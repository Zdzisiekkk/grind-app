"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Chip, Sheet } from "@/components/ui";
import { ExerciseCard, type NewSet } from "@/components/training/ExerciseCard";
import { RestTimer } from "@/components/training/RestTimer";
import { KneePainPicker } from "@/components/training/KneePainPicker";
import { ExercisePicker } from "@/components/training/ExercisePicker";
import type { SessionExercise, SessionInfo } from "@/components/training/types";
import type { CatalogExercise, WorkoutLog } from "@/lib/database.types";
import { DEFAULT_REST_SECONDS, DEFAULT_WEIGHT_STEP } from "@/lib/constants";
import { useLocalNumber } from "@/lib/localSetting";
import { createClient } from "@/lib/supabase/client";
import { longDate, sets as setsLabel, volume } from "@/lib/format";

const STEP_KEY = "grind:weight-step";
/** Sesja bez jawnego startu (np. wznowiona) — liczymy najwyżej 6 h treningu. */
const MAX_SESSION_HOURS = 6;

/** Odczyty zegara trzymamy poza renderem — to funkcje nieczyste. */
function restWindow(seconds: number) {
  return { endsAt: Date.now() + seconds * 1000, total: seconds };
}

function elapsedMinutes(startDate: string) {
  const now = Date.now();
  const startedAt = Math.max(new Date(startDate).getTime(), now - MAX_SESSION_HOURS * 3600_000);
  return Math.max(1, Math.round((now - startedAt) / 60000));
}

