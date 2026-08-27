/**
 * Sleep score — ocena jednej nocy w skali 0–100.
 *
 * Formuła mieszka tutaj, a nie w bazie, z trzech powodów:
 *  1. regularność wymaga porównania z poprzednimi nocami, więc i tak nie da
 *     się jej policzyć w kolumnie generowanej,
 *  2. wagi będą się jeszcze zmieniać, a strojenie nie powinno wymagać migracji,
 *  3. ten sam wynik potrzebny jest ekranowi snu i Health Score — jedno miejsce
 *     prawdy jest ważniejsze niż policzenie tego po stronie serwera.
 *
 * Wynik NIGDY nie jest pokazywany jako sama liczba — zawsze z rozbiciem na
 * cztery składowe, żeby było wiadomo, co konkretnie podnieść.
 */

import { STATUS } from "@/lib/viz";

export const DEFAULT_SLEEP_GOAL_MIN = 480; // 8 h

/** Ile punktów może dać każda składowa. Suma = 100. */
export const SLEEP_WEIGHTS = {
  duration: 40,
  feeling: 25,
  continuity: 20,
  regularity: 15,
} as const;

export type SleepNight = {
  date: string;
  bedtime: string;
  wake_time: string;
  sleep_min: number;
  time_in_bed_min: number;
  fell_asleep_min: number;
  awakenings: number;
  awake_min: number;
  quality: number;
  morning_energy: number | null;
  nap_min: number;
  factors: string[];
  note: string | null;
};

export type ScorePart = {
  key: "duration" | "feeling" | "continuity" | "regularity";
  label: string;
  /** 0–1; mnożone przez wagę składowej. */
  ratio: number;
  points: number;
  max: number;
  hint: string;
};

export type SleepScore = {
  /** 0–100. */
  total: number;
  parts: ScorePart[];
  /** Składowe, których nie dało się policzyć — wagi rozdzielone na resztę. */
  skipped: ScorePart["key"][];
};

/* ------------------------------ Czas i godziny ----------------------------- */

