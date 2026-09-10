import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip, Stat } from "@/components/ui";
import { Skrzynka } from "@/components/admin/Skrzynka";
import { createClient } from "@/lib/supabase/server";
import { humanDate } from "@/lib/format";
import type {
  AdminStatystyki,
  AdminUzycie,
  AdminUzytkownik,
  Zgloszenie,
  ZgloszenieOdpowiedz,
} from "@/lib/database.types";

export const metadata = { title: "Panel" };

/**
 * Panel administratora.
 *
 * Bramka stoi w BAZIE - funkcje admin_* same sprawdzają uprawnienia i wybuchają
 * bez nich. `notFound()` tutaj jest tylko po to, żeby ekran wyglądał sensownie:
 * ukrywanie linku nigdy nie było zabezpieczeniem, a sam adres /admin zgadnie
 * każdy.
 *
 * Świadoma granica: to jest panel o UŻYCIU aplikacji, nie podgląd cudzych
 * dzienników. Widać, kto się zarejestrował, czy płaci i kiedy ostatnio coś
 * zapisał - nie widać, co zapisał. Do prowadzenia produktu potrzebne są
 * liczby, a nie czyjeś posiłki, waga czy finanse.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") notFound();

  const [
    { data: statystyki },
    { data: uzycie },
    { data: uzytkownicy },
    { data: zgloszenia },
    { data: odpowiedzi },
  ] = await Promise.all([
    supabase.rpc("admin_statystyki"),
    supabase.rpc("admin_uzycie", { p_dni: 30 }),
    supabase.rpc("admin_uzytkownicy", { p_limit: 100 }),
    supabase.from("zgloszenia").select("*").order("created_at", { ascending: false }),
    supabase.from("zgloszenia_odpowiedzi").select("*").order("created_at"),
  ]);

  const s = statystyki as AdminStatystyki | null;
  const dni = (uzycie ?? []) as AdminUzycie[];
  const konta = (uzytkownicy ?? []) as AdminUzytkownik[];
  const maks = Math.max(1, ...dni.map((d) => d.aktywni));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Panel</h1>
          <p className="text-[13px] text-muted">Użycie aplikacji, konta i zgłoszenia</p>
        </div>
        <Chip tone="accent">administrator</Chip>
      </header>

      {!s ? (
        <Card title="Brak danych">
          <p className="text-[13px] text-muted">
            Statystyki nie wróciły z bazy. Sprawdź, czy migracja 0076 została zastosowana.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Ludzie" subtitle="Konta i aktywność">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Konta" value={String(s.kont)} />
              <Stat label="Aktywni 7 dni" value={String(s.aktywni_7d)} />
              <Stat label="Dziś" value={String(s.aktywni_1d)} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
              <div>
                <div className="text-faint">Nowi 7 dni</div>
                <div className="font-semibold tabular-nums">{s.nowe_7d}</div>
              </div>
              <div>
                <div className="text-faint">Nowi 30 dni</div>
                <div className="font-semibold tabular-nums">{s.nowe_30d}</div>
              </div>
              <div>
                <div className="text-faint">Po kreatorze</div>
                <div className="font-semibold tabular-nums">
                  {s.ukonczyli_start}
                  <span className="text-faint">
                    {" "}
                    / {s.kont}
                  </span>
                </div>
              </div>
            </div>
            {/*
              Aktywni miesięcznie kontra konta - jedyna liczba, która mówi,
              czy produkt żyje. Reszta rośnie sama z upływem czasu.
            */}
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-faint">
              Aktywni w 30 dni: <strong className="text-text">{s.aktywni_30d}</strong> z {s.kont}{" "}
              {s.kont > 0 && `(${Math.round((s.aktywni_30d / s.kont) * 100)}%)`}. Aktywny znaczy:
              cokolwiek zapisał, a nie samo otwarcie aplikacji.
            </p>
          </Card>

          <Card title="Ostatnie 30 dni" subtitle="Aktywni dziennie">
            {/*
              Wykres jako czyste divy, bez biblioteki: trzydzieści słupków nie
              jest wart dodatkowego pakietu w przeglądarce administratora.
            */}
            <div className="flex h-24 items-end gap-[2px]">
              {dni.map((d) => (
                <div
                  key={d.dzien}
                  title={`${d.dzien}: ${d.aktywni} aktywnych, ${d.rejestracje} rejestracji`}
                  className="flex-1 rounded-t bg-accent/80"
                  style={{ height: `${Math.max(2, (d.aktywni / maks) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-faint">
              <span>{dni[0] ? humanDate(dni[0].dzien) : ""}</span>
              <span>szczyt: {maks}</span>
              <span>dziś</span>
            </div>
          </Card>

          <Card title="Pieniądze" subtitle="Subskrypcje i koszty">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Płacących" value={String(s.subskrypcje.aktywne)} />
              <Stat label="Starter" value={String(s.subskrypcje.starter)} />
              <Stat label="Pro" value={String(s.subskrypcje.pro)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <div>
                <div className="text-faint">Okresy próbne</div>
                <div className="font-semibold tabular-nums">{s.subskrypcje.probne}</div>
              </div>
              <div>
                <div className="text-faint">Rezygnacje na koniec</div>
                <div className="font-semibold tabular-nums text-danger">
                  {s.subskrypcje.anulowane_na_koniec}
                </div>
              </div>
              <div>
                <div className="text-faint">Dostępy bonusowe</div>
                <div className="font-semibold tabular-nums">{s.bonusy_aktywne}</div>
              </div>
              <div>
                <div className="text-faint">AI, 30 dni</div>
                <div className="font-semibold tabular-nums">
                  {Number(s.ai.koszt_30d_usd).toFixed(2)} USD
                </div>
                <div className="text-[11px] text-faint">{s.ai.wywolan_30d} wywołań</div>
              </div>
            </div>
          </Card>

          <Card title="Co się dzieje w aplikacji" subtitle="Wpisy z ostatnich 7 dni">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Treningi" value={String(s.wpisy_7d.treningi)} />
              <Stat label="Posiłki" value={String(s.wpisy_7d.posilki)} />
              <Stat label="Wydatki" value={String(s.wpisy_7d.wydatki)} />
            </div>
          </Card>
        </>
      )}

      <Skrzynka
        adminId={user.id}
        zgloszenia={(zgloszenia ?? []) as Zgloszenie[]}
        odpowiedzi={(odpowiedzi ?? []) as ZgloszenieOdpowiedz[]}
      />

      <Card title="Konta" subtitle={`${konta.length} najnowszych`} padded={false}>
        <ul className="divide-y divide-border">
          {konta.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  {k.display_name || k.email || "bez nazwy"}
                </span>
                <span className="block text-[12px] text-faint">
                  {k.ostatnia_aktywnosc
                    ? `ostatnio ${humanDate(k.ostatnia_aktywnosc)}`
                    : "nic nie zapisał"}
                  {" · "}
                  {k.dni_aktywnych} {k.dni_aktywnych === 1 ? "dzień" : "dni"} · {k.xp} XP
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {k.role === "admin" && <Chip tone="accent">admin</Chip>}
                {k.plan_poziom >= 2 ? (
                  <Chip tone="success">Pro</Chip>
                ) : k.plan_poziom === 1 ? (
                  <Chip tone="info">Starter</Chip>
                ) : (
                  <Chip>darmowy</Chip>
                )}
                {!k.onboarded && <Chip tone="warn">bez kreatora</Chip>}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 pb-3 pt-2 text-[12px] leading-snug text-faint">
          Metadane kont: kiedy założone, jaki plan, kiedy ostatnia aktywność. Treści dziennika -
          wagi, posiłków, snu, kontuzji ani finansów - nie widać stąd i nie da się ich stąd
          zobaczyć; blokuje to baza, nie ten ekran.
        </p>
      </Card>

      <p className="px-1 text-[12px] text-faint">
        <Link className="underline" href="/pomoc">
          Wróć do Pomocy
        </Link>
      </p>
    </div>
  );
}