export function SessionScreen({
  session,
  exercises: initialExercises,
  initialLogs,
  userId,
  hasKneePainToday,
}: {
  session: SessionInfo;
  exercises: SessionExercise[];
  initialLogs: WorkoutLog[];
  userId: string;
  hasKneePainToday: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [exercises, setExercises] = useState(initialExercises);
  const [logs, setLogs] = useState(initialLogs);
  const [expanded, setExpanded] = useState<string | null>(() => {
    const firstUndone = initialExercises.find(
      (ex) => !initialLogs.some((l) => l.workout_exercise_id === ex.workoutExerciseId),
    );
    return firstUndone?.key ?? initialExercises[0]?.key ?? null;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<{ endsAt: number; total: number } | null>(null);
  const [painOpen, setPainOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [weightStep, changeWeightStep] = useLocalNumber(STEP_KEY, DEFAULT_WEIGHT_STEP);

  // Wyjście z treningu przez pomyłkę = utrata kontekstu, więc ostrzegamy.
  useEffect(() => {
    if (session.finishedAt) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (logs.length === 0) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [logs.length, session.finishedAt]);

  const logsFor = useCallback(
    (ex: SessionExercise) =>
      logs
        .filter((l) =>
          ex.workoutExerciseId
            ? l.workout_exercise_id === ex.workoutExerciseId
            : l.workout_exercise_id === null &&
              (ex.catalogId ? l.catalog_exercise_id === ex.catalogId : l.exercise_name === ex.name),
        )
        .sort((a, b) => a.set_number - b.set_number),
    [logs],
  );

  const totals = useMemo(() => {
    const working = logs.filter((l) => !l.is_warmup);
    return {
      sets: working.length,
      volumeKg: working.reduce((sum, l) => sum + (l.weight_kg ?? 0) * (l.reps ?? 0), 0),
      doneExercises: exercises.filter((ex) => logsFor(ex).length > 0).length,
    };
  }, [logs, exercises, logsFor]);

  async function addSet(ex: SessionExercise, values: NewSet) {
    setSavingKey(ex.key);
    setError(null);
    const setNumber = logsFor(ex).length + 1;

    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        user_id: userId,
        session_id: session.id,
        workout_exercise_id: ex.workoutExerciseId,
        catalog_exercise_id: ex.catalogId,
        exercise_name: ex.name,
        date: session.date,
        set_number: setNumber,
        weight_kg: values.weight_kg,
        reps: values.reps,
        duration_seconds: values.duration_seconds,
        distance_m: values.distance_m,
        rpe: values.rpe,
      })
      .select()
      .single();

    setSavingKey(null);

    if (error) {
      setError(`Nie udało się zapisać serii: ${error.message}`);
      return;
    }

    setLogs((prev) => [...prev, data as WorkoutLog]);
    navigator.vibrate?.(15);

    const rest = ex.restSeconds ?? DEFAULT_REST_SECONDS;
    if (rest > 0) setTimer(restWindow(rest));
  }

  async function deleteLog(id: string) {
    const removed = logs.find((l) => l.id === id);
    if (!removed) return;

    setLogs((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("workout_logs").delete().eq("id", id);
    if (error) {
      setError(`Nie udało się usunąć serii: ${error.message}`);
      setLogs((prev) => [...prev, removed]);
      return;
    }

    // Przenumeruj pozostałe serie tego ćwiczenia, żeby nie było dziur (1, 3, 4…).
    const siblings = logs
      .filter(
        (l) =>
          l.id !== id &&
          l.workout_exercise_id === removed.workout_exercise_id &&
          l.exercise_name === removed.exercise_name,
      )
      .sort((a, b) => a.set_number - b.set_number);

    const renumbered = siblings
      .map((l, i) => ({ ...l, set_number: i + 1 }))
      .filter((l, i) => l.set_number !== siblings[i].set_number);

    if (renumbered.length) {
      await Promise.all(
        renumbered.map((l) =>
          supabase.from("workout_logs").update({ set_number: l.set_number }).eq("id", l.id),
        ),
      );
      setLogs((prev) =>
        prev.map((l) => renumbered.find((r) => r.id === l.id) ?? l),
      );
    }
  }

  function addAdHocExercise(item: CatalogExercise) {
    const key = `adhoc:${item.id}`;
    if (exercises.some((e) => e.key === key)) {
      setExpanded(key);
      setPickerOpen(false);
      return;
    }
    setExercises((prev) => [
      ...prev,
      {
        key,
        workoutExerciseId: null,
        catalogId: item.id,
        name: item.name,
        muscleGroup: item.muscle_group,
        targetSets: null,
        targetReps: null,
        targetNote: "spoza planu",
        techniqueNotes: null,
        restSeconds: null,
        metric: item.metric,
        imageUrl: item.image_thumb_url ?? item.image_url,
        lastTime: null,
      },
    ]);
    setExpanded(key);
    setPickerOpen(false);
  }

  async function finishSession() {
    if (session.tracksKneePain && !hasKneePainToday) {
      setPainOpen(true);
      return;
    }
    await closeSession();
  }

  async function closeSession() {
    setFinishing(true);
    const minutes = elapsedMinutes(session.date);

    const { error } = await supabase
      .from("workout_sessions")
      .update({ finished_at: new Date().toISOString(), duration_min: minutes })
      .eq("id", session.id);

    setFinishing(false);
    if (error) {
      setError(`Nie udało się zakończyć treningu: ${error.message}`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight">
              {session.dayLabel ?? "Trening"}
            </h1>
            <p className="text-[13px] text-muted">{longDate(session.date)}</p>
          </div>
          {session.finishedAt ? (
            <Chip tone="success">zakończony</Chip>
          ) : (
            <Chip tone="accent">w trakcie</Chip>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip>
            {totals.doneExercises}/{exercises.length} ćwiczeń
          </Chip>
          <Chip>{setsLabel(totals.sets)}</Chip>
          {totals.volumeKg > 0 && <Chip>objętość {volume(totals.volumeKg)}</Chip>}
        </div>

        {session.dayDescription && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
            {session.dayDescription}
          </p>
        )}
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-2">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.key}
            exercise={ex}
            logs={logsFor(ex)}
            expanded={expanded === ex.key}
            onToggle={() => setExpanded(expanded === ex.key ? null : ex.key)}
            onAddSet={(values) => addSet(ex, values)}
            onDeleteLog={deleteLog}
            weightStep={weightStep}
            onWeightStepChange={changeWeightStep}
            saving={savingKey === ex.key}
          />
        ))}
      </div>

      <Button variant="secondary" block onClick={() => setPickerOpen(true)}>
        + Dodaj ćwiczenie spoza planu
      </Button>

      {session.tracksKneePain && (
        <Button variant="secondary" block onClick={() => setPainOpen(true)}>
          🦵 {hasKneePainToday ? "Zmień ocenę bólu kolana" : "Oceń ból kolana"}
        </Button>
      )}

      {!session.finishedAt && (
        <Button variant="primary" size="lg" block loading={finishing} onClick={finishSession}>
          Zakończ trening
        </Button>
      )}

      {timer && (
        <RestTimer
          endsAt={timer.endsAt}
          totalSeconds={timer.total}
          onDismiss={() => setTimer(null)}
          onExtend={(s) =>
            setTimer((t) => (t ? { endsAt: t.endsAt + s * 1000, total: t.total + s } : t))
          }
        />
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Dodaj ćwiczenie">
        <ExercisePicker onPick={addAdHocExercise} />
      </Sheet>

      <Sheet open={painOpen} onClose={() => setPainOpen(false)} title="Ból kolana po treningu">
        <KneePainPicker
          userId={userId}
          date={session.date}
          sessionId={session.id}
          onSaved={async () => {
            setPainOpen(false);
            if (!session.finishedAt) await closeSession();
          }}
        />
      </Sheet>
    </div>
  );
}
