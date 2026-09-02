"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

/**
 * Rozpoczyna (albo wznawia) trening danego dnia planu.
 * Jeśli dziś istnieje już niezakończona sesja tego samego dnia - wracamy do niej,
 * zamiast tworzyć duplikat.
 */
export async function startSession(formData: FormData) {
  const dayId = (formData.get("dayId") as string) || null;
  const dayLabel = (formData.get("dayLabel") as string) || null;
  const date = todayISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data && !dayId) redirect(`/trening/${existing.data.id}`);

  if (dayId) {
    const sameDay = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("workout_day_id", dayId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sameDay.data) redirect(`/trening/${sameDay.data.id}`);
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      workout_day_id: dayId,
      day_label: dayLabel,
      date,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Nie udało się rozpocząć treningu: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/trening");
  redirect(`/trening/${data.id}`);
}

/** Usuwa sesję razem z jej seriami (kaskada w bazie). */
export async function deleteSession(formData: FormData) {
  const id = formData.get("sessionId") as string;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS i tak dopuszcza wyłącznie własne wiersze, ale jawny filtr jest tu
  // zgodny z resztą pliku (patrz startSession) i nie polega wyłącznie na
  // tym, że nikt nigdy nie zmieni polityki na tej tabeli.
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/trening");
  redirect("/trening");
}
