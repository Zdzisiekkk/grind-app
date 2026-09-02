import "server-only";
import Stripe from "stripe";

/**
 * Klient Stripe'a po stronie serwera.
 *
 * Cała integracja jest napisana tak, żeby BRAK kluczy nie psuł aplikacji.
 * Klucze dojdą później, a do tego czasu ekran subskrypcji ma mówić "płatności
 * jeszcze nie są włączone" zamiast wywalać się błędem 500 - inaczej nie dałoby
 * się skończyć i sprawdzić reszty.
 */

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && (stripePriceId("starter") || stripePriceId("pro")),
  );
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Brak STRIPE_SECRET_KEY - płatności nie są skonfigurowane.");
  if (!cached) cached = new Stripe(key);
  return cached;
}

/**
 * Cena Stripe'a dla danego planu.
 *
 * STRIPE_PRICE_ID (bez sufiksu) zostaje jako zapas dla Pro - to zmienna
 * z czasów jednego planu i może jeszcze siedzieć w konfiguracji Vercela.
 */
export function stripePriceId(plan: "starter" | "pro"): string | null {
  if (plan === "starter") return process.env.STRIPE_PRICE_ID_STARTER ?? null;
  return process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID ?? null;
}

/**
 * Który plan opłaca dana cena - do webhooka.
 *
 * null znaczy "nie poznaję tej ceny" i webhook sięga wtedy po metadane
 * z checkoutu. Cena ma pierwszeństwo przed metadanymi, bo zmiana planu
 * w portalu Stripe'a podmienia cenę, a metadane zostają stare.
 */
export function planFromPriceId(priceId: string | null | undefined): "starter" | "pro" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return "starter";
  if (priceId === (process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID)) return "pro";
  return null;
}

export const stripeWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET ?? null;

/**
 * Adres, na który Stripe odsyła po płatności.
 *
 * Na Vercelu bierzemy go ze zmiennej systemowej, żeby podglądy działały same
 * z siebie; lokalnie z NEXT_PUBLIC_SITE_URL albo z localhost.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
