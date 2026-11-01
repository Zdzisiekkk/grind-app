"use server";

import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { PartnerKontekst, PartnerStan } from "@/lib/database.types";

type Wynik = { ok: true } | { ok: false; blad: string };

const NAZWA_KONTEKSTU: Record<PartnerKontekst, string> = {
  ogolne: "",
  trening: "treningu",
  posilek: "jedzenia",
  nawyk: "nawyków",
  skincare: "skin care",
  woda: "wody",
};

/**
 * Wiadomość do partnera: zapis w bazie, potem natychmiastowy push.
 *
 * Zapis idzie przez funkcję partner_wyslij, która sama ustala nadawcę i
 * odbiorcę z pary - klient nie przesyła, do kogo pisze. Push jest dodatkiem:
 * jeśli klucze VAPID nie są ustawione albo partner nie włączył powiadomień,
 * wiadomość i tak czeka w aplikacji, więc błąd wysyłki nie cofa zapisu.
 */
export async function wyslijDoPartnera(
  rodzaj: "szturch" | "reakcja" | "wiadomosc",
  kontekst: PartnerKontekst,
  tresc?: string,
  emoji?: string,
): Promise<Wynik> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, blad: "Zaloguj się ponownie." };

  const { error } = await supabase.rpc("partner_wyslij", {
    p_rodzaj: rodzaj,
    p_kontekst: kontekst,
    p_tresc: tresc ?? null,
    p_emoji: emoji ?? null,
  });
  if (error) return { ok: false, blad: error.message.replace(/^.*?: /, "") };

  await wyslijPush(supabase, user.id, rodzaj, kontekst, tresc, emoji);
  revalidatePath("/partner");
  return { ok: true };
}

async function wyslijPush(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rodzaj: "szturch" | "reakcja" | "wiadomosc",
  kontekst: PartnerKontekst,
  tresc?: string,
  emoji?: string,
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  try {
    const [{ data: subs }, { data: ja }] = await Promise.all([
      supabase.rpc("partner_subskrypcje"),
      supabase.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
    ]);
    if (!subs?.length) return;

    const imie = ja?.display_name?.trim() || ja?.email?.split("@")[0] || "Partner";
    const o = NAZWA_KONTEKSTU[kontekst];
    const body =
      rodzaj === "szturch"
        ? tresc || (o ? `Szturcha Cię w sprawie ${o} 👊` : "Szturcha Cię 👊")
        : rodzaj === "reakcja"
          ? `${emoji ?? "👏"}${o ? ` za postęp w ${o}` : ""}`
          : (tresc ?? "");

    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:kontakt@grind.app", publicKey, privateKey);
    await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: `Grind - ${imie}`, body, url: "/partner", key: `partner:${Date.now()}` }),
          { TTL: 3600 },
        ),
      ),
    );
  } catch (e) {
    // Push to dodatek do zapisanej wiadomości, więc jego awaria nie jest błędem użytkownika.
    console.error("partner push:", e instanceof Error ? e.message : e);
  }
}

export async function wygenerujKod(): Promise<{ ok: true; kod: string } | { ok: false; blad: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_kod");
  if (error || !data) return { ok: false, blad: error?.message.replace(/^.*?: /, "") ?? "Nie udało się." };
  revalidatePath("/partner");
  return { ok: true, kod: data };
}

export async function dolaczKodem(kod: string): Promise<Wynik> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_dolacz", { p_kod: kod });
  if (error) return { ok: false, blad: error.message.replace(/^.*?: /, "") };
  revalidatePath("/partner");
  return { ok: true };
}

export async function rozlacz(): Promise<Wynik> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_rozlacz");
  if (error) return { ok: false, blad: error.message };
  revalidatePath("/partner");
  return { ok: true };
}

export async function ustawAlerty(wlaczone: boolean): Promise<Wynik> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_ustaw_alerty", { p_wlaczone: wlaczone });
  if (error) return { ok: false, blad: error.message };
  revalidatePath("/partner");
  return { ok: true };
}

export async function odczytaneWiadomosci(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("partner_odczytane");
}

export type { PartnerStan };
