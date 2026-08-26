"use client";

import { painDescriptor } from "@/lib/constants";
import { PAIN_LEGEND } from "@/lib/viz";
import { clsx } from "@/lib/clsx";

/**
 * Skala 0–10 jako rząd przycisków. Wydzielona osobno, bo używa jej i arkusz po
 * treningu, i szybki wpis z pulpitu, i edycja wpisu z kalendarza.
 */
export function PainScale({
  value,
  onChange,
  size = "md",
  legend = true,
}: {
  value: number | null;
  onChange: (level: number) => void;
  size?: "sm" | "md";
  /** Opis progów pod skalą — kolor nigdy nie jest jedynym nośnikiem znaczenia. */
  legend?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
    <div className={clsx("grid gap-1.5", size === "sm" ? "grid-cols-11" : "grid-cols-6")}>
      {Array.from({ length: 11 }, (_, i) => i).map((i) => {
        const d = painDescriptor(i);
        const active = value === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={active}
            aria-label={`${i} z 10 — ${d.label}`}
            className={clsx(
              "tabular flex items-center justify-center rounded-xl font-bold transition-transform active:scale-95",
              size === "sm" ? "min-h-9 text-[13px]" : "min-h-12 text-[16px]",
              active ? "text-white" : "bg-surface-2 text-muted",
            )}
            style={active ? { background: d.color } : undefined}
          >
            {i}
          </button>
        );
      })}
    </div>

      {legend && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {PAIN_LEGEND.map((l) => (
            <li key={l.range} className="flex items-center gap-1 text-[11px] text-faint">
              <span aria-hidden style={{ color: l.color }}>
                {l.icon}
              </span>
              {l.range} · {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
