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

/** Ile powiadomień leci równolegle w jednej paczce. */
const BATCH = 50;

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

  const ok: string[] = [];
  const dead: string[] = [];
  const retry: string[] = [];

  // Paczkami, nie wszystko naraz.
  //
  // Przy garstce ludzi jedno wielkie Promise.all nie robi różnicy. Przy tysiącu
  // subskrypcji o pełnej godzinie to tysiąc równoczesnych połączeń w funkcji
  // z limitem 60 sekund — i wtedy nie dochodzi ŻADNE powiadomienie, a nie tylko
  // te nadmiarowe. Pięćdziesiąt naraz wysyca łącze i zostawia zapas czasu.
  for (let i = 0; i < due.length; i += BATCH) {
    await Promise.all(
      due.slice(i, i + BATCH).map(async (item) => {
        try {
          await webpush.sendNotification(
            { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
            JSON.stringify({ title: item.title, body: item.body, url: item.url, key: item.key }),
            { TTL: 3600 },
          );
          sent++;
          ok.push(item.endpoint);
        } catch (e) {
          // 404 i 410 znaczą, że subskrypcja już nie istnieje — najczęściej ktoś
          // odinstalował aplikację. Trzymanie takiego wpisu to wysyłanie w próżnię.
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            gone++;
            dead.push(item.endpoint);
          } else {
            failed++;
            retry.push(item.endpoint);
          }
        }
      }),
    );
  }

  // Wynik zapisujemy zbiorczo. Wcześniej każde powiadomienie ciągnęło za sobą
  // osobne zapytanie do bazy, czyli drugie tyle ruchu, co sama wysyłka.
  await Promise.all([
    ok.length ? supabase.rpc("push_ok_many", { p_secret: secret, p_endpoints: ok }) : null,
    dead.length
      ? supabase.rpc("push_failed_many", { p_secret: secret, p_endpoints: dead, p_gone: true })
      : null,
    retry.length
      ? supabase.rpc("push_failed_many", { p_secret: secret, p_endpoints: retry, p_gone: false })
      : null,
  ]);

  return NextResponse.json({ sent, gone, failed });
}
