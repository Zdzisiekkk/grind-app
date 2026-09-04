"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { KARTY_PULPITU } from "@/lib/pulpit";

/**
 * Zapis tego, co ma być widoczne na pulpicie.
 *
 * Przyjmujemy WYŁĄCZNIE identyfikatory kart, które aplikacja zna - lista
 * z przeglądarki nie jest źródłem prawdy o tym, co istnieje. Bez tego
 * filtra kolumna zbierałaby śmieci przy każdej zmianie w aplikacji.
 */
export async function zapiszKartyPulpitu(karty: string[]): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const znane = new Set(KARTY_PULPITU.map((k) => k.id));
  // Kolejność bierzemy z katalogu, a nie z żądania: pulpit ma wyglądać tak
  // samo niezależnie od tego, w jakiej kolejności ktoś klikał przełączniki.
  const wybrane = KARTY_PULPITU.filter((k) => karty.includes(k.id) && znane.has(k.id)).map(
    (k) => k.id,
  );

  const { error } = await supabase
    .from("profiles")
    .update({ pulpit_karty: wybrane })
    .eq("id", user.id);

  if (error) return { ok: false };

  revalidatePath("/");
  return { ok: true };
}
