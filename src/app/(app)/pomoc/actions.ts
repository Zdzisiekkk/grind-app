"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Zapis stanu samouczka.
 *
 * Akcja serwerowa, nie zapytanie z przeglądarki: to jedyna zmiana w profilu
 * robiona bez formularza, a ma przechodzić tą samą drogą co reszta zapisów.
 */
export async function zamknijSamouczek(stan: "pominiety" | "ukonczony") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ samouczek_stan: stan }).eq("id", user.id);
  revalidatePath("/", "layout");
}

/** Ponowne włączenie samouczka z Pomocy. */
export async function wlaczSamouczek() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ samouczek_stan: "nowy" }).eq("id", user.id);
  revalidatePath("/", "layout");
}
