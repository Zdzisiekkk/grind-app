import { redirect } from "next/navigation";
import { StartWizard } from "@/components/onboarding/StartWizard";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/SetupNotice";
import { createClient } from "@/lib/supabase/server";
import type { TemplatePlan } from "@/lib/onboarding";

export const metadata = { title: "Zaczynamy" };

/**
 * Kreator startowy stoi POZA grupą (app) celowo: nie ma tu dolnej nawigacji
 * ani przypomnień. Człowiek, który widzi apkę pierwszy raz, ma mieć jedną
 * rzecz do zrobienia na ekranie.
 */
export default async function StartPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("onboarded_at, email").eq("id", user.id).maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, description, goal, days_per_week, level, equipment, tags")
      .is("user_id", null)
      .eq("is_template", true)
      .eq("is_public", true)
      .order("days_per_week"),
  ]);

  // Kto już przeszedł kreator, nie ma po co do niego wracać - wejście przez
  // adres wprost odsyłamy na pulpit.
  if (profile?.onboarded_at) redirect("/");

  return (
    <StartWizard
      plans={(plans ?? []) as TemplatePlan[]}
      email={profile?.email ?? user.email ?? null}
    />
  );
}
