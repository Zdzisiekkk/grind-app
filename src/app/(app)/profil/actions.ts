"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const intOrNull = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

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
    })
    .eq("id", user.id);

  if (error) throw new Error(`Nie udało się zapisać profilu: ${error.message}`);

  revalidatePath("/profil");
  revalidatePath("/");
  revalidatePath("/dieta");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