/** „23:30:00" → 1410. Zwraca null dla pustych wartości. */
export function timeToMin(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 1410 → „23:30". Minuty spoza doby zawijają się. */
export function minToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Godzina zaśnięcia jako minuty od 18:00.
 * Dzięki temu 23:30 i 00:30 leżą obok siebie (330 i 390), a nie na
 * przeciwnych końcach doby — inaczej średnia z tych dwóch wypadłaby w południe.
 */
export function bedtimeAxis(min: number): number {
  return (min - 18 * 60 + 1440) % 1440;
}

/** 465 minut → „7 h 45 min". */
export function sleepDuration(min: number | null | undefined): string {
  if (min == null) return "–";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** Skrót do kafelków: 465 → „7:45". */
export function sleepClock(min: number | null | undefined): string {
  if (min == null) return "–";
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}

/* -------------------------------- Składowe --------------------------------- */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Długość: pełnia punktów od pół godziny przed celem w górę.
 * Za krótko boli mocno (0 pkt przy 3 h poniżej celu), za długo tylko lekko —
 * przespana godzina ekstra nie jest błędem, dopiero regularne 10 h to sygnał.
 */
function durationRatio(sleepMin: number, goalMin: number): number {
  const deficit = goalMin - 30 - sleepMin;
  if (deficit > 0) return clamp01(1 - deficit / 150);
  const excess = sleepMin - (goalMin + 90);
  if (excess > 0) return clamp01(1 - excess / 180);
  return 1;
}

/**
 * Odczucia: ocena snu (1–5) plus energia po przebudzeniu.
 * Rozdzielone celowo — można przespać osiem godzin i wstać rozbitym.
 * Gdy energii nie podałeś, cała waga wraca do oceny snu.
 */
function feelingRatio(quality: number, energy: number | null): number {
  const q = clamp01((quality - 1) / 4);
  if (energy == null) return q;
  const e = clamp01((energy - 1) / 4);
  return q * 0.6 + e * 0.4;
}

/**
 * Ciągłość: pobudki, czas nieprzespany w środku nocy i długie zasypianie.
 * Kara jest odejmowana od pełnej puli, więc trzy drobne rzeczy naraz zabolą
 * tyle samo co jedna duża — i o to chodzi, bo tak właśnie czuje się taka noc.
 */
function continuityRatio(night: SleepNight): number {
  const wakePenalty = Math.min(0.6, night.awakenings * 0.2);
  const awakePenalty = Math.min(0.4, Math.max(0, night.awake_min - 10) / 100);
  const latencyPenalty = Math.min(0.3, Math.max(0, night.fell_asleep_min - 25) / 100);
  return clamp01(1 - wakePenalty - awakePenalty - latencyPenalty);
}

/**
 * Regularność: jak blisko Twojej zwykłej pory się położyłeś.
 * Punktem odniesienia jest mediana ostatnich nocy (odporna na jedną imprezę)
 * albo godzina docelowa z profilu, jeśli ją ustawiłeś.
 */
function regularityRatio(bedMin: number, referenceMin: number): number {
  const axis = bedtimeAxis(bedMin);
  const ref = bedtimeAxis(referenceMin);
  const raw = Math.abs(axis - ref);
  const diff = Math.min(raw, 1440 - raw);
  if (diff <= 30) return 1;
  return clamp01(1 - (diff - 30) / 90);
}

/** Mediana pory zaśnięcia z podanych nocy — punkt odniesienia dla regularności. */
export function medianBedtime(nights: SleepNight[]): number | null {
  const values = nights
    .map((n) => timeToMin(n.bedtime))
    .filter((v): v is number => v != null)
    .map(bedtimeAxis)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  const axis =
    values.length % 2 === 1 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
  return (axis + 18 * 60) % 1440;
}

/* --------------------------------- Wynik ----------------------------------- */

export function scoreNight(
  night: SleepNight,
  options: { goalMin?: number; referenceBedtime?: number | null } = {},
): SleepScore {
  const goal = options.goalMin ?? DEFAULT_SLEEP_GOAL_MIN;
  const bedMin = timeToMin(night.bedtime);
  const reference = options.referenceBedtime ?? null;

  const parts: ScorePart[] = [
    {
      key: "duration",
      label: "Długość",
      ratio: durationRatio(night.sleep_min, goal),
      points: 0,
      max: SLEEP_WEIGHTS.duration,
      hint: `${sleepDuration(night.sleep_min)} przy celu ${sleepDuration(goal)}`,
    },
    {
      key: "feeling",
      label: "Odczucia",
      ratio: feelingRatio(night.quality, night.morning_energy),
      points: 0,
      max: SLEEP_WEIGHTS.feeling,
      hint:
        night.morning_energy != null
          ? `Sen ${night.quality}/5, energia rano ${night.morning_energy}/5`
          : `Sen ${night.quality}/5`,
    },
    {
      key: "continuity",
      label: "Ciągłość",
      ratio: continuityRatio(night),
      points: 0,
      max: SLEEP_WEIGHTS.continuity,
      hint:
        night.awakenings === 0
          ? `Bez pobudek, zasypianie ${night.fell_asleep_min} min`
          : `${night.awakenings}× pobudka, ${night.awake_min} min na jawie`,
    },
  ];

  const skipped: ScorePart["key"][] = [];

  if (bedMin != null && reference != null) {
    parts.push({
      key: "regularity",
      label: "Regularność",
      ratio: regularityRatio(bedMin, reference),
      points: 0,
      max: SLEEP_WEIGHTS.regularity,
      hint: `Zwykle ${minToTime(reference)}, dziś ${minToTime(bedMin)}`,
    });
  } else {
    skipped.push("regularity");
  }

  // Wagi składowych, których nie da się policzyć, rozdzielamy na resztę —
  // brak danych ma nie obniżać wyniku, tylko go zawężać.
  const available = parts.reduce((sum, p) => sum + p.max, 0);
  const scale = available > 0 ? 100 / available : 0;

  let total = 0;
  for (const part of parts) {
    part.points = Math.round(part.ratio * part.max * scale);
    total += part.ratio * part.max * scale;
  }

  return { total: Math.round(total), parts, skipped };
}

/* -------------------------------- Etykiety --------------------------------- */

/** Pasmo wyniku — kolor ze wspólnej palety statusów, zawsze z opisem słownym. */
export function sleepBand(score: number): { label: string; color: string; icon: string } {
  if (score >= 80) return { label: "świetna noc", color: STATUS.good, icon: "●" };
  if (score >= 65) return { label: "dobra noc", color: STATUS.warning, icon: "▲" };
  if (score >= 50) return { label: "przeciętna noc", color: STATUS.serious, icon: "◆" };
  return { label: "słaba noc", color: STATUS.critical, icon: "■" };
}

export const SLEEP_LEGEND = [
  { range: "80–100", ...sleepBand(85) },
  { range: "65–79", ...sleepBand(70) },
  { range: "50–64", ...sleepBand(55) },
  { range: "0–49", ...sleepBand(20) },
];

export const QUALITY_LABELS = [
  { value: 1, icon: "😖", label: "fatalnie" },
  { value: 2, icon: "😕", label: "słabo" },
  { value: 3, icon: "😐", label: "średnio" },
  { value: 4, icon: "🙂", label: "dobrze" },
  { value: 5, icon: "😴", label: "wybornie" },
] as const;

export const ENERGY_LABELS = [
  { value: 1, icon: "🪫", label: "wrak" },
  { value: 2, icon: "😩", label: "ciężko" },
  { value: 3, icon: "😑", label: "da się" },
  { value: 4, icon: "😊", label: "świeżo" },
  { value: 5, icon: "⚡", label: "pełna moc" },
] as const;

/* -------------------------------- Wnioski ---------------------------------- */

export type FactorInsight = {
  key: string;
  nightsWith: number;
  avgWith: number;
  avgWithout: number;
  delta: number;
};

/**
 * Które czynniki realnie psują (albo poprawiają) Twoje noce.
 *
 * To zwykłe porównanie średnich, nie dowód przyczynowości — dlatego widok
 * podaje liczbę nocy przy każdym wniosku i nie pokazuje niczego, co opiera
 * się na mniej niż trzech.
 */
export function factorInsights(
  scored: { night: SleepNight; score: number }[],
  minNights = 3,
): FactorInsight[] {
  const keys = new Set(scored.flatMap((s) => s.night.factors));
  const out: FactorInsight[] = [];

  for (const key of keys) {
    const withF = scored.filter((s) => s.night.factors.includes(key));
    const without = scored.filter((s) => !s.night.factors.includes(key));
    if (withF.length < minNights || without.length < minNights) continue;

    const avgWith = withF.reduce((s, x) => s + x.score, 0) / withF.length;
    const avgWithout = without.reduce((s, x) => s + x.score, 0) / without.length;
    out.push({
      key,
      nightsWith: withF.length,
      avgWith: Math.round(avgWith),
      avgWithout: Math.round(avgWithout),
      delta: Math.round(avgWith - avgWithout),
    });
  }

  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
