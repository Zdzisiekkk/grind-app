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

/* --------------------------------- Nawyki --------------------------------- */

/** Ikony do wyboru przy nawyku — emoji, żeby nie ciągnąć zestawu ikon. */
export const HABIT_ICONS = [
  "✅", "💊", "🧘", "🛌", "💧", "🥗", "🚭", "📖", "🧴", "🦷",
  "🩹", "🏃", "🧊", "☀️", "📵", "🧠", "🫁", "🧂",
] as const;

export const WEEKDAYS = [
  { value: 1, short: "Pn", label: "poniedziałek" },
  { value: 2, short: "Wt", label: "wtorek" },
  { value: 3, short: "Śr", label: "środa" },
  { value: 4, short: "Cz", label: "czwartek" },
  { value: 5, short: "Pt", label: "piątek" },
  { value: 6, short: "So", label: "sobota" },
  { value: 7, short: "Nd", label: "niedziela" },
] as const;

/** ISO-owy dzień tygodnia (1 = poniedziałek) z daty w formacie YYYY-MM-DD. */
export function isoWeekday(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 7 : day;
}

/** Czy nawyk obowiązuje danego dnia. Pusta lista dni = codziennie. */
export function habitDueOn(daysOfWeek: number[], dateISO: string): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(isoWeekday(dateISO));
}

/* ------------------------------- Nawodnienie ------------------------------ */

export const DEFAULT_WATER_GOAL_ML = 2500;
export const DEFAULT_WATER_PORTION_ML = 250;

/** Szybkie porcje przy dodawaniu wody. */
export const WATER_PORTIONS = [
  { ml: 200, label: "Szklanka", icon: "🥛" },
  { ml: 330, label: "Puszka", icon: "🥤" },
  { ml: 500, label: "Butelka", icon: "🍶" },
  { ml: 750, label: "Bidon", icon: "🚰" },
] as const;

export function waterLabel(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} l` : `${ml} ml`;
}

/* --------------------------------- Zadania -------------------------------- */

export const LIST_ICONS = [
  "📝", "🛒", "🏋️", "🩺", "🥊", "💰", "🏠", "✈️", "📚", "🔧",
] as const;

export const TODO_PRIORITIES = [
  { value: 0, label: "Zwykłe", chip: null },
  { value: 1, label: "Ważne", chip: "❗" },
  { value: 2, label: "Pilne", chip: "🔥" },
] as const;

export function priorityTone(priority: number): "neutral" | "warn" | "danger" {
  if (priority >= 2) return "danger";
  if (priority === 1) return "warn";
  return "neutral";
}

/** „Zaległe", „Dziś", „Jutro", „za 3 dni" — do etykiety terminu. */
export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const days = Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );
  if (days < 0) return { text: days === -1 ? "wczoraj" : `${-days} dni temu`, overdue: true };
  if (days === 0) return { text: "dziś", overdue: false };
  if (days === 1) return { text: "jutro", overdue: false };
  if (days <= 7) return { text: `za ${days} dni`, overdue: false };
  return { text: due.slice(5).replace("-", "."), overdue: false };
}

/* ----------------------------------- Sen ---------------------------------- */

/**
 * Czynniki, które mogły wpłynąć na noc. Klucze muszą się zgadzać z listą
 * w migracji 0010 (funkcja sleep_factor_keys) — baza je waliduje.
 *
 * `helps` mówi tylko, jak podpisać wniosek („alkohol zabiera Ci 14 pkt"
 * kontra „magnez dodaje 6"). O tym, czy coś naprawdę pomaga, decydują Twoje
 * dane, a nie ta flaga.
 */
export const SLEEP_FACTORS = [
  { value: "alkohol", label: "Alkohol", icon: "🍺", helps: false },
  { value: "kofeina", label: "Kofeina po południu", icon: "☕", helps: false },
  { value: "ekran", label: "Ekran przed snem", icon: "📱", helps: false },
  { value: "pozny_posilek", label: "Późny posiłek", icon: "🍔", helps: false },
  { value: "trening_wieczor", label: "Trening wieczorem", icon: "🏋️", helps: false },
  { value: "stres", label: "Stres", icon: "😰", helps: false },
  { value: "choroba", label: "Choroba / ból", icon: "🤒", helps: false },
  { value: "halas", label: "Hałas", icon: "🔊", helps: false },
  { value: "upal", label: "Za ciepło", icon: "🥵", helps: false },
  { value: "podroz", label: "Podróż / inne łóżko", icon: "✈️", helps: false },
  { value: "drzemka", label: "Drzemka w dzień", icon: "😪", helps: false },
  { value: "melatonina", label: "Melatonina", icon: "💊", helps: true },
  { value: "magnez", label: "Magnez", icon: "🧂", helps: true },
  { value: "ciemno", label: "Pełne zaciemnienie", icon: "🌑", helps: true },
  { value: "chlodno", label: "Chłodna sypialnia", icon: "❄️", helps: true },
] as const;

export type SleepFactorKey = (typeof SLEEP_FACTORS)[number]["value"];

export function sleepFactor(value: string) {
  return (
    SLEEP_FACTORS.find((f) => f.value === value) ?? {
      value,
      label: value,
      icon: "•",
      helps: false,
    }
  );
}

/** Podpowiedzi pory snu przy pierwszym wpisie — typowe godziny. */
export const BEDTIME_PRESETS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00"] as const;
export const WAKE_PRESETS = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00"] as const;
