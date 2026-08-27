import { ProgressScreen } from "@/components/ProgressScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, shortDate, todayISO } from "@/lib/format";
import { DEFAULT_SLEEP_GOAL_MIN, type SleepNight } from "@/lib/sleep";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/constants";
import type { ExercisePr, PeriodSummary } from "@/lib/database.types";

export const metadata = { title: "Postępy" };

/** Poniedziałek tygodnia, w którym leży data (ISO, bez stref czasowych). */
function weekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7; // 0 = poniedziałek
  date.setDate(date.getDate() - shift);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export default async function ProgresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();
  const twelveWeeksAgo = addDaysISO(today, -84);

  const [
    prsRes,
    weightRes,
    painRes,
    injuryRes,
    volumeRes,
    weekRes,
    monthRes,
    sleepRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from("v_exercise_prs")
      .select("*")
      .eq("user_id", user.id)
      .order("total_sets", { ascending: false })
      .limit(60),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -180))
      .order("date"),
    supabase
      .from("pain_logs")
      .select("injury_id, date, level")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -90))
      .order("date"),
    supabase
      .from("injuries")
      .select("id, name, body_part, side, status, order_index")
      .eq("user_id", user.id)
      .order("status")
      .order("order_index"),
    supabase
      .from("v_daily_volume")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", twelveWeeksAgo)
      .order("date"),
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -6), p_to: today }),
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -29), p_to: today }),
    // 44 dni: 30 wchodzi na wykres, 14 najnowszych wyznacza zwykłą porę snu.
    supabase
      .from("v_sleep")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -44))
      .order("date", { ascending: false }),
    supabase
      .from("profiles")
      .select("sleep_goal_min, sleep_target_bedtime, daily_kcal, daily_water_ml")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Dzienna objętość → tygodnie (poniedziałek–niedziela)
  const weeks = new Map<string, { volume: number; sets: number; workouts: number }>();
  for (let i = 11; i >= 0; i--) {
    weeks.set(weekStart(addDaysISO(today, -i * 7)), { volume: 0, sets: 0, workouts: 0 });
  }
  for (const day of volumeRes.data ?? []) {
    const key = weekStart(day.date);
    const bucket = weeks.get(key);
    if (!bucket) continue;
    bucket.volume += day.volume_kg;
    bucket.sets += day.sets;
    bucket.workouts += 1;
  }

  const weeklyVolume = [...weeks.entries()].map(([start, v]) => ({
    label: shortDate(start),
    ...v,
  }));

  // Każda kontuzja dostaje własny wykres — ból to stan, a stany różnych kontuzji
  // nie sumują się w jedną serię.
  const pointsByInjury = new Map<string, { date: string; level: number }[]>();
  for (const log of painRes.data ?? []) {
    const list = pointsByInjury.get(log.injury_id) ?? [];
    list.push({ date: log.date, level: log.level });
    pointsByInjury.set(log.injury_id, list);
  }

  const painByInjury = (injuryRes.data ?? [])
    .map((injury) => ({
      id: injury.id,
      name: injury.name,
      bodyPart: injury.body_part,
      side: injury.side,
      points: pointsByInjury.get(injury.id) ?? [],
    }))
    .filter((injury) => injury.points.length > 0);

  const nights: SleepNight[] = (sleepRes.data ?? []).map((r) => ({
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
    factors: r.factors,
    note: r.note,
  }));

  return (
    <ProgressScreen
      userId={user.id}
      prs={(prsRes.data ?? []) as ExercisePr[]}
      bodyWeight={(weightRes.data ?? []).map((w) => ({ date: w.date, weight: Number(w.weight_kg) }))}
      painByInjury={painByInjury}
      weeklyVolume={weeklyVolume}
      summaries={{
        week: weekRes.data as PeriodSummary,
        month: monthRes.data as PeriodSummary,
      }}
      nights={nights}
      today={today}
      sleepGoalMin={profileRes.data?.sleep_goal_min ?? DEFAULT_SLEEP_GOAL_MIN}
      targetBedtime={profileRes.data?.sleep_target_bedtime ?? null}
      kcalGoal={profileRes.data?.daily_kcal ?? null}
      waterGoal={profileRes.data?.daily_water_ml ?? DEFAULT_WATER_GOAL_ML}
    />
  );
}
