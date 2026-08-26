"use client";

import { useState, useSyncExternalStore } from "react";
import { Alert, Button, Card } from "@/components/ui";

/**
 * Zgoda na powiadomienia. Stan czytamy przy renderze przez
 * useSyncExternalStore, bo `Notification.permission` to zewnętrzne źródło
 * prawdy, którego przeglądarka nie zgłasza zdarzeniem — odświeżamy je po
 * kliknięciu przycisku.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

export function NotificationSettings() {
  const [asked, setAsked] = useState(0);
  const permission = useSyncExternalStore(
    subscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unsupported",
  );

  async function ask() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    setAsked((n) => n + 1);
  }

  // `asked` istnieje po to, żeby po odpowiedzi użytkownika komponent
  // przerysował się z nowym stanem zgody.
  void asked;

  return (
    <Card
      title="Powiadomienia"
      subtitle="Przypomnienia o nawykach i piciu wody."
    >
      <div className="flex flex-col gap-3">
        {permission === "granted" && (
          <Alert tone="success">
            Powiadomienia włączone. Docierają, gdy aplikacja jest otwarta.
          </Alert>
        )}

        {permission === "denied" && (
          <Alert>
            Powiadomienia zablokowane w ustawieniach przeglądarki. Odblokuj je tam, żeby
            przypomnienia mogły dojść.
          </Alert>
        )}

        {permission === "default" && (
          <Button variant="primary" block onClick={ask}>
            Włącz powiadomienia
          </Button>
        )}

        {permission === "unsupported" && (
          <Alert>Ta przeglądarka nie obsługuje powiadomień.</Alert>
        )}

        <p className="text-[12px] leading-relaxed text-faint">
          Powiadomienia wysyła przeglądarka, więc przychodzą wtedy, gdy Grind jest
          otwarty. Na iPhonie działają dopiero po dodaniu aplikacji do ekranu głównego.
          Niezależnie od nich zaległe nawyki i brakującą wodę widać na ekranie „Dziś”
          i w zakładce Dieta.
        </p>
      </div>
    </Card>
  );
}
