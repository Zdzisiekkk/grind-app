/**
 * Health Score — jedna liczba 0–100 złożona z sześciu filarów.
 *
 * Trzy zasady, które decydują o tym, czy taka liczba jest uczciwa:
 *
 *  1. BRAK DANYCH NIE KARZE. Filar bez wpisów wypada z rachunku, a jego waga
 *     rozkłada się na pozostałe. Inaczej wynik mierzyłby pilność w prowadzeniu
 *     dziennika, a nie formę — i spadałby najmocniej dokładnie wtedy, gdy
 *     jesteś zajęty. Widok zawsze pokazuje, ile filarów weszło do wyniku.
 *  2. NIGDY SAMA LICZBA. Zawsze obok rozbicie na filary z opisem, bo „68"
 *     bez kontekstu nie mówi, co poprawić.
 *  3. OKNO KROCZĄCE 7 DNI. Jedna nieprzespana noc nie ma prawa zawalić wyniku,
 *     a tydzień porządnej roboty ma prawo go odbudować.
 */

import type { PeriodSummary } from "@/lib/database.types";
import { STATUS } from "@/lib/viz";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/constants";

export type PillarKey = "sleep" | "training" | "diet" | "habits" | "water" | "recovery";

export type Pillar = {
  key: PillarKey;
  label: string;
  icon: string;
  /** Udział w wyniku, gdy filar ma dane. */
  weight: number;
  /** 0–100 albo null, gdy brak danych. */
  score: number | null;
  /** Krótkie „skąd ta liczba". */
  detail: string;
};

export type HealthResult = {
  /** 0–100 albo null, gdy żaden filar nie ma danych. */
  total: number | null;
  pillars: Pillar[];
  /** Ile filarów weszło do wyniku i ile ich jest w ogóle. */
  covered: number;
  possible: number;
};

export type HealthGoals = {
  kcal: number | null;
  waterMl: number;
  /** Ile treningów siłowych tygodniowo uznajemy za komplet. */
  workoutsPerWeek: number;
};

export const DEFAULT_WORKOUTS_PER_WEEK = 4;

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/**
 * Kaloryczna trafność: pełne punkty w promieniu 10 % od celu, zero przy 40 %.
 * Odchylenie w obie strony liczy się tak samo — 1000 kcal ponad cel to nie
 * większy sukces niż 1000 kcal pod celem.
 */
function kcalAccuracy(avg: number, goal: number): number {
  const off = Math.abs(avg - goal) / goal;
  if (off <= 0.1) return 1;
  return Math.max(0, 1 - (off - 0.1) / 0.3);
}

