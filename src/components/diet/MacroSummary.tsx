"use client";

import { num } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { MacroTotals } from "@/lib/diet";

type Goals = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

function Bar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  color: string;
}) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  const over = goal ? value > goal * 1.05 : false;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
        <span className={clsx("tabular text-[12px] font-semibold", over && "text-warn")}>
          {num(value, 0)}
          {goal ? <span className="font-normal text-faint">/{goal}</span> : null} g
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Kalorie i makro dnia zestawione z celem z profilu. */
export function MacroSummary({
  totals,
  goals,
  compact,
}: {
  totals: MacroTotals;
  goals: Goals;
  compact?: boolean;
}) {
  const kcalPct = goals.kcal ? Math.min(100, (totals.kcal / goals.kcal) * 100) : 0;
  const left = goals.kcal ? goals.kcal - totals.kcal : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="tabular text-[28px] font-black leading-none">
            {num(totals.kcal, 0)}
            {goals.kcal && (
              <span className="text-[16px] font-semibold text-faint"> / {goals.kcal}</span>
            )}
            <span className="ml-1 text-[14px] font-semibold text-muted">kcal</span>
          </div>
          {left !== null && (
            <div className={clsx("mt-1 text-[13px]", left < 0 ? "text-warn" : "text-muted")}>
              {left >= 0 ? `zostało ${num(left, 0)} kcal` : `przekroczone o ${num(-left, 0)} kcal`}
            </div>
          )}
        </div>
      </div>

      {goals.kcal ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${kcalPct}%`,
              background: totals.kcal > goals.kcal ? "var(--warn)" : "var(--accent)",
            }}
          />
        </div>
      ) : (
        !compact && (
          <p className="text-[12px] text-faint">
            Ustaw dzienne cele w profilu, żeby widzieć postęp względem celu.
          </p>
        )
      )}

      <div className="flex gap-3">
        <Bar label="Białko" value={totals.protein} goal={goals.protein} color="var(--chart-2)" />
        <Bar label="Węgle" value={totals.carbs} goal={goals.carbs} color="var(--chart-5)" />
        <Bar label="Tłuszcz" value={totals.fat} goal={goals.fat} color="var(--chart-4)" />
      </div>
    </div>
  );
}
