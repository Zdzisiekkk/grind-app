"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { KROKI_SAMOUCZKA, OSTATNI_KROK } from "@/lib/samouczek";
import { zamknijSamouczek } from "@/app/(app)/pomoc/actions";

/**
 * Samouczek na pełnym ekranie.
 *
 * Świadomie NIE dymki przyklejone do przycisków. Podpowiedź "tu kliknij"
 * uczy jednego gestu i znika z pamięci; ekran wyjaśniający, po co jest dana
 * część aplikacji, zostaje. Do tego dymki wymagają, żeby każdy element był
 * dokładnie na swoim miejscu - a na telefonie o szerokości 320 px nigdy nie jest.
 *
 * Stan trzymamy w profilu, nie w przeglądarce: localStorage znika przy zmianie
 * telefonu i w trybie prywatnym, więc samouczek wracałby ludziom, którzy go
 * już przeszli.
 */
export function Samouczek({ odRazu = true }: { odRazu?: boolean }) {
  const [otwarty, setOtwarty] = useState(odRazu);
  const [krok, setKrok] = useState(0);
  const [pending, startTransition] = useTransition();

  if (!otwarty) return null;

  const k = KROKI_SAMOUCZKA[krok];
  const ostatni = krok === OSTATNI_KROK;

  function zamknij(stan: "pominiety" | "ukonczony") {
    setOtwarty(false);
    // Zapis w tle: człowiek zobaczył już, co miał zobaczyć, i nie ma powodu
    // trzymać go na ekranie ładowania przez zapis jednej kolumny.
    startTransition(() => {
      void zamknijSamouczek(stan);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface">
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <span className="text-[13px] text-faint">
          {krok + 1} z {KROKI_SAMOUCZKA.length}
        </span>
        <button
          type="button"
          onClick={() => zamknij("pominiety")}
          className="text-[13px] font-medium text-muted"
        >
          Pomiń
        </button>
      </div>

      <div className="flex gap-1 px-4">
        {KROKI_SAMOUCZKA.map((s, i) => (
          <span
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i <= krok ? "bg-accent" : "bg-surface-2"}`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-8">
        <span className="text-[56px] leading-none" aria-hidden>
          {k.ikona}
        </span>
        <h2 className="mt-5 text-[26px] font-bold leading-tight">{k.tytul}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{k.tresc}</p>
        {k.gdzie && (
          <p className="mt-4 text-[13px] font-medium text-accent">Znajdziesz to w: {k.gdzie}</p>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {krok > 0 && (
          <Button variant="ghost" onClick={() => setKrok((x) => x - 1)}>
            Wstecz
          </Button>
        )}
        <Button
          variant="primary"
          block
          size="lg"
          loading={pending}
          onClick={() => (ostatni ? zamknij("ukonczony") : setKrok((x) => x + 1))}
        >
          {ostatni ? "Zaczynamy" : "Dalej"}
        </Button>
      </div>
    </div>
  );
}
