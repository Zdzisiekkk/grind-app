import { GlowaScreen } from "@/components/glowa/GlowaScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import type { GlowaDzien, GlowaSesja, GlowaWpis } from "@/lib/database.types";

export const metadata = { title: "Głowa" };

export default async function GlowaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();
  // 60 dni: 14 na pasek, reszta, żeby zestawienia ze snem miały z czego liczyć.
  const od = addDaysISO(dzis, -59);

  const [{ data: dni }, { data: sesje }, { data: wpisy }, { data: noce }] = await Promise.all([
    supabase
      .from("glowa_dzien")
      .select("*")
      .eq("user_id", user.id)
      .gte("data", od)
      .order("data", { ascending: false }),
    supabase
      .from("glowa_sesje")
      .select("*")
      .eq("user_id", user.id)
      .gte("data", addDaysISO(dzis, -29))
      .order("created_at", { ascending: false }),
    supabase
      .from("glowa_wpisy")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("v_sleep").select("date, sleep_min").eq("user_id", user.id).gte("date", od),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Głowa</h1>
      <GlowaScreen
        userId={user.id}
        dzis={dzis}
        dni={(dni ?? []) as GlowaDzien[]}
        sesje={(sesje ?? []) as GlowaSesja[]}
        wpisy={(wpisy ?? []) as GlowaWpis[]}
        noce={(noce ?? []).map((n) => ({ date: n.date, sleep_min: n.sleep_min }))}
      />
    </div>
  );
}
