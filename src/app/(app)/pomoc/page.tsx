import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Zgloszenia } from "@/components/pomoc/Zgloszenia";
import { createClient } from "@/lib/supabase/server";
import { KROKI_SAMOUCZKA } from "@/lib/samouczek";
import { wlaczSamouczek } from "./actions";

export const metadata = { title: "Pomoc" };

/**
 * Pomoc: jedno miejsce na trzy rzeczy, których człowiek szuka w panice -
 * jak to działa, co z moimi danymi i do kogo napisać.
 *
 * Dokumentów nie przepisujemy tutaj drugi raz. Regulamin i polityka
 * prywatności mają własne adresy, bo trzeba je dać komuś linkiem także wtedy,
 * gdy nie jest zalogowany - a dwie kopie tego samego tekstu zawsze kończą się
 * jedną nieaktualną.
 */
export default async function PomocPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: zgloszenia }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("zgloszenia")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Odpowiedzi jednym zapytaniem zamiast po jednym na wątek - RLS i tak
  // przepuści wyłącznie te z własnych zgłoszeń.
  const { data: odpowiedzi } = await supabase
    .from("zgloszenia_odpowiedzi")
    .select("*")
    .order("created_at");

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold leading-tight">Pomoc</h1>
        <p className="text-[13px] text-muted">
          Samouczek, dokumenty i kontakt, gdy coś nie działa.
        </p>
      </header>

      {profile?.role === "admin" && (
        <Card title="Panel administratora" subtitle="Statystyki, konta i skrzynka zgłoszeń">
          <Link href="/admin" className="block">
            <Button variant="primary" block>
              Otwórz panel
            </Button>
          </Link>
        </Card>
      )}

      <Card
        title="Samouczek"
        subtitle={`${KROKI_SAMOUCZKA.length} ekranów o tym, po co jest która zakładka`}
      >
        <p className="text-[13px] text-muted">
          Pokazuje się raz, przy pierwszym wejściu. Możesz go włączyć ponownie w każdej chwili -
          uruchomi się przy następnym ekranie.
        </p>
        <form action={wlaczSamouczek} className="mt-3">
          <Button type="submit" variant="secondary" block>
            Przejdź samouczek jeszcze raz
          </Button>
        </form>
      </Card>

      <Zgloszenia
        userId={user.id}
        zgloszenia={zgloszenia ?? []}
        odpowiedzi={odpowiedzi ?? []}
        // Commit z Vercela, gdy nikt nie ustawił wersji ręcznie. Zgłoszenie
        // z "dev" nie mówiło, na której wersji kodu ktoś trafił na błąd.
        wersja={
          process.env.NEXT_PUBLIC_WERSJA ??
          process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
          "dev"
        }
      />

      <Card title="Dokumenty" subtitle="Zasady, prywatność i ciasteczka" padded={false}>
        <ul className="divide-y divide-border">
          <li>
            <Link
              href="/regulamin"
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-[18px]" aria-hidden>
                📜
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Regulamin</span>
                <span className="block text-[12px] text-faint">
                  Zasady korzystania, płatności i odstąpienia
                </span>
              </span>
              <span className="text-faint" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/prywatnosc"
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-[18px]" aria-hidden>
                🔒
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Polityka prywatności</span>
                <span className="block text-[12px] text-faint">
                  Jakie dane zbieramy, po co i komu je powierzamy
                </span>
              </span>
              <span className="text-faint" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/prywatnosc#ciasteczka"
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-[18px]" aria-hidden>
                🍪
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Ciasteczka</span>
                <span className="block text-[12px] text-faint">
                  Tylko niezbędne do logowania - stąd brak okienka ze zgodą
                </span>
              </span>
              <span className="text-faint" aria-hidden>
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/profil"
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-[18px]" aria-hidden>
                📦
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Twoje dane (RODO)</span>
                <span className="block text-[12px] text-faint">
                  Pobranie kopii wszystkiego i skasowanie konta - w Profilu
                </span>
              </span>
              <span className="text-faint" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        </ul>
      </Card>

      <Card title="Zanim zgłosisz błąd">
        <ul className="flex flex-col gap-2 text-[13px] text-muted">
          <li>
            <strong className="text-text">Aplikacja działa offline w ograniczonym zakresie.</strong>{" "}
            Bez internetu część ekranów pokaże ostatnie znane dane, a zapisy poczekają na
            połączenie.
          </li>
          <li>
            <strong className="text-text">Powiadomienia wymagają zgody przeglądarki.</strong> Jeśli
            nie przychodzą, sprawdź ustawienia w Profilu i uprawnienia strony w telefonie.
          </li>
          <li>
            <strong className="text-text">Funkcje z AI mają limity.</strong> Dzienne i miesięczne -
            po ich wyczerpaniu wracają następnego dnia albo pierwszego dnia miesiąca.
          </li>
        </ul>
      </Card>
    </div>
  );
}
