/**
 * Wykrywanie sytuacji, o których trener ma się odezwać.
 *
 * CAŁA ARYTMETYKA JEST TUTAJ, nie w modelu. To jest świadoma decyzja:
 * model językowy potrafi przekonująco pomylić się w liczeniu trendu, a taka
 * pomyłka kończy się poradą "dodaj 300 kcal", gdy waga i tak rośnie. Kod
 * liczy fakty, model dostaje je gotowe i ma za zadanie wytłumaczyć je po
 * ludzku oraz zaproponować jedną konkretną zmianę.
 *
 * Dzięki temu darmowy użytkownik też widzi sygnał ("waga stoi trzeci tydzień") -
 * płatne jest wyjaśnienie i propozycja, a nie dostęp do własnych danych.
 */

import { e1rm } from "@/lib/format";
import { verdictOnPace, type Goal } from "@/lib/nutrition";

/* ------------------------------ Dieta i waga ------------------------------- */

export type WeightPoint = { date: string; kg: number };

export type DietFinding = {
  kind: "diet_weight";
  /** Zmiana wagi na tydzień, wyliczona z regresji liniowej. */
  weeklyChangeKg: number;
  measurements: number;
  spanDays: number;
  goal: Goal;
  kcalGoal: number | null;
  avgKcal: number | null;
  daysLogged: number;
  periodDays: number;
  onTrack: boolean;
  /** Co jest naprawdę do naprawienia. */
  problem: "none" | "pace" | "adherence" | "no_data";
  message: string;
  /** Sugerowana zmiana celu w kcal. Zero, gdy problemem nie jest cel. */
  suggestKcal: number;
};

/**
 * Trend wagi liczymy regresją liniową, a nie różnicą "pierwszy minus ostatni".
 *
 * Waga potrafi skoczyć o dwa kilogramy po słonym obiedzie. Odejmowanie dwóch
 * pojedynczych pomiarów daje wtedy wynik mówiący o zawartości wody, a nie
 * o tłuszczu. Regresja bierze pod uwagę wszystkie punkty naraz.
 */
export function weeklyWeightTrend(points: WeightPoint[]): number | null {
  if (points.length < 3) return null;

  const t0 = new Date(`${points[0].date}T00:00:00`).getTime();
  const xs = points.map((p) => (new Date(`${p.date}T00:00:00`).getTime() - t0) / 86_400_000);
  const ys = points.map((p) => p.kg);

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;

  return (num / den) * 7;
}

export function analyseDietVsWeight({
  weights,
  goal,
  kcalGoal,
  avgKcal,
  daysLogged,
  periodDays,
}: {
  /** Posortowane rosnąco po dacie, z okna 14-28 dni. */
  weights: WeightPoint[];
  goal: Goal;
  kcalGoal: number | null;
  avgKcal: number | null;
  daysLogged: number;
  periodDays: number;
}): DietFinding {
  const base = {
    kind: "diet_weight" as const,
    measurements: weights.length,
    spanDays: weights.length
      ? Math.round(
          (new Date(`${weights[weights.length - 1].date}T00:00:00`).getTime() -
            new Date(`${weights[0].date}T00:00:00`).getTime()) /
            86_400_000,
        )
      : 0,
    goal,
    kcalGoal,
    avgKcal,
    daysLogged,
    periodDays,
  };

  const trend = weeklyWeightTrend(weights);

  // Bez trzech pomiarów rozłożonych na co najmniej dziesięć dni nie da się
  // powiedzieć nic uczciwego. Milczenie jest lepsze niż zgadywanie.
  if (trend === null || base.spanDays < 10) {
    return {
      ...base,
      weeklyChangeKg: 0,
      onTrack: true,
      problem: "no_data",
      message:
        "Za mało pomiarów wagi, żeby cokolwiek stwierdzić. Wchodź na wagę 3-4 razy w tygodniu, rano, po toalecie - po dwóch tygodniach będzie o czym rozmawiać.",
      suggestKcal: 0,
    };
  }

  const verdict = verdictOnPace({ goal, weeklyChangeKg: trend });

  // Kluczowe rozróżnienie: jeśli nie trafiasz w cel, to nie cel jest zły.
  // Obniżanie celu, którego i tak nie realizujesz, tylko pogłębia problem.
  const coverage = periodDays > 0 ? daysLogged / periodDays : 0;
  const missesGoal =
    kcalGoal != null && avgKcal != null && coverage >= 0.5
      ? Math.abs(avgKcal - kcalGoal) / kcalGoal > 0.12
      : false;

  if (!verdict.onTrack && missesGoal) {
    const over = (avgKcal as number) > (kcalGoal as number);
    return {
      ...base,
      weeklyChangeKg: trend,
      onTrack: false,
      problem: "adherence",
      message: over
        ? `Jesz średnio ${avgKcal} kcal przy celu ${kcalGoal}. Zanim ruszymy cel, warto najpierw w niego trafić - zmiana liczby, której i tak nie realizujesz, niczego nie naprawi.`
        : `Jesz średnio ${avgKcal} kcal przy celu ${kcalGoal}, czyli sporo poniżej. Zbyt duży deficyt zabiera siłę i sen szybciej niż tłuszcz.`,
      suggestKcal: 0,
    };
  }

  if (coverage < 0.5) {
    return {
      ...base,
      weeklyChangeKg: trend,
      onTrack: verdict.onTrack,
      problem: "no_data",
      message: `Dziennik masz wypełniony przez ${daysLogged} z ${periodDays} dni. Bez tego nie da się powiedzieć, czy problemem jest cel, czy jego realizacja.`,
      suggestKcal: 0,
    };
  }

  return {
    ...base,
    weeklyChangeKg: trend,
    onTrack: verdict.onTrack,
    problem: verdict.onTrack ? "none" : "pace",
    message: verdict.message,
    suggestKcal: verdict.suggestKcal,
  };
}

