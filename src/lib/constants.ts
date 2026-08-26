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
 * Części ciała dla kontuzji. Klucz trafia do bazy, reszta służy tylko widokom —
 * dzięki temu zmiana etykiety nie wymaga migracji.
 */
export const BODY_PARTS = [
  { value: "knee", label: "Kolano", icon: "🦵" },
  { value: "shoulder", label: "Bark", icon: "💪" },
  { value: "elbow", label: "Łokieć", icon: "🦾" },
  { value: "wrist", label: "Nadgarstek", icon: "🤚" },
  { value: "hand", label: "Dłoń / palce", icon: "✋" },
  { value: "hip", label: "Biodro", icon: "🕺" },
  { value: "ankle", label: "Kostka", icon: "🦶" },
  { value: "foot", label: "Stopa", icon: "👣" },
  { value: "lower_back", label: "Dolny odcinek pleców", icon: "🔻" },
  { value: "upper_back", label: "Górny odcinek pleców", icon: "🔺" },
  { value: "neck", label: "Szyja", icon: "🧣" },
  { value: "groin", label: "Pachwina", icon: "🔗" },
  { value: "hamstring", label: "Dwugłowy uda", icon: "🍖" },
  { value: "calf", label: "Łydka", icon: "🦿" },
  { value: "achilles", label: "Ścięgno Achillesa", icon: "🩹" },
  { value: "ribs", label: "Żebra / klatka", icon: "🫁" },
  { value: "head", label: "Głowa", icon: "🧠" },
  { value: "other", label: "Inne", icon: "❓" },
] as const;

export type BodyPart = (typeof BODY_PARTS)[number]["value"];

export function bodyPart(value: string) {
  return BODY_PARTS.find((b) => b.value === value) ?? BODY_PARTS[BODY_PARTS.length - 1];
}

export const INJURY_SIDES = [
  { value: "left", label: "Lewa" },
  { value: "right", label: "Prawa" },
  { value: "both", label: "Obie" },
  { value: "none", label: "Nie dotyczy" },
] as const;

export const INJURY_STATUSES = [
  { value: "active", label: "Aktywna", hint: "Boli, pilnujemy jej po treningach." },
  { value: "monitoring", label: "Obserwacja", hint: "Prawie zeszła, ale warto patrzeć." },
  { value: "healed", label: "Wyleczona", hint: "Zostaje w historii, nie pyta o ocenę." },
] as const;

export function injuryStatusTone(status: string): "success" | "accent" | "warn" {
  if (status === "healed") return "success";
  if (status === "monitoring") return "warn";
  return "accent";
}

/** Krótki opis kontuzji do nagłówków: „Lewe kolano · Kolano". */
export function injurySideLabel(side: string): string | null {
  return INJURY_SIDES.find((s) => s.value === side && s.value !== "none")?.label ?? null;
}

/**
 * Skala bólu 0–10.
 * Kolory i progi pochodzą z palety statusów w lib/viz.ts — trzymamy je w jednym
 * miejscu, żeby suwak w formularzu i wykres w postępach mówiły to samo.
 */
export function painDescriptor(level: number): { label: string; color: string } {
  const { color, label } = painStatus(level);
  return { color, label };
}
