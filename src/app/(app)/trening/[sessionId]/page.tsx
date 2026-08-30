import { notFound } from "next/navigation";
import { SessionScreen } from "@/components/training/SessionScreen";
import type { SessionExercise } from "@/components/training/types";
import type { CatalogExercise, Injury, LastExerciseSet, WorkoutLog } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Trening" };

/** Grupuje logi w "ostatni raz, gdy to robiłem": bierzemy komplet serii z najświeższej daty. */
function lastTimeFrom(logs: WorkoutLog[]): { date: string; sets: LastExerciseSet[] } | null {
  if (!logs.length) return null;
  const date = logs[0].date;
  const sets = logs
    .filter((l) => l.date === date)
    .sort((a, b) => a.set_number - b.set_number)
    .map<LastExerciseSet>((l) => ({
      date: l.date,
      set_number: l.set_number,
      weight_kg: l.weight_kg,
      reps: l.reps,
      rpe: l.rpe,
      duration_seconds: l.duration_seconds,
    }));
  return { date, sets };
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  // --- Ćwiczenia zaplanowane na ten dzień ---
  let day: { description: string | null; tracks_pain: boolean } | null = null;
  let planned: {
    id: string;
    catalog_exercise_id: string | null;
    name_override: string | null;
    muscle_group: string | null;
    target_sets: number | null;
    target_reps: string | null;
    target_note: string | null;
    technique_notes: string | null;
    rest_seconds: number | null;
  }[] = [];

  if (session.workout_day_id) {
    const [dayRes, exRes] = await Promise.all([
      supabase
        .from("workout_days")
        .select("description, tracks_pain")
        .eq("id", session.workout_day_id)
        .maybeSingle(),
      supabase
        .from("workout_exercises")
        .select(
          "id, catalog_exercise_id, name_override, muscle_group, target_sets, target_reps, target_note, technique_notes, rest_seconds",
        )
        .eq("workout_day_id", session.workout_day_id)
        .order("order_index"),
    ]);
    day = dayRes.data;
    planned = exRes.data ?? [];
  }

  // --- Logi tej sesji ---
  const { data: logRows } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("set_number");
  const logs = (logRows ?? []) as WorkoutLog[];

  // --- Katalog dla ćwiczeń z planu i tych dorzuconych w trakcie ---
  const catalogIds = [
    ...new Set(
      [
        ...planned.map((p) => p.catalog_exercise_id),
        ...logs.map((l) => l.catalog_exercise_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  let catalog = new Map<string, CatalogExercise>();
  if (catalogIds.length) {
    const { data } = await supabase.from("exercise_catalog").select("*").in("id", catalogIds);
    catalog = new Map((data ?? []).map((e) => [e.id, e as CatalogExercise]));
  }

  // --- Historia: co robiłem ostatnio w tych ćwiczeniach ---
  const historyByCatalog = new Map<string, WorkoutLog[]>();
  const historyByName = new Map<string, WorkoutLog[]>();

  const plannedNames = planned
    .map((p) => p.name_override ?? (p.catalog_exercise_id ? catalog.get(p.catalog_exercise_id)?.name : null))
    .filter((n): n is string => Boolean(n));

  if (catalogIds.length || plannedNames.length) {
    const { data: history } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_warmup", false)
      .lt("date", session.date)
      .order("date", { ascending: false })
      .order("set_number")
      .limit(600);

    for (const log of (history ?? []) as WorkoutLog[]) {
      if (log.catalog_exercise_id) {
        const list = historyByCatalog.get(log.catalog_exercise_id) ?? [];
        list.push(log);
        historyByCatalog.set(log.catalog_exercise_id, list);
      }
      const nameKey = log.exercise_name.toLowerCase();
      const byName = historyByName.get(nameKey) ?? [];
      byName.push(log);
      historyByName.set(nameKey, byName);
    }
  }

  // --- Sklejamy listę ćwiczeń widoczną na ekranie ---
  const exercises: SessionExercise[] = planned.map((p) => {
    const cat = p.catalog_exercise_id ? catalog.get(p.catalog_exercise_id) : undefined;
    const name = p.name_override ?? cat?.name ?? "Ćwiczenie";
    const history =
      (p.catalog_exercise_id ? historyByCatalog.get(p.catalog_exercise_id) : undefined) ??
      historyByName.get(name.toLowerCase()) ??
      [];

    return {
      key: p.id,
      workoutExerciseId: p.id,
      catalogId: p.catalog_exercise_id,
      name,
      muscleGroup: p.muscle_group ?? cat?.muscle_group ?? null,
      targetSets: p.target_sets,
      targetReps: p.target_reps,
      targetNote: p.target_note,
      techniqueNotes: p.technique_notes,
      restSeconds: p.rest_seconds,
      metric: cat?.metric ?? "weight_reps",
      imageUrl: cat?.image_thumb_url ?? cat?.image_url ?? null,
      lastTime: lastTimeFrom(history),
    };
  });

  // Ćwiczenia dorzucone w trakcie treningu (są w logach, nie ma ich w planie)
  const plannedIds = new Set(planned.map((p) => p.id));
  for (const log of logs) {
    if (log.workout_exercise_id && plannedIds.has(log.workout_exercise_id)) continue;
    const key = log.catalog_exercise_id ? `adhoc:${log.catalog_exercise_id}` : `adhoc:${log.exercise_name}`;
    if (exercises.some((e) => e.key === key)) continue;

    const cat = log.catalog_exercise_id ? catalog.get(log.catalog_exercise_id) : undefined;
    const history =
      (log.catalog_exercise_id ? historyByCatalog.get(log.catalog_exercise_id) : undefined) ??
      historyByName.get(log.exercise_name.toLowerCase()) ??
      [];

    exercises.push({
      key,
      workoutExerciseId: null,
      catalogId: log.catalog_exercise_id,
      name: log.exercise_name,
      muscleGroup: cat?.muscle_group ?? null,
      targetSets: null,
      targetReps: null,
      targetNote: "spoza planu",
      techniqueNotes: null,
      restSeconds: null,
      metric: cat?.metric ?? "weight_reps",
      imageUrl: cat?.image_thumb_url ?? null,
      lastTime: lastTimeFrom(history),
    });
  }

  // Kontuzje, o które apka pyta po treningu, plus dzisiejsze oceny - żeby
  // powtórne wejście w arkusz pokazywało to, co już wpisane.
  const [{ data: injuries }, { data: painToday }] = await Promise.all([
    supabase
      .from("injuries")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "healed")
      .eq("track_pain", true)
      .order("order_index"),
    supabase
      .from("pain_logs")
      .select("injury_id, level")
      .eq("user_id", user.id)
      .eq("date", session.date),
  ]);

  return (
    <SessionScreen
      session={{
        id: session.id,
        date: session.date,
        dayLabel: session.day_label,
        dayDescription: day?.description ?? null,
        tracksPain: day?.tracks_pain ?? false,
        finishedAt: session.finished_at,
        notes: session.notes,
      }}
      exercises={exercises}
      initialLogs={logs}
      userId={user.id}
      injuries={(injuries ?? []) as Injury[]}
      painToday={Object.fromEntries((painToday ?? []).map((p) => [p.injury_id, p.level]))}
    />
  );
}
