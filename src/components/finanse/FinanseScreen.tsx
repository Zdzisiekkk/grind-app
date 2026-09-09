"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { humanDate, todayISO } from "@/lib/format";
import {
  IKONY_CELOW,
  KATEGORIE_WYDATKOW,
  KOSZYKI_MAJATKU,
  RODZAJE_MAJATKU,
  dziennieDoKonca,
  kategoriaStalego,
  kategoriaWydatku,
  koszykRodzaju,
  nazwaMiesiaca,
  poduszkaProcent,
  rodzajMajatku,
  stanPoduszki,
  sumyKoszykow,
  tempoBudzetu,
  zl,
  zmiana,
} from "@/lib/finanse";
import { ArkuszRozliczenia } from "./ArkuszRozliczenia";
import { ArkuszStalych } from "./ArkuszStalych";
import { ArkuszZrodel } from "./ArkuszZrodel";
import { liczba, useZapis } from "./useZapis";
import type {
  FinanseAnaliza,
  FinanseBilans,
  FinanseCelZPostepem,
  FinanseNaliczenie,
  FinansePodsumowanie,
  FinansePozycja,
  FinanseRozliczeniePodglad,
  FinanseStaly,
  FinanseWplyw,
  FinanseWydatek,
  FinanseZrodlo,
} from "@/lib/database.types";

/**
 * Finanse - finansowa strona "lock inu".
 *
 * Kolejność kart odpowiada temu, jak pilne jest pytanie, na które odpowiadają:
 * najpierw rzeczy wymagające decyzji dziś (rozliczenie miesiąca, rachunki do
 * potwierdzenia), potem stan (poduszka, budżet), potem obraz miesiąca, a na
 * końcu przeglądy, które ogląda się raz na kilka dni.
 */

type Arkusz =
  | "stan" | "wydatek" | "wplyw" | "cel" | "celEdycja" | "wplata"
  | "stale" | "zrodla" | "rozliczenie" | null;

/** Pola celu wspólne dla zakładania i edycji. */
type FormularzCelu = {
  nazwa: string;
  ikona: string;
  kwota_cel: string;
  termin: string;
  przypominac: boolean;
};

