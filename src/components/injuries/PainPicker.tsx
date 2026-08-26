"use client";

import { useState } from "react";
import { Alert, Button, Chip, Textarea } from "@/components/ui";
import { PainScale } from "@/components/injuries/PainScale";
import { bodyPart, injurySideLabel, painDescriptor } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Injury } from "@/lib/database.types";

export type PainDraft = { level: number | null; note: string };

/**
 * Ocena bólu dla jednej lub wielu kontuzji naraz. Po treningu nóg nie ma sensu
 * pytać osobno o każdą — pokazujemy wszystkie śledzone i zapisujemy te ocenione.
 * Powtórna ocena tego samego dnia nadpisuje poprzednią (upsert po dacie).
 */
export function PainPicker({
  userId,
  date,
  sessionId,
  injuries,
  initial,
  onSaved,
}: {
  userId: string;
  date: string;
  sessionId?: string | null;
  injuries: Injury[];
  initial?: Record<string, number>;
  onSaved?: () => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, PainDraft>>(() =>
    Object.fromEntries(
      injuries.map((i) => [i.id, { level: initial?.[i.id] ?? null, note: "" }]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rated = injuries.filter((i) => drafts[i.id]?.level !== null);

  function patch(id: string, next: Partial<PainDraft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...next } }));
  }

  async function save() {
    if (rated.length === 0) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("pain_logs").upsert(
      rated.map((i) => ({
        user_id: userId,
        injury_id: i.id,
        session_id: sessionId ?? null,
        date,
        level: drafts[i.id].level as number,
        note: drafts[i.id].note.trim() || null,
      })),
      { onConflict: "user_id,injury_id,date" },
    );

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    await onSaved?.();
  }

  if (injuries.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-[14px] text-muted">
          Nie masz jeszcze żadnej kontuzji na liście. Dodaj ją, a po treningu apka sama
          zapyta, jak się trzyma.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-muted">0 = brak bólu, 10 = nie do zniesienia.</p>

      {injuries.map((injury) => {
        const draft = drafts[injury.id];
        const part = bodyPart(injury.body_part);
        const side = injurySideLabel(injury.side);
        const d = draft?.level !== null && draft?.level !== undefined ? painDescriptor(draft.level) : null;

        return (
          <div key={injury.id} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>{part.icon}</span>
                {injury.name}
                {side && <Chip>{side}</Chip>}
              </span>
              {d && (
                <span className="text-[13px] font-semibold" style={{ color: d.color }}>
                  {d.label}
                </span>
              )}
            </div>

            <PainScale value={draft?.level ?? null} onChange={(level) => patch(injury.id, { level })} />

            {draft?.level !== null && (
              <Textarea
                value={draft.note}
                onChange={(e) => patch(injury.id, { note: e.target.value })}
                placeholder="Notatka — np. bolało przy prostowniku powyżej 30 kg"
                rows={2}
              />
            )}
          </div>
        );
      })}

      {error && <Alert>{error}</Alert>}

      <Button
        variant="primary"
        size="lg"
        block
        disabled={rated.length === 0}
        loading={saving}
        onClick={save}
      >
        {rated.length <= 1 ? "Zapisz ocenę" : `Zapisz ${rated.length} oceny`}
      </Button>
    </div>
  );
}
