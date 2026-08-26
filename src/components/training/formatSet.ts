import type { ExerciseMetric } from "@/lib/database.types";
import { mmss, num } from "@/lib/format";

type SetLike = {
  weight_kg?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  rpe?: number | null;
};

/** Jedna seria w zwięzłej formie: „80 kg × 8”, „0:40”, „35 kg · 30 m”. */
export function formatSet(set: SetLike, metric: ExerciseMetric = "weight_reps"): string {
  const parts: string[] = [];

  if (set.weight_kg != null && set.weight_kg > 0) parts.push(`${num(set.weight_kg, 2)} kg`);

  if (set.duration_seconds != null && set.duration_seconds > 0) {
    parts.push(mmss(set.duration_seconds));
  }
  if (set.distance_m != null && set.distance_m > 0) parts.push(`${num(set.distance_m, 0)} m`);

  if (set.reps != null && set.reps > 0) {
    const label = metric === "rounds" ? `${set.reps} rund` : `× ${set.reps}`;
    parts.push(parts.length && metric !== "rounds" ? label : label);
  }

  if (!parts.length) return "–";
  return parts.join(metric === "weight_reps" ? " " : " · ");
}

/** Skrót całego wyniku z jednego dnia: „80 kg × 8, 8, 7”. */
export function summarizeSets(sets: SetLike[], metric: ExerciseMetric = "weight_reps"): string {
  if (!sets.length) return "–";

  if (metric === "weight_reps") {
    const weights = new Set(sets.map((s) => s.weight_kg ?? 0));
    if (weights.size === 1) {
      const w = sets[0].weight_kg;
      const reps = sets.map((s) => s.reps ?? 0).join(", ");
      return w ? `${num(w, 2)} kg × ${reps}` : `× ${reps}`;
    }
  }
  return sets.map((s) => formatSet(s, metric)).join(" · ");
}
