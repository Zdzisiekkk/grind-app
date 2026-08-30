import { PlansScreen } from "@/components/plan/PlansScreen";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/database.types";

export const metadata = { title: "Plany" };

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS zwraca własne plany i publiczne szablony jednym zapytaniem.
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  const all = (plans ?? []) as Plan[];
  const myPlans = all.filter((p) => p.user_id === user.id);
  const templates = all.filter((p) => p.user_id !== user.id && p.is_template);

  // Liczba dni w każdym planie - dwa zapytania zamiast N.
  const dayCounts: Record<string, number> = {};
  if (all.length) {
    const { data: phases } = await supabase
      .from("phases")
      .select("id, plan_id")
      .in("plan_id", all.map((p) => p.id));

    const planByPhase = new Map((phases ?? []).map((p) => [p.id, p.plan_id]));

    if (planByPhase.size) {
      const { data: days } = await supabase
        .from("workout_days")
        .select("id, phase_id")
        .in("phase_id", [...planByPhase.keys()]);

      for (const day of days ?? []) {
        const planId = planByPhase.get(day.phase_id);
        if (planId) dayCounts[planId] = (dayCounts[planId] ?? 0) + 1;
      }
    }
  }

  return (
    <PlansScreen
      userId={user.id}
      myPlans={myPlans}
      templates={templates}
      dayCounts={dayCounts}
    />
  );
}
