import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured, siteUrl, stripe, stripePriceId } from "@/lib/stripe/server";
import { getPricing } from "@/lib/subscription";

/**
 * Rozpoczęcie płatności.
 *
 * BLIK i Przelewy24 nie są tu wypisane z palca - metody płatności ustawia się
 * raz w panelu Stripe'a i Checkout sam pokazuje te, które pasują do waluty
 * i kraju kupującego. Wpisanie ich na sztywno w kodzie kończy się błędem
 * u kogoś, kto płaci kartą spoza Polski.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Płatności nie są jeszcze włączone. Wróć za chwilę." },
      { status: 503 },
    );
  }

  const pricing = await getPricing();
  if (!pricing.enabled) {
    return NextResponse.json(
      { error: "Sprzedaż subskrypcji jest chwilowo wyłączona." },
      { status: 503 },
    );
  }

  // Który plan kupuje - domyślnie Pro, żeby stary klient (bez pola w body)
  // dalej działał. Wartość spoza listy to nie błąd użytkownika, tylko nasz,
  // więc ucinamy ją do domyślnej zamiast odsyłać 400.
  const body = await request.json().catch(() => ({}));
  const plan: "starter" | "pro" = body?.plan === "starter" ? "starter" : "pro";

  const priceId = stripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: "Ten plan nie jest jeszcze skonfigurowany. Spróbuj drugiego." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Klient wraca do Stripe'a przy każdym kolejnym okresie, więc trzymamy
      // jego identyfikator; przy pierwszym zakupie podajemy sam adres e-mail.
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : (user.email ?? undefined),
      // Po tym odnajdujemy konto w webhooku. client_reference_id bywa gubione
      // przy zmianach subskrypcji, dlatego id trafia też do metadanych.
      client_reference_id: user.id,
      subscription_data: {
        // Plan idzie też w metadanych - zapas na wypadek, gdyby ktoś w panelu
        // Stripe'a podmienił cenę i webhook nie poznał jej po identyfikatorze.
        metadata: { user_id: user.id, plan },
        ...(pricing.trial_days > 0 ? { trial_period_days: pricing.trial_days } : {}),
      },
      metadata: { user_id: user.id, plan },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/subskrypcja?platnosc=ok`,
      cancel_url: `${siteUrl()}/subskrypcja?platnosc=anulowana`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout:", e);
    return NextResponse.json(
      { error: "Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę." },
      { status: 502 },
    );
  }
}
