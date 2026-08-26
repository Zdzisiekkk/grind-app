import type { ExerciseMetric, LastExerciseSet, WorkoutLog } from "@/lib/database.types";

export type SessionExercise = {
  /** id z workout_exercises albo klucz syntetyczny dla ćwiczenia dorzuconego ad hoc */
  key: string;
  workoutExerciseId: string | null;
  catalogId: string | null;
  name: string;
  muscleGroup: string | null;
  targetSets: number | null;
  targetReps: string | null;
  targetNote: string | null;
  techniqueNotes: string | null;
  restSeconds: number | null;
  metric: ExerciseMetric;
  imageUrl: string | null;
  /** ostatni raz, gdy robiłeś to ćwiczenie (przed dzisiaj) */
  lastTime: { date: string; sets: LastExerciseSet[] } | null;
};

export type SessionInfo = {
  id: string;
  date: string;
  dayLabel: string | null;
  dayDescription: string | null;
  tracksPain: boolean;
  finishedAt: string | null;
  notes: string | null;
};

export type { WorkoutLog };
