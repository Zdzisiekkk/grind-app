"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Chip, Field, Input, SegmentedControl, Select, Sheet, Spinner, Textarea } from "@/components/ui";
import { EQUIPMENT_OPTIONS, type AiPlan, type PlanRequest } from "@/lib/ai/planSchema";
import { DAY_TYPE_LABEL } from "@/lib/constants";
import { clsx } from "@/lib/clsx";

export function AiPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const [form, setForm] = useState<PlanRequest>({
    goal: "",
    days_per_week: 4,
    experience: "intermediate",
    session_minutes: 60,
    equipment: ["sztanga", "hantle", "maszyny", "wyciąg", "drążek"],
    limitations: "",
  });

  const [stage, setStage] = useState<"form" | "loading" | "preview">("form");
  const [draft, setDraft] = useState<AiPlan | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const upd = (patch: Partial<PlanRequest>) => setForm((f) => ({ ...f, ...patch }));

  const toggleEquipment = (item: string) =>
    upd({
      equipment: form.equipment.includes(item)
        ? form.equipment.filter((e) => e !== item)
        : [...form.equipment, item],
    });

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("loading");

    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Nie udało się ułożyć planu.");
        setStage("form");
        return;
      }

      setDraft(json.draft);
      setRequestId(json.requestId);
      setStage("preview");
    } catch {
      setError("Brak połączenia z serwerem.");
      setStage("form");
    }
  }

  async function save() {
    if (!requestId) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/ai/plan/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error ?? "Nie udało się zapisać planu.");
      return;
    }
    onClose();
    router.push(`/plan/${json.planId}` as never);
    router.refresh();
  }

  const totalDays = draft?.phases.reduce((sum, p) => sum + p.days.length, 0) ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={stage === "preview" ? "Propozycja planu" : "AI-trener"}
      footer={
        stage === "preview" ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStage("form")}>
              Popraw założenia
            </Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={save}>
              Zapisz plan
            </Button>
          </div>
        ) : null
      }
    >
      {stage === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Spinner className="size-7" />
          <p className="font-semibold">Układam plan…</p>
          <p className="max-w-xs text-[13px] text-muted">
            To potrafi zająć nawet minutę — model przegląda cały katalog ćwiczeń i dopasowuje
            objętość do Twoich ograniczeń.
          </p>
        </div>
      )}

      {stage === "form" && (
        <form onSubmit={generate} className="flex flex-col gap-4">
          <Field label="Twój cel" hint="Im konkretniej, tym lepszy plan.">
            <Textarea
              required
              value={form.goal}
              onChange={(e) => upd({ goal: e.target.value })}
              placeholder="np. wrócić do pełnej sprawności po kontuzji kolana i przygotować się do sparingów MMA"
            />
          </Field>

          <Field label="Doświadczenie">
            <SegmentedControl
              value={form.experience}
              onChange={(v) => upd({ experience: v })}
              options={[
                { value: "beginner", label: "Początkujący" },
                { value: "intermediate", label: "Średni" },
                { value: "advanced", label: "Zaawansowany" },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Dni w tygodniu">
              <Select
                value={String(form.days_per_week)}
                onChange={(e) => upd({ days_per_week: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Czas sesji (min)">
              <Input
                inputMode="numeric"
                value={form.session_minutes}
                onChange={(e) => upd({ session_minutes: Number(e.target.value) || 60 })}
              />
            </Field>
          </div>

          <Field label="Dostępny sprzęt">
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={clsx(
                    "min-h-9 rounded-lg px-3 text-[13px] font-medium",
                    form.equipment.includes(item)
                      ? "bg-accent text-[var(--accent-fg)]"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Kontuzje i ograniczenia"
            hint="AI nie zastąpi fizjoterapeuty — plan przy kontuzji skonsultuj ze specjalistą."
          >
            <Textarea
              value={form.limitations}
              onChange={(e) => upd({ limitations: e.target.value })}
              placeholder="np. kolano po kontuzji, bez głębokich przysiadów i skoków"
            />
          </Field>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" variant="primary" size="lg" block>
            Ułóż plan
          </Button>
        </form>
      )}

      {stage === "preview" && draft && (
        <div className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}

          <div>
            <h3 className="text-[17px] font-bold leading-tight">{draft.name}</h3>
            <p className="mt-1 text-[13px] text-muted">{draft.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="accent">{totalDays} dni treningowych</Chip>
              <Chip>{draft.phases.length === 1 ? "1 faza" : `${draft.phases.length} fazy`}</Chip>
            </div>
          </div>

          {draft.coach_notes && (
            <div className="rounded-xl bg-[var(--info-soft)] px-3 py-2.5 text-[13px] text-info">
              {draft.coach_notes}
            </div>
          )}

          {draft.phases.map((phase) => (
            <section key={phase.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-[14px] font-semibold">{phase.name}</h4>
                <span className="text-[12px] text-faint">{phase.frequency}</span>
              </div>
              {phase.description && <p className="text-[12px] text-muted">{phase.description}</p>}

              {phase.days.map((day) => (
                <div key={day.name} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{day.name}</span>
                    <Chip>{DAY_TYPE_LABEL[day.day_type]}</Chip>
                  </div>
                  {day.description && (
                    <p className="mt-1 text-[12px] text-muted">{day.description}</p>
                  )}
                  <ul className="mt-2 flex flex-col gap-1">
                    {day.exercises.map((ex, i) => (
                      <li key={`${ex.name}-${i}`} className="flex items-baseline gap-2 text-[13px]">
                        <span className="tabular w-4 shrink-0 text-faint">{i + 1}.</span>
                        <span className="flex-1">{ex.name}</span>
                        <span className="tabular shrink-0 font-semibold">
                          {ex.target_sets}×{ex.target_reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
