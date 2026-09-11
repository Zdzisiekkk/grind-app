"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import {
  KATEGORIA_ETYKIETA,
  OBSZARY_STALE,
  PODOCENA_ETYKIETA,
  PODOCENA_KLUCZE,
  WYMAGANE_UJECIE,
  ZMIANA_ETYKIETA,
} from "@/lib/ai/wygladSchema";
import type { Kategoria, PodocenaKlucz, WygladAnalysis, Zmiana } from "@/lib/ai/wygladSchema";
import type { Ujecie } from "@/lib/database.types";
import { humanDate } from "@/lib/format";

/**
 * Pełny raport z ostatniego skanu.
 *
 * Plan jest zwinięty. Sześć rozwiniętych zaleceń naraz czyta się jak wyrok,
 * a nie jak listę rzeczy do zrobienia - i kończy się tym, że nie robi się
 * żadnego. Rozwinięte jest tylko pierwsze, czyli to o największym wpływie.
 */

/** Które kategorie da się przełożyć na codzienną rutynę, a które na protokół. */
const DO_PROTOKOLU: Partial<Record<Kategoria, string>> = {
  mewing: "mewing",
  cwiczenia_twarzy: "cwiczenia_twarzy",
  postawa: "postawa",
};

const STRZALKA: Record<Zmiana, string> = {
  wyraznie_lepiej: "↑↑",
  lepiej: "↑",
  bez_zmian: "=",
  gorzej: "↓",
  wyraznie_gorzej: "↓↓",
  brak_porownania: "",
};

const TON: Record<Zmiana, "success" | "danger" | "neutral"> = {
  wyraznie_lepiej: "success",
  lepiej: "success",
  bez_zmian: "neutral",
  gorzej: "danger",
  wyraznie_gorzej: "danger",
  brak_porownania: "neutral",
};

const BRAK_ZDJECIA: Record<Ujecie, string> = {
  front: "zdjęcia twarzy na wprost",
  zeby: "zdjęcia z uśmiechem",
  profil: "zdjęcia z profilu",
  sylwetka: "zdjęcia sylwetki",
};

