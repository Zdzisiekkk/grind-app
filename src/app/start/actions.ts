"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nutritionTargets, type ActivityLevel, type Goal, type Sex } from "@/lib/nutrition";
import { todayISO } from "@/lib/format";
import type { Equipment, Experience } from "@/lib/onboarding";

export type OnboardingInput = {
  goal: Goal;
  experience: Experience;
  daysPerWeek: number;
  equipment: Equipment;
  activity: ActivityLevel;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  planId: string | null;
};

/**
 * Zamknięcie kreatora: profil, cele, pierwszy pomiar wagi i kopia planu.
 *
 * Wszystko jednym strzałem po stronie serwera, bo to moment, w którym
 * człowiek jest najbardziej niecierpliwy — cztery osobne zapytania z
 * przeglądarki dawałyby cztery okazje do zawiśnięcia w połowie.
 */
export async function finishOnboarding(input: OnboardingInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const age = Math.max(14, Math.min(100, new Date().getFullYear() - input.birthYear));
  const targets = nutritionTargets({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age,
    sex: input.sex,
    activity: input.activity,
    goal: input.goal,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      goal: input.goal,
      experience: input.experience,
      equipment: input.equipment,
      activity_level: input.activity,
      weekly_workouts: input.daysPerWeek,
      sex: input.sex,
      birth_year: input.birthYear,
      height_cm: input.heightCm,
      daily_kcal: targets.kcal,
      daily_protein_g: targets.protein,
      daily_carbs_g: targets.carbs,
      daily_fat_g: targets.fat,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) throw new Error(`Nie udało się zapisać profilu: ${profileError.message}`);

  // Pierwszy punkt na wykresie wagi. Bez niego przez dwa tygodnie nie da się
  // powiedzieć, czy policzone kalorie w ogóle działają.
  await supabase
    .from("body_weight_logs")
    .upsert(
      { user_id: user.id, date: todayISO(), weight_kg: input.weightKg },
      { onConflict: "user_id,date" },
    );

  if (input.planId) {
    const { error: planError } = await supabase.rpc("clone_plan", {
      p_source_plan_id: input.planId,
      p_new_name: null,
      p_activate: true,
    });
    // Brak planu nie może zablokować wejścia do aplikacji — resztę już mamy
    // zapisaną, a plan da się wybrać później z zakładki „Plany".
    if (planError) console.error("clone_plan przy kreatorze:", planError.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** „Pomiń" — zapisujemy tylko fakt przejścia, żeby kreator nie wracał. */
export async function skipOnboarding(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/");
}
