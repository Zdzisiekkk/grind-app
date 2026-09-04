"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Sheet } from "@/components/ui";
import { KARTY_PULPITU } from "@/lib/pulpit";
import { zapiszKartyPulpitu } from "@/app/(app)/actions";

/**
 * Wybór kart pulpitu - edytowany tam, gdzie widać efekt.
 *
 * Ustawienia wyglądu ukryte w osobnej zakładce znajduje tylko ten, kto ich
 * szuka. Ktoś, komu pulpit wydaje się przeładowany, zwykle nie idzie do
 * ustawień - po prostu przestaje przewijać do końca. Dlatego przycisk stoi
 * pod ostatnią kartą, dokładnie tam, gdzie kończy się przewijanie.
 */
export function UstawieniaPulpitu({ widoczne }: { widoczne: string[] }) {
  const [otwarte, setOtwarte] = useState(false);
  const [wybrane, setWybrane] = useState<string[]>(widoczne);
  const [blad, setBlad] = useState(false);
  const [zapisuje, startTransition] = useTransition();

  function przelacz(id: string) {
    setWybrane((lista) =>
      lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id],
    );
  }

  function zapisz() {
    setBlad(false);
    startTransition(async () => {
      const wynik = await zapiszKartyPulpitu(wybrane);
      if (wynik.ok) setOtwarte(false);
      else setBlad(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setWybrane(widoczne);
          setOtwarte(true);
        }}
        className="mx-auto mb-2 mt-1 flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] text-faint transition-colors hover:bg-surface-2 hover:text-muted"
      >
        <span aria-hidden>⚙️</span> Dostosuj pulpit
      </button>

      <Sheet
        open={otwarte}
        onClose={() => setOtwarte(false)}
        title="Co pokazywać na pulpicie"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOtwarte(false)}>
              Anuluj
            </Button>
            <Button block onClick={zapisz} disabled={zapisuje}>
              {zapisuje ? "Zapisuję..." : "Zapisz"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[13px] text-muted">
            Wyłączone karty nie znikają z aplikacji - dalej masz je w zakładkach na dole.
            Tu decydujesz tylko, co widzisz od razu po otwarciu.
          </p>

          {blad && <Alert tone="danger">Nie udało się zapisać. Spróbuj jeszcze raz.</Alert>}

          <ul className="flex flex-col gap-1.5">
            {KARTY_PULPITU.map((karta) => {
              const wlaczona = wybrane.includes(karta.id);
              return (
                <li key={karta.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3">
                    <input
                      type="checkbox"
                      checked={wlaczona}
                      onChange={() => przelacz(karta.id)}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium leading-tight">
                        {karta.nazwa}
                      </span>
                      <span className="block text-[12px] leading-snug text-muted">
                        {karta.opis}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2 px-1 pt-1">
            <button
              type="button"
              onClick={() => setWybrane(KARTY_PULPITU.map((k) => k.id))}
              className="text-[13px] text-accent"
            >
              Zaznacz wszystkie
            </button>
            <span className="text-faint">·</span>
            <button
              type="button"
              onClick={() => setWybrane(KARTY_PULPITU.filter((k) => k.domyslna).map((k) => k.id))}
              className="text-[13px] text-accent"
            >
              Przywróć domyślne
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
