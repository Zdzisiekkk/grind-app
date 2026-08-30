import { InjuriesScreen, type InjuryWithPain } from "@/components/injuries/InjuriesScreen";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { dataZAdresu } from "@/lib/wstecz";
import type { Injury, PainLog } from "@/lib/database.types";

export const metadata = { title: "Kontuzje" };

export default async function InjuriesPage({
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
  // Ból ocenia się wieczorem albo następnego dnia, gdy już wiadomo, jak kolano
  // zniosło trening - stąd ten sam przełącznik dnia, co przy nawykach.
  const date = dataZAdresu(d, today);

  const [{ data: injuries }, { data: logs }] = await Promise.all([
    supabase
      .from("injuries")
      .select("*")
      .eq("user_id", user.id)
      .order("status")
      .order("order_index")
      .order("created_at"),
    supabase
      .from("pain_logs")
      .select("injury_id, date, level")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
  ]);

  const byInjury = new Map<string, Pick<PainLog, "injury_id" | "date" | "level">[]>();
  for (const log of (logs ?? []) as Pick<PainLog, "injury_id" | "date" | "level">[]) {
    const list = byInjury.get(log.injury_id) ?? [];
    list.push(log);
    byInjury.set(log.injury_id, list);
  }

  const withPain: InjuryWithPain[] = ((injuries ?? []) as Injury[]).map((injury) => {
    const list = byInjury.get(injury.id) ?? [];
    return {
      ...injury,
      lastLevel: list[0]?.level ?? null,
      lastDate: list[0]?.date ?? null,
      dayLevel: list.find((l) => l.date === date)?.level ?? null,
      entries: list.length,
    };
  });

  return <InjuriesScreen userId={user.id} injuries={withPain} date={date} today={today} />;
}
