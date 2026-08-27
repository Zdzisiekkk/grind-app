"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Duże +/- po bokach pola liczbowego.
 *
 * Przyciski są celowo szerokie — trafia się w nie kciukiem, bez patrzenia,
 * ze spoconymi rękami, w połowie serii.
 *
 * WPISYWANIE Z KLAWIATURY jest tu równoprawne z przyciskami i to ono
 * decydowało o kształcie tego komponentu. Wcześniej wartość była obcinana do
 * zakresu przy KAŻDYM naciśnięciu klawisza: przy wadze ciała (minimum 20 kg)
 * wpisanie „8" natychmiast zamieniało się w „20" i nie dało się dojść do 85
 * inaczej niż klikając plus sześćset pięćdziesiąt razy.
 *
 * Dlatego w trakcie pisania trzymamy surowy tekst i nie ruszamy go. Do
 * zakresu sprowadzamy dopiero, gdy pole traci fokus albo gdy ktoś użyje
 * przycisków. Zasada ogólna: pole tekstowe nie może poprawiać człowieka
 * w środku wpisywania, bo nie wie jeszcze, co ten człowiek chce napisać.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimals = 0,
  suffix,
  ariaLabel,
  size = "md",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  ariaLabel: string;
  size?: "md" | "lg";
}) {
  const current = value ?? 0;
  const clamp = (n: number) => Math.min(max, Math.max(min, Number(n.toFixed(decimals))));
  const bump = (delta: number) => {
    setDraft(null);
    onChange(clamp(current + delta));
  };

  // null = nikt teraz nie pisze, pokazujemy wartość z zewnątrz.
  const [draft, setDraft] = useState<string | null>(null);

  /** Zamiana tekstu na liczbę — przecinek jest u nas równie poprawny co kropka. */
  const parse = (raw: string): number | null => {
    const n = Number(raw.replace(",", "."));
    return raw.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  function commit() {
    if (draft === null) return;
    const parsed = parse(draft);
    setDraft(null);
    onChange(parsed === null ? null : clamp(parsed));
  }

  const btn = clsx(
    "flex shrink-0 items-center justify-center rounded-xl bg-surface-3 font-bold text-text",
    "active:scale-95 disabled:opacity-40",
    size === "lg" ? "size-14 text-2xl" : "size-12 text-xl",
  );

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        className={btn}
        onClick={() => bump(-step)}
        disabled={current - step < min}
        aria-label={`${ariaLabel}: mniej o ${step}`}
      >
        −
      </button>

      <div className="relative min-w-0 flex-1">
        <input
          // type="text" zamiast "number": na telefonie i tak decyduje
          // inputMode, a "number" dokłada strzałki, walidację przeglądarki
          // i blokuje przecinek — którego Polacy używają częściej niż kropki.
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          aria-label={ariaLabel}
          value={draft ?? (value ?? "")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
          }}
          onFocus={(e) => e.target.select()}
          className={clsx(
            "tabular w-full rounded-xl border border-border bg-surface-2 text-center font-bold",
            "outline-none focus:border-accent focus:ring-2 focus:ring-accent/25",
            suffix && "pr-8",
            size === "lg" ? "h-14 text-2xl" : "h-12 text-xl",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-faint">
            {suffix}
          </span>
        )}
      </div>

      <button
        type="button"
        className={btn}
        onClick={() => bump(step)}
        disabled={current + step > max}
        aria-label={`${ariaLabel}: więcej o ${step}`}
      >
        +
      </button>
    </div>
  );
}
