"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { mmss, num } from "@/lib/format";
import { sekundyMinutnika } from "@/lib/przepisy";
import type { RecipeItem, RecipeStep, RecipeTotals } from "@/lib/database.types";

/**
 * Gotowanie krok po kroku.
 *
 * DLACZEGO PEŁNY EKRAN, A NIE LISTA. Telefon leży na blacie metr od oczu,
 * a ręce są mokre albo w mące. Lista wszystkich kroków znaczy szukanie
 * wzrokiem, w którym miejscu się jest, po każdym powrocie do ekranu.
 * Jeden krok naraz, dużą czcionką, z jednym wielkim przyciskiem "dalej"
 * odpowiada na jedyne pytanie, jakie się wtedy zadaje.
 *
 * BLOKADA WYGASZANIA. Bez niej ekran gaśnie w połowie smażenia i trzeba go
 * odblokowywać brudnym palcem. Wake Lock jest zwalniany przy wyjściu i brany
 * z powrotem po przełączeniu okna - przeglądarka odbiera go sama przy
 * każdym zejściu na drugi plan.
 */
export function TrybGotowania({
  recipe,
  items,
  steps,
  onClose,
}: {
  recipe: RecipeTotals;
  items: RecipeItem[];
  steps: RecipeStep[];
  onClose: () => void;
}) {
  /** -1 to lista składników, potem kroki, na końcu ekran zakończenia. */
  const [etap, setEtap] = useState(-1);
  const [odhaczone, setOdhaczone] = useState<Set<string>>(new Set());
  const [koniecO, setKoniecO] = useState<Record<string, number>>({});
  const [teraz, setTeraz] = useState(() => Date.now());
  const zadzwonil = useRef<Set<string>>(new Set());

  const ostatni = steps.length - 1;
  const krok = etap >= 0 && etap <= ostatni ? steps[etap] : null;
  const koniec = etap > ostatni;

  /* --- Blokada wygaszania ekranu --- */
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let zywy = true;

    const wez = async () => {
      try {
        if (!zywy || document.visibilityState !== "visible") return;
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        // Brak zgody albo brak obsługi - gotowanie działa dalej, tylko ekran gaśnie.
      }
    };
    const naPowrocie = () => {
      if (document.visibilityState === "visible") void wez();
    };

    void wez();
    document.addEventListener("visibilitychange", naPowrocie);
    return () => {
      zywy = false;
      document.removeEventListener("visibilitychange", naPowrocie);
      void lock?.release().catch(() => {});
    };
  }, []);

  /* --- Zegar; tyka tylko wtedy, gdy jest co odliczać --- */
  const czyOdlicza = Object.keys(koniecO).length > 0;
  useEffect(() => {
    if (!czyOdlicza) return;
    const id = setInterval(() => setTeraz(Date.now()), 250);
    return () => clearInterval(id);
  }, [czyOdlicza]);

  const dalej = useCallback(() => {
    setEtap((e) => Math.min(ostatni + 1, e + 1));
    navigator.vibrate?.(10);
  }, [ostatni]);
  const wstecz = useCallback(() => setEtap((e) => Math.max(-1, e - 1)), []);

  /* Strzałki działają też z klawiatury - na tablecie z etui to jedyne wygodne
     wyjście, a kosztuje trzy linijki. */
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") dalej();
      if (e.key === "ArrowLeft") wstecz();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [dalej, wstecz, onClose]);

  /* Ekran gotowania przykrywa całą stronę, więc tło nie ma się przewijać. */
  useEffect(() => {
    const poprzedni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = poprzedni;
    };
  }, []);

  const sekundy = krok ? sekundyMinutnika(krok.minuty) : null;
  const zostalo = krok && koniecO[krok.id]
    ? Math.max(0, Math.round((koniecO[krok.id] - teraz) / 1000))
    : null;

  useEffect(() => {
    if (!krok || zostalo !== 0 || zadzwonil.current.has(krok.id)) return;
    zadzwonil.current.add(krok.id);
    navigator.vibrate?.([180, 90, 180]);
  }, [krok, zostalo]);

  function przelacz(id: string) {
    setOdhaczone((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    navigator.vibrate?.(8);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* --- Pasek górny --- */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 pt-[calc(12px+env(safe-area-inset-top))]">
        <span className="text-xl" aria-hidden>{recipe.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">
            {recipe.name}
          </span>
          <span className="block text-[12px] text-muted">
            {etap < 0 ? "Składniki" : koniec ? "Gotowe" : `Krok ${etap + 1} z ${steps.length}`}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij tryb gotowania"
          className="flex size-9 items-center justify-center rounded-lg text-faint hover:bg-surface-2"
        >
          ✕
        </button>
      </header>

      {/* --- Kropki postępu --- */}
      <div className="flex items-center gap-1 px-4 py-2" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={clsx(
              "h-1 flex-1 rounded-full transition-colors",
              i < etap ? "bg-accent" : i === etap ? "bg-accent/60" : "bg-surface-2",
            )}
          />
        ))}
      </div>

      {/* --- Treść --- */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {etap < 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-muted">
              Odhacz, co masz pod ręką. Nic się nie zapisuje - to tylko lista, żeby
              w połowie nie zabrakło jajek.
            </p>
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const zrobione = odhaczone.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => przelacz(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2"
                    >
                      <span
                        className={clsx(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border text-[13px]",
                          zrobione
                            ? "border-accent bg-accent text-white"
                            : "border-border text-transparent",
                        )}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span
                        className={clsx(
                          "min-w-0 flex-1 text-[16px]",
                          zrobione && "text-faint line-through",
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="tabular shrink-0 text-[14px] text-muted">
                        {num(item.grams, 0)} g
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {recipe.makra_orientacyjne && (
              <p className="text-[12px] text-warn">
                Gramatura przeliczona z miar domowych z oryginalnego przepisu - traktuj
                ją jako wskazówkę, nie jako wagę apteczną.
              </p>
            )}
          </div>
        )}

        {krok && (
          <div className="flex h-full flex-col justify-center gap-6 py-4">
            <p className="text-[22px] leading-relaxed">{krok.tekst}</p>

            {sekundy && (
              <div className="flex flex-col items-center gap-3">
                <span
                  className={clsx(
                    "tabular text-5xl font-bold",
                    zostalo === 0 ? "text-success" : "text-accent",
                  )}
                >
                  {mmss(zostalo ?? sekundy)}
                </span>
                {zostalo == null ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setKoniecO((k) => ({ ...k, [krok.id]: Date.now() + sekundy * 1000 }))
                    }
                  >
                    Włącz minutnik
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setKoniecO((k) => {
                        const n = { ...k };
                        delete n[krok.id];
                        zadzwonil.current.delete(krok.id);
                        return n;
                      })
                    }
                  >
                    {zostalo === 0 ? "Gotowe, wyłącz" : "Zatrzymaj"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {koniec && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="text-5xl" aria-hidden>🍽️</span>
            <p className="text-xl font-semibold">Zrobione.</p>
            <p className="text-[14px] text-muted">
              Smacznego. Danie możesz teraz wpisać do dziennika - jedna porcja to{" "}
              {num(Number(recipe.kcal) / Math.max(1, Number(recipe.servings)), 0)} kcal.
            </p>
          </div>
        )}
      </div>

      {/* --- Nawigacja --- */}
      <footer className="flex gap-2 border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {etap > -1 && (
          <Button variant="ghost" size="lg" onClick={wstecz}>
            Wstecz
          </Button>
        )}
        {koniec ? (
          <Button variant="primary" size="lg" block onClick={onClose}>
            Zamknij
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={dalej}>
            {etap < 0 ? "Zaczynamy" : etap === ostatni ? "Skończone" : "Dalej"}
          </Button>
        )}
      </footer>
    </div>
  );
}
