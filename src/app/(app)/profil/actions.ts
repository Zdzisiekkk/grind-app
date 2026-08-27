"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WATER_PORTION_ML } from "@/lib/constants";
import { DEFAULT_SLEEP_GOAL_MIN } from "@/lib/sleep";

const intOrNull = (value: FormDataEntryValue | null) => {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Pole <input type="time"> oddaje „HH:MM" albo pusty string. */
const timeOrNull = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;

/** Cel snu wpisuje się w godzinach, baza trzyma minuty. */
const sleepGoalMin = (value: FormDataEntryValue | null) => {
  const h = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(h) || h <= 0) return DEFAULT_SLEEP_GOAL_MIN;
  return Math.min(720, Math.max(240, Math.round(h * 60)));
};

/**
 * Wynik zapisu profilu.
 *
 * `at` to znacznik czasu, nie ozdoba: bez niego dwa zapisy pod rząd dają ten
 * sam obiekt stanu i potwierdzenie nie pokazuje się po raz drugi.
 */
export type SaveState =
  | { ok: true; at: number }
  | { ok: false; message: string }
  | null;

export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
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
      sleep_goal_min: sleepGoalMin(formData.get("sleep_goal_h")),
      sleep_target_bedtime: timeOrNull(formData.get("sleep_target_bedtime")),
      sleep_reminder_at: timeOrNull(formData.get("sleep_reminder_at")),
    })
    .eq("id", user.id);

  // Błąd wracamy jako stan, a nie wyjątek: wyjątek w akcji serwerowej gasi
  // cały ekran, a tutaj chodzi o jedno pole, które się nie zapisało.
  if (error) return { ok: false, message: `Nie udało się zapisać: ${error.message}` };

  revalidatePath("/profil");
  revalidatePath("/");
  revalidatePath("/dieta");
  revalidatePath("/nawyki");
  revalidatePath("/sen");
  revalidatePath("/progres");

  return { ok: true, at: Date.now() };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Trwałe usunięcie konta.
 *
 * Kasowanie robi funkcja w bazie, bo do auth.users zwykły użytkownik nie ma
 * dostępu — ale kasuje wyłącznie auth.uid(), więc nie da się nią ruszyć
 * cudzego konta. Kaskady zabierają dziennik, plany, notatki i subskrypcję.
 *
 * Uwaga: to NIE anuluje subskrypcji w Stripe. Płatności trzeba wypowiedzieć
 * osobno, w panelu — dlatego ekran mówi o tym wprost, zamiast zostawiać
 * człowieka z kartą obciążaną za nieistniejące konto.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("delete_my_account", {});
  if (error) throw new Error(`Nie udało się usunąć konta: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/login?usuniete=1");
}

/**
 * Wycofanie zgody na przetwarzanie danych o zdrowiu.
 *
 * Zgodę można cofnąć w każdej chwili — i cofnięcie musi coś realnie znaczyć,
 * więc razem z nią znikają dane, których dotyczyła. Reszta aplikacji
 * (trening, plany, zadania) działa dalej.
 */
export async function withdrawHealthConsent(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (const table of ["sleep_logs", "pain_logs", "injuries", "body_weight_logs"] as const) {
    await supabase.from(table).delete().eq("user_id", user.id);
  }

  await supabase
    .from("profiles")
    .update({ health_consent_at: null, height_cm: null, birth_year: null, sex: null })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/profil");
}
