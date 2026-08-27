import { SubscriptionScreen } from "@/components/billing/SubscriptionScreen";
import { getAccess, getPricing, priceLabel } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe/server";

export const metadata = { title: "Trener AI" };

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ platnosc?: string }>;
}) {
  const [access, pricing, params] = await Promise.all([getAccess(), getPricing(), searchParams]);

  const notice =
    params.platnosc === "ok" ? "ok" : params.platnosc === "anulowana" ? "anulowana" : null;

  return (
    <SubscriptionScreen
      access={access}
      pricing={pricing}
      priceText={priceLabel(pricing)}
      paymentsReady={isStripeConfigured()}
      notice={notice}
    />
  );
}
