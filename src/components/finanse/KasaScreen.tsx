"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { humanDate, todayISO } from "@/lib/format";
import {
  KATEGORIE_WYDATKOW,
  dziennieDoKonca,
  kategoriaWydatku,
  poduszkaProcent,
  stanPoduszki,
  zl,
  zmiana,
} from "@/lib/finanse";
import type {
  FinanseCelZPostepem,
  FinansePodsumowanie,
  FinanseWydatek,
} from "@/lib/database.types";

/**
 * Kasa - finansowa strona "lock inu".
 *
 * Kolejność kart nie jest przypadkowa i odpowiada temu, jak często pytanie
 * naprawdę pada: najpierw ile mam zapasu (poduszka), potem ile zostało do
 * końca miesiąca (budżet), potem czy majątek rośnie (trend), a cele na końcu,
 * bo to jedyna rzecz, którą ogląda się raz na kilka dni, a nie codziennie.
 */

type Arkusz = "stan" | "wydatek" | "cel" | "wplata" | null;

export function KasaScreen({
  userId,
  podsumowanie,
  cele,
  wydatki,
}: {
  userId: string;
  podsumowanie: FinansePodsumowanie;
  cele: FinanseCelZPostepem[];
  /** Ostatnie wydatki - lista, nie statystyka. */
  wydatki: FinanseWydatek[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = todayISO();

  const [arkusz, setArkusz] = useState<Arkusz>(null);
  const [celDoWplaty, setCelDoWplaty] = useState<FinanseCelZPostepem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Migawka majątku
  const [stan, setStan] = useState({ plynne: "", inwestycje: "", inne: "", dlugi: "" });
  // Wydatek
  const [wydatek, setWydatek] = useState({ kwota: "", kategoria: "jedzenie", opis: "" });
  // Cel
  const [cel, setCel] = useState({ nazwa: "", ikona: "🎯", kwota_cel: "", termin: "" });
  const [wplata, setWplata] = useState("");

  const liczba = (t: string) => {
    // Ludzie wpisują przecinek, bo tak wygląda kwota po polsku.
    const n = Number(t.replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // PromiseLike, nie Promise: builder Supabase jest "thenable" i dopiero
  // await zamienia go w wynik - typowanie na Promise odrzucałoby wywołania
  // bez sztucznego owijania każdego w async.
  async function zapisz(co: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error } = await co();
    setBusy(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setArkusz(null);
    router.refresh();
  }

  const poduszka = podsumowanie.poduszka_miesiecy;
  const ocena = stanPoduszki(poduszka);
  const procentPoduszki = poduszkaProcent(poduszka, podsumowanie.poduszka_cel);
  const naDzien = dziennieDoKonca(podsumowanie.budzet_zostalo);
  const przekroczony = (podsumowanie.budzet_zostalo ?? 0) < 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Kasa</h1>
          <p className="text-[13px] text-muted">
            Zapas, budżet i majątek. Bez księgowania każdej kawy.
          </p>
        </div>
        <Button variant="primary" onClick={() => setArkusz("wydatek")}>
          + Wydatek
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* --- Poduszka: najważniejsza liczba w całym module --- */}
      <Card
        title="Poduszka finansowa"
        subtitle="Ile miesięcy wytrzymasz bez przychodu"
        action={<Chip tone={ocena.tone === "danger" ? "danger" : ocena.tone === "warn" ? "warn" : ocena.tone === "success" ? "success" : "accent"}>{ocena.label}</Chip>}
      >
        {poduszka == null ? (
          <EmptyState
            icon="🛟"
            title="Brakuje jednej liczby"
            description="Podaj w profilu swoje miesięczne koszty życia, a policzymy, na ile miesięcy starczy Ci to, co masz płynne."
          />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold leading-none tabular-nums">
                {poduszka.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[15px] text-muted">
                z {podsumowanie.poduszka_cel} miesięcy
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${procentPoduszki ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-faint">
              Liczone z {zl(podsumowanie.plynne)} płynnych przy kosztach{" "}
              {zl(podsumowanie.koszty_miesieczne)} na miesiąc. Inwestycje nie wchodzą - nie
              sprzedaje się ich w dniu, w którym psuje się pralka.
            </p>
          </>
        )}
      </Card>

      {/* --- Budżet uznaniowy --- */}
      {podsumowanie.budzet != null && (
        <Card
          title="Budżet na ten miesiąc"
          subtitle="Wydatki uznaniowe - to, o czym realnie decydujesz"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`text-[26px] font-bold tabular-nums ${przekroczony ? "text-danger" : ""}`}
            >
              {zl(podsumowanie.budzet_zostalo)}
            </span>
            <span className="text-[13px] text-muted">
              z {zl(podsumowanie.budzet)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-[width] ${przekroczony ? "bg-danger" : "bg-success"}`}
              style={{
                width: `${Math.min(100, Math.round((podsumowanie.wydane_w_miesiacu / (podsumowanie.budzet || 1)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[12px] text-faint">
            {przekroczony
              ? `Przekroczone o ${zl(Math.abs(podsumowanie.budzet_zostalo ?? 0))}. Nie jest to koniec świata - jest to informacja.`
              : `Zostało ${zl(naDzien)} na dzień do końca miesiąca.`}
          </p>
        </Card>
      )}

      {/* --- Majątek --- */}
      <Card
        title="Majątek"
        subtitle={
          podsumowanie.data_migawki
            ? `Ostatni wpis: ${humanDate(podsumowanie.data_migawki)}`
            : "Jeszcze nic nie zapisano"
        }
        action={
          <Button variant="secondary" onClick={() => setArkusz("stan")}>
            Zapisz stan
          </Button>
        }
      >
        {podsumowanie.netto == null ? (
          <EmptyState
            icon="📊"
            title="Zrób pierwszą migawkę"
            description="Raz na tydzień albo miesiąc wpisz, ile masz na koncie, w inwestycjach i ile wisisz. Liczy się trend, nie dokładność co do złotówki."
          />
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-[28px] font-bold tabular-nums">{zl(podsumowanie.netto)}</span>
              {podsumowanie.zmiana_30d != null && (
                <Chip tone={podsumowanie.zmiana_30d >= 0 ? "success" : "danger"}>
                  {zmiana(podsumowanie.zmiana_30d)} / 30 dni
                </Chip>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
              <div>
                <div className="text-faint">Płynne</div>
                <div className="font-semibold tabular-nums">{zl(podsumowanie.plynne)}</div>
              </div>
              <div>
                <div className="text-faint">Inwestycje</div>
                <div className="font-semibold tabular-nums">{zl(podsumowanie.inwestycje)}</div>
              </div>
              <div>
                <div className="text-faint">Długi</div>
                <div className="font-semibold tabular-nums text-danger">
                  {zl(podsumowanie.dlugi)}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* --- Cele --- */}
      <Card
        title="Cele"
        subtitle="Na co odkładasz"
        action={
          <Button variant="secondary" onClick={() => setArkusz("cel")}>
            + Cel
          </Button>
        }
        padded={cele.length === 0}
      >
        {cele.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Brak celów"
            description="Konkretna kwota z nazwą odkłada się lepiej niż ogólne postanowienie, że warto oszczędzać."
          />
        ) : (
          <ul className="divide-y divide-border">
            {cele.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-[20px]" aria-hidden>
                    {c.ikona}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-medium">{c.nazwa}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">
                        {zl(c.zebrane)} / {zl(c.kwota_cel)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${c.procent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px] text-faint">
                      <span>
                        {c.procent}%
                        {c.termin ? ` · do ${humanDate(c.termin)}` : ""}
                      </span>
                      <button
                        type="button"
                        className="font-medium text-accent"
                        onClick={() => {
                          setCelDoWplaty(c);
                          setWplata("");
                          setArkusz("wplata");
                        }}
                      >
                        + wpłata
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --- Ostatnie wydatki --- */}
      {wydatki.length > 0 && (
        <Card title="Ostatnie wydatki" padded={false}>
          <ul className="divide-y divide-border">
            {wydatki.map((w) => {
              const k = kategoriaWydatku(w.kategoria);
              return (
                <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[16px]" aria-hidden>
                    {k.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{w.opis || k.label}</span>
                    <span className="block text-[12px] text-faint">
                      {w.data === today ? "dziś" : humanDate(w.data)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                    {zl(w.kwota, true)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ----------------------------- Arkusze ----------------------------- */}

      <Sheet open={arkusz === "wydatek"} onClose={() => setArkusz(null)} title="Wydatek">
        <div className="flex flex-col gap-3">
          <Field label="Kwota (zł)">
            <Input
              inputMode="decimal"
              value={wydatek.kwota}
              onChange={(e) => setWydatek({ ...wydatek, kwota: e.target.value })}
              placeholder="49,90"
              autoFocus
            />
          </Field>
          <Field label="Na co">
            <Select
              value={wydatek.kategoria}
              onChange={(e) => setWydatek({ ...wydatek, kategoria: e.target.value })}
            >
              {KATEGORIE_WYDATKOW.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.icon} {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Opis (opcjonalnie)">
            <Input
              value={wydatek.opis}
              onChange={(e) => setWydatek({ ...wydatek, opis: e.target.value })}
              placeholder="np. obiad z Kubą"
            />
          </Field>
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={liczba(wydatek.kwota) <= 0}
            onClick={() =>
              zapisz(async () => {
                const res = await supabase.from("finanse_wydatki").insert({
                  user_id: userId,
                  kwota: liczba(wydatek.kwota),
                  kategoria: wydatek.kategoria as FinanseWydatek["kategoria"],
                  opis: wydatek.opis.trim() || null,
                });
                if (!res.error) setWydatek({ kwota: "", kategoria: wydatek.kategoria, opis: "" });
                return res;
              })
            }
          >
            Zapisz wydatek
          </Button>
        </div>
      </Sheet>

      <Sheet open={arkusz === "stan"} onClose={() => setArkusz(null)} title="Stan majątku">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Wpisz okrągłe kwoty - liczy się kierunek, nie grosze. Drugi wpis tego samego dnia
            nadpisuje poprzedni.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Płynne (konto, gotówka)">
              <Input
                inputMode="decimal"
                value={stan.plynne}
                onChange={(e) => setStan({ ...stan, plynne: e.target.value })}
                placeholder="12000"
              />
            </Field>
            <Field label="Inwestycje">
              <Input
                inputMode="decimal"
                value={stan.inwestycje}
                onChange={(e) => setStan({ ...stan, inwestycje: e.target.value })}
                placeholder="8000"
              />
            </Field>
            <Field label="Inne (sprzęt, auto)">
              <Input
                inputMode="decimal"
                value={stan.inne}
                onChange={(e) => setStan({ ...stan, inne: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Długi">
              <Input
                inputMode="decimal"
                value={stan.dlugi}
                onChange={(e) => setStan({ ...stan, dlugi: e.target.value })}
                placeholder="0"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            block
            loading={busy}
            onClick={() =>
              zapisz(() =>
                supabase.from("finanse_stan").upsert(
                  {
                    user_id: userId,
                    data: today,
                    plynne: liczba(stan.plynne),
                    inwestycje: liczba(stan.inwestycje),
                    inne: liczba(stan.inne),
                    dlugi: liczba(stan.dlugi),
                  },
                  { onConflict: "user_id,data" },
                ),
              )
            }
          >
            Zapisz migawkę
          </Button>
        </div>
      </Sheet>

      <Sheet open={arkusz === "cel"} onClose={() => setArkusz(null)} title="Nowy cel">
        <div className="flex flex-col gap-3">
          <Field label="Na co odkładasz">
            <Input
              value={cel.nazwa}
              onChange={(e) => setCel({ ...cel, nazwa: e.target.value })}
              placeholder="np. Wyjazd na Sycylię"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kwota (zł)">
              <Input
                inputMode="decimal"
                value={cel.kwota_cel}
                onChange={(e) => setCel({ ...cel, kwota_cel: e.target.value })}
                placeholder="8000"
              />
            </Field>
            <Field label="Termin (opcjonalnie)">
              <Input
                type="date"
                value={cel.termin}
                onChange={(e) => setCel({ ...cel, termin: e.target.value })}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={!cel.nazwa.trim() || liczba(cel.kwota_cel) <= 0}
            onClick={() =>
              zapisz(async () => {
                const res = await supabase.from("finanse_cele").insert({
                  user_id: userId,
                  nazwa: cel.nazwa.trim(),
                  ikona: cel.ikona,
                  kwota_cel: liczba(cel.kwota_cel),
                  termin: cel.termin || null,
                });
                if (!res.error) setCel({ nazwa: "", ikona: "🎯", kwota_cel: "", termin: "" });
                return res;
              })
            }
          >
            Dodaj cel
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={arkusz === "wplata"}
        onClose={() => setArkusz(null)}
        title={celDoWplaty ? `Wpłata: ${celDoWplaty.nazwa}` : "Wpłata"}
      >
        <div className="flex flex-col gap-3">
          {celDoWplaty && (
            <p className="text-[13px] text-muted">
              Zebrane {zl(celDoWplaty.zebrane)} z {zl(celDoWplaty.kwota_cel)}. Brakuje{" "}
              {zl(celDoWplaty.zostalo)}.
            </p>
          )}
          <Field label="Kwota (zł)" hint="Ujemna kwota to wypłata z celu.">
            <Input
              inputMode="decimal"
              value={wplata}
              onChange={(e) => setWplata(e.target.value)}
              placeholder="500"
              autoFocus
            />
          </Field>
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={liczba(wplata) === 0 || !celDoWplaty}
            onClick={() =>
              zapisz(() =>
                supabase.from("finanse_wplaty").insert({
                  user_id: userId,
                  cel_id: celDoWplaty!.id,
                  kwota: liczba(wplata),
                }),
              )
            }
          >
            Zapisz wpłatę
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
