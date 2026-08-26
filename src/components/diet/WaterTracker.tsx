"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip } from "@/components/ui";
import { WATER_PORTIONS, waterLabel } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { WaterLog } from "@/lib/database.types";

/**
 * Nawodnienie dnia. Każde tapnięcie to osobny wpis, więc da się cofnąć
 * ostatni łyk bez przeliczania sumy w głowie.
 */
export function WaterTracker({
  userId,
  date,
  entries,
  goalMl,
  portionMl,
}: {
  userId: string;
  date: string;
  entries: Pick<WaterLog, "id" | "ml" | "created_at">[];
  goalMl: number;
  portionMl: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = entries.reduce((sum, e) => sum + e.ml, 0);
  const pct = goalMl > 0 ? Math.min(100, Math.round((total / goalMl) * 100)) : 0;
  const left = Math.max(0, goalMl - total);

  async function add(ml: number) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("water_logs").insert({ user_id: userId, date, ml });
    setBusy(false);
    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      navigator.vibrate?.(12);
      router.refresh();
    }
  }

  async function undo() {
    const last = entries.at(-1);
    if (!last) return;
    setBusy(true);
    const { error } = await supabase.from("water_logs").delete().eq("id", last.id);
    setBusy(false);
    if (error) setError(`Nie udało się cofnąć: ${error.message}`);
    else router.refresh();
  }

  return (
    <Card
      title="Nawodnienie"
      subtitle={left > 0 ? `Zostało ${waterLabel(left)}` : "Cel osiągnięty 💧"}
      action={<Chip tone={pct >= 100 ? "success" : "info"}>{pct}%</Chip>}
    >
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="tabular text-[22px] font-bold">{waterLabel(total)}</span>
            <span className="text-[13px] text-muted">z {waterLabel(goalMl)}</span>
          </div>
          <div
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Postęp nawodnienia"
          >
            <div
              className={clsx(
                "h-full rounded-full transition-[width] duration-300",
                pct >= 100 ? "bg-success" : "bg-info",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {WATER_PORTIONS.map((p) => (
            <button
              key={p.ml}
              type="button"
              disabled={busy}
              onClick={() => add(p.ml)}
              className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              <span className="text-[20px]" aria-hidden>
                {p.icon}
              </span>
              <span className="text-[11px] font-medium text-muted">{p.ml} ml</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={busy} onClick={() => add(portionMl)}>
            + {portionMl} ml
          </Button>
          <Button variant="ghost" disabled={busy || entries.length === 0} onClick={undo}>
            Cofnij
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {entries.length > 0 && (
          <p className="text-[12px] text-faint">
            {entries.length} {entries.length === 1 ? "wpis" : "wpisów"} dziś ·{" "}
            {entries.map((e) => `${e.ml}`).join(" + ")} ml
          </p>
        )}
      </div>
    </Card>
  );
}
