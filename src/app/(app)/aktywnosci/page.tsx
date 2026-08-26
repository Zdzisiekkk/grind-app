import { ActivitiesScreen } from "@/components/activities/ActivitiesScreen";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/lib/database.types";

export const metadata = { title: "Aktywności" };

export default async function AktywnosciPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: activities }, { data: weight }] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(60),
    supabase
      .from("body_weight_logs")
      .select("weight_kg")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <ActivitiesScreen
      userId={user.id}
      initialActivities={(activities ?? []) as Activity[]}
      bodyWeightKg={weight?.weight_kg ?? null}
    />
  );
}
