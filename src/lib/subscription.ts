import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Dostęp do funkcji płatnych.
 *
 * Pytamy o to bazę (public.has_pro), a nie liczymy sami po stanie z tabeli -
 * ta sama funkcja obsługuje później polityki RLS, więc odpowiedź musi być
 * jedna. Administrator ma dostęp z urzędu: to konto właściciela aplikacji.
 */

export type Access = {
  /** Dowolny plan płatny - bramka do funkcji AI. */
  pro: boolean;
  /** 0 = darmowy, 1 = Starter, 2 = Pro. Decyduje o wysokości limitów. */
  poziom: number;
  /** Nazwa aktywnego planu do pokazania na ekranie. */
  plan: "none" | "starter" | "pro";
  status: string;
  /** Do kiedy opłacone - null, gdy nigdy nie było subskrypcji. */
  until: string | null;
  cancelAtPeriodEnd: boolean;
  /** Dostęp z tytułu roli administratora, a nie płatności. */
  viaAdmin: boolean;
};

export type Pricing = {
  /** Cena planu Pro w groszach. Nazwa bez sufiksu z czasów jednego planu. */
  amount: number;
  /** Cena planu Starter w groszach. */
  starter_amount: number;
  currency: string;
  interval: string;
  trial_days: number;
  /** Czy w ogóle pokazywać przycisk zakupu. */
  enabled: boolean;
};

export const FALLBACK_PRICING: Pricing = {
  amount: 2999,
  starter_amount: 1499,
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
    return {
      pro: false,
      poziom: 0,
      plan: "none",
      status: "none",
      until: null,
      cancelAtPeriodEnd: false,
      viaAdmin: false,
    };
  }

  const [{ data: poziom }, { data: sub }, { data: profile }] = await Promise.all([
    supabase.rpc("plan_poziom", {}),
    supabase
      .from("subscriptions")
      .select("status, plan, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const level = poziom ?? 0;
  return {
    pro: level >= 1,
    poziom: level,
    plan: level >= 2 ? "pro" : level === 1 ? "starter" : "none",
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

/** "29,99 zł / mies." - do pokazania na ekranie, osobno dla każdego planu. */
export function priceLabel(pricing: Pricing, plan: "starter" | "pro" = "pro"): string {
  const grosze = plan === "starter" ? pricing.starter_amount : pricing.amount;
  const amount = (grosze / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: grosze % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const unit = pricing.currency === "PLN" ? "zł" : pricing.currency;
  const period = pricing.interval === "year" ? "rok" : "mies.";
  return `${amount} ${unit} / ${period}`;
}
