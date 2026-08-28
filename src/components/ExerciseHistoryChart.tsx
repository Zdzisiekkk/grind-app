"use client";

import { StrengthChart } from "@/components/charts/LazyCharts";
import type { StrengthPoint } from "@/components/charts/Charts";

/** Cienka klientowa otoczka — wykres potrzebuje przeglądarki, dane liczy serwer. */
export function ExerciseHistoryChart({ data }: { data: StrengthPoint[] }) {
  return <StrengthChart data={data} mode="weight" />;
}
