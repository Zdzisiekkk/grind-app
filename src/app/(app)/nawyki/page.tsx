import { HabitsScreen, type HabitWithDay } from "@/components/habits/HabitsScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { dataZAdresu } from "@/lib/wstecz";
import { habitDueOn } from "@/lib/constants";
import { HISTORY_DAYS, bestStreakOf, perfectDayStreak, streakOf } from "@/lib/nawyki";
import type { Habit, HabitLog, Vice, ViceEvent } from "@/lib/database.types";
import { daysClean } from "@/lib/vices";

export const metadata = { title: "Nawyki i nałogi" };

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();
  // Dzień oglądany i odhaczany. Passy poniżej liczą się dalej od dzisiaj -
  // seria to fakt o teraz, a nie o dniu, który akurat masz na ekranie.
  const date = dataZAdresu(d, today);

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
      // Ten sam zakres, z którego liczą się passy - stąd stała z biblioteki,
      // a nie 180 wpisane drugi raz z palca.
      .gte("date", addDaysISO(today, -HISTORY_DAYS)),
  ]);

  const byHabit = new Map<string, Map<string, number>>();
  for (const log of (logs ?? []) as Pick<HabitLog, "habit_id" | "date" | "count">[]) {
    const map = byHabit.get(log.habit_id) ?? new Map<string, number>();
    map.set(log.date, log.count);
    byHabit.set(log.habit_id, map);
  }

  const withDay: HabitWithDay[] = ((habits ?? []) as Habit[]).map((habit) => {
    const counts = byHabit.get(habit.id) ?? new Map<string, number>();
    return {
      ...habit,
      dayCount: counts.get(date) ?? 0,
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

  // Nałogi mają własny ekran - tutaj potrzebny jest tylko skrót: ile ich jest
  // i najdłuższa trwająca passa, żeby kafelek mówił coś konkretnego.
  const [{ data: vices }, { data: viceEvents }] = await Promise.all([
    supabase.from("vices").select("*").eq("user_id", user.id).eq("is_archived", false),
    supabase.from("vice_events").select("*").eq("user_id", user.id),
  ]);

  const viceRows = (vices ?? []) as Vice[];
  const eventRows = (viceEvents ?? []) as ViceEvent[];
  const bestDays = viceRows.reduce(
    (max, vice) =>
      Math.max(max, daysClean(vice, eventRows.filter((e) => e.vice_id === vice.id))),
    0,
  );

  return (
    <HabitsScreen
      userId={user.id}
      habits={withDay}
      date={date}
      today={today}
      perfectStreak={perfectDayStreak((habits ?? []) as Habit[], byHabit, today)}
      reading={reading?.[0] ?? null}
      vices={{ count: viceRows.length, bestDays }}
    />
  );
}
