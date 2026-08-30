import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { OfflineGate } from "@/components/offline/OfflineGate";
import { Reminders, type SleepReminder, type WaterReminder } from "@/components/reminders/Reminders";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, getUser } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";
import { DEFAULT_WATER_GOAL_ML, habitDueOn } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { DEFAULT_SLEEP_GOAL_MIN, sleepDuration } from "@/lib/sleep";
import type { Habit } from "@/lib/database.types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const user = await getUser();
  if (!user) redirect("/login");

  // Dane do przypomnień - na tyle małe, że nie warto ich rozdzielać na trasy.
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: habits }, { data: habitLogs }, { data: profile }, { data: water }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .not("reminder_at", "is", null),
      supabase.from("habit_logs").select("habit_id, count").eq("user_id", user.id).eq("date", today),
      supabase
        .from("profiles")
        .select(
          "daily_water_ml, water_reminder_from, water_reminder_to, water_reminder_every_min, sleep_reminder_at, sleep_goal_min, onboarded_at",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("water_logs").select("ml").eq("user_id", user.id).eq("date", today),
    ]);

  // Nowa osoba nie ma prawa zobaczyć pustego pulpitu z napisem "wybierz plan".
  // Kreator stoi poza tą grupą tras, więc przekierowanie się nie zapętli.
  if (profile && !profile.onboarded_at) redirect("/start");

  const doneToday = new Map((habitLogs ?? []).map((l) => [l.habit_id, l.count]));
  const habitReminders = ((habits ?? []) as Habit[])
    .filter((h) => habitDueOn(h.days_of_week, today))
    .map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      at: h.reminder_at ?? "",
      due: (doneToday.get(h.id) ?? 0) < h.target_per_day,
    }));

  const drunk = (water ?? []).reduce((sum, w) => sum + w.ml, 0);
  const waterReminder: WaterReminder = profile?.water_reminder_every_min
    ? {
        from: profile.water_reminder_from,
        to: profile.water_reminder_to,
        everyMin: profile.water_reminder_every_min,
        behind: drunk < (profile.daily_water_ml ?? DEFAULT_WATER_GOAL_ML),
      }
    : null;

  const sleepReminder: SleepReminder = profile?.sleep_reminder_at
    ? {
        at: profile.sleep_reminder_at,
        goalLabel: `Cel na dziś: ${sleepDuration(profile.sleep_goal_min ?? DEFAULT_SLEEP_GOAL_MIN)}`,
      }
    : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/*
        Aplikacja rysuje pod paskiem stanu (viewport-fit=cover + black-translucent),
        więc górny odstęp musi uwzględniać wcięcie notcha. Bez tego na iPhonie
        nagłówek ekranu ląduje pod zegarkiem.
      */}
      <main className="safe-top flex-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <OfflineGate />
      <BottomNav />
      <Reminders habits={habitReminders} water={waterReminder} sleep={sleepReminder} />
    </div>
  );
}
