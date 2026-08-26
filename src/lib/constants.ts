import type { ActivityType, DayType, ExerciseMetric, MealType } from "@/lib/database.types";
import { painStatus } from "@/lib/viz";

export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "Śniadanie", icon: "🌅" },
  { value: "lunch", label: "Obiad", icon: "🍽️" },
  { value: "dinner", label: "Kolacja", icon: "🌙" },
  { value: "snack", label: "Przekąska", icon: "🍎" },
];

export const MEAL_LABEL: Record<MealType, string> = Object.fromEntries(
  MEAL_TYPES.map((m) => [m.value, m.label]),
) as Record<MealType, string>;

export const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string; hasDistance: boolean }[] = [
  { value: "running", label: "Bieganie", icon: "🏃", hasDistance: true },
  { value: "cycling", label: "Rower", icon: "🚴", hasDistance: true },
  { value: "swimming", label: "Pływanie", icon: "🏊", hasDistance: true },
  { value: "mma_sparring", label: "Sparing MMA", icon: "🥊", hasDistance: false },
  { value: "mma_training", label: "Trening MMA", icon: "🥋", hasDistance: false },
  { value: "walking", label: "Marsz / spacer", icon: "🚶", hasDistance: true },
  { value: "rowing", label: "Ergometr wioślarski", icon: "🚣", hasDistance: true },
  { value: "hiking", label: "Górska wędrówka", icon: "🥾", hasDistance: true },
  { value: "climbing", label: "Wspinaczka", icon: "🧗", hasDistance: false },
  { value: "other", label: "Inne", icon: "⚡", hasDistance: true },
];

export const ACTIVITY_LABEL: Record<ActivityType, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((a) => [a.value, a.label]),
) as Record<ActivityType, string>;

export const ACTIVITY_ICON: Record<ActivityType, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((a) => [a.value, a.icon]),
) as Record<ActivityType, string>;

/** Orientacyjne MET — do szacowania kalorii, gdy nie wpiszesz ich ręcznie. */
export const ACTIVITY_MET: Record<ActivityType, number> = {
  running: 9.8,
  cycling: 7.5,
  swimming: 8.0,
  mma_sparring: 10.3,
  mma_training: 8.5,
  walking: 3.5,
  rowing: 7.0,
  hiking: 6.0,
  climbing: 8.0,
  other: 6.0,
};

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  gym: "Siłownia",
  conditioning: "Kondycja",
  mobility: "Mobilność",
  mma: "MMA",
  other: "Inne",
};

export const DAY_TYPE_ICON: Record<DayType, string> = {
  gym: "🏋️",
  conditioning: "🚴",
  mobility: "🧘",
  mma: "🥊",
  other: "•",
};

/** Jak zapisujemy wynik danego ćwiczenia. */
export const METRIC_FIELDS: Record<
  ExerciseMetric,
  { weight: boolean; reps: boolean; time: boolean; distance: boolean; hint: string }
> = {
  weight_reps: { weight: true, reps: true, time: false, distance: false, hint: "ciężar × powtórzenia" },
  reps: { weight: false, reps: true, time: false, distance: false, hint: "powtórzenia" },
  time: { weight: false, reps: false, time: true, distance: false, hint: "czas" },
  distance: { weight: true, reps: false, time: false, distance: true, hint: "ciężar i dystans" },
  rounds: { weight: false, reps: true, time: false, distance: false, hint: "rundy" },
};

/** Kroki zmiany ciężaru — przełączalne, bo talerze bywają różne. */
export const WEIGHT_STEPS = [0.5, 1, 1.25, 2.5, 5, 10] as const;
export const DEFAULT_WEIGHT_STEP = 2.5;
export const DEFAULT_REST_SECONDS = 90;

/**
 * Skala bólu kolana 0–10.
 * Kolory i progi pochodzą z palety statusów w lib/viz.ts — trzymamy je w jednym
 * miejscu, żeby suwak w formularzu i wykres w postępach mówiły to samo.
 */
export function painDescriptor(level: number): { label: string; color: string } {
  const { color, label } = painStatus(level);
  return { color, label };
}
