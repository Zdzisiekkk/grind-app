"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";
import { humanDate } from "@/lib/format";
import type { Access, Pricing } from "@/lib/subscription";

/**
 * Dwa plany, jedna zasada: WSZYSTKIE funkcje AI są dostępne już od Startera,
 * a Pro różni się wysokością miesięcznych pul. Liczby niżej muszą się zgadzać
 * z limitami w trasach API i w bazie (0056) - to jest cennik, nie marketing.
 */
const PLANY = {
  starter: {
    nazwa: "Starter",
    haslo: "Całe AI w rozsądnej dawce",
    limity: [
      { icon: "🍽️", text: "Opis posiłku słowami - 30 opisów / mies." },
      { icon: "💬", text: "Rozmowy z trenerem AI - 4 / mies." },
      { icon: "📋", text: "Plan treningowy pisany pod Ciebie - co 30 dni" },
      { icon: "📸", text: "Skan wyglądu i zębów - 1 / mies." },
    ],
  },
  pro: {
    nazwa: "Pro",
    haslo: "Bez oglądania się na liczniki",
    limity: [
      { icon: "🍽️", text: "Opis posiłku słowami - 150 opisów / mies." },
      { icon: "💬", text: "Rozmowy z trenerem AI - 30 / mies." },
      { icon: "📋", text: "Plan treningowy pisany pod Ciebie - co 7 dni" },
      { icon: "📸", text: "Skan wyglądu i zębów - 5 / mies." },
      { icon: "🚀", text: "Nowe funkcje AI najpierw tutaj (podsumowania tygodnia, eksport PDF)" },
    ],
  },
} as const;

const FREE = [
  "Wszystkie gotowe plany treningowe",
  "Dziennik serii, diety, snu i nawyków",
  "Health Score i pełna historia wykresów",
  "Tryb offline i przypomnienia w aplikacji",
];

export function SubscriptionScreen({
  access,
  pricing,
  priceStarter,
  pricePro,
  paymentsReady,
  notice,
}: {
  access: Access;
  pricing: Pricing;
  priceStarter: string;
  pricePro: string;
  /** Czy klucze Stripe'a są w ogóle wpisane po stronie serwera. */
  paymentsReady: boolean;
  notice: "ok" | "anulowana" | null;
}) {
  const [busy, setBusy] = useState<"starter" | "pro" | "manage" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string, kind: "starter" | "pro" | "manage", body?: object) {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
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
  const planName =
    access.plan === "pro" ? "Plan Pro" : access.plan === "starter" ? "Plan Starter" : null;

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
            {planName ?? "wersja darmowa"}
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
              {access.status === "trialing"
                ? `Trwa okres próbny (${planName}).`
                : `${planName} aktywny.`}
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
              Zmiana karty, przejście między Starterem a Pro, faktury i rezygnacja - wszystko
              w panelu Stripe&apos;a. Rezygnacja działa od razu i nie trzeba nikogo o nią prosić.
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
            Korzystasz z wersji darmowej. Poniżej jest dokładnie to, co dokładają plany płatne.
          </p>
        )}
      </Card>

      {/* --- Wybór planu --- */}
      {!access.pro && (
        <>
          {(["starter", "pro"] as const).map((plan) => {
            const p = PLANY[plan];
            const cena = plan === "starter" ? priceStarter : pricePro;
            return (
              <Card
                key={plan}
                title={p.nazwa}
                subtitle={`${p.haslo} · ${cena}`}
                action={plan === "pro" ? <Chip tone="accent">pełna moc</Chip> : null}
              >
                <ul className="flex flex-col gap-2.5">
                  {p.limity.map((l) => (
                    <li key={l.text} className="flex gap-3">
                      <span className="text-[18px]" aria-hidden>
                        {l.icon}
                      </span>
                      <span className="min-w-0 text-[14px] leading-snug">{l.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {canBuy ? (
                    <Button
                      variant={plan === "pro" ? "primary" : "secondary"}
                      size="lg"
                      block
                      loading={busy === plan}
                      onClick={() => go("/api/stripe/checkout", plan, { plan })}
                    >
                      {pricing.trial_days > 0
                        ? `Wypróbuj ${p.nazwa} ${pricing.trial_days} dni za darmo`
                        : `Włącz ${p.nazwa} za ${cena}`}
                    </Button>
                  ) : (
                    plan === "starter" && (
                      <Alert tone="info">
                        Płatności nie są jeszcze uruchomione. Gdy ruszą, przyciski pojawią się
                        tutaj - nic nie musisz robić.
                      </Alert>
                    )
                  )}
                </div>
              </Card>
            );
          })}

          {canBuy && (
            <p className="text-[12px] leading-relaxed text-faint">
              {/*
               * Nie wypisujemy tu z nazwy BLIK-a ani przelewu: to metody
               * jednorazowe, których Stripe nie oferuje przy odnawialnej
               * subskrypcji (mode: "subscription") - realnie dostępna jest
               * karta, ewentualnie inne metody wspierające płatności cykliczne
               * skonfigurowane w panelu Stripe'a. Obiecywanie BLIK-a tutaj
               * byłoby fałszywe.
               */}
              Płatność obsługuje Stripe. Rezygnacja i zmiana planu jednym kliknięciem w panelu,
              bez dzwonienia i pisania maili.
              {pricing.trial_days > 0 &&
                ` Pierwsze ${pricing.trial_days} dni nic nie kosztuje; jeśli zrezygnujesz przed końcem, nie pobierzemy nic.`}
            </p>
          )}
        </>
      )}

      {/* --- Starter widzi, co dokłada Pro --- */}
      {!access.viaAdmin && access.plan === "starter" && (
        <Card title="Pro" subtitle={`${PLANY.pro.haslo} · ${pricePro}`}>
          <ul className="flex flex-col gap-2.5">
            {PLANY.pro.limity.map((l) => (
              <li key={l.text} className="flex gap-3">
                <span className="text-[18px]" aria-hidden>
                  {l.icon}
                </span>
                <span className="min-w-0 text-[14px] leading-snug">{l.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button
              variant="primary"
              block
              loading={busy === "manage"}
              onClick={() => go("/api/stripe/portal", "manage")}
            >
              Przejdź na Pro w panelu Stripe&apos;a
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Zmiana planu przelicza się proporcjonalnie - Stripe policzy tylko różnicę
            do końca okresu.
          </p>
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
