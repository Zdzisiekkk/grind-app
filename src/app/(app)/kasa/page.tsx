import { redirect } from "next/navigation";
import { KasaScreen } from "@/components/finanse/KasaScreen";
import { createClient } from "@/lib/supabase/server";
import type { FinansePodsumowanie } from "@/lib/database.types";

export const metadata = { title: "Kasa" };

export default async function KasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: podsumowanie }, { data: cele }, { data: wydatki }] = await Promise.all([
    // Majątek, poduszka i budżet jednym zapytaniem zamiast czterema -
    // każda z tych liczb potrzebuje innego okna czasu i łączenie ich
    // po stronie klienta znaczyłoby cztery rundy do bazy.
    supabase.rpc("finanse_podsumowanie"),
    supabase
      .from("v_finanse_cele")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "aktywny")
      .order("order_index")
      .order("created_at"),
    supabase
      .from("finanse_wydatki")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <KasaScreen
      userId={user.id}
      podsumowanie={podsumowanie as FinansePodsumowanie}
      cele={cele ?? []}
      wydatki={wydatki ?? []}
    />
  );
}