/* ---------------------------- Stagnacja siłowa ----------------------------- */

export type SetRow = {
  date: string;
  exercise_name: string;
  catalog_exercise_id: string | null;
  weight_kg: number | null;
  reps: number | null;
  is_warmup: boolean;
};

export type StrengthFinding = {
  kind: "strength_stall";
  exercise: string;
  sessions: number;
  /** Najlepszy szacowany 1RM w oknie. */
  bestE1rm: number;
  /** Ile dni temu padł ten rekord. */
  daysSincePr: number;
  /** Zmiana szacowanego 1RM między pierwszą a ostatnią sesją, w kilogramach. */
  changeKg: number;
  /** Ile razy w tygodniu robisz to ćwiczenie. */
  perWeek: number;
  problem: "stall" | "frequency";
  message: string;
};

const STALL_MIN_SESSIONS = 4;
const STALL_MIN_DAYS = 21;

/**
 * Poniżej tego progu mówimy o częstotliwości, nie o stagnacji.
 *
 * Raz w tygodniu to podłoga, przy której w ogóle wypada oczekiwać postępu
 * w ćwiczeniu złożonym. 0,75 zamiast równego 1 daje zapas na jeden opuszczony
 * trening w miesiącu - nie chcemy besztać kogoś za chorobę.
 */
const MIN_SESSIONS_PER_WEEK = 0.75;

/**
 * Stagnacja to brak poprawy MIMO regularnej pracy.
 *
 * Dlatego zanim nazwiemy coś stagnacją, sprawdzamy częstotliwość: ćwiczenie
 * robione raz na trzy tygodnie nie stoi w miejscu - po prostu go nie robisz.
 * Doradzanie deloadu komuś, kto nie przychodzi, to najgorsza możliwa porada.
 */
export function findStrengthStalls(rows: SetRow[], today: string, windowDays = 56): StrengthFinding[] {
  const byExercise = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (row.is_warmup) continue;
    const estimated = e1rm(row.weight_kg ?? 0, row.reps ?? 0);
    if (estimated <= 0) continue;

    const perDay = byExercise.get(row.exercise_name) ?? new Map<string, number>();
    perDay.set(row.date, Math.max(perDay.get(row.date) ?? 0, estimated));
    byExercise.set(row.exercise_name, perDay);
  }

  const todayMs = new Date(`${today}T00:00:00`).getTime();
  const findings: StrengthFinding[] = [];

  for (const [exercise, perDay] of byExercise) {
    const sessions = [...perDay.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sessions.length < STALL_MIN_SESSIONS) continue;

    const best = sessions.reduce((max, s) => (s.value > max.value ? s : max));
    const daysSincePr = Math.round((todayMs - new Date(`${best.date}T00:00:00`).getTime()) / 86_400_000);
    const changeKg = sessions[sessions.length - 1].value - sessions[0].value;
    const perWeek = (sessions.length / windowDays) * 7;

    // Rekord z ostatnich trzech tygodni to nie stagnacja, tylko normalny progres.
    if (daysSincePr < STALL_MIN_DAYS) continue;

    if (perWeek < MIN_SESSIONS_PER_WEEK) {
      findings.push({
        kind: "strength_stall",
        exercise,
        sessions: sessions.length,
        bestE1rm: Math.round(best.value * 10) / 10,
        daysSincePr,
        changeKg: Math.round(changeKg * 10) / 10,
        perWeek: Math.round(perWeek * 10) / 10,
        problem: "frequency",
        message: `${exercise}: ${sessions.length} sesji w ${windowDays} dni, czyli rzadziej niż raz w tygodniu. To nie jest stagnacja - po prostu za rzadko, żeby oczekiwać postępu.`,
      });
      continue;
    }

    findings.push({
      kind: "strength_stall",
      exercise,
      sessions: sessions.length,
      bestE1rm: Math.round(best.value * 10) / 10,
      daysSincePr,
      changeKg: Math.round(changeKg * 10) / 10,
      perWeek: Math.round(perWeek * 10) / 10,
      problem: "stall",
      message: `${exercise}: rekord ${Math.round(best.value)} kg padł ${daysSincePr} dni temu i od tego czasu nic się nie ruszyło.`,
    });
  }

  // Najpierw to, co stoi najdłużej - tam jest największa strata.
  return findings.sort((a, b) => b.daysSincePr - a.daysSincePr);
}
