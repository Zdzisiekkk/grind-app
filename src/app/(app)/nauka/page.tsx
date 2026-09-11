import { NaukaScreen } from "@/components/nauka/NaukaScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { ETAP_OPANOWANE } from "@/lib/nauka";
import type { NaukaPowtorka, NaukaSesja, NaukaTemat } from "@/lib/database.types";

export const metadata = { title: "Nauka" };

export default async function NaukaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();

  const [{ data: tematy }, { data: sesje }, { data: powtorki }, { count: opanowanych }] =
    await Promise.all([
      supabase.from("nauka_tematy").select("*").eq("user_id", user.id).order("created_at"),
      // 60 dni: tydzień do celu, reszta na passę i listę ostatnich sesji.
      supabase
        .from("nauka_sesje")
        .select("*")
        .eq("user_id", user.id)
        .gte("data", addDaysISO(dzis, -59))
        .order("created_at", { ascending: false }),
      supabase
        .from("nauka_powtorki")
        .select("*")
        .eq("user_id", user.id)
        .lt("etap", ETAP_OPANOWANE)
        .order("nastepna"),
      supabase
        .from("nauka_powtorki")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("etap", ETAP_OPANOWANE),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nauka</h1>
      <NaukaScreen
        userId={user.id}
        dzis={dzis}
        tematy={(tematy ?? []) as NaukaTemat[]}
        sesje={(sesje ?? []) as NaukaSesja[]}
        powtorki={(powtorki ?? []) as NaukaPowtorka[]}
        opanowanych={opanowanych ?? 0}
      />
    </div>
  );
}
