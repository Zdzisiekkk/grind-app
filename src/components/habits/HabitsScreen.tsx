"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, ProgressRing, Sheet, Textarea } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { DateNav } from "@/components/DateNav";
import { HABIT_ICONS, WEEKDAYS, habitDueOn } from "@/lib/constants";
import { humanDate } from "@/lib/format";
import { useLocalBoolean } from "@/lib/localSetting";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { Habit } from "@/lib/database.types";

type DayMark = { date: string; count: number; due: boolean };

export type HabitWithDay = Habit & {
  /** Ile razy odhaczone w dniu, który jest na ekranie - niekoniecznie dzisiaj. */
  dayCount: number;
  /** Ostatnie 7 dni, od najstarszego: ile razy odhaczone. */
  week: DayMark[];
  /** Ostatnie 28 dni - siatka 4 tygodni pod nazwą nawyku. */
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
  date,
  today,
  perfectStreak,
  reading,
  vices,
}: {
  userId: string;
  habits: HabitWithDay[];
  /** Dzień oglądany i odhaczany. */
  date: string;
  /** Dzisiaj - potrzebne, żeby odróżnić bieżący dzień od dopisywanego wstecz. */
  today: string;
  /** Ile dni z rzędu domknięte zostało wszystko, co było na liście. */
  perfectStreak: number;
  /** Książka w trakcie - skrót do podstrony z czytaniem. */
  reading: { id: string; title: string; current_page: number; pages: number | null } | null;
  /** Ile nałogów i najdłuższa trwająca passa - skrót do podstrony z nałogami. */
  vices: { count: number; bestDays: number };
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HabitWithDay | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Domyślnie zwinięte, ale wybór zostaje zapamiętany - kto raz rozwinie,
  // nie musi tego robić codziennie przed odhaczeniem.
  const [listOpen, setListOpen] = useLocalBoolean("grind:habits-open", false);

  const jestDzis = date === today;
  const dueOnDay = habits.filter((h) => habitDueOn(h.days_of_week, date));
  const restOnDay = habits.filter((h) => !habitDueOn(h.days_of_week, date));
  const doneOnDay = dueOnDay.filter((h) => h.dayCount >= h.target_per_day).length;
  const allDone = dueOnDay.length > 0 && doneOnDay === dueOnDay.length;
  const bestOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak), 0);

  function openNew() {
    setEditing(null);
    setDraft(EMPTY);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(habit: HabitWithDay) {
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
  async function bump(habit: HabitWithDay, delta: number) {
    const next = Math.max(0, Math.min(habit.target_per_day, habit.dayCount + delta));
    if (next === habit.dayCount) return;

    setBusy(habit.id);
    const { error } = await supabase.from("habit_logs").upsert(
      { user_id: userId, habit_id: habit.id, date, count: next },
      { onConflict: "user_id,habit_id,date" },
    );
    setBusy(null);

    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      if (next > habit.dayCount) navigator.vibrate?.(12);
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

  async function remove(habit: HabitWithDay) {
    if (!confirm(`Usunąć nawyk "${habit.name}" razem z historią odhaczeń?`)) return;
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
        <h1 className="text-2xl font-bold">
          {jestDzis ? "Nawyki i nałogi" : `Nawyki - ${humanDate(date)}`}
        </h1>
        <Button variant="primary" onClick={openNew}>
          + Dodaj
        </Button>
      </header>

      {/* Przełącznik dnia: to samo, co w diecie, tyle że zamknięte w oknie
          wpisywania wstecz - passy liczą się z historii, więc dopisanie dnia
          sprzed pół roku przepisałoby rekord po cichu. */}
      <DateNav date={date} basePath="/nawyki" ograniczWstecz />

      {/* Pasek postępu dnia - jedna liczba, po którą sięga się najczęściej. */}
      {dueOnDay.length > 0 && (
        <Card className={clsx(allDone && "border-success/50")}>
          <div className="flex items-center gap-4">
            <ProgressRing value={doneOnDay} max={dueOnDay.length} size={72} />

            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-tight">
                {allDone
                  ? jestDzis
                    ? "Komplet na dziś 🎉"
                    : `Komplet: ${humanDate(date)} 🎉`
                  : doneOnDay === 0
                    ? jestDzis
                      ? "Jeszcze nic dziś"
                      : `Nic nie odhaczone: ${humanDate(date)}`
                    : `Zostało ${dueOnDay.length - doneOnDay}`}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {perfectStreak > 0
                  ? `🔥 ${perfectStreak} ${dayWord(perfectStreak)} z rzędu w komplecie`
                  : jestDzis
                    ? "Domknij wszystko dziś, żeby zacząć passę."
                    : "Dopisany dzień liczy się do passy tak samo jak wpisany na czas."}
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

      {/* Czytanie mieszka tu, ale ma własny ekran - nie da się go odhaczyć
          ptaszkiem, bo ma tytuł, strony i notatki. */}
      <Link href="/nawyki/ksiazki" className="block">
        <Card className="transition-colors active:bg-surface-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
              📚
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Czytanie</p>
              <p className="truncate text-[13px] text-muted">
                {reading
                  ? `${reading.title} · s. ${reading.current_page}${reading.pages ? ` z ${reading.pages}` : ""}`
                  : "Książki, postęp, cytaty i notatki"}
              </p>
            </div>
            <span className="text-faint" aria-hidden>
              ›
            </span>
          </div>
        </Card>
      </Link>

      {/* Nałóg to odwrócony nawyk - sukcesem jest dzień, w którym nic nie
          zrobiłeś. Osobny ekran, bo passa liczy się tam w drugą stronę. */}
      <Link href="/nawyki/nalogi" className="block">
        <Card className="transition-colors active:bg-surface-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
              🚭
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Nałogi</p>
              <p className="truncate text-[13px] text-muted">
                {vices.count === 0
                  ? "Walka ze złymi nawykami - licznik czystych dni"
                  : `${vices.bestDays} ${dayWord(vices.bestDays)} czysto · ${viceWord(vices.count)}`}
              </p>
            </div>
            <span className="text-faint" aria-hidden>
              ›
            </span>
          </div>
        </Card>
      </Link>

      {error && <Alert>{error}</Alert>}

      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔁"
            title="Brak nawyków"
            description="Suplementy, rozciąganie, sen o stałej porze, unikanie telefonu przed snem - cokolwiek chcesz robić regularnie."
            action={
              <Button variant="primary" onClick={openNew}>
                Dodaj pierwszy
              </Button>
            }
          />
        </Card>
      ) : (
        /* Wszystkie własne nawyki pod jednym nagłówkiem - po rozwinięciu
           wyglądają dokładnie tak, jak wcześniej. */
        <Card padded={false} className="overflow-hidden">
          <button
            type="button"
            onClick={() => setListOpen(!listOpen)}
            aria-expanded={listOpen}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-surface-2"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
              🔁
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Moje nawyki</p>
              <p className="truncate text-[13px] text-muted">
                {viceOrHabitWord(habits.length)}
                {dueOnDay.length > 0 && ` · ${doneOnDay}/${dueOnDay.length} dziś`}
              </p>
            </div>
            <span
              className={clsx(
                "text-faint transition-transform",
                listOpen ? "rotate-90" : "rotate-0",
              )}
              aria-hidden
            >
              ›
            </span>
          </button>

          {/* Zwinięte, ale wciąż w DOM: dzięki temu wyszukiwarka przeglądarki
              znajduje nazwę nawyku, a display:none i tak wycina to z drzewa
              dostępności, więc czytnik ekranu nie czyta ukrytej listy. */}
          <div
            className={clsx(
              "flex-col gap-2 border-t border-border p-3",
              listOpen ? "flex" : "hidden",
            )}
          >
              {dueOnDay.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  busy={busy === habit.id}
                  onBump={(d) => bump(habit, d)}
                  onEdit={() => openEdit(habit)}
                  onDelete={() => remove(habit)}
                />
              ))}

              {restOnDay.length > 0 && (
                <>
                  <p className="mt-1 px-1 text-[12px] font-medium uppercase tracking-wide text-faint">
                    {jestDzis
                      ? "Nie na dziś - wróci w swoim dniu tygodnia"
                      : "Nie na ten dzień tygodnia"}
                  </p>
                  {restOnDay.map((habit) => (
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
                </>
              )}
          </div>
        </Card>
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
  habit: HabitWithDay;
  muted?: boolean;
  busy: boolean;
  onBump: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = habit.dayCount >= habit.target_per_day;
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
              ? `${habit.dayCount}/${habit.target_per_day}${habit.unit ? ` ${habit.unit}` : ""} · ${days}`
              : days}
            {habit.reminder_at && ` · ⏰ ${habit.reminder_at.slice(0, 5)}`}
            {habit.bestStreak > habit.streak && ` · rekord ${habit.bestStreak}`}
          </p>

          {/* Ostatnie 4 tygodnie - kwadracik na dzień, wypełniony gdy cel osiągnięty. */}
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

/** "1 dzień", "2 dni", "5 dni" - polska odmiana bez biblioteki. */
function dayWord(n: number): string {
  return n === 1 ? "dzień" : "dni";
}

/**
 * Polska odmiana po liczbie: 1 nawyk, 2-4 nawyki, 5+ nawyków - z wyjątkiem
 * nastek (12 nawyków, nie "12 nawyki").
 */
function viceOrHabitWord(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) return "1 nawyk";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} nawyki`;
  return `${n} nawyków`;
}

/** To samo dla nałogów. */
function viceWord(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) return "1 nałóg";
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} nałogi`;
  return `${n} nałogów`;
}
