import { format, isToday, isYesterday, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

/** Dzisiejsza data w formacie YYYY-MM-DD, w strefie czasowej urządzenia. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function toDate(iso: string): Date {
  return parseISO(`${iso}T00:00:00`);
}

/** „dzisiaj” / „wczoraj” / „pon, 12 sie” */
export function humanDate(iso: string): string {
  const d = toDate(iso);
  if (isToday(d)) return "dzisiaj";
  if (isYesterday(d)) return "wczoraj";
  return format(d, "EEE, d MMM", { locale: pl });
}

export function longDate(iso: string): string {
  return format(toDate(iso), "EEEE, d MMMM yyyy", { locale: pl });
}

export function shortDate(iso: string): string {
  return format(toDate(iso), "d MMM", { locale: pl });
}

export function monthName(iso: string): string {
  return format(toDate(iso), "LLLL yyyy", { locale: pl });
}

/** Liczba bez zbędnych zer: 82.50 → „82,5”, 82.00 → „82” */
export function num(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const rounded = Number(value.toFixed(decimals));
  return rounded.toLocaleString("pl-PL", { maximumFractionDigits: decimals });
}

export function kg(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : `${num(value, 2)} kg`;
}

/** 95 → „1:35”, 3720 → „62:00” */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 95 min → „1 h 35 min” */
export function duration(minutes: number | null | undefined): string {
  if (!minutes) return "–";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${m} min`;
}

/** Polska odmiana: 1 seria / 2 serie / 5 serii */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

export const sets = (n: number) => `${n} ${plural(n, "seria", "serie", "serii")}`;
export const reps = (n: number) => `${n} ${plural(n, "powtórzenie", "powtórzenia", "powtórzeń")}`;
export const workouts = (n: number) => `${n} ${plural(n, "trening", "treningi", "treningów")}`;

/** Skrót dużych liczb objętości: 12500 → „12,5 t” */
export function volume(kilograms: number): string {
  if (kilograms >= 1000) return `${num(kilograms / 1000, 1)} t`;
  return `${num(kilograms, 0)} kg`;
}

/** Szacunkowy 1RM (wzór Epleya) — porównywalna miara siły między seriami. */
export function e1rm(weightKg: number, repetitions: number): number {
  if (!weightKg || !repetitions) return 0;
  return weightKg * (1 + repetitions / 30);
}
