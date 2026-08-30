"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { KATEGORIA_ETYKIETA, PODOCENA_ETYKIETA } from "@/lib/ai/wygladSchema";
import type { Kategoria, PodocenaKlucz, WygladAnalysis } from "@/lib/ai/wygladSchema";

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

export function ScanReport({
  analiza,
  aktywneProtokoly,
  onWlaczProtokol,
}: {
  analiza: WygladAnalysis;
  aktywneProtokoly: string[];
  onWlaczProtokol: (klucz: string) => Promise<void>;
}) {
  const [otwarte, setOtwarte] = useState<number[]>([0]);
  const [zajety, setZajety] = useState<string | null>(null);

  const przelacz = (i: number) =>
    setOtwarte((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));

  return (
    <div className="space-y-3">
      {!analiza.jakosc_zdjecia.wystarczajaca && (
        <Alert tone="warn">
          <strong>Zdjęcie utrudniło ocenę.</strong> {analiza.jakosc_zdjecia.uwagi} Wynik tego skanu
          traktuj ostrożnie - nie liczymy go też do porównań.
        </Alert>
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

      <Card title="Co widać">
        <div className="space-y-3">
          {analiza.podoceny.map((p) => (
            <div key={p.klucz}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">
                  {PODOCENA_ETYKIETA[p.klucz as PodocenaKlucz] ?? p.klucz}
                </span>
                <span className="tabular text-[14px] font-bold">{p.ocena}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${p.ocena}%` }}
                />
              </div>
              <p className="mt-1.5 text-[13px] text-muted">{p.obserwacja}</p>
            </div>
          ))}
        </div>
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