export function ScanReport({
  analiza,
  odniesienieData,
  aktywneProtokoly,
  onWlaczProtokol,
}: {
  analiza: WygladAnalysis;
  /** Data skanu, z którym model porównywał zdjęcia. */
  odniesienieData: string | null;
  aktywneProtokoly: string[];
  onWlaczProtokol: (klucz: string) => Promise<void>;
}) {
  const [otwarte, setOtwarte] = useState<number[]>([0]);
  const [zajety, setZajety] = useState<string | null>(null);

  const przelacz = (i: number) =>
    setOtwarte((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  /*
   * Obszary bez oceny, pogrupowane według brakującego zdjęcia. Bez tej
   * informacji brak "Zębów" w raporcie wygląda jak błąd, a nie jak
   * konsekwencja pominiętego ujęcia.
   */
  const ocenione = new Set(analiza.podoceny.map((p) => p.klucz));
  const brakujace = new Map<Ujecie, string[]>();
  for (const k of PODOCENA_KLUCZE) {
    if (ocenione.has(k)) continue;
    const u = WYMAGANE_UJECIE[k];
    brakujace.set(u, [...(brakujace.get(u) ?? []), PODOCENA_ETYKIETA[k]]);
  }
  const liczoneDoOgolnej = analiza.podoceny.filter(
    (p) => !OBSZARY_STALE.includes(p.klucz as PodocenaKlucz),
  ).length;

  return (
    <div className="space-y-3">
      {!analiza.jakosc_zdjecia.wystarczajaca && (
        <Alert tone="warn">
          <strong>Zdjęcie utrudniło ocenę.</strong> {analiza.jakosc_zdjecia.uwagi} Wynik tego skanu
          traktuj ostrożnie - nie liczymy go też do porównań.
        </Alert>
      )}

      {analiza.porownanie_ogolne && (
        <Card
          title="Od poprzedniego skanu"
          subtitle={
            odniesienieData
              ? `Model porównał zdjęcia ze skanem z ${humanDate(odniesienieData.slice(0, 10))}`
              : undefined
          }
        >
          <p className="text-[14px] leading-relaxed">{analiza.porownanie_ogolne}</p>
        </Card>
      )}

      <Card>
        <p className="text-[14px] leading-relaxed">{analiza.podsumowanie}</p>
      </Card>

      {analiza.mocne_strony.length > 0 && (
        <Card title="Mocne strony">
          <ul className="space-y-1.5">
            {analiza.mocne_strony.map((m, i) => (
              <li key={i} className="flex gap-2 text-[14px]">
                <span aria-hidden>✓</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Co widać"
        subtitle={`Ocena ogólna ${analiza.ocena_ogolna} to średnia ${liczoneDoOgolnej} obszarów poniżej, bez symetrii.`}
      >
        <div className="space-y-3">
          {analiza.podoceny.map((p) => {
            const stala = OBSZARY_STALE.includes(p.klucz as PodocenaKlucz);
            return (
              <div key={p.klucz}>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-[14px] font-semibold">
                    {PODOCENA_ETYKIETA[p.klucz as PodocenaKlucz] ?? p.klucz}
                    {stala && (
                      <span className="ml-1.5 text-[11px] font-normal text-faint">
                        nie liczy się do ogólnej
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {p.zmiana && p.zmiana !== "brak_porownania" && (
                      <Chip tone={TON[p.zmiana]}>
                        {STRZALKA[p.zmiana]} {ZMIANA_ETYKIETA[p.zmiana]}
                      </Chip>
                    )}
                    <span className="tabular text-[14px] font-bold">{p.ocena}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${p.ocena}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{p.obserwacja}</p>
                {p.co_sie_zmienilo && (
                  <p className="mt-1 text-[13px]">
                    <span className="text-faint">Zmiana: </span>
                    {p.co_sie_zmienilo}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {brakujace.size > 0 && (
          <p className="mt-3 text-[12px] text-faint">
            Nie oceniono:{" "}
            {[...brakujace.entries()]
              .map(([u, obszary]) => `${obszary.join(", ").toLowerCase()} (brak ${BRAK_ZDJECIA[u]})`)
              .join("; ")}
            . Obszar bez zdjęcia nie dostaje liczby - zgadywanie psułoby porównania.
          </p>
        )}
      </Card>

      <Card title="Plan">
        <div className="space-y-2">
          {analiza.plan.map((z, i) => {
            const protokol = DO_PROTOKOLU[z.kategoria];
            const wlaczony = protokol ? aktywneProtokoly.includes(protokol) : false;

            return (
              <div key={i} className="rounded-xl bg-surface-2">
                <button
                  type="button"
                  onClick={() => przelacz(i)}
                  aria-expanded={otwarte.includes(i)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <span
                    className={clsx(
                      "tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      z.priorytet === 1
                        ? "bg-accent-soft text-accent"
                        : "bg-[var(--surface)] text-muted",
                    )}
                    aria-label={`Priorytet ${z.priorytet}`}
                  >
                    {z.priorytet}
                  </span>
                  <span className="flex-1 text-[14px] font-semibold">{z.tytul}</span>
                  <span aria-hidden className="text-faint">
                    {otwarte.includes(i) ? "▾" : "▸"}
                  </span>
                </button>

                {otwarte.includes(i) && (
                  <div className="space-y-2.5 px-3 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Chip>{KATEGORIA_ETYKIETA[z.kategoria] ?? z.kategoria}</Chip>
                      <Chip tone="info">{z.czestotliwosc}</Chip>
                      <Chip tone="neutral">efekt za {z.horyzont_tygodni} tyg.</Chip>
                    </div>

                    <p className="text-[13px] text-muted">{z.dlaczego}</p>

                    {z.jak.length > 0 && (
                      <ol className="space-y-1 text-[13px]">
                        {z.jak.map((krok, k) => (
                          <li key={k} className="flex gap-2">
                            <span className="tabular text-faint">{k + 1}.</span>
                            <span>{krok}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {protokol && (
                      <Button
                        variant="ghost"
                        disabled={wlaczony || zajety === protokol}
                        onClick={async () => {
                          setZajety(protokol);
                          await onWlaczProtokol(protokol);
                          setZajety(null);
                        }}
                      >
                        {wlaczony ? "Protokół już włączony" : "Włącz protokół"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[12px] text-faint">
          Zalecenia z pielęgnacji trafiły już do rutyn - znajdziesz je na liście dnia.
        </p>
      </Card>
    </div>
  );
}
