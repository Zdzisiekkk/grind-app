import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Wysyłka powiadomień w tle.
 *
 * Budzi to pg_cron w Supabase co 15 minut — nie cron Vercela, bo darmowy plan
 * daje tam JEDNO uruchomienie dziennie, co przy przypomnieniach o wodzie jest
 * bezużyteczne.
 *
 * Trasa niczego nie decyduje: co komu wysłać, ustala funkcja w bazie, która
 * przy okazji zaklepuje wysyłkę, żeby powtórzone wywołanie crona nie wysłało
 * tego samego dwa razy.
 */
export const maxDuration = 60;

type Due = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  key: string;
  title: string;
  body: string;
  url: string;
};

function configured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY ||
      (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_CRON_SECRET;
  // Porównanie o stałym czasie nie ma tu sensu — sekret ma 32 losowe bajty,
  // a zgadywanie po czasie odpowiedzi przez sieć jest nierealne.
  if (!secret || request.headers.get("x-grind-cron") !== secret) {
    return NextResponse.json({ error: "Nie tędy." }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || !configured()) {
    return NextResponse.json({ skipped: "brak kluczy VAPID" });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:kontakt@grind.app",
    publicKey,
    privateKey,
  );

  const supabase = createClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY());

  const { data, error } = await supabase.rpc("push_due", { p_secret: secret });
  if (error) {
    console.error("push_due:", error.message);
    return NextResponse.json({ error: "Nie udało się pobrać kolejki." }, { status: 500 });
  }

  const due = (data ?? []) as unknown as Due[];
  if (due.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;
  let gone = 0;
  let failed = 0;

  await Promise.all(
    due.map(async (item) => {
      try {
        await webpush.sendNotification(
          { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
          JSON.stringify({ title: item.title, body: item.body, url: item.url, key: item.key }),
          { TTL: 3600 },
        );
        sent++;
        await supabase.rpc("push_ok", { p_secret: secret, p_endpoint: item.endpoint });
      } catch (e) {
        // 404 i 410 znaczą, że subskrypcja już nie istnieje — najczęściej ktoś
        // odinstalował aplikację. Trzymanie takiego wpisu to wysyłanie w próżnię.
        const status = (e as { statusCode?: number }).statusCode;
        const isGone = status === 404 || status === 410;
        if (isGone) gone++;
        else failed++;
        await supabase.rpc("push_failed", {
          p_secret: secret,
          p_endpoint: item.endpoint,
          p_gone: isGone,
        });
      }
    }),
  );

  return NextResponse.json({ sent, gone, failed });
}
