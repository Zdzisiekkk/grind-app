"use client";

import { clsx } from "@/lib/clsx";

/**
 * Duże +/- po bokach pola liczbowego.
 * Przyciski są celowo szerokie — trafia się w nie kciukiem, bez patrzenia,
 * ze spoconymi rękami, w połowie serii.
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
  const bump = (delta: number) => onChange(clamp(current + delta));

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
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : clamp(Number(raw.replace(",", "."))));
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
