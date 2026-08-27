"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Zatwierdzenie propozycji.
 *
 * Zmiana dzieje się TUTAJ, po stronie serwera, a nie w trasie API trenera —
 * dzięki temu model nigdy nie ma drogi do zapisania czegokolwiek w profilu.
 * Może wyłącznie zaproponować liczbę, którą człowiek musi kliknąć.
 */
export async function acceptProposal(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: proposal } = await supabase
    .from("coach_proposals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!proposal || proposal.status !== "pending") return;

  const kcal = (proposal.action as { daily_kcal?: number })?.daily_kcal;
  // Zakres jak w kreatorze — nawet zatwierdzona propozycja nie może ustawić
  // celu, który byłby niebezpieczny.
  if (proposal.kind === "diet_kcal" && typeof kcal === "number" && kcal >= 1200 && kcal <= 6000) {
    await supabase.from("profiles").update({ daily_kcal: kcal }).eq("id", user.id);
  }

  await supabase
    .from("coach_proposals")
    .update({ status: "accepted", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/trener");
  revalidatePath("/");
  revalidatePath("/dieta");
  revalidatePath("/profil");
}

export async function rejectProposal(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("coach_proposals")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  revalidatePath("/trener");
}