/**
 * Pozycja majątku w trakcie edycji.
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

export function FinanseScreen({
  userId,
  podsumowanie,
  bilans,
  analiza,
  pozycje,
  zrodla,
  wplywy,
  stale,
  naliczenia,
  rozliczenie,
  cele,
  wydatki,
}: {
  userId: string;
  podsumowanie: FinansePodsumowanie;
  bilans: FinanseBilans;
  analiza: FinanseAnaliza;
  /** Pozycje majątku razem ze schowanymi - arkusz pozwala je przywrócić. */
  pozycje: FinansePozycja[];
  zrodla: FinanseZrodlo[];
  wplywy: FinanseWplyw[];
  stale: FinanseStaly[];
  /** Naliczenia bieżącego miesiąca, ze statusem. */
  naliczenia: (FinanseNaliczenie & { finanse_stale: { nazwa: string; kategoria: string } | null })[];
  rozliczenie: FinanseRozliczeniePodglad | null;
  cele: FinanseCelZPostepem[];
  /** Ostatnie wydatki - lista, nie statystyka. */
  wydatki: FinanseWydatek[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = todayISO();
  const { busy, error, setError, zapisz } = useZapis();

  const [arkusz, setArkusz] = useState<Arkusz>(null);
  const [celDoWplaty, setCelDoWplaty] = useState<FinanseCelZPostepem | null>(null);

  // Migawka majątku
  const [wiersze, setWiersze] = useState<Wiersz[]>(() => doWierszy(pozycje));
  const [usuniete, setUsuniete] = useState<string[]>([]);
  /** Który koszyk ma rozwiniętą listę podpowiedzi; null = żaden. */
  const [podpowiedziDla, setPodpowiedziDla] = useState<string | null>(null);

  const [wydatek, setWydatek] = useState({ kwota: "", kategoria: "jedzenie", opis: "" });
  const [wplyw, setWplyw] = useState({ kwota: "", zrodlo: "", opis: "" });
  const [cel, setCel] = useState({
    nazwa: "",
    ikona: "🎯",
    kwota_cel: "",
    termin: "",
    przypominac: false,
  });
  const [wplata, setWplata] = useState("");
  const [edycja, setEdycja] = useState<FormularzCelu | null>(null);
  const [celEdytowany, setCelEdytowany] = useState<FinanseCelZPostepem | null>(null);
  /** Kasowanie w dwóch krokach - cel znika razem z historią wpłat. */
  const [potwierdzUsuniecie, setPotwierdzUsuniecie] = useState(false);

  /* ----------------------------- Majątek ---------------------------------- */

  function otworzMajatek() {
    setWiersze(doWierszy(pozycje));
    setUsuniete([]);
    setPodpowiedziDla(null);
    setError(null);
    setArkusz("stan");
  }

  function otworzEdycjeCelu(c: FinanseCelZPostepem) {
    setCelEdytowany(c);
    setEdycja({
      nazwa: c.nazwa,
      ikona: c.ikona,
      kwota_cel: String(Number(c.kwota_cel)),
      termin: c.termin ?? "",
      przypominac: c.przypominac,
    });
    setPotwierdzUsuniecie(false);
    setError(null);
    setArkusz("celEdycja");
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
    }, () => setArkusz(null));
  }

  /* ------------------------------ Liczby ---------------------------------- */

  const poduszka = podsumowanie.poduszka_miesiecy;
  const ocena = stanPoduszki(poduszka);
  const procentPoduszki = poduszkaProcent(poduszka, podsumowanie.poduszka_cel);
  const naDzien = dziennieDoKonca(podsumowanie.budzet_zostalo);
  const przekroczony = (podsumowanie.budzet_zostalo ?? 0) < 0;
  const tempo = tempoBudzetu(podsumowanie.budzet, podsumowanie.wydane_w_miesiacu);

  const celeAktywne = cele.filter((c) => c.status === "aktywny");
  const celeZamkniete = cele.filter((c) => c.status !== "aktywny");

  const doPotwierdzenia = naliczenia.filter(
    (n) => n.status === "oczekuje" && n.termin <= today,
  );
  const nadchodzace = naliczenia.filter((n) => n.status === "oczekuje" && n.termin > today);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Finanse</h1>
          <p className="text-[13px] text-muted">
            Ile wpada, gdzie znika, ile masz zapasu.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setArkusz("wplyw")}>
            + Wpływ
          </Button>
          <Button variant="primary" onClick={() => setArkusz("wydatek")}>
            + Wydatek
          </Button>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* --- Rozliczenie miesiąca: jedyna rzecz, która wymaga decyzji dziś --- */}
      {podsumowanie.rozliczenie_okres && (
        <Card
          title={`${nazwaMiesiaca(podsumowanie.rozliczenie_okres)} czeka na rozliczenie`}
          subtitle="Trzy kroki: bilans, sprawdzenie konta, decyzja o nadwyżce"
        >
          <p className="text-[13px] text-muted">
            Dopóki miesiąca nie zamkniesz, majątek opiera się na szacunku z wpisów. Zamknięcie
            konfrontuje go ze stanem konta i pokazuje, ile w tym miesiącu wyciekło poza rejestrem.
          </p>
          <Button
            variant="primary"
            block
            className="mt-3"
            onClick={() => setArkusz("rozliczenie")}
          >
            Rozlicz {nazwaMiesiaca(podsumowanie.rozliczenie_okres)}
          </Button>
        </Card>
      )}

      {/* --- Rachunki do potwierdzenia --- */}
      {doPotwierdzenia.length > 0 && (
        <Card
          title="Do potwierdzenia"
          subtitle="Szablon przygotował, Ty potwierdzasz albo poprawiasz kwotę"
          padded={false}
        >
          <ul className="divide-y divide-border">
            {doPotwierdzenia.map((n) => (
              <li key={n.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-[16px]" aria-hidden>
                  {kategoriaStalego(n.finanse_stale?.kategoria ?? "inne").icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">
                    {n.finanse_stale?.nazwa ?? "Koszt stały"}
                  </span>
                  <span className="block text-[12px] text-faint">
                    termin {humanDate(n.termin)}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                  {zl(Number(n.kwota))}
                </span>
                <Button
                  size="sm"
                  variant="success"
                  loading={busy}
                  onClick={() =>
                    zapisz(() =>
                      supabase
                        .from("finanse_naliczenia")
                        .update({ status: "potwierdzone", potwierdzone_at: new Date().toISOString() })
                        .eq("id", n.id),
                    )
                  }
                >
                  Było
                </Button>
                <button
                  type="button"
                  aria-label="Pomiń"
                  className="shrink-0 px-1 text-[12px] text-faint"
                  onClick={() =>
                    zapisz(() =>
                      supabase.from("finanse_naliczenia").update({ status: "pominiete" }).eq("id", n.id),
                    )
                  }
                >
                  pomiń
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --- Poduszka: najważniejsza liczba w całym module --- */}
      <Card
        title="Poduszka finansowa"
        subtitle="Ile miesięcy wytrzymasz bez przychodu"
        action={
          <Chip
            tone={
              ocena.tone === "danger"
                ? "danger"
                : ocena.tone === "warn"
                  ? "warn"
                  : ocena.tone === "success"
                    ? "success"
                    : "accent"
            }
          >
            {ocena.label}
          </Chip>
        }
      >
        {poduszka == null ? (
          <EmptyState
            icon="🛟"
            title="Brakuje kosztów życia"
            description="Wypisz koszty stałe, a policzymy, na ile miesięcy starczy Ci to, co masz płynne."
            action={
              <Button variant="primary" onClick={() => setArkusz("stale")}>
                Wypisz koszty stałe
              </Button>
            }
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
              {zl(podsumowanie.koszty_miesieczne)} na miesiąc
              {podsumowanie.koszty_z_szablonu ? " (suma kosztów stałych)" : " (z profilu)"}.
              Inwestycje nie wchodzą - nie sprzedaje się ich w dniu, w którym psuje się pralka.
            </p>
            <button
              type="button"
              className="mt-2 text-[13px] font-medium text-accent"
              onClick={() => setArkusz("stale")}
            >
              Koszty stałe ({stale.filter((s) => s.aktywny).length})
            </button>
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
            <span className="text-[13px] text-muted">z {zl(podsumowanie.budzet)}</span>
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
          {tempo.stan === "uwaga" && (
            <Alert tone="warn">
              W tym tempie skończysz miesiąc na {zl(tempo.prognoza)}, czyli powyżej budżetu.
            </Alert>
          )}
        </Card>
      )}

      {/* --- Bilans miesiąca --- */}
      <Card
        title="Ten miesiąc"
        subtitle="Ile wpadło, ile wyszło"
        action={
          <Button variant="secondary" onClick={() => setArkusz("zrodla")}>
            Źródła
          </Button>
        }
      >
        <div className="flex items-baseline gap-3">
          <span
            className={`text-[28px] font-bold tabular-nums ${bilans.wynik < 0 ? "text-danger" : "text-success"}`}
          >
            {zmiana(bilans.wynik)}
          </span>
          {bilans.stale_oczekuje > 0 && (
            <Chip tone="warn">-{zl(bilans.stale_oczekuje)} niepotwierdzone</Chip>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <div>
            <div className="text-faint">Wpłynęło</div>
            <div className="font-semibold tabular-nums text-success">
              {zl(bilans.wplywy_realne)}
            </div>
            {bilans.wplywy_plan > 0 && (
              <div className="text-[11px] text-faint">plan {zl(bilans.wplywy_plan)}</div>
            )}
          </div>
          <div>
            <div className="text-faint">Stałe</div>
            <div className="font-semibold tabular-nums">{zl(bilans.stale_potwierdzone)}</div>
          </div>
          <div>
            <div className="text-faint">Uznaniowe</div>
            <div className="font-semibold tabular-nums">{zl(bilans.uznaniowe)}</div>
          </div>
        </div>

        {zrodla.length > 0 && bilans.wplywy_plan > 0 && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
            {zrodla
              .filter((z) => z.aktywne)
              .map((z) => {
                const wpadlo = wplywy
                  .filter((w) => w.zrodlo_id === z.id && w.data >= bilans.okres)
                  .reduce((s, w) => s + Number(w.kwota), 0);
                const plan = Number(z.plan_miesieczny ?? 0);
                return (
                  <li key={z.id} className="flex items-baseline gap-2">
                    <span aria-hidden>{z.ikona}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{z.nazwa}</span>
                    <span className="shrink-0 tabular-nums">
                      {zl(wpadlo)}
                      {plan > 0 && <span className="text-faint"> / {zl(plan)}</span>}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}

        {nadchodzace.length > 0 && (
          <p className="mt-3 text-[12px] text-faint">
            Jeszcze w tym miesiącu zejdzie {zl(bilans.stale_oczekuje)} w {nadchodzace.length}{" "}
            {nadchodzace.length === 1 ? "racie" : "ratach"}.
          </p>
        )}
      </Card>

      {/* --- Majątek --- */}
      <Card
        title="Majątek"
        subtitle={
          podsumowanie.data_migawki
            ? `Potwierdzony ${humanDate(podsumowanie.data_migawki)}`
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

            {/*
              Szacunek obok potwierdzonego, nigdy zamiast. Jedna liczba
              udawałaby sprawdzoną, a opiera się wyłącznie na tym, co ktoś
              zdążył wpisać.
            */}
            {podsumowanie.netto_szacowany != null && (
              <p className="mt-1 text-[13px] text-muted">
                Szacunek na dziś:{" "}
                <span className="font-semibold tabular-nums">
                  {zl(podsumowanie.netto_szacowany)}
                </span>{" "}
                <span className="text-faint">
                  ({zmiana(podsumowanie.ruch_od_migawki)} od migawki)
                </span>
              </p>
            )}

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

            {podsumowanie.wyciek_sredni != null && (podsumowanie.wyciek_miesiecy ?? 0) > 0 && (
              <p className="mt-3 border-t border-border pt-3 text-[12px] text-faint">
                Z {podsumowanie.wyciek_miesiecy} rozliczonych{" "}
                {podsumowanie.wyciek_miesiecy === 1 ? "miesiąca" : "miesięcy"}: średnio{" "}
                {zl(Math.abs(podsumowanie.wyciek_sredni))}{" "}
                {podsumowanie.wyciek_sredni >= 0 ? "wycieka poza wpisami" : "znajduje się ponad wpisy"}.
              </p>
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
        padded={celeAktywne.length === 0 && celeZamkniete.length === 0}
      >
        {celeAktywne.length === 0 && celeZamkniete.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Brak celów"
            description="Konkretna kwota z nazwą odkłada się lepiej niż ogólne postanowienie, że warto oszczędzać."
          />
        ) : (
          <ul className="divide-y divide-border">
            {celeAktywne.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-[20px]" aria-hidden>
                    {c.ikona}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      {/*
                        Nazwa jest przyciskiem, bo edycji szuka się właśnie tam,
                        gdzie widać rzecz do poprawienia - a nie w menu obok.
                      */}
                      <button
                        type="button"
                        onClick={() => otworzEdycjeCelu(c)}
                        className="min-w-0 truncate text-left text-[14px] font-medium underline decoration-transparent underline-offset-2 hover:decoration-inherit"
                      >
                        {c.nazwa}
                      </button>
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
                        {c.przypominac && c.rata_potrzebna != null && (
                          <> · {zl(c.rata_potrzebna)}/mies.</>
                        )}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        {/*
                          Dzwonek przy celu, a nie w ustawieniach: decyzja
                          "pilnuj tego" dotyczy jednego konkretnego celu
                          i podejmuje się ją patrząc właśnie na niego.
                        */}
                        <button
                          type="button"
                          aria-label={
                            c.przypominac
                              ? `Przestań pilnować: ${c.nazwa}`
                              : `Pilnuj tempa: ${c.nazwa}`
                          }
                          title={
                            c.termin
                              ? c.przypominac
                                ? "Pilnowane - ostrzeżemy, gdy zaczniesz odstawać"
                                : "Cichy cel - kliknij, żeby pilnować tempa"
                              : "Pilnowanie wymaga terminu"
                          }
                          className={c.przypominac ? "text-accent" : "text-faint"}
                          onClick={() => {
                            if (!c.termin && !c.przypominac) {
                              setError(
                                `Cel „${c.nazwa}" nie ma terminu, więc nie ma czego pilnować. Dodaj termin, a przypomnienia zaczną działać.`,
                              );
                              return;
                            }
                            zapisz(() =>
                              supabase
                                .from("finanse_cele")
                                .update({ przypominac: !c.przypominac })
                                .eq("id", c.id),
                            );
                          }}
                        >
                          {c.przypominac ? "🔔" : "🔕"}
                        </button>
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
                      </span>
                    </div>
                    {c.spozniony && (
                      <p className="mt-1 text-[12px] text-warn">
                        Nie wyrabiasz się: {c.procent}% przy{" "}
                        {c.oczekiwany_procent}% upływu czasu.
                        {c.rata_potrzebna != null && (
                          <> Żeby zdążyć, potrzeba {zl(c.rata_potrzebna)} miesięcznie.</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {celeZamkniete.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <h3 className="text-[13px] font-semibold text-muted">
              Zamknięte ({celeZamkniete.length})
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {celeZamkniete.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden>{c.ikona}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {c.nazwa}
                    <span className="text-faint">
                      {" "}
                      · {c.status === "osiagniety" ? "osiągnięty" : "odłożony"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-faint">{zl(c.zebrane)}</span>
                  <button
                    type="button"
                    className="shrink-0 font-medium text-accent"
                    onClick={() =>
                      zapisz(() =>
                        supabase
                          .from("finanse_cele")
                          .update({ status: "aktywny" })
                          .eq("id", c.id),
                      )
                    }
                  >
                    przywróć
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* --- Gdzie znika kasa --- */}
      {analiza.kategorie.length > 0 && (
        <Card
          title="Gdzie znika kasa"
          subtitle={
            analiza.srednia_poprzednich != null
              ? `Ten miesiąc: ${zl(analiza.suma)} · zwykle ${zl(analiza.srednia_poprzednich)}`
              : `Ten miesiąc: ${zl(analiza.suma)}`
          }
        >
          <ul className="flex flex-col gap-2.5">
            {analiza.kategorie.map((k) => {
              const kat = kategoriaWydatku(k.kategoria);
              const gorzej = (k.roznica ?? 0) > 0;
              return (
                <li key={k.kategoria}>
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span aria-hidden>{kat.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{kat.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{zl(k.kwota)}</span>
                    {k.roznica != null && Math.abs(k.roznica) >= 1 && (
                      <span
                        className={`shrink-0 text-[12px] tabular-nums ${gorzej ? "text-danger" : "text-success"}`}
                      >
                        {zmiana(k.roznica)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${k.procent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          {/*
            Przeliczenie na cel zamiast morału. "Wydałeś dużo" nikogo nie
            przekonuje; "to jest 8% mieszkania" pokazuje koszt alternatywny,
            czyli jedyną rzecz, o której naprawdę decydujesz.
          */}
          {celeAktywne[0] && analiza.suma > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-faint">
              {zl(analiza.suma)} wydane w tym miesiącu to{" "}
              {Math.round((analiza.suma / Number(celeAktywne[0].kwota_cel)) * 100)}% celu
              &bdquo;{celeAktywne[0].nazwa}&rdquo;.
            </p>
          )}
        </Card>
      )}

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
              zapisz(
                () =>
                  supabase.from("finanse_wydatki").insert({
                    user_id: userId,
                    kwota: liczba(wydatek.kwota),
                    kategoria: wydatek.kategoria as FinanseWydatek["kategoria"],
                    opis: wydatek.opis.trim() || null,
                  }),
                () => {
                  setWydatek({ kwota: "", kategoria: wydatek.kategoria, opis: "" });
                  setArkusz(null);
                },
              )
            }
          >
            Zapisz wydatek
          </Button>
        </div>
      </Sheet>

      <Sheet open={arkusz === "wplyw"} onClose={() => setArkusz(null)} title="Wpływ">
        <div className="flex flex-col gap-3">
          <Field label="Kwota (zł)">
            <Input
              inputMode="decimal"
              value={wplyw.kwota}
              onChange={(e) => setWplyw({ ...wplyw, kwota: e.target.value })}
              placeholder="2000"
              autoFocus
            />
          </Field>
          <Field label="Skąd" hint="Bez źródła też można - jednorazowy zwrot nie potrzebuje własnej pozycji.">
            <Select
              value={wplyw.zrodlo}
              onChange={(e) => setWplyw({ ...wplyw, zrodlo: e.target.value })}
            >
              <option value="">Bez źródła</option>
              {zrodla
                .filter((z) => z.aktywne)
                .map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.ikona} {z.nazwa}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Opis (opcjonalnie)">
            <Input
              value={wplyw.opis}
              onChange={(e) => setWplyw({ ...wplyw, opis: e.target.value })}
              placeholder="np. wypłata za wrzesień"
            />
          </Field>
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={liczba(wplyw.kwota) <= 0}
            onClick={() =>
              zapisz(
                () =>
                  supabase.from("finanse_wplywy").insert({
                    user_id: userId,
                    zrodlo_id: wplyw.zrodlo || null,
                    kwota: liczba(wplyw.kwota),
                    opis: wplyw.opis.trim() || null,
                  }),
                () => {
                  setWplyw({ kwota: "", zrodlo: wplyw.zrodlo, opis: "" });
                  setArkusz(null);
                },
              )
            }
          >
            Zapisz wpływ
          </Button>
          {zrodla.length === 0 && (
            <button
              type="button"
              className="text-[13px] font-medium text-accent"
              onClick={() => setArkusz("zrodla")}
            >
              Najpierw nazwij swoje źródła przychodu
            </button>
          )}
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
                      /*
                       * Szerokości na opakowaniach, nie na samym polu: Input
                       * ma w klasach bazowych `w-full`, a przekazane `w-24`
                       * jej nie nadpisuje - obie zostają w atrybucie i wygrywa
                       * ta późniejsza w arkuszu stylów. Efektem był wiersz
                       * rozpychający okno w bok na telefonie.
                       */
                      <li key={w.id} className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 text-center text-[16px]" aria-hidden>
                          {rodzajMajatku(w.rodzaj).icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Input
                            value={w.nazwa}
                            onChange={(e) => zmienWiersz(w.id, { nazwa: e.target.value })}
                            aria-label="Nazwa pozycji"
                          />
                        </div>
                        <div className="w-[96px] shrink-0">
                          <Input
                            inputMode="decimal"
                            value={w.kwota}
                            onChange={(e) => zmienWiersz(w.id, { kwota: e.target.value })}
                            placeholder="0"
                            aria-label={`Kwota: ${w.nazwa}`}
                            className="px-2 text-right tabular-nums"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => schowajWiersz(w)}
                          aria-label={`Usuń: ${w.nazwa}`}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-2"
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
          <div className="flex flex-wrap gap-1.5">
            {IKONY_CELOW.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCel({ ...cel, ikona: i })}
                aria-label={`Ikona ${i}`}
                className={`flex size-10 items-center justify-center rounded-lg border text-[18px] ${
                  cel.ikona === i ? "border-accent bg-surface-2" : "border-border"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
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

          {/*
            Domyślnie cicho. Cel bywa zobowiązaniem z terminem, ale równie
            często zwykłą etykietą na odkładane pieniądze - i wtedy
            przypominanie o nim jest wyłącznie hałasem.
          */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={cel.przypominac}
              disabled={!cel.termin}
              onChange={(e) => setCel({ ...cel, przypominac: e.target.checked })}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)] disabled:opacity-40"
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium leading-tight">
                Pilnuj tempa
              </span>
              <span className="block text-[12px] leading-snug text-muted">
                {cel.termin
                  ? "Ostrzeżemy, gdy postęp zacznie odstawać od upływu czasu."
                  : "Wymaga terminu - bez niego nie ma czego pilnować."}
              </span>
            </span>
          </label>
          <Button
            variant="primary"
            block
            loading={busy}
            disabled={!cel.nazwa.trim() || liczba(cel.kwota_cel) <= 0}
            onClick={() =>
              zapisz(
                () =>
                  supabase.from("finanse_cele").insert({
                    user_id: userId,
                    nazwa: cel.nazwa.trim(),
                    ikona: cel.ikona,
                    kwota_cel: liczba(cel.kwota_cel),
                    termin: cel.termin || null,
                    przypominac: cel.przypominac && !!cel.termin,
                  }),
                () => {
                  setCel({ nazwa: "", ikona: "🎯", kwota_cel: "", termin: "", przypominac: false });
                  setArkusz(null);
                },
              )
            }
          >
            Dodaj cel
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={arkusz === "celEdycja"}
        onClose={() => setArkusz(null)}
        title={celEdytowany ? `Cel: ${celEdytowany.nazwa}` : "Cel"}
      >
        {edycja && celEdytowany && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {IKONY_CELOW.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEdycja({ ...edycja, ikona: i })}
                  aria-label={`Ikona ${i}`}
                  className={`flex size-10 items-center justify-center rounded-lg border text-[18px] ${
                    edycja.ikona === i ? "border-accent bg-surface-2" : "border-border"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            <Field label="Na co odkładasz">
              <Input
                value={edycja.nazwa}
                onChange={(e) => setEdycja({ ...edycja, nazwa: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Kwota (zł)"
                hint={
                  liczba(edycja.kwota_cel) > 0 && liczba(edycja.kwota_cel) < celEdytowany.zebrane
                    ? `Masz już odłożone ${zl(celEdytowany.zebrane)}.`
                    : undefined
                }
              >
                <Input
                  inputMode="decimal"
                  value={edycja.kwota_cel}
                  onChange={(e) => setEdycja({ ...edycja, kwota_cel: e.target.value })}
                />
              </Field>
              <Field label="Termin">
                <Input
                  type="date"
                  value={edycja.termin}
                  onChange={(e) =>
                    setEdycja({
                      ...edycja,
                      termin: e.target.value,
                      // Bez terminu nie ma czego pilnować - gaśnie razem z nim,
                      // zamiast zostawać włączone i nic nie robić.
                      przypominac: e.target.value ? edycja.przypominac : false,
                    })
                  }
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={edycja.przypominac}
                disabled={!edycja.termin}
                onChange={(e) => setEdycja({ ...edycja, przypominac: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)] disabled:opacity-40"
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-tight">Pilnuj tempa</span>
                <span className="block text-[12px] leading-snug text-muted">
                  {edycja.termin
                    ? "Ostrzeżemy, gdy postęp zacznie odstawać od upływu czasu."
                    : "Wymaga terminu - bez niego nie ma czego pilnować."}
                </span>
              </span>
            </label>

            <Button
              variant="primary"
              block
              loading={busy}
              disabled={!edycja.nazwa.trim() || liczba(edycja.kwota_cel) <= 0}
              onClick={() =>
                zapisz(
                  () =>
                    supabase
                      .from("finanse_cele")
                      .update({
                        nazwa: edycja.nazwa.trim(),
                        ikona: edycja.ikona,
                        kwota_cel: liczba(edycja.kwota_cel),
                        termin: edycja.termin || null,
                        przypominac: edycja.przypominac && !!edycja.termin,
                      })
                      .eq("id", celEdytowany.id),
                  () => setArkusz(null),
                )
              }
            >
              Zapisz zmiany
            </Button>

            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {/*
                Osiągnięty i porzucony to dwa różne końce i oba są lepsze niż
                kasowanie: zebrane 8000 zł na wyjazd to kawałek historii, który
                za rok mówi więcej niż brak wiersza w bazie.
              */}
              <Button
                variant="success"
                block
                loading={busy}
                onClick={() =>
                  zapisz(
                    () =>
                      supabase
                        .from("finanse_cele")
                        .update({ status: "osiagniety" })
                        .eq("id", celEdytowany.id),
                    () => setArkusz(null),
                  )
                }
              >
                🏁 Cel osiągnięty
              </Button>
              <Button
                variant="secondary"
                block
                loading={busy}
                onClick={() =>
                  zapisz(
                    () =>
                      supabase
                        .from("finanse_cele")
                        .update({ status: "porzucony" })
                        .eq("id", celEdytowany.id),
                    () => setArkusz(null),
                  )
                }
              >
                Odłóż na później
              </Button>

              {potwierdzUsuniecie ? (
                <Button
                  variant="danger"
                  block
                  loading={busy}
                  onClick={() =>
                    zapisz(
                      () => supabase.from("finanse_cele").delete().eq("id", celEdytowany.id),
                      () => setArkusz(null),
                    )
                  }
                >
                  {celEdytowany.zebrane !== 0
                    ? `Tak, usuń razem z historią wpłat (${zl(celEdytowany.zebrane)})`
                    : "Tak, usuń cel"}
                </Button>
              ) : (
                <Button variant="ghost" block onClick={() => setPotwierdzUsuniecie(true)}>
                  Usuń cel
                </Button>
              )}
              <p className="text-[12px] leading-snug text-faint">
                Usunięcie kasuje też wpłaty przypisane do tego celu. Same pieniądze zostają
                w majątku - wpłaty na cel tylko etykietują to, co i tak masz odłożone.
              </p>
            </div>
          </div>
        )}
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
              zapisz(
                () =>
                  supabase.from("finanse_wplaty").insert({
                    user_id: userId,
                    cel_id: celDoWplaty!.id,
                    kwota: liczba(wplata),
                  }),
                () => setArkusz(null),
              )
            }
          >
            Zapisz wpłatę
          </Button>
        </div>
      </Sheet>

      <ArkuszStalych
        open={arkusz === "stale"}
        onClose={() => setArkusz(null)}
        userId={userId}
        stale={stale}
      />

      <ArkuszZrodel
        open={arkusz === "zrodla"}
        onClose={() => setArkusz(null)}
        userId={userId}
        zrodla={zrodla}
      />

      {podsumowanie.rozliczenie_okres && (
        <ArkuszRozliczenia
          open={arkusz === "rozliczenie"}
          onClose={() => {
            setArkusz(null);
            router.refresh();
          }}
          userId={userId}
          okres={podsumowanie.rozliczenie_okres}
          podglad={rozliczenie}
          pozycje={pozycje.filter((p) => !p.archiwalna && p.kategoria === "plynne")}
          cele={celeAktywne}
        />
      )}
    </div>
  );
}
