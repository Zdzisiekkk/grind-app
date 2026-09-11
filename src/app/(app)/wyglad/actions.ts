"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Ujecie } from "@/lib/database.types";

/**
 * Pięć minut - dość, żeby przejrzeć galerię, za mało, żeby link krążył.
 *
 * Linki podpisujemy na żądanie, a nie przy renderze strony. Przy renderze
 * trzeba by podpisać wszystkie zdjęcia ze wszystkich skanów na zapas, z krótką
 * ważnością - i galeria otwarta trzy minuty później pokazywałaby puste ramki.
 */
const WAZNOSC_LINKU = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Linki do zdjęć: identyfikator skanu → ujęcie → podpisany adres. */
export type LinkiZdjec = Record<string, Partial<Record<Ujecie, string>>>;

export async function linkiDoZdjec(): Promise<LinkiZdjec> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: zdjecia } = await supabase
    .from("wyglad_zdjecia")
    .select("skan_id, ujecie, storage_path")
    .eq("user_id", user.id);
  if (!zdjecia?.length) return {};

  // Jedno żądanie na wszystkie pliki, nie jedno na zdjęcie.
  const { data: podpisane } = await supabase.storage
    .from("wyglad")
    .createSignedUrls(
      zdjecia.map((z) => z.storage_path),
      WAZNOSC_LINKU,
    );

  const poSciezce = new Map<string, string>();
  for (const p of podpisane ?? []) {
    if (p.path && p.signedUrl && !p.error) poSciezce.set(p.path, p.signedUrl);
  }

  const wynik: LinkiZdjec = {};
  for (const z of zdjecia) {
    const url = poSciezce.get(z.storage_path);
    if (!url) continue;
    (wynik[z.skan_id] ??= {})[z.ujecie] = url;
  }
  return wynik;
}

/**
 * Usunięcie skanu razem ze zdjęciami.
 *
 * Najpierw pliki, potem wiersz. Odwrotna kolejność zostawiłaby zdjęcia twarzy
 * w magazynie bez wiersza, który by o nich wiedział - czyli bez żadnego
 * przycisku, którym dałoby się je jeszcze usunąć.
 *
 * Skasowanie skanu NIE zwraca miejsca w miesięcznej puli (0078) - pula liczy
 * się z rejestru kosztów AI, bo analiza już się odbyła i kosztowała.
 */
export async function usunSkan(skanId: string): Promise<{ ok: boolean; blad?: string }> {
  if (!UUID.test(skanId)) return { ok: false, blad: "Nie ma takiego skanu." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, blad: "Nie zalogowano." };

  const { data: skan } = await supabase
    .from("wyglad_skany")
    .select("id")
    .eq("id", skanId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!skan) return { ok: false, blad: "Nie ma takiego skanu." };

  const { data: zdjecia } = await supabase
    .from("wyglad_zdjecia")
    .select("storage_path")
    .eq("skan_id", skanId);

  /*
   * Katalog skanu też, nie tylko ścieżki z tabeli. Plik wysłany, zanim zapis
   * wiersza się wywrócił, leży w kubełku bez wiersza - a to ciągle zdjęcie
   * czyjejś twarzy.
   */
  const katalog = `${user.id}/${skanId}`;
  const { data: wKatalogu } = await supabase.storage.from("wyglad").list(katalog, { limit: 100 });

  const sciezki = new Set<string>((zdjecia ?? []).map((z) => z.storage_path));
  for (const p of wKatalogu ?? []) sciezki.add(`${katalog}/${p.name}`);

  if (sciezki.size) {
    const { error } = await supabase.storage.from("wyglad").remove([...sciezki]);
    if (error) return { ok: false, blad: "Nie udało się usunąć zdjęć. Spróbuj jeszcze raz." };
  }

  const { error } = await supabase
    .from("wyglad_skany")
    .delete()
    .eq("id", skanId)
    .eq("user_id", user.id);
  if (error) return { ok: false, blad: "Zdjęcia usunięte, ale sam skan nie. Spróbuj jeszcze raz." };

  revalidatePath("/wyglad");
  return { ok: true };
}
