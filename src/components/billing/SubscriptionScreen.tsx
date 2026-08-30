"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";
import { humanDate } from "@/lib/format";
import type { Access, Pricing } from "@/lib/subscription";

const PERKS = [
  {
    icon: "💬",
    title: "Rozmowa z trenerem AI",
    desc: "Pytasz, on patrzy na Twoje treningi, dietę, sen i kontuzje - i odpowiada konkretnie, a nie ogólnikami z internetu.",
  },
  {
    icon: "📋",
    title: "Plan pisany pod Ciebie",
    desc: "Nie szablon, tylko plan pod Twój sprzęt, staż, kontuzje i termin walki. Zmienia się, gdy zmieniają się Twoje wyniki.",
  },
  {
    icon: "🔔",
    title: "Odprawy i przypomnienia",
    desc: "Trener sam się odzywa: po słabej nocy, przy stagnacji, gdy waga idzie w złą stronę.",
  },
];

const FREE = [
  "Wszystkie gotowe plany treningowe",
  "Dziennik serii, diety, snu i nawyków",
  "Health Score i pełna historia wykresów",
  "Tryb offline i przypomnienia w aplikacji",
];

export function SubscriptionScreen({
  access,
  pricing,
  priceText,
  paymentsReady,
  notice,
}: {
  access: Access;
  pricing: Pricing;
  priceText: string;
  /** Czy klucze Stripe'a są w ogóle wpisane po stronie serwera. */
  paymentsReady: boolean;
  notice: "ok" | "anulowana" | null;
}) {
  const [busy, setBusy] = useState<"buy" | "manage" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string, kind: "buy" | "manage") {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error ?? "Nie udało się otworzyć płatności.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Brak połączenia. Spróbuj, gdy wróci sieć.");
      setBusy(null);
    }
  }

  const canBuy = paymentsReady && pricing.enabled;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold leading-tight">Trener AI</h1>
        <p className="text-[13px] text-muted">
          Cała reszta aplikacji jest i zostaje darmowa.
        </p>
      </header>

      {notice === "ok" && (
        <Alert tone="success">
          Płatność przyjęta. Dostęp włącza się w chwili, gdy Stripe potwierdzi ją
          po swojej stronie - zwykle kilka sekund. Odśwież stronę, jeśli poniżej
          nadal widzisz starą informację.
        </Alert>
      )}
      {notice === "anulowana" && <Alert tone="warn">Płatność przerwana - nic nie pobraliśmy.</Alert>}
      {error && <Alert>{error}</Alert>}

      {/* --- Stan konta --- */}
      <Card
        title="Twój dostęp"
        action={
          <Chip tone={access.pro ? "success" : "neutral"}>
            {access.pro ? "aktywny" : "wersja darmowa"}
          </Chip>
        }
      >
        {access.viaAdmin ? (
          <p className="text-[14px]">
            Masz dostęp jako <span className="font-semibold">administrator</span> - bez płacenia,
            bezterminowo.
          </p>
        ) : access.pro ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px]">
              {access.status === "trialing" ? "Trwa okres próbny." : "Subskrypcja aktywna."}
              {access.until && (
                <>
                  {" "}
                  {access.cancelAtPeriodEnd ? "Dostęp wygaśnie" : "Kolejne odnowienie"}{" "}
                  <span className="font-semibold">{humanDate(access.until.slice(0, 10))}</span>.
                </>
              )}
            </p>
            <Button
              variant="secondary"
              loading={busy === "manage"}
              onClick={() => go("/api/stripe/portal", "manage")}
            >
              Zarządzaj płatnością
            </Button>
            <p className="text-[12px] text-faint">
              Zmiana karty, faktury i rezygnacja - wszystko w panelu Stripe&apos;a.
              Rezygnacja działa od razu i nie trzeba nikogo o nią prosić.
            </p>
          </div>
        ) : access.status === "past_due" ? (
          <div className="flex flex-col gap-3">
            <Alert tone="warn">
              Ostatnia płatność się nie powiodła. Popraw dane karty, żeby nie stracić dostępu.
            </Alert>
            <Button
              variant="primary"
              loading={busy === "manage"}
              onClick={() => go("/api/stripe/portal", "manage")}
            >
              Popraw płatność
            </Button>
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            Korzystasz z wersji darmowej. Poniżej jest dokładnie to, co dokłada wersja płatna.
          </p>
        )}
      </Card>

      {/* --- Co daje płatna wersja --- */}
      {!access.pro && (
        <Card title="Co dostajesz" subtitle={priceText}>
          <ul className="flex flex-col gap-3">
            {PERKS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="text-[20px]" aria-hidden>
                  {p.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-tight">{p.title}</span>
                  <span className="block text-[13px] leading-snug text-muted">{p.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            {canBuy ? (
              <Button
                variant="primary"
                size="lg"
                block
                loading={busy === "buy"}
                onClick={() => go("/api/stripe/checkout", "buy")}
              >
                {pricing.trial_days > 0
                  ? `Wypróbuj ${pricing.trial_days} dni za darmo`
                  : `Włącz za ${priceText}`}
              </Button>
            ) : (
              <Alert tone="info">
                Płatności nie są jeszcze uruchomione. Gdy ruszą, przycisk pojawi się tutaj -
                nic nie musisz robić.
              </Alert>
            )}
          </div>

          {canBuy && (
            <p className="mt-2 text-[12px] leading-relaxed text-faint">
              Płatność obsługuje Stripe - BLIK, przelew albo karta. Rezygnacja jednym kliknięciem
              w panelu, bez dzwonienia i pisania maili.
              {pricing.trial_days > 0 &&
                ` Pierwsze ${pricing.trial_days} dni nic nie kosztuje; jeśli zrezygnujesz przed końcem, nie pobierzemy nic.`}
            </p>
          )}
        </Card>
      )}

      {/* --- Co zostaje darmowe --- */}
      <Card title="Darmowe na zawsze" subtitle="Bez limitu dni, bez karty, bez haczyków">
        <ul className="flex flex-col gap-1.5">
          {FREE.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[14px]">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span className="min-w-0 flex-1">{f}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          Historia i wykresy zostają darmowe świadomie: nic nas nie kosztują, a odcinanie
          człowieka od jego własnych danych byłoby zwykłym szantażem. Płatne jest tylko to,
          co realnie kosztuje przy każdym użyciu - czyli praca modelu AI.
        </p>
      </Card>
    </div>
  );
}
