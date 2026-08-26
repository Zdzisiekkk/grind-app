"use client";

import { useState } from "react";
import { Alert, Button, Field, SegmentedControl, Textarea } from "@/components/ui";
import { painDescriptor } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";

/**
 * Skala bólu kolana 0–10. Jedno tapnięcie = ocena, drugie = zapis.
 * Zapisujemy per data i strona, więc powtórna ocena tego samego dnia nadpisuje poprzednią.
 */
export function KneePainPicker({
  userId,
  date,
  sessionId,
  initialLevel,
  initialSide = "both",
  onSaved,
}: {
  userId: string;
  date: string;
  sessionId?: string | null;
  initialLevel?: number | null;
  initialSide?: "left" | "right" | "both";
  onSaved?: () => void | Promise<void>;
}) {
  const [level, setLevel] = useState<number | null>(initialLevel ?? null);
  const [side, setSide] = useState<"left" | "right" | "both">(initialSide);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (level === null) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("knee_pain_logs").upsert(
      {
        user_id: userId,
        session_id: sessionId ?? null,
        date,
        level,
        side,
        note: note.trim() || null,
      },
      { onConflict: "user_id,date,side" },
    );

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    await onSaved?.();
  }

  const descriptor = level !== null ? painDescriptor(level) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-muted">0 = brak bólu, 10 = nie do zniesienia</span>
          {descriptor && (
            <span className="text-[13px] font-semibold" style={{ color: descriptor.color }}>
              {descriptor.label}
            </span>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((i) => {
            const d = painDescriptor(i);
            const active = level === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setLevel(i)}
                aria-pressed={active}
                className={clsx(
                  "tabular flex min-h-12 items-center justify-center rounded-xl text-[16px] font-bold transition-transform active:scale-95",
                  active ? "text-white" : "bg-surface-2 text-muted",
                )}
                style={active ? { background: d.color } : undefined}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Które kolano">
        <SegmentedControl
          value={side}
          onChange={setSide}
          options={[
            { value: "left", label: "Lewe" },
            { value: "right", label: "Prawe" },
            { value: "both", label: "Oba" },
          ]}
        />
      </Field>

      <Field label="Notatka (opcjonalnie)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="np. bolało przy prostowniku nóg powyżej 30 kg"
        />
      </Field>

      {error && <Alert>{error}</Alert>}

      <Button variant="primary" size="lg" block disabled={level === null} loading={saving} onClick={save}>
        Zapisz ocenę
      </Button>
    </div>
  );
}
