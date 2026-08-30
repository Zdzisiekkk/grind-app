import { addDaysISO } from "./format";
import { habitDueOn } from "./constants";
import type { Habit } from "./database.types";

/*
 * Liczenie pass dla nawyków.
 *
 * Mieszkało w pliku ekranu, dopóki nie okazało się, że trzeba je sprawdzić
 * testem: dopisanie dnia wstecz ma zrastać przerwaną serię, a to jest reguła,
 * która musi trzymać niezależnie od tego, co akurat rysuje ekran.
 */

/** Pół roku wstecz - dalej passa i tak nie ma znaczenia. */
export const HISTORY_DAYS = 180;

/** Ile dni z rzędu (wstecz od dziś) nawyk był domknięty, pomijając dni wolne. */
export function streakOf(habit: Habit, counts: Map<string, number>, today: string): number {
  let streak = 0;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDaysISO(today, -i);
    if (!habitDueOn(habit.days_of_week, date)) continue;
    const done = (counts.get(date) ?? 0) >= habit.target_per_day;
    if (!done) {
      // Dzisiejszy brak jeszcze nie zrywa serii - dzień się nie skończył.
      if (i === 0) continue;
      break;
    }
    streak++;
  }
  return streak;
}

/** Najdłuższa passa w całej historii - rekord do pobicia. */
export function bestStreakOf(habit: Habit, counts: Map<string, number>, today: string): number {
  let best = 0;
  let run = 0;
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = addDaysISO(today, -i);
    if (!habitDueOn(habit.days_of_week, date)) continue;
    if ((counts.get(date) ?? 0) >= habit.target_per_day) {
      run++;
      best = Math.max(best, run);
    } else if (i > 0) {
      run = 0;
    }
  }
  return best;
}

/**
 * Passa całego dnia: ile dni z rzędu domknąłeś wszystko, co było na liście.
 * To jest liczba, którą widać na górze ekranu - nagradza konsekwencję
 * w całości, a nie w pojedynczym nawyku.
 */
export function perfectDayStreak(
  habits: Habit[],
  byHabit: Map<string, Map<string, number>>,
  today: string,
): number {
  let streak = 0;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDaysISO(today, -i);
    const due = habits.filter((h) => habitDueOn(h.days_of_week, date));
    if (due.length === 0) continue;

    const allDone = due.every(
      (h) => (byHabit.get(h.id)?.get(date) ?? 0) >= h.target_per_day,
    );
    if (!allDone) {
      if (i === 0) continue; // dziś jeszcze trwa
      break;
    }
    streak++;
  }
  return streak;
}
