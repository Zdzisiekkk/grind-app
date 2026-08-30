"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Chip } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { formatSet, summarizeSets } from "@/components/training/formatSet";
import type { SessionExercise } from "@/components/training/types";
import type { WorkoutLog } from "@/lib/database.types";
import { METRIC_FIELDS, WEIGHT_STEPS } from "@/lib/constants";
import { clsx } from "@/lib/clsx";
import { humanDate, num } from "@/lib/format";

export type NewSet = {
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
};

/** "6-8" → 6, "10/stronę" → 10, "40s" → null (to metryka czasowa) */
function targetRepsNumber(target: string | null): number | null {
  if (!target) return null;
  const m = target.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function targetSeconds(target: string | null): number | null {
  if (!target) return null;
  const m = target.match(/(\d+)\s*(?:-\s*(\d+))?\s*s/i);
  if (m) return Number(m[2] ?? m[1]);
  const min = target.match(/(\d+)\s*(?:-\s*(\d+))?\s*min/i);
  if (min) return Number(min[2] ?? min[1]) * 60;
  return null;
}

export function ExerciseCard({
  exercise,
  logs,
  expanded,
  onToggle,
  onAddSet,
  onDeleteLog,
  weightStep,
  onWeightStepChange,
  saving,
}: {
  exercise: SessionExercise;
  logs: WorkoutLog[];
  expanded: boolean;
  onToggle: () => void;
  onAddSet: (values: NewSet) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
  weightStep: number;
  onWeightStepChange: (step: number) => void;
  saving: boolean;
}) {
  const fields = METRIC_FIELDS[exercise.metric];
  const done = logs.length;
  const target = exercise.targetSets ?? 0;
  const complete = target > 0 && done >= target;

  // Punkt startowy formularza: ostatnia seria z dzisiaj → ostatni trening → cel z planu
  const defaults = useMemo<NewSet>(() => {
    const lastToday = logs.at(-1);
    const lastEver = exercise.lastTime?.sets.at(-1);
    const src = lastToday ?? lastEver;
    return {
      weight_kg: src?.weight_kg ?? null,
      reps: src?.reps ?? targetRepsNumber(exercise.targetReps),
      duration_seconds: src?.duration_seconds ?? targetSeconds(exercise.targetReps),
      distance_m: (lastToday?.distance_m ?? null) as number | null,
      rpe: null,
    };
  }, [logs, exercise.lastTime, exercise.targetReps]);

  const [draft, setDraft] = useState<NewSet>(defaults);
  const [seed, setSeed] = useState<NewSet>(defaults);
  const [showRpe, setShowRpe] = useState(false);
  const [showStepPicker, setShowStepPicker] = useState(false);

  // Po zapisaniu serii formularz podnosi się do nowego punktu odniesienia.
  // Korekta stanu w trakcie renderu - bez efektu i bez zbędnego przemalowania.
  if (seed !== defaults) {
    setSeed(defaults);
    setDraft(defaults);
  }

  const set = (patch: Partial<NewSet>) => setDraft((d) => ({ ...d, ...patch }));

  const canSave =
    (fields.weight && draft.weight_kg !== null) ||
    (fields.reps && draft.reps !== null) ||
    (fields.time && draft.duration_seconds !== null) ||
    (fields.distance && draft.distance_m !== null);

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-[var(--radius)] border bg-surface transition-colors",
        complete ? "border-success/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span
          className={clsx(
            "tabular flex size-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold",
            complete ? "bg-[var(--success-soft)] text-success" : "bg-surface-2 text-muted",
          )}
        >
          {complete ? "✓" : `${done}/${target || "-"}`}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">
            {exercise.name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {exercise.targetSets && exercise.targetReps
              ? `${exercise.targetSets}×${exercise.targetReps}`
              : fields.hint}
            {exercise.targetNote && ` · ${exercise.targetNote}`}
            {exercise.muscleGroup && ` · ${exercise.muscleGroup}`}
          </span>
        </span>

        <span className="text-faint" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Historia z poprzedniego treningu - widoczna także po zwinięciu karty */}
      {exercise.lastTime && (
        <div className="border-t border-border/60 bg-surface-2/50 px-3 py-2 text-[12px]">
          <span className="text-faint">Ostatnio ({humanDate(exercise.lastTime.date)}): </span>
          <span className="tabular font-medium">
            {summarizeSets(exercise.lastTime.sets, exercise.metric)}
          </span>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border p-3">
          {exercise.techniqueNotes && (
            <p className="mb-3 rounded-lg bg-[var(--info-soft)] px-3 py-2 text-[13px] text-info">
              {exercise.techniqueNotes}
            </p>
          )}

          {/* Serie zapisane dzisiaj */}
          {logs.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[14px]"
                >
                  <span className="tabular w-6 shrink-0 text-[12px] font-semibold text-faint">
                    {log.set_number}.
                  </span>
                  <span className="tabular flex-1 font-semibold">
                    {formatSet(log, exercise.metric)}
                  </span>
                  {log.rpe != null && (
                    <Chip tone="neutral">RPE {num(log.rpe, 1)}</Chip>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    aria-label={`Usuń serię ${log.set_number}`}
                    className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-3 hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Formularz nowej serii */}
          <div className="flex flex-col gap-3">
            {fields.weight && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted">Ciężar</span>
                  <button
                    type="button"
                    onClick={() => setShowStepPicker((v) => !v)}
                    className="text-[12px] font-medium text-accent"
                  >
                    skok: {num(weightStep, 2)} kg
                  </button>
                </div>
                {showStepPicker && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {WEIGHT_STEPS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          onWeightStepChange(s);
                          setShowStepPicker(false);
                        }}
                        className={clsx(
                          "min-h-9 rounded-lg px-3 text-[13px] font-semibold",
                          s === weightStep
                            ? "bg-accent text-[var(--accent-fg)]"
                            : "bg-surface-2 text-muted",
                        )}
                      >
                        {num(s, 2)} kg
                      </button>
                    ))}
                  </div>
                )}
                <NumberStepper
                  ariaLabel="Ciężar w kilogramach"
                  value={draft.weight_kg}
                  onChange={(v) => set({ weight_kg: v })}
                  step={weightStep}
                  decimals={2}
                  max={1000}
                  suffix="kg"
                  size="lg"
                />
              </div>
            )}

            {fields.reps && (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">
                  {exercise.metric === "rounds" ? "Rundy" : "Powtórzenia"}
                </span>
                <NumberStepper
                  ariaLabel="Liczba powtórzeń"
                  value={draft.reps}
                  onChange={(v) => set({ reps: v })}
                  step={1}
                  max={1000}
                  size="lg"
                />
              </div>
            )}

            {fields.time && (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">Czas (sekundy)</span>
                <NumberStepper
                  ariaLabel="Czas w sekundach"
                  value={draft.duration_seconds}
                  onChange={(v) => set({ duration_seconds: v })}
                  step={5}
                  max={86400}
                  suffix="s"
                  size="lg"
                />
              </div>
            )}

            {fields.distance && (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">Dystans (metry)</span>
                <NumberStepper
                  ariaLabel="Dystans w metrach"
                  value={draft.distance_m}
                  onChange={(v) => set({ distance_m: v })}
                  step={5}
                  max={100000}
                  suffix="m"
                />
              </div>
            )}

            {showRpe ? (
              <div>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">
                  RPE - jak ciężko było (1-10)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set({ rpe: draft.rpe === r ? null : r })}
                      className={clsx(
                        "tabular min-h-10 min-w-11 rounded-lg text-[14px] font-semibold",
                        draft.rpe === r
                          ? "bg-accent text-[var(--accent-fg)]"
                          : "bg-surface-2 text-muted",
                      )}
                    >
                      {num(r, 1)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRpe(true)}
                className="self-start text-[13px] font-medium text-accent"
              >
                + dodaj RPE
              </button>
            )}

            <Button
              variant="primary"
              size="lg"
              block
              loading={saving}
              disabled={!canSave}
              onClick={() => onAddSet(draft)}
            >
              Zapisz serię {done + 1}
            </Button>

            {exercise.catalogId && (
              <Link
                href={`/cwiczenia/${exercise.catalogId}`}
                className="self-center text-[13px] text-muted underline underline-offset-4"
              >
                Technika i historia tego ćwiczenia
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
