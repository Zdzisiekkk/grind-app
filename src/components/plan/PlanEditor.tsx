"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { ExercisePicker } from "@/components/training/ExercisePicker";
import type { CatalogExercise, DayType, Phase, Plan, WorkoutDay, WorkoutExercise } from "@/lib/database.types";
import { DAY_TYPE_ICON, DAY_TYPE_LABEL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";

export type EditorExercise = WorkoutExercise & { display_name: string };
export type EditorDay = WorkoutDay & { exercises: EditorExercise[] };
export type EditorPhase = Phase & { days: EditorDay[] };

export function PlanEditor({
  plan,
  initialPhases,
  canEdit,
}: {
  plan: Plan;
  initialPhases: EditorPhase[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [phases, setPhases] = useState(initialPhases);
  const [openDay, setOpenDay] = useState<string | null>(initialPhases[0]?.days[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<{ dayId: string; exercise: EditorExercise } | null>(null);
  const [editingDay, setEditingDay] = useState<{ phaseId: string; day: EditorDay | null } | null>(null);

  const fail = (message: string) => setError(message);

  /* ------------------------------- Fazy -------------------------------- */

  async function addPhase() {
    const name = prompt("Nazwa nowej fazy:", `Faza ${phases.length + 1}`);
    if (!name?.trim()) return;

    const { data, error } = await supabase
      .from("phases")
      .insert({ plan_id: plan.id, name: name.trim(), order_index: phases.length + 1 })
      .select()
      .single();

    if (error) return fail(error.message);
    setPhases((prev) => [...prev, { ...(data as Phase), days: [] }]);
  }

  async function deletePhase(phaseId: string) {
    if (!confirm("Usunąć całą fazę razem z dniami i ćwiczeniami?")) return;
    const { error } = await supabase.from("phases").delete().eq("id", phaseId);
    if (error) return fail(error.message);
    setPhases((prev) => prev.filter((p) => p.id !== phaseId));
  }

  /* -------------------------------- Dni -------------------------------- */

  async function saveDay(phaseId: string, day: EditorDay | null, values: DayFormValues) {
    if (day) {
      const { error } = await supabase
        .from("workout_days")
        .update(values)
        .eq("id", day.id);
      if (error) return fail(error.message);

      setPhases((prev) =>
        prev.map((p) => ({
          ...p,
          days: p.days.map((d) => (d.id === day.id ? { ...d, ...values } : d)),
        })),
      );
    } else {
      const phase = phases.find((p) => p.id === phaseId);
      const { data, error } = await supabase
        .from("workout_days")
        .insert({ ...values, phase_id: phaseId, order_index: (phase?.days.length ?? 0) + 1 })
        .select()
        .single();
      if (error) return fail(error.message);

      setPhases((prev) =>
        prev.map((p) =>
          p.id === phaseId ? { ...p, days: [...p.days, { ...(data as WorkoutDay), exercises: [] }] } : p,
        ),
      );
      setOpenDay((data as WorkoutDay).id);
    }
    setEditingDay(null);
  }

  async function deleteDay(dayId: string) {
    if (!confirm("Usunąć ten dzień treningowy?")) return;
    const { error } = await supabase.from("workout_days").delete().eq("id", dayId);
    if (error) return fail(error.message);
    setPhases((prev) => prev.map((p) => ({ ...p, days: p.days.filter((d) => d.id !== dayId) })));
  }

  /* ----------------------------- Ćwiczenia ------------------------------ */

  async function addExercise(dayId: string, item: CatalogExercise) {
    const day = phases.flatMap((p) => p.days).find((d) => d.id === dayId);
    const { data, error } = await supabase
      .from("workout_exercises")
      .insert({
        workout_day_id: dayId,
        catalog_exercise_id: item.id,
        muscle_group: item.muscle_group,
        target_sets: 3,
        target_reps: "8-12",
        rest_seconds: 90,
        order_index: (day?.exercises.length ?? 0) + 1,
      })
      .select()
      .single();

    if (error) return fail(error.message);

    setPhases((prev) =>
      prev.map((p) => ({
        ...p,
        days: p.days.map((d) =>
          d.id === dayId
            ? {
                ...d,
                exercises: [...d.exercises, { ...(data as WorkoutExercise), display_name: item.name }],
              }
            : d,
        ),
      })),
    );
    setPickerDay(null);
  }

  async function updateExercise(dayId: string, exerciseId: string, patch: Partial<WorkoutExercise>) {
    const { error } = await supabase.from("workout_exercises").update(patch).eq("id", exerciseId);
    if (error) return fail(error.message);

    setPhases((prev) =>
      prev.map((p) => ({
        ...p,
        days: p.days.map((d) =>
          d.id === dayId
            ? { ...d, exercises: d.exercises.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e)) }
            : d,
        ),
      })),
    );
    setEditingExercise(null);
  }

  async function deleteExercise(dayId: string, exerciseId: string) {
    const { error } = await supabase.from("workout_exercises").delete().eq("id", exerciseId);
    if (error) return fail(error.message);

    setPhases((prev) =>
      prev.map((p) => ({
        ...p,
        days: p.days.map((d) =>
          d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseId) } : d,
        ),
      })),
    );
  }

  /** Zamienia miejscami dwa ćwiczenia i zapisuje nową kolejność. */
  async function moveExercise(dayId: string, index: number, direction: -1 | 1) {
    const day = phases.flatMap((p) => p.days).find((d) => d.id === dayId);
    if (!day) return;

    const target = index + direction;
    if (target < 0 || target >= day.exercises.length) return;

    const reordered = [...day.exercises];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((e, i) => ({ ...e, order_index: i + 1 }));

    setPhases((prev) =>
      prev.map((p) => ({
        ...p,
        days: p.days.map((d) => (d.id === dayId ? { ...d, exercises: withOrder } : d)),
      })),
    );

    await Promise.all(
      withOrder.map((e) =>
        supabase.from("workout_exercises").update({ order_index: e.order_index }).eq("id", e.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold leading-tight">{plan.name}</h1>
          {plan.is_active && <Chip tone="success">aktywny</Chip>}
        </div>
        {plan.goal && <p className="text-[13px] text-muted">{plan.goal}</p>}
        {!canEdit && (
          <Alert tone="info">
            To publiczny szablon — tylko do podglądu. Skopiuj go do siebie, żeby edytować.
          </Alert>
        )}
      </header>

      {plan.description && (
        <Card>
          <p className="whitespace-pre-line text-[13px] text-muted">{plan.description}</p>
        </Card>
      )}

      {error && <Alert>{error}</Alert>}

      {phases.map((phase) => (
        <section key={phase.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold">{phase.name}</h2>
              {phase.frequency && <p className="text-[12px] text-faint">{phase.frequency}</p>}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => deletePhase(phase.id)}
                aria-label="Usuń fazę"
                className="flex size-8 items-center justify-center rounded-lg text-faint hover:text-danger"
              >
                🗑️
              </button>
            )}
          </div>

          {phase.days.map((day) => {
            const isOpen = openDay === day.id;
            return (
              <Card key={day.id} padded={false}>
                <button
                  type="button"
                  onClick={() => setOpenDay(isOpen ? null : day.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
                    {DAY_TYPE_ICON[day.day_type]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold leading-tight">
                      {day.name}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {day.exercises.length} ćwiczeń · {DAY_TYPE_LABEL[day.day_type]}
                      {day.tracks_pain && " · ocena bólu"}
                    </span>
                  </span>
                  <span className="text-faint" aria-hidden>
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-3">
                    {day.description && (
                      <p className="mb-2 text-[12px] text-muted">{day.description}</p>
                    )}

                    <ul className="flex flex-col gap-1">
                      {day.exercises.map((exercise, index) => (
                        <li
                          key={exercise.id}
                          className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-2"
                        >
                          <span className="tabular w-5 shrink-0 text-[12px] font-semibold text-faint">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">
                              {exercise.display_name}
                            </span>
                            <span className="tabular block text-[12px] text-muted">
                              {exercise.target_sets ?? "?"}×{exercise.target_reps ?? "?"}
                              {exercise.rest_seconds ? ` · przerwa ${exercise.rest_seconds}s` : ""}
                              {exercise.target_note ? ` · ${exercise.target_note}` : ""}
                            </span>
                          </span>

                          {canEdit && (
                            <span className="flex shrink-0 items-center">
                              <button
                                type="button"
                                onClick={() => moveExercise(day.id, index, -1)}
                                disabled={index === 0}
                                aria-label="W górę"
                                className="flex size-8 items-center justify-center rounded-lg text-faint disabled:opacity-25"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExercise(day.id, index, 1)}
                                disabled={index === day.exercises.length - 1}
                                aria-label="W dół"
                                className="flex size-8 items-center justify-center rounded-lg text-faint disabled:opacity-25"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExercise({ dayId: day.id, exercise })}
                                aria-label="Edytuj"
                                className="flex size-8 items-center justify-center rounded-lg text-faint"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteExercise(day.id, exercise.id)}
                                aria-label="Usuń"
                                className="flex size-8 items-center justify-center rounded-lg text-faint hover:text-danger"
                              >
                                ✕
                              </button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {canEdit && (
                      <div className="mt-3 flex flex-col gap-2">
                        <Button variant="secondary" block onClick={() => setPickerDay(day.id)}>
                          + Dodaj ćwiczenie
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            className="flex-1"
                            onClick={() => setEditingDay({ phaseId: phase.id, day })}
                          >
                            Ustawienia dnia
                          </Button>
                          <Button variant="ghost" onClick={() => deleteDay(day.id)}>
                            Usuń dzień
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {canEdit && (
            <Button variant="secondary" block onClick={() => setEditingDay({ phaseId: phase.id, day: null })}>
              + Dodaj dzień do fazy
            </Button>
          )}
        </section>
      ))}

      {canEdit && (
        <Button variant="ghost" block onClick={addPhase}>
          + Nowa faza
        </Button>
      )}

      <Sheet open={Boolean(pickerDay)} onClose={() => setPickerDay(null)} title="Dodaj ćwiczenie">
        {pickerDay && <ExercisePicker onPick={(item) => addExercise(pickerDay, item)} />}
      </Sheet>

      <Sheet
        open={Boolean(editingExercise)}
        onClose={() => setEditingExercise(null)}
        title={editingExercise?.exercise.display_name ?? ""}
      >
        {editingExercise && (
          <ExerciseSettingsForm
            exercise={editingExercise.exercise}
            onSave={(patch) =>
              updateExercise(editingExercise.dayId, editingExercise.exercise.id, patch)
            }
          />
        )}
      </Sheet>

      <Sheet
        open={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        title={editingDay?.day ? "Ustawienia dnia" : "Nowy dzień"}
      >
        {editingDay && (
          <DayForm
            day={editingDay.day}
            onSave={(values) => saveDay(editingDay.phaseId, editingDay.day, values)}
          />
        )}
      </Sheet>

      <p className="pb-2 text-center text-[12px] text-faint">
        Zmiany zapisują się od razu.{" "}
        <button type="button" onClick={() => router.refresh()} className="underline">
          Odśwież
        </button>
      </p>
    </div>
  );
}

/* ------------------------------- Formularze -------------------------------- */

type DayFormValues = {
  name: string;
  short_label: string | null;
  description: string | null;
  day_type: DayType;
  tracks_pain: boolean;
};

function DayForm({ day, onSave }: { day: EditorDay | null; onSave: (v: DayFormValues) => void }) {
  const [values, setValues] = useState<DayFormValues>({
    name: day?.name ?? "",
    short_label: day?.short_label ?? "",
    description: day?.description ?? "",
    day_type: day?.day_type ?? "gym",
    tracks_pain: day?.tracks_pain ?? false,
  });

  const upd = (patch: Partial<DayFormValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...values,
          short_label: values.short_label?.trim() || null,
          description: values.description?.trim() || null,
        });
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Nazwa dnia">
        <Input required value={values.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Dzień A — góra ciała" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Skrót" hint="max 4 znaki">
          <Input maxLength={4} value={values.short_label ?? ""} onChange={(e) => upd({ short_label: e.target.value })} placeholder="A" />
        </Field>
        <Field label="Typ dnia">
          <Select value={values.day_type} onChange={(e) => upd({ day_type: e.target.value as DayType })}>
            {(Object.keys(DAY_TYPE_LABEL) as DayType[]).map((t) => (
              <option key={t} value={t}>
                {DAY_TYPE_ICON[t]} {DAY_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Opis">
        <Textarea value={values.description ?? ""} onChange={(e) => upd({ description: e.target.value })} />
      </Field>

      <button
        type="button"
        onClick={() => upd({ tracks_pain: !values.tracks_pain })}
        className={clsx(
          "flex items-center justify-between rounded-xl border px-3 py-3 text-left",
          values.tracks_pain ? "border-accent bg-accent-soft" : "border-border bg-surface-2",
        )}
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">Pytaj o ból kontuzji</span>
          <span className="block text-[12px] text-muted">Po treningu tego dnia apka poprosi o ocenę śledzonych kontuzji.</span>
        </span>
        <span className="text-lg" aria-hidden>
          {values.tracks_pain ? "✅" : "⬜"}
        </span>
      </button>

      <Button type="submit" variant="primary" size="lg" block>
        Zapisz
      </Button>
    </form>
  );
}

function ExerciseSettingsForm({
  exercise,
  onSave,
}: {
  exercise: EditorExercise;
  onSave: (patch: Partial<WorkoutExercise>) => void;
}) {
  const [sets, setSets] = useState(exercise.target_sets?.toString() ?? "3");
  const [reps, setReps] = useState(exercise.target_reps ?? "");
  const [note, setNote] = useState(exercise.target_note ?? "");
  const [rest, setRest] = useState(exercise.rest_seconds?.toString() ?? "90");
  const [technique, setTechnique] = useState(exercise.technique_notes ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          target_sets: Number(sets) || null,
          target_reps: reps.trim() || null,
          target_note: note.trim() || null,
          rest_seconds: Number(rest) || null,
          technique_notes: technique.trim() || null,
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Serie">
          <Input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </Field>
        <Field label="Powtórzenia" hint='np. "6-8", "40s"'>
          <Input value={reps} onChange={(e) => setReps(e.target.value)} />
        </Field>
      </div>
      <Field label="Przerwa (sekundy)" hint="Timer po zapisaniu serii liczy właśnie tyle.">
        <Input inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
      </Field>
      <Field label="Adnotacja" hint='np. "opcjonalnie"'>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Field label="Twoja uwaga do techniki" hint="Pokaże się w trakcie treningu przy tym ćwiczeniu.">
        <Textarea value={technique} onChange={(e) => setTechnique(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" block>
        Zapisz
      </Button>
    </form>
  );
}
