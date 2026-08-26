"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WATER_PORTION_ML } from "@/lib/constants";

const intOrNull = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Pole <input type="time"> oddaje „HH:MM" albo pusty string. */
const timeOrNull = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: (formData.get("display_name") as string)?.trim() || null,
      daily_kcal: intOrNull(formData.get("daily_kcal")),
      daily_protein_g: intOrNull(formData.get("daily_protein_g")),
      daily_carbs_g: intOrNull(formData.get("daily_carbs_g")),
      daily_fat_g: intOrNull(formData.get("daily_fat_g")),
      height_cm: intOrNull(formData.get("height_cm")),
      birth_year: intOrNull(formData.get("birth_year")),
      daily_water_ml: intOrNull(formData.get("daily_water_ml")),
      water_portion_ml: intOrNull(formData.get("water_portion_ml")) ?? DEFAULT_WATER_PORTION_ML,
      water_reminder_from: timeOrNull(formData.get("water_reminder_from")),
      water_reminder_to: timeOrNull(formData.get("water_reminder_to")),
      water_reminder_every_min: intOrNull(formData.get("water_reminder_every_min")),
    })
    .eq("id", user.id);

  if (error) throw new Error(`Nie udało się zapisać profilu: ${error.message}`);

  revalidatePath("/profil");
  revalidatePath("/");
  revalidatePath("/dieta");
  revalidatePath("/nawyki");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
