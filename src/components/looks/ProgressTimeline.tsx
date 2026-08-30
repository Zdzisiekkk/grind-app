"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, Select } from "@/components/ui";
import { LooksChart } from "@/components/charts/LazyCharts";
import { PODOCENA_ETYKIETA } from "@/lib/ai/wygladSchema";
import type { PodocenaKlucz } from "@/lib/ai/wygladSchema";
import { delty, zestawienia } from "@/lib/looks";
import type { Skan } from "@/lib/looks";
import { humanDate } from "@/lib/format";

/**
 * Zmiana w czasie: wykres, delty i suwak przed/po.
 *
 * Suwak jest tu najważniejszy. Liczba potrafi urosnąć o cztery punkty i nic
 * z tego nie wynika, bo model raz ocenia surowiej. Dwa zdjęcia tego samego
 * ujęcia nałożone na siebie są jedynym porównaniem, którego nie da się
 * podważyć - pod warunkiem, że kadr się zgadza. Od tego jest duch w skanerze.
 */

export type ZdjecieDoPorownania = { ujecie: string; url: string; data: string };

export function ProgressTimeline({
  skany,
  najstarsze,
  najnowsze,
  senPrzedSkanem,
  czysteDniPrzedSkanem,
  wagaPrzySkanie,
}: {
  skany: Skan[];
  najstarsze: ZdjecieDoPorownania | null;
  najnowsze: ZdjecieDoPorownania | null;
  senPrzedSkanem: Array<number | null>;
  czysteDniPrzedSkanem: Array<number | null>;
  wagaPrzySkanie: Array<number | null>;
}) {
  const [podocena, setPodocena] = useState<PodocenaKlucz | "">("");
  const [suwak, setSuwak] = useState(50);

  const chronologicznie = useMemo(
    () => [...skany].sort((a, b) => a.utworzono.localeCompare(b.utworzono)),
    [skany],
  );

  const dostepnePodoceny = useMemo(() => {
    const klucze = new Set<string>();
    for (const s of skany) for (const k of Object.keys(s.oceny ?? {})) klucze.add(k);
    return [...klucze] as PodocenaKlucz[];
  }, [skany]);

  const punkty = chronologicznie.map((s) => ({
    date: s.utworzono.slice(0, 10),
    ogolna: s.ocena_ogolna,
    podocena: podocena ? (s.oceny?.[podocena] ?? null) : null,
    pewny: s.jakosc_ok !== false,
  }));

  const zmiany = delty(skany);
  const wnioski = zestawienia({
    skany: chronologicznie,
    senPrzedSkanem,
    czysteDniPrzedSkanem,
    wagaPrzySkanie,
  });

  if (skany.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="Brak skanów"
        description="Zmianę widać dopiero na dwóch. Zrób pierwszy, a za tydzień kolejny."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card title="Ocena w czasie">
        <div className="mb-2">
          <Select
            value={podocena}
            onChange={(e) => setPodocena(e.target.value as PodocenaKlucz | "")}
            aria-label="Druga seria na wykresie"
          >
            <option value="">Tylko ocena ogólna</option>
            {dostepnePodoceny.map((k) => (
              <option key={k} value={k}>
                {PODOCENA_ETYKIETA[k] ?? k}
              </option>
            ))}
          </Select>
        </div>
        <LooksChart data={punkty} podocenaLabel={podocena ? PODOCENA_ETYKIETA[podocena] : null} />
        <p className="mt-2 text-[12px] text-faint">
          Pusty środek punktu znaczy, że zdjęcie było słabe i ocena jest mniej pewna.
        </p>
      </Card>

      {najstarsze && najnowsze && (
        <Card title="Przed i po">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={najstarsze.url}
              alt={`Zdjęcie z ${najstarsze.data.slice(0, 10)}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${suwak}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={najnowsze.url}
                alt={`Zdjęcie z ${najnowsze.data.slice(0, 10)}`}
                className="absolute inset-y-0 left-0 h-full object-cover"
                style={{ width: "100vw", maxWidth: "none" }}
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
              style={{ left: `${suwak}%` }}
              aria-hidden
            />
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={suwak}
            onChange={(e) => setSuwak(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--accent)]"
            aria-label="Suwak porównania zdjęć"
          />
          <div className="flex justify-between text-[12px] text-muted">
            <span>{humanDate(najnowsze.data.slice(0, 10))} (nowsze)</span>
            <span>{humanDate(najstarsze.data.slice(0, 10))} (starsze)</span>
          </div>
        </Card>
      )}

      {zmiany.length > 0 && (
        <Card title="Co się zmieniło" subtitle="Od pierwszego do ostatniego skanu">
          <div className="space-y-2">
            {zmiany.map((d) => (
              <div key={d.klucz} className="flex items-center justify-between gap-2">
                <span className="text-[14px]">
                  {d.klucz === "ogolna"
                    ? "Ocena ogólna"
                    : (PODOCENA_ETYKIETA[d.klucz as PodocenaKlucz] ?? d.klucz)}
                </span>
                <span
                  className={`tabular text-[14px] font-bold ${
                    d.zmiana > 0 ? "text-success" : d.zmiana < 0 ? "text-danger" : "text-muted"
                  }`}
                >
                  {d.zmiana > 0 ? "+" : ""}
                  {d.zmiana}
                  <span className="ml-1 text-[12px] font-normal text-faint">
                    ({d.od} → {d.do})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {wnioski.length > 0 && (
        <Card title="Co z czym idzie w parze">
          <div className="space-y-2.5">
            {wnioski.map((z, i) => (
              <div key={i}>
                <p className="text-[14px] font-semibold">{z.tytul}</p>
                <p className="text-[13px] text-muted">{z.opis}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-faint">
            To są zestawienia, nie dowody. Przy kilku skanach taki związek równie dobrze może być
            przypadkiem - traktuj je jak podpowiedź, gdzie szukać, a nie jak wyjaśnienie.
          </p>
        </Card>
      )}
    </div>
  );
}
