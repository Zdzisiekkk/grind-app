"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, ProgressRing, Sheet, Textarea } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { HABIT_ICONS, WEEKDAYS, habitDueOn } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { Habit } from "@/lib/database.types";

type DayMark = { date: string; count: number; due: boolean };

export type HabitWithToday = Habit & {
  todayCount: number;
  /** Ostatnie 7 dni, od najstarszego: ile razy odhaczone. */
  week: DayMark[];
  /** Ostatnie 28 dni — siatka 4 tygodni pod nazwą nawyku. */
  history: DayMark[];
  streak: number;
  bestStreak: number;
  totalDone: number;
};

const EMPTY = {
  name: "",
  icon: "✅",
  note: "",
  target_per_day: 1,
  unit: "",
  days_of_week: [] as number[],
  reminder_at: "",
};

export function HabitsScreen({
  userId,
  habits,
  today,
  perfectStreak,
}: {
  userId: string;
  habits: HabitWithToday[];
  today: string;
  /** Ile dni z rzędu domknięte zostało wszystko, co było na liście. */
  perfectStreak: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HabitWithToday | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const dueToday = habits.filter((h) => habitDueOn(h.days_of_week, today));
  const restToday = habits.filter((h) => !habitDueOn(h.days_of_week, today));
  const doneToday = dueToday.filter((h) => h.todayCount >= h.target_per_day).length;
  const allDone = dueToday.length > 0 && doneToday === dueToday.length;
  const bestOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak), 0);

  function openNew() {
    setEditing(null);
    setDraft(EMPTY);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(habit: HabitWithToday) {
    setEditing(habit);
    setDraft({
      name: habit.name,
      icon: habit.icon,
      note: habit.note ?? "",
      target_per_day: habit.target_per_day,
      unit: habit.unit ?? "",
      days_of_week: habit.days_of_week,
      reminder_at: habit.reminder_at?.slice(0, 5) ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  /** Odhaczenie: jeden wiersz na nawyk i dzień, więc podbijamy licznik. */
  async function bump(habit: HabitWithToday, delta: number) {
    const next = Math.max(0, Math.min(habit.target_per_day, habit.todayCount + delta));
    if (next === habit.todayCount) return;

    setBusy(habit.id);
    const { error } = await supabase.from("habit_logs").upsert(
      { user_id: userId, habit_id: habit.id, date: today, count: next },
      { onConflict: "user_id,habit_id,date" },
    );
    setBusy(null);

    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      if (next > habit.todayCount) navigator.vibrate?.(12);
      router.refresh();
    }
  }

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      user_id: userId,
      name: draft.name.trim(),
      icon: draft.icon,
      note: draft.note.trim() || null,
      target_per_day: draft.target_per_day,
      unit: draft.unit.trim() || null,
      days_of_week: draft.days_of_week,
      reminder_at: draft.reminder_at || null,
    };

    const { error } = editing
      ? await supabase.from("habits").update(payload).eq("id", editing.id)
      : await supabase.from("habits").insert({ ...payload, order_index: habits.length });

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function remove(habit: HabitWithToday) {
    if (!confirm(`Usunąć nawyk „${habit.name}" razem z historią odhaczeń?`)) return;
    const { error } = await supabase.from("habits").delete().eq("id", habit.id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else router.refresh();
  }

  function toggleDay(day: number) {
    setDraft((d) => ({
      ...d,
      days_of_week: d.days_of_week.includes(day)
        ? d.days_of_week.filter((x) => x !== day)
        : [...d.days_of_week, day].sort(),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">Nawyki</h1>
        <Button variant="primary" onClick={openNew}>
          + Dodaj
        </Button>
      </header>

      {/* Pasek postępu dnia — jedna liczba, po którą sięga się najczęściej. */}
      {dueToday.length > 0 && (
        <Card className={clsx(allDone && "border-success/50")}>
          <div className="flex items-center gap-4">
            <ProgressRing value={doneToday} max={dueToday.length} size={72} />

            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-tight">
                {allDone
                  ? "Komplet na dziś 🎉"
                  : doneToday === 0
                    ? "Jeszcze nic dziś"
                    : `Zostało ${dueToday.length - doneToday}`}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {perfectStreak > 0
                  ? `🔥 ${perfectStreak} ${dayWord(perfectStreak)} z rzędu w komplecie`
                  : "Domknij wszystko dziś, żeby zacząć passę."}
              </p>

              {bestOverall > 0 && (
                <p className="mt-1 text-[12px] text-faint">
                  Twój rekord: {bestOverall} {dayWord(bestOverall)}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {error && <Alert>{error}</Alert>}

      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔁"
            title="Brak nawyków"
            description="Suplementy, rozciąganie, sen o stałej porze, unikanie telefonu przed snem — cokolwiek chcesz robić regularnie."
            action={
              <Button variant="primary" onClick={openNew}>
                Dodaj pierwszy
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {dueToday.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                busy={busy === habit.id}
                onBump={(d) => bump(habit, d)}
                onEdit={() => openEdit(habit)}
                onDelete={() => remove(habit)}
              />
            ))}
          </div>

          {restToday.length > 0 && (
            <Card title="Nie na dziś" subtitle="Wróci w swoim dniu tygodnia">
              <div className="flex flex-col gap-2">
                {restToday.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    muted
                    busy={busy === habit.id}
                    onBump={(d) => bump(habit, d)}
                    onEdit={() => openEdit(habit)}
                    onDelete={() => remove(habit)}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edytuj nawyk" : "Nowy nawyk"}
      >
        <div className="flex flex-col gap-4">
          <Field label="Nazwa">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="np. Kreatyna rano"
              autoFocus
            />
          </Field>

          <Field label="Ikona">
            <div className="grid grid-cols-9 gap-1.5">
              {HABIT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setDraft({ ...draft, icon })}
                  aria-pressed={draft.icon === icon}
                  aria-label={`Ikona ${icon}`}
                  className={clsx(
                    "flex min-h-10 items-center justify-center rounded-xl text-[18px] transition-transform active:scale-95",
                    draft.icon === icon ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Ile razy dziennie" hint="1 = zwykły ptaszek.">
            <NumberStepper
              ariaLabel="Cel dzienny"
              value={draft.target_per_day}
              onChange={(v) => setDraft({ ...draft, target_per_day: Math.max(1, v ?? 1) })}
              step={1}
              min={1}
              max={50}
              decimals={0}
            />
          </Field>

          {draft.target_per_day > 1 && (
            <Field label="Jednostka (opcjonalnie)">
              <Input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="np. kapsułki, minuty"
              />
            </Field>
          )}

          <Field
            label="Dni tygodnia"
            hint={draft.days_of_week.length === 0 ? "Nic nie zaznaczone = codziennie." : undefined}
          >
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={draft.days_of_week.includes(d.value)}
                  aria-label={d.label}
                  className={clsx(
                    "min-h-10 rounded-xl text-[13px] font-semibold transition-colors",
                    draft.days_of_week.includes(d.value)
                      ? "bg-accent text-[var(--accent-fg)]"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  {d.short}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Przypomnienie (opcjonalnie)"
            hint="Powiadomienie pojawi się, gdy aplikacja jest otwarta. Szczegóły w Profilu."
          >
            <Input
              type="time"
              value={draft.reminder_at}
              onChange={(e) => setDraft({ ...draft, reminder_at: e.target.value })}
            />
          </Field>

          <Field label="Notatka (opcjonalnie)">
            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="np. 5 g, po treningu, popić dużą ilością wody"
              rows={2}
            />
          </Field>

          <Button
            variant="primary"
            size="lg"
            block
            loading={saving}
            disabled={!draft.name.trim()}
            onClick={save}
          >
            {editing ? "Zapisz zmiany" : "Dodaj nawyk"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function HabitCard({
  habit,
  muted,
  busy,
  onBump,
  onEdit,
  onDelete,
}: {
  habit: HabitWithToday;
  muted?: boolean;
  busy: boolean;
  onBump: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = habit.todayCount >= habit.target_per_day;
  const days = habit.days_of_week.length
    ? WEEKDAYS.filter((d) => habit.days_of_week.includes(d.value)).map((d) => d.short).join(" ")
    : "codziennie";

  return (
    <Card padded={false} className={clsx(muted && "opacity-70", done && "border-success/40")}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => onBump(done ? -habit.target_per_day : 1)}
          disabled={busy}
          aria-label={done ? `Cofnij ${habit.name}` : `Odhacz ${habit.name}`}
          className={clsx(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl text-[22px] transition-transform active:scale-90",
            done ? "bg-[var(--success-soft)]" : "bg-surface-2",
          )}
        >
          {done ? "✓" : habit.icon}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={clsx("font-semibold", done && "text-success")}>{habit.name}</span>
            {habit.streak >= 2 && <Chip tone="accent">🔥 {habit.streak} dni</Chip>}
          </div>

          <p className="mt-0.5 text-[12px] text-muted">
            {habit.target_per_day > 1
              ? `${habit.todayCount}/${habit.target_per_day}${habit.unit ? ` ${habit.unit}` : ""} · ${days}`
              : days}
            {habit.reminder_at && ` · ⏰ ${habit.reminder_at.slice(0, 5)}`}
            {habit.bestStreak > habit.streak && ` · rekord ${habit.bestStreak}`}
          </p>

          {/* Ostatnie 4 tygodnie — kwadracik na dzień, wypełniony gdy cel osiągnięty. */}
          <div
            className="mt-1.5 flex gap-[3px]"
            role="img"
            aria-label={`Ostatnie 28 dni: ${habit.history.filter((d) => d.count >= habit.target_per_day).length} dni z celem`}
          >
            {habit.history.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={clsx(
                  "h-3 flex-1 rounded-[2px]",
                  d.count >= habit.target_per_day
                    ? "bg-success"
                    : d.due
                      ? "bg-surface-3"
                      : "bg-transparent ring-1 ring-inset ring-border",
                )}
              />
            ))}
          </div>
        </div>

        {habit.target_per_day > 1 && !done && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onBump(1)}>
            +1
          </Button>
        )}

        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edytuj ${habit.name}`}
          className="px-1 text-faint"
        >
          ⋯
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Usuń ${habit.name}`}
          className="pr-1 text-faint"
        >
          🗑
        </button>
      </div>
    </Card>
  );
}

/** „1 dzień", „2 dni", „5 dni" — polska odmiana bez biblioteki. */
function dayWord(n: number): string {
  return n === 1 ? "dzień" : "dni";
}
