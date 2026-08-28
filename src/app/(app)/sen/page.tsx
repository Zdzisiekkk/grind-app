import { SleepScreen } from "@/components/sleep/SleepScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { DEFAULT_SLEEP_GOAL_MIN, napsFromView, type SleepNight } from "@/lib/sleep";

export const metadata = { title: "Sen" };

/** Pół roku wstecz — tyle wystarczy na trendy i wnioski o czynnikach. */
const HISTORY_DAYS = 180;

export default async function SleepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from("v_sleep")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -HISTORY_DAYS))
      .order("date", { ascending: false }),
    supabase
      .from("profiles")
      .select("sleep_goal_min, sleep_target_bedtime")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const nights: SleepNight[] = (rows ?? []).map((r) => ({
    date: r.date,
    bedtime: r.bedtime,
    wake_time: r.wake_time,
    sleep_min: r.sleep_min,
    time_in_bed_min: r.time_in_bed_min,
    fell_asleep_min: r.fell_asleep_min,
    awakenings: r.awakenings,
    awake_min: r.awake_min,
    quality: r.quality,
    morning_energy: r.morning_energy,
    nap_min: r.nap_min,
    naps: napsFromView(r.naps),
    factors: r.factors,
    note: r.note,
  }));

  return (
    <SleepScreen
      userId={user.id}
      nights={nights}
      today={today}
      goalMin={profile?.sleep_goal_min ?? DEFAULT_SLEEP_GOAL_MIN}
      targetBedtime={profile?.sleep_target_bedtime ?? null}
    />
  );
}
