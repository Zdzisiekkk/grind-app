"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BodyWeightChart,
  PainChart,
  SleepChart,
  StrengthChart,
  VolumeChart,
  type StrengthPoint,
} from "@/components/charts/Charts";
import { HealthBreakdown } from "@/components/health/HealthCard";
import { Card, Chip, EmptyState, SegmentedControl, Select, Spinner, Stat } from "@/components/ui";
import type { ExercisePr, PeriodSummary, WorkoutLog } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { addDaysISO, e1rm, num, volume as fmtVolume, workouts as fmtWorkouts } from "@/lib/format";
import { bodyPart, injurySideLabel } from "@/lib/constants";
import { healthScore } from "@/lib/health";
import { medianBedtime, scoreNight, sleepDuration, timeToMin, type SleepNight } from "@/lib/sleep";

const EMPTY_POINTS: StrengthPoint[] = [];

export function ProgressScreen({
  userId,
  prs,
  bodyWeight,
  painByInjury,
  weeklyVolume,
  summaries,
  nights,
  today,
  sleepGoalMin,
  targetBedtime,
  kcalGoal,
  waterGoal,
  workoutsPerWeek,
}: {
  userId: string;
  prs: ExercisePr[];
  bodyWeight: { date: string; weight: number }[];
  painByInjury: {
    id: string;
    name: string;
    bodyPart: string;
    side: string;
    points: { date: string; level: number }[];
  }[];
  weeklyVolume: { label: string; volume: number; sets: number; workouts: number }[];
  summaries: { week: PeriodSummary; month: PeriodSummary };
  /** Noce od najnowszej — starsze niż okno służą tylko za punkt odniesienia. */
  nights: SleepNight[];
  today: string;
  sleepGoalMin: number;
  targetBedtime: string | null;
  kcalGoal: number | null;
  waterGoal: number;
  /** Ile treningów tygodniowo to komplet — z profilu, ustawia to kreator. */
  workoutsPerWeek: number;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const summary = summaries[period];
  const days = period === "week" ? 7 : 30;

  /* --- Sen i Health Score liczone dla wybranego okresu --- */

  const reference = useMemo(
    () => timeToMin(targetBedtime) ?? medianBedtime(nights.slice(0, 14)),
    [targetBedtime, nights],
  );

  const sleepPoints = useMemo(() => {
    const from = addDaysISO(today, -(days - 1));
    return nights
      .filter((n) => n.date >= from)
      .map((n) => ({
        date: n.date,
        minutes: n.sleep_min,
        score: scoreNight(n, { goalMin: sleepGoalMin, referenceBedtime: reference }).total,
      }))
      .reverse();
  }, [nights, today, days, sleepGoalMin, reference]);

  const health = useMemo(
    () =>
      healthScore({
        summary,
        sleepScores: sleepPoints.map((p) => p.score),
        goals: {
          kcal: kcalGoal,
          waterMl: waterGoal,
          workoutsPerWeek,
        },
      }),
    [summary, sleepPoints, kcalGoal, waterGoal, workoutsPerWeek],
  );

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

      <Card title="Health Score" subtitle="Sześć filarów, waga proporcjonalna do wpływu">
        <HealthBreakdown result={health} days={days} />
      </Card>

      <Card
        title="Sen"
        subtitle="Kolor słupka to ocena całej nocy"
        action={
          summary.avg_sleep_min != null ? (
            <Chip tone="accent">średnio {sleepDuration(summary.avg_sleep_min)}</Chip>
          ) : undefined
        }
      >
        <SleepChart data={sleepPoints} goalMin={sleepGoalMin} />
      </Card>

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
            label="Ból (średnia)"
            value={summary.avg_pain ?? "–"}
            sub={
              summary.pain_by_injury?.length
                ? `${summary.pain_by_injury.length} kontuzje w okresie`
                : "brak ocen"
            }
            tone={summary.avg_pain != null && summary.avg_pain >= 5 ? "danger" : undefined}
          />
          <Stat
            label="Sen (średnia)"
            value={summary.avg_sleep_min != null ? sleepDuration(summary.avg_sleep_min) : "–"}
            sub={
              summary.nights_logged
                ? `${summary.nights_logged} z ${summary.days_in_period} nocy`
                : "brak wpisów"
            }
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

      {painByInjury.length === 0 ? (
        <Card title="Ból kontuzji" subtitle="Skala 0–10">
          <EmptyState
            icon="🩹"
            title="Nie śledzisz jeszcze żadnej kontuzji"
            description="Dodaj kontuzję, a po treningach apka zapyta o ból i narysuje tu przebieg."
          />
        </Card>
      ) : (
        painByInjury.map((injury) => {
          const part = bodyPart(injury.bodyPart);
          const side = injurySideLabel(injury.side);
          const last = injury.points.at(-1);
          return (
            <Card
              key={injury.id}
              title={
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{part.icon}</span>
                  {injury.name}
                </span>
              }
              subtitle={[side, "skala 0–10"].filter(Boolean).join(" · ")}
              action={
                last ? (
                  <Chip tone={last.level >= 5 ? "danger" : last.level >= 3 ? "warn" : "success"}>
                    ostatnio {last.level}/10
                  </Chip>
                ) : undefined
              }
            >
              <PainChart data={injury.points} />
            </Card>
          );
        })
      )}

      <Card title="Waga ciała">
        <BodyWeightChart data={bodyWeight} />
      </Card>
    </div>
  );
}
