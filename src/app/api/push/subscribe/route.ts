import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Zapisanie i wypisanie subskrypcji przeglądarki.
 *
 * Idzie przez trasę serwerową, a nie prosto z przeglądarki do bazy, tylko po
 * to, żeby przy okazji zapisać strefę czasową urządzenia - bez niej
 * przypomnienie o 22:00 przyszłoby w Polsce o północy.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const subscription = body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Niekompletna subskrypcja." }, { status: 400 });
  }

  if (typeof body?.timezone === "string" && body.timezone.length < 64) {
    await supabase.from("profiles").update({ timezone: body.timezone }).eq("id", user.id);
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      label: typeof body?.label === "string" ? body.label.slice(0, 60) : null,
      failures: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: `Nie udało się zapisać: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Brak adresu." }, { status: 400 });

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
