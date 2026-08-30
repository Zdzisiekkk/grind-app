"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Sheet, Textarea } from "@/components/ui";
import type { Plan } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { AiPlanSheet } from "@/components/plan/AiPlanSheet";

export function PlansScreen({
  userId,
  myPlans,
  templates,
  dayCounts,
}: {
  userId: string;
  myPlans: Plan[];
  templates: Plan[];
  dayCounts: Record<string, number>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  async function activate(planId: string) {
    setBusy(planId);
    const { error } = await supabase.rpc("set_active_plan", { p_plan_id: planId });
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function clone(sourceId: string, name: string) {
    setBusy(sourceId);
    const { error } = await supabase.rpc("clone_plan", {
      p_source_plan_id: sourceId,
      p_new_name: name,
      p_activate: true,
    });
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function remove(planId: string) {
    setBusy(planId);
    const { error } = await supabase.from("plans").delete().eq("id", planId);
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Plany treningowe</h1>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-2">
        <Button variant="primary" size="lg" block onClick={() => setAiOpen(true)}>
          🤖 Poproś AI o plan
        </Button>
        <Button variant="secondary" block onClick={() => setNewOpen(true)}>
          + Nowy pusty plan
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[15px] font-semibold">Moje plany</h2>
        {myPlans.length === 0 ? (
          <Card>
            <EmptyState
              icon="📋"
              title="Nie masz jeszcze planu"
              description="Skopiuj gotowy szablon poniżej albo poproś AI o plan pod Twoje cele."
            />
          </Card>
        ) : (
          myPlans.map((plan) => (
            <Card key={plan.id} padded={false}>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold leading-tight">{plan.name}</h3>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {dayCounts[plan.id] ?? 0} dni treningowych
                      {plan.source === "ai" && " · ułożony przez AI"}
                      {plan.source === "template" && " · z szablonu"}
                    </p>
                  </div>
                  {plan.is_active && <Chip tone="success">aktywny</Chip>}
                </div>

                {plan.description && <p className="text-[13px] text-muted">{plan.description}</p>}

                <div className="flex flex-wrap gap-2">
                  <Link href={`/plan/${plan.id}`} className="flex-1">
                    <Button variant="secondary" block>
                      Edytuj
                    </Button>
                  </Link>
                  {!plan.is_active && (
                    <Button
                      variant="primary"
                      className="flex-1"
                      loading={busy === plan.id}
                      onClick={() => activate(plan.id)}
                    >
                      Ustaw aktywny
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Usunąć plan "${plan.name}"? Zapisane treningi zostaną nietknięte.`))
                        remove(plan.id);
                    }}
                    aria-label="Usuń plan"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      {templates.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[15px] font-semibold">Gotowe szablony</h2>
          {templates.map((tpl) => (
            <Card key={tpl.id} padded={false}>
              <div className="flex flex-col gap-3 p-4">
                <div>
                  <h3 className="text-[15px] font-semibold leading-tight">{tpl.name}</h3>
                  <p className="mt-0.5 text-[12px] text-muted">{dayCounts[tpl.id] ?? 0} dni treningowych</p>
                </div>
                {tpl.description && <p className="text-[13px] text-muted">{tpl.description}</p>}
                <Button
                  variant="secondary"
                  block
                  loading={busy === tpl.id}
                  onClick={() => clone(tpl.id, tpl.name)}
                >
                  Skopiuj do siebie
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <NewPlanSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        userId={userId}
        onCreated={(id) => router.push(`/plan/${id}` as never)}
      />

      <AiPlanSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

function NewPlanSheet({
  open,
  onClose,
  userId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onCreated: (planId: string) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("plans")
      .insert({ user_id: userId, name: name.trim(), goal: goal.trim() || null, source: "manual" })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    // Każdy plan potrzebuje przynajmniej jednej fazy, żeby dało się dodać dni.
    await supabase.from("phases").insert({ plan_id: data.id, name: "Faza 1", order_index: 1 });

    setSaving(false);
    onCreated(data.id);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nowy plan">
      <form onSubmit={create} className="flex flex-col gap-3">
        <Field label="Nazwa planu">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Siła i MMA - jesień" />
        </Field>
        <Field label="Cel (opcjonalnie)">
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Co chcesz osiągnąć?" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" block loading={saving}>
          Utwórz plan
        </Button>
      </form>
    </Sheet>
  );
}
