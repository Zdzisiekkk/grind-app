import { redirect } from "next/navigation";
import { FinanseScreen } from "@/components/finanse/FinanseScreen";
import { createClient } from "@/lib/supabase/server";
import { OdswiezNotowania } from "@/components/finanse/OdswiezNotowania";
import { poczatekMiesiaca } from "@/lib/finanse";
import type {
  FinanseAnaliza,
  FinanseBilans,
  FinansePodsumowanie,
  FinanseRozliczeniePodglad,
} from "@/lib/database.types";

export const metadata = { title: "Finanse" };

export default async function FinansePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /*
   * Dwa wywołania, które coś zmieniają, przed odczytem: naliczenie rachunków
   * na bieżący miesiąc i domknięcie punktów za minione dni. Oba są
   * idempotentne (klucze unikalne po stronie bazy), więc powtórne wejście na
   * ekran niczego nie dubluje. Alternatywą byłby cron - koszt utrzymania
   * niewspółmierny do zysku przy jednym ekranie.
   */
  await Promise.all([
    supabase.rpc("finanse_nalicz_stale", {}),
    supabase.rpc("finanse_xp_rozlicz", {}),
  ]);

  const [
    { data: podsumowanie },
    { data: bilans },
    { data: analiza },
    { data: pozycje },
    { data: zrodla },
    { data: wplywy },
    { data: stale },
    { data: naliczenia },
    { data: cele },
    { data: ruchy },
    { data: aktywa },
    { data: ostatnieNotowanie },
  ] = await Promise.all([
    // Majątek, poduszka i budżet jednym zapytaniem zamiast czterema -
    // każda z tych liczb potrzebuje innego okna czasu i łączenie ich
    // po stronie klienta znaczyłoby cztery rundy do bazy.
    supabase.rpc("finanse_podsumowanie"),
    supabase.rpc("finanse_bilans", {}),
    supabase.rpc("finanse_analiza", {}),
    // Ze schowanymi włącznie - arkusz pozwala je przywrócić, a karta i tak
    // filtruje. Drugie zapytanie tylko po to byłoby rundą do bazy za nic.
    // Widok, nie tabela: dokłada rezerwację na cele i kwotę naprawdę wolną.
    supabase
      .from("v_finanse_pozycje")
      .select("*")
      .eq("user_id", user.id)
      .order("archiwalna")
      .order("order_index"),
    supabase.from("finanse_zrodla").select("*").eq("user_id", user.id).order("order_index"),
    supabase
      .from("finanse_wplywy")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })
      .limit(30),
    supabase.from("finanse_stale").select("*").eq("user_id", user.id).order("dzien_miesiaca"),
    supabase
      .from("finanse_naliczenia")
      .select("*, finanse_stale (nazwa, kategoria)")
      .eq("user_id", user.id)
      .gte("okres", poczatekMiesiaca())
      .order("termin"),
    // Także zamknięte: cel oznaczony jako osiągnięty musi mieć dokąd trafić,
    // inaczej przycisk "osiągnięty" jest zapadnią, a nie zakończeniem.
    supabase
      .from("v_finanse_cele")
      .select("*")
      .eq("user_id", user.id)
      .order("status")
      .order("order_index")
      .order("created_at"),
    // Jeden dziennik: wydatki i wpłaty na cele obok siebie, chronologicznie.
    supabase
      .from("v_finanse_ruchy")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("v_finanse_aktywa").select("*").eq("user_id", user.id).order("order_index"),
    // Najświeższe notowanie decyduje, czy trzeba ruszać zewnętrzne serwisy.
    supabase
      .from("finanse_notowania")
      .select("updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pods = podsumowanie as FinansePodsumowanie;

  // Podgląd rozliczenia ma sens tylko wtedy, gdy jest co rozliczać.
  const { data: rozliczenie } = pods?.rozliczenie_okres
    ? await supabase.rpc("finanse_rozliczenie_podglad", { p_okres: pods.rozliczenie_okres })
    : { data: null };

  /*
   * "Nieaktualne" znaczy: z innego dnia niż dziś. Nie "starsze niż 24 godziny" -
   * notowanie z wczorajszego zamknięcia jest aktualne przez cały dzisiejszy
   * poranek, a odmierzanie dób od losowej godziny kazałoby pobierać ceny
   * w środku nocy bez żadnego zysku.
   */
  const notowaniaNieaktualne =
    (aktywa ?? []).some((a) => a.notowanie_symbol) &&
    (!ostatnieNotowanie?.updated_at ||
      ostatnieNotowanie.updated_at.slice(0, 10) < new Date().toISOString().slice(0, 10));

  return (
    <>
      <OdswiezNotowania nieaktualne={notowaniaNieaktualne} />
      <FinanseScreen
      userId={user.id}
      podsumowanie={pods}
      bilans={bilans as FinanseBilans}
      analiza={analiza as FinanseAnaliza}
      pozycje={pozycje ?? []}
      zrodla={zrodla ?? []}
      wplywy={wplywy ?? []}
      stale={stale ?? []}
      naliczenia={(naliczenia ?? []) as never}
      rozliczenie={rozliczenie as FinanseRozliczeniePodglad | null}
      cele={cele ?? []}
      ruchy={ruchy ?? []}
      aktywa={aktywa ?? []}
      />
    </>
  );
}
