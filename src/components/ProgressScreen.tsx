"use client";

import { useEffect, useMemo, useState } from "react";
import { BodyWeightChart, KneePainChart, StrengthChart, VolumeChart, type StrengthPoint } from "@/components/charts/Charts";
import { Card, Chip, EmptyState, SegmentedControl, Select, Spinner, Stat } from "@/components/ui";
import type { ExercisePr, PeriodSummary, WorkoutLog } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { e1rm, num, volume as fmtVolume, workouts as fmtWorkouts } from "@/lib/format";

const EMPTY_POINTS: StrengthPoint[] = [];

export function ProgressScreen({
  userId,
  prs,
  bodyWeight,
  kneePain,
  weeklyVolume,
  summaries,
}: {
  userId: string;
  prs: ExercisePr[];
  bodyWeight: { date: string; weight: number }[];
  kneePain: { date: string; level: number }[];
  weeklyVolume: { label: string; volume: number; sets: number; workouts: number }[];
  summaries: { week: PeriodSummary; month: PeriodSummary };
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const summary = summaries[period];

  const [exerciseId, setExerciseId] = useState<string>(prs[0]?.exercise_key ?? "");
  const [strengthMode, setStrengthMode] = useState<"weight" | "e1rm">("weight");
  // Historia trzymana razem z kluczem ćwiczenia, którego dotyczy — dzięki temu
  // „ładowanie” i „pusto” wychodzą z danych, bez czyszczenia stanu w efekcie.
  const [history, setHistory] = useState<{ key: string; points: StrengthPoint[] } | null>(null);

  const selected = useMemo(
    () => prs.find((p) => p.exercise_key === exerciseId),
    [prs, exerciseId],
  );

  // Historia wybranego ćwiczenia: z każdego dnia bierzemy najcięższą serię roboczą.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const key = selected.exercise_key;

    (async () => {
      const supabase = createClient();
      let request = supabase
        .from("workout_logs")
        .select("date, weight_kg, reps, catalog_exercise_id, exercise_name")
        .eq("user_id", userId)
        .eq("is_warmup", false)
        .order("date", { ascending: true })
        .limit(1000);

      request = selected.catalog_exercise_id
        ? request.eq("catalog_exercise_id", selected.catalog_exercise_id)
        : request.ilike("exercise_name", selected.exercise_name);

      const { data } = await request;
      if (cancelled) return;

      const byDate = new Map<string, StrengthPoint>();
      for (const row of (data ?? []) as Pick<WorkoutLog, "date" | "weight_kg" | "reps">[]) {
        const weight = row.weight_kg ?? 0;
        const reps = row.reps ?? 0;
        const estimated = e1rm(weight, reps);
        const current = byDate.get(row.date);

        if (!current || weight > (current.weight ?? 0)) {
          byDate.set(row.date, {
            date: row.date,
            weight,
            reps,
            e1rm: Math.max(estimated, current?.e1rm ?? 0),
          });
        } else if (estimated > (current.e1rm ?? 0)) {
          byDate.set(row.date, { ...current, e1rm: estimated });
        }
      }

      setHistory({
        key,
        points: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selected, userId]);

  const points = history?.key === exerciseId ? history.points : EMPTY_POINTS;
  const loading = Boolean(selected) && history?.key !== exerciseId;

  const weightDelta =
    summary.weight_start != null && summary.weight_end != null
      ? summary.weight_end - summary.weight_start
      : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Postępy</h1>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            { value: "week", label: "7 dni" },
            { value: "month", label: "30 dni" },
          ]}
        />
      </header>

      <Card title="Podsumowanie okresu">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Treningi" value={summary.workouts} sub={`${summary.sets} serii`} />
          <Stat label="Objętość" value={fmtVolume(summary.volume_kg)} tone="accent" />
          <Stat
            label="Średnio kcal"
            value={summary.avg_kcal || "–"}
            sub={summary.days_logged_food ? `z ${summary.days_logged_food} dni` : "brak wpisów"}
          />
          <Stat
            label="Aktywności"
            value={summary.activities}
            sub={summary.activity_minutes ? `${summary.activity_minutes} min` : undefined}
          />
          <Stat
            label="Ból kolana"
            value={summary.avg_knee_pain ?? "–"}
            sub="średnia z ocen"
            tone={summary.avg_knee_pain != null && summary.avg_knee_pain >= 5 ? "danger" : undefined}
          />
          <Stat
            label="Waga"
            value={summary.weight_end != null ? `${num(summary.weight_end, 1)} kg` : "–"}
            sub={
              weightDelta != null
                ? `${weightDelta > 0 ? "+" : ""}${num(weightDelta, 1)} kg w okresie`
                : undefined
            }
          />
        </div>
      </Card>

      <Card
        title="Progres siłowy"
        subtitle={selected ? selected.exercise_name : "Wybierz ćwiczenie"}
        action={
          <Chip tone="accent">
            {strengthMode === "weight" ? "najcięższa seria" : "szac. 1RM"}
          </Chip>
        }
      >
        {prs.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title="Brak zapisanych serii"
            description="Zapisz pierwszy trening, a tutaj pojawi się wykres progresu."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {prs.map((p) => (
                <option key={p.exercise_key} value={p.exercise_key}>
                  {p.exercise_name} ({p.total_sets} serii)
                </option>
              ))}
            </Select>

            <SegmentedControl
              value={strengthMode}
              onChange={setStrengthMode}
              options={[
                { value: "weight", label: "Ciężar" },
                { value: "e1rm", label: "Szac. 1RM" },
              ]}
            />

            {loading ? (
              <div className="flex h-[200px] items-center justify-center text-muted">
                <Spinner />
              </div>
            ) : (
              <StrengthChart data={points} mode={strengthMode} />
            )}

            {selected && (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Rekord" value={`${num(selected.best_weight_kg, 2)} kg`} tone="accent" />
                <Stat label="Szac. 1RM" value={`${num(selected.best_e1rm_kg, 1)} kg`} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Objętość tygodniowa" subtitle="Ciężar × powtórzenia, suma z tygodnia">
        <VolumeChart data={weeklyVolume} />
        <p className="mt-2 text-[12px] text-faint">
          Ostatnie {weeklyVolume.length} tygodni ·{" "}
          {fmtWorkouts(weeklyVolume.reduce((s, w) => s + w.workouts, 0))}
        </p>
      </Card>

      <Card title="Ból kolana w czasie" subtitle="Skala 0–10 po treningach nóg">
        <KneePainChart data={kneePain} />
      </Card>

      <Card title="Waga ciała">
        <BodyWeightChart data={bodyWeight} />
      </Card>
    </div>
  );
}
