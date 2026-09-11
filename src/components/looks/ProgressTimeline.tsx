"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, Select } from "@/components/ui";
import { LooksChart } from "@/components/charts/LazyCharts";
import { PODOCENA_ETYKIETA } from "@/lib/ai/wygladSchema";
import type { PodocenaKlucz } from "@/lib/ai/wygladSchema";
import { delty, zestawienia } from "@/lib/looks";
import type { Skan } from "@/lib/looks";

/**
 * Zmiana w czasie: wykres, delty i zestawienia z dziennikiem.
 *
 * Zdjęcia przed/po mieszkają w zakładce "Zdjęcia" (GaleriaSkanow) - tam da
 * się wybrać ujęcie i dowolne dwa skany, a nie tylko pierwsze zdjęcie twarzy
 * z ostatnim.
 */
export function ProgressTimeline({
  skany,
  senPrzedSkanem,
  czysteDniPrzedSkanem,
  wagaPrzySkanie,
}: {
  skany: Skan[];
  senPrzedSkanem: Array<number | null>;
  czysteDniPrzedSkanem: Array<number | null>;
  wagaPrzySkanie: Array<number | null>;
}) {
  const [podocena, setPodocena] = useState<PodocenaKlucz | "">("");

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
          Pusty środek punktu znaczy, że zdjęcie było słabe i ocena jest mniej pewna. Oś jest
          przycięta do zakresu Twoich ocen, żeby zmiana była widoczna.
        </p>
      </Card>

      {zmiany.length > 0 && (
        <Card
          title="Co się zmieniło"
          subtitle="Od pierwszego do ostatniego skanu, na tych samych obszarach"
        >
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