export function healthScore({
  summary,
  sleepScores,
  goals,
}: {
  summary: PeriodSummary;
  /** Wyniki poszczególnych nocy z okna (scoreNight). */
  sleepScores: number[];
  goals: HealthGoals;
}): HealthResult {
  const days = summary.days_in_period || 7;

  /* --- Sen --- */
  const sleep =
    sleepScores.length > 0
      ? Math.round(sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length)
      : null;

  /* --- Trening --- */
  // Cel skalujemy do długości okna, żeby widok 30-dniowy nie był zawsze na 100 %.
  const workoutTarget = Math.max(1, (goals.workoutsPerWeek * days) / 7);
  const training =
    summary.workouts > 0 || days <= 7 ? clamp((summary.workouts / workoutTarget) * 100) : null;

  /* --- Dieta --- */
  // Połowa punktów za samo prowadzenie dziennika, połowa za trafienie w cel.
  // Bez celu kalorycznego zostaje sama regularność, przeskalowana do 100.
  let diet: number | null = null;
  let dietDetail = "Brak wpisów w dzienniku";
  if (summary.days_logged_food > 0) {
    const consistency = Math.min(1, summary.days_logged_food / days);
    if (goals.kcal) {
      const accuracy = kcalAccuracy(summary.avg_kcal, goals.kcal);
      diet = clamp((consistency * 0.5 + accuracy * 0.5) * 100);
      dietDetail = `${summary.days_logged_food}/${days} dni · średnio ${summary.avg_kcal} kcal przy celu ${goals.kcal}`;
    } else {
      diet = clamp(consistency * 100);
      dietDetail = `${summary.days_logged_food}/${days} dni z dziennikiem · ustaw cel kcal, żeby liczyć trafność`;
    }
  }

  /* --- Nawyki --- */
  const habits =
    summary.habit_days_due > 0
      ? clamp((summary.habit_days_done / summary.habit_days_due) * 100)
      : null;

  /* --- Nawodnienie --- */
  // Średnia z dni, w których cokolwiek zapisałeś — przemnożona przez pokrycie,
  // bo „wypiłem 3 l w jeden dzień z siedmiu" to nie jest nawodniony tydzień.
  const waterGoal = goals.waterMl || DEFAULT_WATER_GOAL_ML;
  const water =
    summary.avg_water_ml != null && summary.days_water_logged > 0
      ? clamp(
          Math.min(1, summary.avg_water_ml / waterGoal) *
            Math.min(1, summary.days_water_logged / days) *
            100,
        )
      : null;

  /* --- Regeneracja --- */
  // Odwrotność średniego bólu. Bez kontuzji filar po prostu nie istnieje —
  // nie dajemy za to ani premii, ani kary.
  const recovery = summary.avg_pain != null ? clamp(100 - summary.avg_pain * 10) : null;

  const pillars: Pillar[] = [
    {
      key: "sleep",
      label: "Sen",
      icon: "😴",
      weight: 25,
      score: sleep,
      detail:
        sleepScores.length > 0
          ? `${sleepScores.length} ${sleepScores.length === 1 ? "noc" : "nocy"} w oknie`
          : "Brak zapisanych nocy",
    },
    {
      key: "training",
      label: "Trening",
      icon: "🏋️",
      weight: 20,
      score: training,
      detail: `${summary.workouts} z ${Math.round(workoutTarget)} zaplanowanych`,
    },
    { key: "diet", label: "Dieta", icon: "🍽️", weight: 20, score: diet, detail: dietDetail },
    {
      key: "habits",
      label: "Nawyki",
      icon: "🔥",
      weight: 15,
      score: habits,
      detail:
        summary.habit_days_due > 0
          ? `${summary.habit_days_done} z ${summary.habit_days_due} odhaczeń`
          : "Brak nawyków na liście",
    },
    {
      key: "water",
      label: "Nawodnienie",
      icon: "💧",
      weight: 10,
      score: water,
      detail:
        summary.avg_water_ml != null
          ? `Średnio ${summary.avg_water_ml} ml przez ${summary.days_water_logged}/${days} dni`
          : "Brak wpisów",
    },
    {
      key: "recovery",
      label: "Regeneracja",
      icon: "🩹",
      weight: 10,
      score: recovery,
      detail:
        summary.avg_pain != null
          ? `Średni ból ${summary.avg_pain}/10`
          : "Brak śledzonych kontuzji",
    },
  ];

  const active = pillars.filter((p) => p.score != null);
  const weightSum = active.reduce((s, p) => s + p.weight, 0);
  const total =
    weightSum > 0
      ? Math.round(active.reduce((s, p) => s + p.weight * (p.score as number), 0) / weightSum)
      : null;

  return { total, pillars, covered: active.length, possible: pillars.length };
}

/** Pasmo wyniku — ta sama paleta statusów co ból i sen, zawsze z opisem. */
export function healthBand(score: number): { label: string; color: string; icon: string } {
  if (score >= 80) return { label: "forma na plus", color: STATUS.good, icon: "●" };
  if (score >= 65) return { label: "jest nieźle", color: STATUS.warning, icon: "▲" };
  if (score >= 50) return { label: "do poprawy", color: STATUS.serious, icon: "◆" };
  return { label: "słaby tydzień", color: STATUS.critical, icon: "■" };
}

/** Najsłabszy filar z danymi — podpowiedź „co ruszyć najpierw". */
export function weakestPillar(result: HealthResult): Pillar | null {
  const withData = result.pillars.filter((p) => p.score != null);
  if (withData.length === 0) return null;
  return withData.reduce((min, p) => ((p.score as number) < (min.score as number) ? p : min));
}
