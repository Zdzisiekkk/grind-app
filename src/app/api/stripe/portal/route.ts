import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured, siteUrl, stripe } from "@/lib/stripe/server";

/**
 * Panel klienta Stripe: zmiana karty, faktury, rezygnacja.
 *
 * Świadomie NIE budujemy własnego ekranu do anulowania. Rezygnacja musi
 * działać bez zarzutu i być łatwa do znalezienia - panel Stripe'a robi to
 * poprawnie i zdejmuje z nas obsługę faktur.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Płatności nie są jeszcze włączone." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "Nie masz jeszcze subskrypcji." }, { status: 404 });
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/subskrypcja`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe portal:", e);
    return NextResponse.json({ error: "Nie udało się otworzyć panelu." }, { status: 502 });
  }
}
