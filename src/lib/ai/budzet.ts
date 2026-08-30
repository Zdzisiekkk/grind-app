/**
 * Miesięczny budżet na AI - strona aplikacji.
 *
 * Dzienny licznik z 0016 liczy wywołania. To nie to samo co pieniądze: pytanie
 * do trenera kosztuje około 3 groszy, ułożenie planu bywa trzydzieści razy
 * droższe. Tutaj liczą się kwoty.
 *
 * Kolejność jest zawsze ta sama i wynika z tego, że koszt znany jest DOPIERO
 * PO wywołaniu:
 *
 *   1. `rezerwuj()`  - przed wywołaniem, na pesymistyczną kwotę,
 *   2. `rozlicz()`   - po udanym wywołaniu, na kwotę policzoną z `usage`,
 *   3. `zwolnij()`   - po nieudanym, żeby nie płacić za brak odpowiedzi.
 *
 * Sam próg pilnuje baza (migracja 0043). Ten plik go nie zna i nie może
 * przekłamać - od niego zależy tylko to, czy odmowa wygląda po ludzku.
 */
import { NextResponse } from "next/server";
import { kosztUSD, zalogujKoszt } from "./koszt";
import type { AiBudzetStan } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";

type Klient = Awaited<ReturnType<typeof createClient>>;

/**
 * Co obciąża budżet.
 *
 * Skan wyglądu jest zapisywany, ale ma własne twarde limity (odstęp 7 dni,
 * 5 miesięcznie), więc stoi poza wspólną pulą. Opis posiłku wchodzi do puli:
 * nie ma żadnego naturalnego sufitu, a przy kilku posiłkach dziennie to
 * najczęściej używana funkcja AI w aplikacji.
 */
export type KategoriaAI = "trener" | "plan" | "wyglad" | "jedzenie";

type Uzycie = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

const zl = (kwota: number) => `${kwota.toFixed(2).replace(".", ",")} zł`;

/** "1 września" - dzień, w którym budżet się odnowi. */
function dzienOdnowy(iso: string | undefined): string {
  if (!iso) return "pierwszego dnia przyszłego miesiąca";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "pierwszego dnia przyszłego miesiąca";
  return data.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  });
}

/**
 * Rezerwacja przed wywołaniem modelu.
 *
 * Przy odmowie zwraca gotową odpowiedź HTTP zamiast rzucać wyjątkiem - trasa
 * ma ją tylko oddać. Komunikat podaje kwotę i datę odnowienia, bo "limit
 * wyczerpany" bez tych dwóch liczb nie mówi człowiekowi nic, czego mógłby użyć.
 */
export async function rezerwuj(
  supabase: Klient,
  kategoria: KategoriaAI,
): Promise<{ ok: true; id: string } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabase.rpc("ai_koszt_rezerwuj", { p_kategoria: kategoria });

  if (error || !data) {
    // Baza nie odpowiedziała. Przepuszczenie wywołania znaczyłoby, że awaria
    // licznika kasuje limit - czyli dokładnie wtedy, kiedy najbardziej trzeba.
    console.error("Budżet AI:", error?.message ?? "brak odpowiedzi");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nie udało się sprawdzić limitu. Spróbuj za chwilę.", code: "budget_check_failed" },
        { status: 503 },
      ),
    };
  }

  if (data.ok) return { ok: true, id: data.id };

  const stan = data.stan;
  const opis = stan
    ? `Miesięczny limit ${zl(Number(stan.limit_pln))} na AI jest wyczerpany ` +
      `(wydane: ${zl(Number(stan.wydano_pln))}). Odnowi się ${dzienOdnowy(stan.odnowa)}.`
    : "Miesięczny limit wydatków na AI jest wyczerpany.";

  return {
    ok: false,
    response: NextResponse.json({ error: opis, code: "budget_limit", stan }, { status: 429 }),
  };
}

/**
 * Wpisanie prawdziwego kosztu po wywołaniu.
 *
 * Wołane także tam, gdzie odpowiedź przyszła, ale jej nie przyjęliśmy (odmowa
 * modelu, zły format) - tokeny zostały wtedy zużyte naprawdę i rachunek za nie
 * przyszedł, więc ukrycie tego byłoby oszukiwaniem własnego licznika.
 */
export async function rozlicz(
  supabase: Klient,
  id: string,
  co: KategoriaAI,
  model: string,
  uzycie: Uzycie,
): Promise<void> {
  zalogujKoszt(co, model, uzycie);

  const { error } = await supabase.rpc("ai_koszt_rozlicz", {
    p_id: id,
    p_model: model,
    // Model spoza cennika daje null i baza zostawia wtedy rezerwację, czyli
    // kwotę zawyżoną. Lepiej policzyć za dużo niż nie policzyć wcale.
    p_koszt_usd: kosztUSD(model, uzycie),
    p_tokeny: {
      we: uzycie.input_tokens ?? 0,
      wy: uzycie.output_tokens ?? 0,
      cache_zapis: uzycie.cache_creation_input_tokens ?? 0,
      cache_odczyt: uzycie.cache_read_input_tokens ?? 0,
    },
  });

  if (error) console.error("Budżet AI (rozliczenie):", error.message);
}

/**
 * Zwolnienie rezerwacji po nieudanym wywołaniu.
 *
 * Model, który zwrócił błąd, nie zwrócił też `usage`. Rachunek za nieotrzymaną
 * odpowiedź byłby karą za naszą awarię, a nie limitem kosztowym.
 */
export async function zwolnij(supabase: Klient, id: string): Promise<void> {
  const { error } = await supabase.rpc("ai_koszt_rozlicz", {
    p_id: id,
    p_model: "",
    p_koszt_usd: 0,
    p_tokeny: {},
  });
  if (error) console.error("Budżet AI (zwolnienie):", error.message);
}

/** Stan dla ekranu. Null, gdy baza nie odpowiedziała - ekran po prostu nic nie pokaże. */
export async function stanBudzetu(supabase: Klient): Promise<AiBudzetStan | null> {
  const { data } = await supabase.rpc("ai_budzet_stan", {});
  return (data as AiBudzetStan | null) ?? null;
}
