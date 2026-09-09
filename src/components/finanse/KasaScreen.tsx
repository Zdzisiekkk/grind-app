"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { humanDate, todayISO } from "@/lib/format";
import {
  KATEGORIE_WYDATKOW,
  KOSZYKI_MAJATKU,
  RODZAJE_MAJATKU,
  dziennieDoKonca,
  kategoriaWydatku,
  koszykRodzaju,
  poduszkaProcent,
  rodzajMajatku,
  stanPoduszki,
  sumyKoszykow,
  zl,
  zmiana,
} from "@/lib/finanse";
import type {
  FinanseCelZPostepem,
  FinansePodsumowanie,
  FinansePozycja,
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

/**
 * Pozycja w trakcie edycji.
 *
 * Kwota jako tekst, nie liczba: między "12" a "12000" przechodzi się przez
 * stany, których nie da się sensownie trzymać jako number - a każde
 * przepuszczenie przez parseFloat kasowałoby przecinek pod palcem.
 */
type Wiersz = {
  id: string;
  nazwa: string;
  rodzaj: string;
  kwota: string;
  archiwalna: boolean;
  /** Nowy wiersz kasuje się na miejscu; istniejący trzeba usunąć z bazy. */
  nowy: boolean;
};

const doWierszy = (ps: FinansePozycja[]): Wiersz[] =>
  ps.map((p) => ({
    id: p.id,
    nazwa: p.nazwa,
    rodzaj: p.rodzaj,
    kwota: Number(p.kwota) ? String(Number(p.kwota)) : "",
    archiwalna: p.archiwalna,
    nowy: false,
  }));

export function KasaScreen({
  userId,
  podsumowanie,
  pozycje,
  cele,
  wydatki,
}: {
  userId: string;
  podsumowanie: FinansePodsumowanie;
  /** Pozycje majątku razem ze schowanymi - arkusz pozwala je przywrócić. */
  pozycje: FinansePozycja[];
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
  const [wiersze, setWiersze] = useState<Wiersz[]>(() => doWierszy(pozycje));
  const [usuniete, setUsuniete] = useState<string[]>([]);
  /** Który koszyk ma rozwiniętą listę podpowiedzi; null = żaden. */
  const [podpowiedziDla, setPodpowiedziDla] = useState<string | null>(null);
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

  /** Otwarcie arkusza zawsze startuje od tego, co jest w bazie. */
  function otworzMajatek() {
    setWiersze(doWierszy(pozycje));
    setUsuniete([]);
    setPodpowiedziDla(null);
    setError(null);
    setArkusz("stan");
  }

  function dodajPozycje(rodzaj: string) {
    const wzor = rodzajMajatku(rodzaj);
    // Unikalna nazwa jest wymuszona w bazie, więc drugie "Konto osobiste"
    // odbiłoby się błędem z bazy zamiast po prostu powstać.
    const zajete = new Set(wiersze.map((w) => w.nazwa.trim().toLowerCase()));
    let nazwa = wzor.label;
    for (let i = 2; zajete.has(nazwa.toLowerCase()); i++) nazwa = `${wzor.label} ${i}`;
    setWiersze((ws) => [
      ...ws,
      { id: crypto.randomUUID(), nazwa, rodzaj, kwota: "", archiwalna: false, nowy: true },
    ]);
    setPodpowiedziDla(null);
  }

  function zmienWiersz(id: string, zmiany: Partial<Wiersz>) {
    setWiersze((ws) => ws.map((w) => (w.id === id ? { ...w, ...zmiany } : w)));
  }

  function schowajWiersz(w: Wiersz) {
    // Nowy wiersz nie zdążył nigdzie trafić, więc znika bez śladu.
    // Istniejący tylko chowamy - skasowanie zabrałoby wiedzę, że coś takiego było.
    if (w.nowy) setWiersze((ws) => ws.filter((x) => x.id !== w.id));
    else zmienWiersz(w.id, { archiwalna: true });
  }

  const aktywne = wiersze.filter((w) => !w.archiwalna);
  const schowane = wiersze.filter((w) => w.archiwalna);
  const podglad = sumyKoszykow(
    aktywne.map((w) => ({
      kategoria: koszykRodzaju(w.rodzaj) ?? "inne",
      kwota: liczba(w.kwota),
    })),
  );

  async function zapiszMajatek() {
    const nazwy = aktywne.map((w) => w.nazwa.trim().toLowerCase());
    if (nazwy.some((n) => !n)) {
      setError("Każda pozycja potrzebuje nazwy.");
      return;
    }
    if (new Set(nazwy).size !== nazwy.length) {
      setError("Dwie pozycje mają tę samą nazwę - zmień jedną z nich.");
      return;
    }

    await zapisz(async () => {
      if (usuniete.length) {
        const res = await supabase.from("finanse_pozycje").delete().in("id", usuniete);
        if (res.error) return res;
      }
      const res = await supabase.from("finanse_pozycje").upsert(
        wiersze.map((w, i) => ({
          id: w.id,
          user_id: userId,
          nazwa: w.nazwa.trim(),
          rodzaj: w.rodzaj,
          kwota: liczba(w.kwota),
          archiwalna: w.archiwalna,
          order_index: i,
        })),
      );
      if (res.error) return res;
      // Sumy liczy baza - podgląd nad przyciskiem jest tylko podglądem.
      return supabase.rpc("finanse_zapisz_migawke", { p_data: today });
    });
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
          <Button variant="secondary" onClick={otworzMajatek}>
            {pozycje.length ? "Zapisz stan" : "Opisz majątek"}
          </Button>
        }
      >
        {podsumowanie.netto == null ? (
          <EmptyState
            icon="📊"
            title="Zrób pierwszą migawkę"
            description="Wypisz raz, co masz i ile wisisz - konta, inwestycje, kredyty. Potem raz na tydzień albo miesiąc tylko poprawiasz kwoty. Liczy się trend, nie dokładność co do złotówki."
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
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
              <div>
                <div className="text-faint">Płynne</div>
                <div className="font-semibold tabular-nums">{zl(podsumowanie.plynne)}</div>
              </div>
              <div>
                <div className="text-faint">Inwestycje</div>
                <div className="font-semibold tabular-nums">{zl(podsumowanie.inwestycje)}</div>
              </div>
              <div>
                <div className="text-faint">Rzeczy</div>
                <div className="font-semibold tabular-nums">{zl(podsumowanie.inne)}</div>
              </div>
              <div>
                <div className="text-faint">Długi</div>
                <div className="font-semibold tabular-nums text-danger">
                  {zl(podsumowanie.dlugi)}
                </div>
              </div>
            </div>

            {/*
              Rozbicie pod sumą, bo pierwsze pytanie po zobaczeniu majątku brzmi
              "co się na to składa" - a nikt nie pamięta własnej sumy z głowy.
            */}
            {pozycje.some((p) => !p.archiwalna) && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
                {pozycje
                  .filter((p) => !p.archiwalna && Number(p.kwota) > 0)
                  .sort((a, b) => Number(b.kwota) - Number(a.kwota))
                  .slice(0, 6)
                  .map((p) => (
                    <li key={p.id} className="flex items-baseline gap-2">
                      <span aria-hidden>{rodzajMajatku(p.rodzaj).icon}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{p.nazwa}</span>
                      <span
                        className={`shrink-0 tabular-nums ${p.kategoria === "dlugi" ? "text-danger" : ""}`}
                      >
                        {p.kategoria === "dlugi" ? "-" : ""}
                        {zl(Number(p.kwota))}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
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

      <Sheet
        open={arkusz === "stan"}
        onClose={() => setArkusz(null)}
        title="Stan majątku"
        footer={
          <>
            <div className="mb-3 flex items-baseline justify-between text-[14px]">
              <span className="text-muted">Majątek netto</span>
              <span className="text-[18px] font-bold tabular-nums">{zl(podglad.netto)}</span>
            </div>
            <Button
              variant="primary"
              block
              loading={busy}
              disabled={aktywne.length === 0}
              onClick={zapiszMajatek}
            >
              Zapisz migawkę
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-[13px] text-muted">
            Wypisz, co masz i ile wisisz. Okrągłe kwoty wystarczą - liczy się kierunek, nie
            grosze. Następnym razem tylko poprawisz liczby.
          </p>

          {KOSZYKI_MAJATKU.map((k) => {
            const wKoszyku = aktywne.filter((w) => koszykRodzaju(w.rodzaj) === k.value);
            const propozycje = RODZAJE_MAJATKU.filter((r) => r.koszyk === k.value);
            const otwarte = podpowiedziDla === k.value;

            return (
              <section key={k.value}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">{k.label}</h3>
                  <span
                    className={`text-[13px] font-medium tabular-nums ${k.value === "dlugi" ? "text-danger" : "text-muted"}`}
                  >
                    {zl(podglad[k.value])}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-faint">{k.opis}</p>

                {wKoszyku.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {wKoszyku.map((w) => (
                      <li key={w.id} className="flex items-center gap-2">
                        <span className="text-[16px]" aria-hidden>
                          {rodzajMajatku(w.rodzaj).icon}
                        </span>
                        <Input
                          value={w.nazwa}
                          onChange={(e) => zmienWiersz(w.id, { nazwa: e.target.value })}
                          aria-label="Nazwa pozycji"
                          className="min-w-0 flex-1"
                        />
                        <Input
                          inputMode="decimal"
                          value={w.kwota}
                          onChange={(e) => zmienWiersz(w.id, { kwota: e.target.value })}
                          placeholder="0"
                          aria-label={`Kwota: ${w.nazwa}`}
                          className="w-24 shrink-0 text-right tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => schowajWiersz(w)}
                          aria-label={`Usuń: ${w.nazwa}`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-2"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  Podpowiedzi zamiast pustego pola "nazwa". Wymyślanie, jak nazwać
                  własne konto, jest tym momentem, w którym połowa osób odpuszcza -
                  a lista przy okazji przypomina o PPK i debecie, o których
                  z głowy nikt nie pamięta.
                */}
                {otwarte ? (
                  <div className="mt-2 rounded-xl border border-border bg-surface-2 p-2">
                    <ul className="flex flex-col">
                      {propozycje.map((r) => (
                        <li key={r.rodzaj}>
                          <button
                            type="button"
                            onClick={() => dodajPozycje(r.rodzaj)}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface"
                          >
                            <span className="text-[16px] leading-tight" aria-hidden>
                              {r.icon}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[14px] font-medium leading-tight">
                                {r.label}
                              </span>
                              <span className="block text-[12px] leading-snug text-faint">
                                {r.podpowiedz}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setPodpowiedziDla(null)}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-surface"
                    >
                      Zwiń
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPodpowiedziDla(k.value)}
                    className="mt-2 text-[13px] font-medium text-accent"
                  >
                    + Dodaj {k.value === "dlugi" ? "dług" : "pozycję"}
                  </button>
                )}
              </section>
            );
          })}

          {schowane.length > 0 && (
            <section className="border-t border-border pt-3">
              <h3 className="text-[13px] font-semibold text-muted">
                Schowane ({schowane.length})
              </h3>
              <p className="mt-0.5 text-[12px] text-faint">
                Nie wchodzą do migawki. Spłacony kredyt zostaje tu zamiast zniknąć.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {schowane.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 text-[13px]">
                    <span aria-hidden>{rodzajMajatku(w.rodzaj).icon}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{w.nazwa}</span>
                    <button
                      type="button"
                      onClick={() => zmienWiersz(w.id, { archiwalna: false })}
                      className="shrink-0 font-medium text-accent"
                    >
                      przywróć
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsuniete((u) => [...u, w.id]);
                        setWiersze((ws) => ws.filter((x) => x.id !== w.id));
                      }}
                      className="shrink-0 text-faint"
                    >
                      skasuj
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
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
