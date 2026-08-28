import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

/**
 * Strefa, w której aplikacja liczy „dzień".
 *
 * NIE pytamy o nią urządzenia. Na telefonie urządzeniem jest telefon, ale przy
 * renderowaniu na serwerze urządzeniem jest maszyna we Frankfurcie, a ta chodzi
 * na UTC — latem dwie godziny za Polską. Bez stałej strefy wszystko zapisane
 * między północą a drugą w nocy lądowało na wczoraj, a serwer i przeglądarka
 * dawały różne odpowiedzi na pytanie „który dziś dzień".
 *
 * Powiadomienia robiły to dobrze od początku (pytają bazę o strefę z profilu);
 * tutaj wyrównujemy do nich resztę aplikacji.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Warsaw";

const ISO_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data „teraz" w strefie aplikacji, jako YYYY-MM-DD. */
export function dateInAppZone(instant: Date): string {
  const parts = ISO_PARTS.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Dzisiejsza data w formacie YYYY-MM-DD. Ta sama na serwerze i w przeglądarce. */
export function todayISO(): string {
  return dateInAppZone(new Date());
}

/**
 * Przesunięcie o dni. Liczone w UTC, bo to czysta arytmetyka na kalendarzu —
 * doba w UTC zawsze ma 24 godziny, więc zmiana czasu nie potrafi tu zgubić dnia.
 */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function toDate(iso: string): Date {
  return parseISO(`${iso}T00:00:00`);
}

/**
 * „dzisiaj” / „wczoraj” / „pon, 12 sie”
 *
 * Porównujemy napisy z datami, a nie obiekty Date przez date-fns: `isToday`
 * pyta o dzisiaj urządzenie, więc serwer odpowiadałby inaczej niż przeglądarka.
 */
export function humanDate(iso: string): string {
  const today = todayISO();
  if (iso === today) return "dzisiaj";
  if (iso === addDaysISO(today, -1)) return "wczoraj";
  if (iso === addDaysISO(today, 1)) return "jutro";
  return format(toDate(iso), "EEE, d MMM", { locale: pl });
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
