"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

/**
 * Wykresy wczytywane dopiero wtedy, gdy są potrzebne.
 *
 * Recharts waży w paczce produkcyjnej ok. 380 kB i siedział w bundlu pięciu
 * tras — także tych, gdzie wykres jest jednym z wielu elementów i często
 * w ogóle nie trafia na ekran (np. /profil). Biblioteka i tak musiała się
 * pobrać i wykonać, zanim strona stała się klikalna.
 *
 * Ten sam wzorzec działa już w projekcie przy skanerze kodów kreskowych.
 *
 * `ssr: false` jest tu właściwe: wykres i tak nie ma co robić w HTML-u
 * z serwera, bo mierzy szerokość kontenera dopiero w przeglądarce.
 */

/** Miejsce na wykres, żeby strona nie podskakiwała po jego wczytaniu. */
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-[var(--radius)] bg-surface-2"
      aria-hidden
    >
      <Spinner />
    </div>
  );
}

export const StrengthChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.StrengthChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const BodyWeightChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.BodyWeightChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const PainChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.PainChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const VolumeChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.VolumeChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const SleepChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.SleepChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const SleepScoreChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.SleepScoreChart),
  { ssr: false, loading: () => <ChartSkeleton height={160} /> },
);

export const ViceChart = dynamic(
  () => import("@/components/charts/Charts").then((m) => m.ViceChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

// Typy nie mają wagi w przeglądarce — idą wprost ze źródła.
export type { StrengthPoint, SleepPoint, VicePoint } from "@/components/charts/Charts";
