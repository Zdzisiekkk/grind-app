import { VicesScreen, type ViceWithEvents } from "@/components/vices/VicesScreen";
import { createClient } from "@/lib/supabase/server";
import type { Vice, ViceEvent } from "@/lib/database.types";

export const metadata = { title: "Nałogi" };

export default async function NalogiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: vices }, { data: events }] = await Promise.all([
    supabase
      .from("vices")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("order_index")
      .order("created_at"),
    supabase
      .from("vice_events")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false }),
  ]);

  const byVice = new Map<string, ViceEvent[]>();
  for (const event of (events ?? []) as ViceEvent[]) {
    const list = byVice.get(event.vice_id) ?? [];
    list.push(event);
    byVice.set(event.vice_id, list);
  }

  const withEvents: ViceWithEvents[] = ((vices ?? []) as Vice[]).map((vice) => ({
    ...vice,
    events: byVice.get(vice.id) ?? [],
  }));

  return <VicesScreen userId={user.id} vices={withEvents} />;
}
