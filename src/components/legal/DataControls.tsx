"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { deleteAccount, withdrawHealthConsent } from "@/app/(app)/profil/actions";

/**
 * Prawo do kopii danych i prawo do bycia zapomnianym - działające, nie
 * obiecane w regulaminie.
 *
 * Usunięcie konta jest za dwoma zaporami: świadomym kliknięciem i przepisaniem
 * słowa. Nie chodzi o utrudnianie, tylko o to, że operacji nie da się cofnąć,
 * a przycisk "usuń" bywa klikany kciukiem w kieszeni.
 */
export function DataControls({
  hasSubscription,
  healthConsentAt,
}: {
  /** Aktywna subskrypcja Stripe - usunięcie konta jej nie anuluje. */
  hasSubscription: boolean;
  healthConsentAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<"idle" | "confirm">("idle");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Twoje dane"
        subtitle="Wszystko, co zapisałeś, należy do Ciebie i możesz to stąd zabrać."
      >
        <div className="flex flex-col gap-3">
          <a href="/api/dane/eksport" download>
            <Button variant="secondary" block>
              ⬇ Pobierz swoje dane
            </Button>
          </a>
          <p className="text-[12px] leading-relaxed text-faint">
            Jeden plik JSON: treningi, dieta, sen, nawyki, zadania, książki i notatki.
            Warto go czasem zgrać - aplikacja może kiedyś przestać działać, Twoje dwa lata
            treningów nie powinny.
          </p>
        </div>
      </Card>

      {healthConsentAt && (
        <Card
          title="Zgoda na dane o zdrowiu"
          subtitle="Sen, ból, kontuzje i waga. Możesz ją cofnąć w każdej chwili."
        >
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Cofnięcie zgody usuwa te dane - dziennik snu, oceny bólu, kontuzje i pomiary
              wagi. Treningi, plany i zadania zostają.
            </p>
            <Button
              variant="ghost"
              loading={pending}
              onClick={() => {
                if (!confirm("Cofnąć zgodę i usunąć dane o zdrowiu? Tego nie da się cofnąć.")) return;
                startTransition(() => withdrawHealthConsent());
              }}
            >
              Cofnij zgodę i usuń te dane
            </Button>
          </div>
        </Card>
      )}

      <Card title="Usunięcie konta" subtitle="Nieodwracalne. Nie zostawiamy żadnych kopii.">
        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}

          {hasSubscription && (
            <Alert tone="warn">
              Masz aktywną subskrypcję. Usunięcie konta <strong>jej nie anuluje</strong> -
              wypowiedz ją najpierw w panelu płatności, inaczej karta będzie dalej obciążana.
            </Alert>
          )}

          {stage === "idle" ? (
            <Button variant="danger" onClick={() => setStage("confirm")}>
              Chcę usunąć konto
            </Button>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed">
                Znikną wszystkie treningi, posiłki, noce, nawyki, zadania, książki i notatki.
                Nie da się tego przywrócić. Jeśli chcesz zachować kopię, pobierz ją wyżej -
                to zajmuje sekundę.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">
                  Przepisz słowo <span className="font-bold text-text">USUŃ</span>, żeby
                  potwierdzić
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-center font-bold outline-none focus:border-danger"
                  aria-label="Potwierdzenie usunięcia konta"
                />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStage("idle")}>
                  Rezygnuję
                </Button>
                <Button
                  variant="danger"
                  block
                  loading={pending}
                  disabled={typed.trim().toUpperCase() !== "USUŃ"}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await deleteAccount();
                      } catch (e) {
                        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
                        setError(e instanceof Error ? e.message : "Nie udało się usunąć konta.");
                      }
                    });
                  }}
                >
                  Usuń konto na zawsze
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
