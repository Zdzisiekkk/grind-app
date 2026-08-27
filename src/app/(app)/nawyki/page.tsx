import { HabitsScreen, type HabitWithToday } from "@/components/habits/HabitsScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { habitDueOn } from "@/lib/constants";
import type { Habit, HabitLog } from "@/lib/database.types";

export const metadata = { title: "Nawyki" };

const HISTORY_DAYS = 180;

/** Ile dni z rzędu (wstecz od dziś) nawyk był domknięty, pomijając dni wolne. */
function streakOf(habit: Habit, counts: Map<string, number>, today: string): number {
  let streak = 0;
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDaysISO(today, -i);
    if (!habitDueOn(habit.days_of_week, date)) continue;
    const done = (counts.get(date) ?? 0) >= habit.target_per_day;
    if (!done) {
      // Dzisiejszy brak jeszcze nie zrywa serii — dzień się nie skończył.
      if (i === 0) continue;
      break;
    }
    streak++;
  }
  return streak;
}

/** Najdłuższa passa w całej historii — rekord do pobicia. */
function bestStreakOf(habit: Habit, counts: Map<string, number>, today: string): number {
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
 * To jest liczba, którą widać na górze ekranu — nagradza konsekwencję
 * w całości, a nie w pojedynczym nawyku.
 */
function perfectDayStreak(
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

export default async function HabitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("order_index")
      .order("created_at"),
    supabase
      .from("habit_logs")
      .select("habit_id, date, count")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -180)),
  ]);

  const byHabit = new Map<string, Map<string, number>>();
  for (const log of (logs ?? []) as Pick<HabitLog, "habit_id" | "date" | "count">[]) {
    const map = byHabit.get(log.habit_id) ?? new Map<string, number>();
    map.set(log.date, log.count);
    byHabit.set(log.habit_id, map);
  }

  const withToday: HabitWithToday[] = ((habits ?? []) as Habit[]).map((habit) => {
    const counts = byHabit.get(habit.id) ?? new Map<string, number>();
    return {
      ...habit,
      todayCount: counts.get(today) ?? 0,
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDaysISO(today, -(6 - i));
        return {
          date,
          count: counts.get(date) ?? 0,
          due: habitDueOn(habit.days_of_week, date),
        };
      }),
      streak: streakOf(habit, counts, today),
      bestStreak: bestStreakOf(habit, counts, today),
      totalDone: [...counts.entries()].filter(
        ([, count]) => count >= habit.target_per_day,
      ).length,
      history: Array.from({ length: 28 }, (_, i) => {
        const date = addDaysISO(today, -(27 - i));
        return {
          date,
          count: counts.get(date) ?? 0,
          due: habitDueOn(habit.days_of_week, date),
        };
      }),
    };
  });

  // Czytanie ma własną podstronę, bo książka to nie ptaszek: ma tytuł,
  // postęp w stronach, cytaty i ocenę na koniec.
  const { data: reading } = await supabase
    .from("books")
    .select("id, title, current_page, pages")
    .eq("user_id", user.id)
    .eq("status", "reading")
    .order("updated_at", { ascending: false })
    .limit(1);

  return (
    <HabitsScreen
      userId={user.id}
      habits={withToday}
      today={today}
      perfectStreak={perfectDayStreak((habits ?? []) as Habit[], byHabit, today)}
      reading={reading?.[0] ?? null}
    />
  );
}
