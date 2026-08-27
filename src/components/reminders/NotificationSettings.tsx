"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";

/**
 * Zgoda na powiadomienia i subskrypcja push.
 *
 * Rozróżniamy dwie rzeczy, które ludzie mylą:
 *  – POWIADOMIENIA W APLIKACJI działają, gdy jest otwarta. Nic nie wymagają.
 *  – POWIADOMIENIA W TLE (push) docierają przy zamkniętej apce, ale wymagają
 *    zapisania subskrypcji na serwerze. Na iPhonie działają WYŁĄCZNIE po
 *    dodaniu apki do ekranu głównego — to ograniczenie Apple, nie nasze.
 */
function subscribeToFocus(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

/**
 * Czy przeglądarka ma zapisaną subskrypcję push.
 *
 * Pytanie o to jest asynchroniczne, a useSyncExternalStore potrzebuje
 * odpowiedzi natychmiast — dlatego ostatni odczyt trzymamy w module i
 * odświeżamy go po każdej zmianie. Ten sam wzorzec co przy liczniku kolejki
 * offline; efekt ustawiający stan łamałby reguły Reacta.
 */
let pushSnapshot: boolean | null = null;

function readPushState(notify: () => void): void {
  if (!("serviceWorker" in navigator)) {
    if (pushSnapshot !== false) {
      pushSnapshot = false;
      notify();
    }
    return;
  }
  navigator.serviceWorker.ready
    .then((registration) => registration.pushManager.getSubscription())
    .then((subscription) => {
      const next = Boolean(subscription);
      if (next !== pushSnapshot) {
        pushSnapshot = next;
        notify();
      }
    })
    .catch(() => {
      if (pushSnapshot !== false) {
        pushSnapshot = false;
        notify();
      }
    });
}

/** Base64url z klucza VAPID na bajty, których oczekuje przeglądarka. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Czy apka chodzi jako zainstalowana (na iPhonie to warunek działania push). */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function NotificationSettings({ vapidKey }: { vapidKey: string | null }) {
  const [asked, setAsked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permission = useSyncExternalStore(
    subscribeToFocus,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unsupported",
  );

  // `asked` istnieje po to, żeby po odpowiedzi użytkownika komponent
  // przerysował się z nowym stanem zgody.
  void asked;

  const subscribeToPush = useCallback((onChange: () => void) => {
    readPushState(onChange);
    window.addEventListener("focus", onChange);
    return () => window.removeEventListener("focus", onChange);
  }, []);

  const pushOn = useSyncExternalStore(
    subscribeToPush,
    () => pushSnapshot,
    () => null,
  );

  /** Po włączeniu i wyłączeniu odświeżamy odczyt, zamiast trzymać drugi stan. */
  const refreshPush = useCallback((value: boolean) => {
    pushSnapshot = value;
    window.dispatchEvent(new Event("focus"));
  }, []);

  async function ask() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    setAsked((n) => n + 1);
  }

  async function enablePush() {
    if (!vapidKey) return;
    setBusy(true);
    setError(null);

    try {
      if (Notification.permission !== "granted") {
        const result = await Notification.requestPermission();
        setAsked((n) => n + 1);
        if (result !== "granted") {
          setError("Bez zgody na powiadomienia nie ma jak ich wysłać.");
          return;
        }
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          // Strefa idzie razem z subskrypcją: bez niej serwer wysyłałby
          // przypomnienia według UTC.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          label: navigator.userAgent.slice(0, 60),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Nie udało się zapisać subskrypcji.");
        return;
      }
      refreshPush(true);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Przeglądarka odmówiła. Sprawdź ustawienia powiadomień dla tej strony."
          : "Nie udało się włączyć powiadomień w tle.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
        });
        await subscription.unsubscribe();
      }
      refreshPush(false);
    } catch {
      setError("Nie udało się wyłączyć.");
    } finally {
      setBusy(false);
    }
  }

  const iosNeedsInstall = isIos() && !isStandalone();

  return (
    <Card
      title="Powiadomienia"
      subtitle="Nawyki, woda i pora snu."
      action={pushOn ? <Chip tone="success">w tle</Chip> : null}
    >
      <div className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}

        {permission === "denied" && (
          <Alert>
            Powiadomienia są zablokowane w ustawieniach przeglądarki. Odblokuj je tam — stąd
            nie da się tego cofnąć.
          </Alert>
        )}

        {permission === "unsupported" && (
          <Alert tone="warn">
            Ta przeglądarka nie obsługuje powiadomień. Zaległe rzeczy widać na ekranie „Dziś”.
          </Alert>
        )}

        {permission === "default" && (
          <Button variant="primary" onClick={ask}>
            Poproś o zgodę
          </Button>
        )}

        {/* --- Powiadomienia w tle --- */}
        {permission === "granted" && (
          <>
            {iosNeedsInstall ? (
              <Alert tone="warn">
                Na iPhonie powiadomienia w tle działają dopiero po dodaniu Grinda do ekranu
                głównego: przycisk „Udostępnij” → „Do ekranu początkowego”. To ograniczenie
                Apple, nie nasze.
              </Alert>
            ) : !vapidKey ? (
              <Alert tone="info">
                Powiadomienia w tle nie są jeszcze uruchomione po stronie serwera. Te przy
                otwartej aplikacji działają normalnie.
              </Alert>
            ) : pushOn ? (
              <>
                <Alert tone="success">
                  Powiadomienia docierają nawet przy zamkniętej aplikacji.
                </Alert>
                <Button variant="ghost" loading={busy} onClick={disablePush}>
                  Wyłącz powiadomienia w tle
                </Button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted">
                  Teraz przypomnienia docierają tylko przy otwartej aplikacji. Włącz tryb w
                  tle, żeby przychodziły też wtedy, gdy jej nie używasz.
                </p>
                <Button variant="primary" loading={busy} onClick={enablePush}>
                  Włącz powiadomienia w tle
                </Button>
              </>
            )}
          </>
        )}

        <p className="text-[12px] leading-relaxed text-faint">
          Godziny ustawiasz przy każdym nawyku, a dla wody i snu — wyżej w tym profilu.
          Zaległe rzeczy zawsze widać też na ekranie „Dziś”.
        </p>
      </div>
    </Card>
  );
}
