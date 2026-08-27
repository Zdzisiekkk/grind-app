import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Dostęp do funkcji płatnych.
 *
 * Pytamy o to bazę (public.has_pro), a nie liczymy sami po stanie z tabeli —
 * ta sama funkcja obsługuje później polityki RLS, więc odpowiedź musi być
 * jedna. Administrator ma dostęp z urzędu: to konto właściciela aplikacji.
 */

export type Access = {
  pro: boolean;
  status: string;
  /** Do kiedy opłacone — null, gdy nigdy nie było subskrypcji. */
  until: string | null;
  cancelAtPeriodEnd: boolean;
  /** Dostęp z tytułu roli administratora, a nie płatności. */
  viaAdmin: boolean;
};

export type Pricing = {
  amount: number;
  currency: string;
  interval: string;
  trial_days: number;
  /** Czy w ogóle pokazywać przycisk zakupu. */
  enabled: boolean;
};

export const FALLBACK_PRICING: Pricing = {
  amount: 2900,
  currency: "PLN",
  interval: "month",
  trial_days: 7,
  enabled: false,
};

export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { pro: false, status: "none", until: null, cancelAtPeriodEnd: false, viaAdmin: false };
  }

  const [{ data: pro }, { data: sub }, { data: profile }] = await Promise.all([
    supabase.rpc("has_pro", {}),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  return {
    pro: Boolean(pro),
    status: sub?.status ?? "none",
    until: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    viaAdmin: profile?.role === "admin",
  };
}

export async function getPricing(): Promise<Pricing> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "pricing")
    .maybeSingle();

  return { ...FALLBACK_PRICING, ...((data?.value as Partial<Pricing>) ?? {}) };
}

/** „29 zł / mies." — do pokazania na ekranie. */
export function priceLabel(pricing: Pricing): string {
  const amount = (pricing.amount / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: pricing.amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const unit = pricing.currency === "PLN" ? "zł" : pricing.currency;
  const period = pricing.interval === "year" ? "rok" : "mies.";
  return `${amount} ${unit} / ${period}`;
}
