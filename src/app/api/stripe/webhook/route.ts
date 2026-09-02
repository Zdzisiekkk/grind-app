import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { isStripeConfigured, planFromPriceId, stripe, stripeWebhookSecret } from "@/lib/stripe/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Webhook Stripe'a - jedyne miejsce, które zmienia stan subskrypcji.
 *
 * Nie ufamy tu niczemu, co przychodzi z przeglądarki: powrót z płatności na
 * /subskrypcja?platnosc=ok NIE nadaje dostępu. Dostęp nadaje wyłącznie
 * podpisane zdarzenie od Stripe'a, sprawdzone kluczem podpisu.
 *
 * Do zapisu używamy wąskiej funkcji apply_subscription chronionej osobnym
 * sekretem, a nie klucza serwisowego Supabase - ten omija całe RLS i nie ma
 * powodu, żeby leżał na serwerze aplikacji. Szczegóły w migracji 0015.
 */

/** Zdarzenia, które faktycznie zmieniają dostęp. Resztę potwierdzamy i mijamy. */
const HANDLED = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function secondsToIso(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

/**
 * Identyfikator użytkownika Grinda.
 *
 * Bierzemy go z metadanych, bo tylko my je tam wpisaliśmy. Adres e-mail
 * z konta Stripe'a nie nadaje się na klucz: da się go zmienić po ich stronie
 * i nie ma gwarancji, że odpowiada komukolwiek u nas.
 */
function userIdFrom(object: Stripe.Subscription | Stripe.Checkout.Session): string | null {
  const meta = object.metadata as Record<string, string> | null;
  if (meta?.user_id) return meta.user_id;
  if ("client_reference_id" in object && object.client_reference_id) {
    return object.client_reference_id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !stripeWebhookSecret()) {
    // 200, nie 500: Stripe ponawia nieudane doręczenia, a my nie chcemy
    // kolejki powtórek tylko dlatego, że klucze jeszcze nie są wpisane.
    return NextResponse.json({ ignored: "brak konfiguracji" });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Brak podpisu." }, { status: 400 });

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, stripeWebhookSecret() as string);
  } catch (e) {
    console.error("Stripe: podpis się nie zgadza", e);
    return NextResponse.json({ error: "Podpis się nie zgadza." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true });

  const gatewaySecret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!gatewaySecret) {
    console.error("Brak SUPABASE_WEBHOOK_SECRET - nie mam czym zapisać subskrypcji.");
    return NextResponse.json({ error: "Serwer nieskonfigurowany." }, { status: 500 });
  }

  try {
    let userId: string | null = null;
    let subscription: Stripe.Subscription | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = userIdFrom(session);
      if (session.subscription) {
        subscription = await stripe().subscriptions.retrieve(String(session.subscription));
      }
    } else {
      subscription = event.data.object as Stripe.Subscription;
      userId = userIdFrom(subscription);
    }

    if (!userId) {
      console.error(`Stripe ${event.type}: brak user_id w metadanych`);
      return NextResponse.json({ received: true });
    }

    // Usunięcie subskrypcji przychodzi ze statusem 'canceled', ale bywa też
    // zdarzeniem bez pełnego obiektu - wtedy zapisujemy sam fakt anulowania.
    const status = subscription?.status ?? "canceled";
    const item = subscription?.items?.data?.[0];

    // Który plan opłacono: po identyfikatorze ceny, a gdy jej nie poznajemy -
    // po metadanych z checkoutu. Ostateczny zapas to 'pro': jedyna droga
    // tutaj wiedzie przez zdarzenie podpisane przez Stripe'a o cenie, którą
    // sami utworzyliśmy, więc lepiej dać za dużo niż odebrać opłacony dostęp
    // przez literówkę w zmiennej środowiskowej.
    const meta = subscription?.metadata as Record<string, string> | null;
    const plan =
      planFromPriceId(item?.price?.id) ?? (meta?.plan === "starter" ? "starter" : "pro");

    const supabase = createClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY());
    const { data: applied, error } = await supabase.rpc("apply_subscription", {
      p_secret: gatewaySecret,
      p_user_id: userId,
      p_status: status,
      p_customer_id: subscription?.customer ? String(subscription.customer) : null,
      p_subscription_id: subscription?.id ?? null,
      p_price_id: item?.price?.id ?? null,
      p_period_end: secondsToIso(item?.current_period_end),
      p_cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
      p_trial_end: secondsToIso(subscription?.trial_end),
      // Stripe NIE gwarantuje kolejności doręczeń i ponawia nieudane. Bez tych
      // dwóch pól starsze zdarzenie potrafiło nadpisać nowszy stan: ktoś
      // anuluje subskrypcję i od razu wykupuje ponownie, a jeśli anulowanie
      // dotrze drugie - traci dostęp mimo opłaty. Baza mija teraz zdarzenia
      // powtórzone i spóźnione (migracja 0031).
      p_event_id: event.id,
      p_event_at: new Date(event.created * 1000).toISOString(),
      p_plan: plan,
    });

    if (error || applied === false) {
      console.error("apply_subscription odrzucone:", error?.message ?? "zły sekret");
      // 500, żeby Stripe ponowił - inaczej opłacona subskrypcja zostałaby
      // po naszej stronie niezapisana i człowiek zapłaciłby za nic.
      return NextResponse.json({ error: "Nie udało się zapisać." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook:", e);
    return NextResponse.json({ error: "Błąd przetwarzania." }, { status: 500 });
  }
}
