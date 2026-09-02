import { addDaysISO } from "./format";
import { habitDueOn } from "./constants";
import { HISTORY_DAYS } from "./nawyki";
import type { Habit } from "./database.types";

/*
 * Passa ogólna: nawyki na dany dzień (jeśli jakieś wypadały) plus dziennik
 * diety tego dnia. Trening świadomie zostaje poza tą regułą - w przeciwieństwie
 * do nawyków nie ma pojęcia "dnia wolnego od treningu" zapisanego w danych,
 * więc wymaganie go tutaj psułoby serię każdemu, kto ma legalny dzień
 * odpoczynku w planie. Dieta jest codzienna z natury - je się każdego dnia,
 * więc brak wpisu jest brakiem wpisu, nie odpoczynkiem.
 */

/** Ile dni z rzędu (wstecz od dziś) były w komplecie: nawyki i dziennik diety. */
export function ogolnaPassa(
  habits: Habit[],
  byHabit: Map<string, Map<string, number>>,
  dietLoggedDates: Set<string>,
  today: string,
): number {
  let streak = 0;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDaysISO(today, -i);
    const due = habits.filter((h) => habitDueOn(h.days_of_week, date));
    const habitsDone = due.every(
      (h) => (byHabit.get(h.id)?.get(date) ?? 0) >= h.target_per_day,
    );
    const allDone = habitsDone && dietLoggedDates.has(date);
    if (!allDone) {
      if (i === 0) continue; // dziś jeszcze trwa
      break;
    }
    streak++;
  }
  return streak;
}
