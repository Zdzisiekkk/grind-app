"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { IKONY_ZRODEL, zl } from "@/lib/finanse";
import { liczba, useZapis } from "./useZapis";
import type { FinanseZrodlo } from "@/lib/database.types";

/**
 * Źródła przychodu z planem na miesiąc.
 *
 * Plan per źródło, a nie jedna kwota łączna, bo przy nieregularnych zleceniach
 * sama suma niczego nie rozstrzyga: chudy miesiąc wygląda identycznie jak
 * trwały spadek. Dopiero "praca dowiozła, zlecenia nie" jest informacją,
 * na którą da się zareagować.
 */
export function ArkuszZrodel({
  open,
  onClose,
  userId,
  zrodla,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  zrodla: FinanseZrodlo[];
}) {
  const supabase = createClient();
  const { busy, error, setError, zapisz } = useZapis();
  const [nowe, setNowe] = useState<{ nazwa: string; plan: string; ikona: string } | null>(null);

  const plan = zrodla
    .filter((z) => z.aktywne)
    .reduce((sum, z) => sum + Number(z.plan_miesieczny ?? 0), 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Źródła przychodu"
      footer={
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="text-muted">Plan na miesiąc</span>
          <span className="text-[18px] font-bold tabular-nums">{zl(plan)}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <p className="text-[13px] text-muted">
          Nazwij raz, skąd wpadają pieniądze, i podaj, ile spodziewasz się w miesiącu.
          Potem wpływ to dwa tapnięcia, a apka pokazuje, które źródło dowiozło.
        </p>

        {zrodla.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {zrodla.map((z) => (
              <li key={z.id} className="flex items-center gap-2 py-2">
                <span className="text-[16px]" aria-hidden>
                  {z.ikona}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${z.aktywne ? "" : "text-faint line-through"}`}>
                    {z.nazwa}
                  </span>
                  <span className="block text-[12px] text-faint">
                    {z.plan_miesieczny == null ? "bez planu" : `plan ${zl(Number(z.plan_miesieczny))}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 px-2 text-[12px] font-medium text-accent"
                  onClick={() =>
                    zapisz(() =>
                      supabase.from("finanse_zrodla").update({ aktywne: !z.aktywne }).eq("id", z.id),
                    )
                  }
                >
                  {z.aktywne ? "wyłącz" : "włącz"}
                </button>
                <button
                  type="button"
                  aria-label={`Usuń: ${z.nazwa}`}
                  className="shrink-0 text-faint"
                  onClick={() => zapisz(() => supabase.from("finanse_zrodla").delete().eq("id", z.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {nowe ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              {IKONY_ZRODEL.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNowe({ ...nowe, ikona: i })}
                  className={`flex size-10 items-center justify-center rounded-lg border text-[18px] ${
                    nowe.ikona === i ? "border-accent bg-surface" : "border-border"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <Field label="Nazwa">
              <Input
                value={nowe.nazwa}
                onChange={(e) => setNowe({ ...nowe, nazwa: e.target.value })}
                placeholder="np. Zlecenia"
                autoFocus
              />
            </Field>
            <Field label="Plan na miesiąc (zł)" hint="Zostaw puste, jeśli tego nie da się przewidzieć.">
              <Input
                inputMode="decimal"
                value={nowe.plan}
                onChange={(e) => setNowe({ ...nowe, plan: e.target.value })}
                placeholder="800"
              />
            </Field>
            <div className="flex gap-2">
              <Button
                variant="primary"
                loading={busy}
                disabled={!nowe.nazwa.trim()}
                onClick={async () => {
                  const ok = await zapisz(() =>
                    supabase.from("finanse_zrodla").insert({
                      user_id: userId,
                      nazwa: nowe.nazwa.trim(),
                      ikona: nowe.ikona,
                      plan_miesieczny: nowe.plan.trim() ? liczba(nowe.plan) : null,
                    }),
                  );
                  if (ok) setNowe(null);
                }}
              >
                Dodaj
              </Button>
              <Button variant="ghost" onClick={() => { setNowe(null); setError(null); }}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-left text-[13px] font-medium text-accent"
            onClick={() => setNowe({ nazwa: "", plan: "", ikona: "💼" })}
          >
            + Dodaj źródło
          </button>
        )}
      </div>
    </Sheet>
  );
}
