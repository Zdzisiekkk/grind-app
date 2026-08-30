"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { LIST_ICONS, TODO_PRIORITIES, dueLabel, priorityTone } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { Todo, TodoList } from "@/lib/database.types";

const INBOX = "__inbox__";

export function TodosScreen({
  userId,
  lists,
  todos,
  today,
}: {
  userId: string;
  lists: TodoList[];
  todos: Todo[];
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeList, setActiveList] = useState<string>("all");
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [listSheet, setListSheet] = useState(false);
  const [listDraft, setListDraft] = useState({ name: "", icon: "📝" });
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const inList = todos.filter((t) =>
      activeList === "all"
        ? true
        : activeList === INBOX
          ? t.list_id === null
          : t.list_id === activeList,
    );
    const open = inList.filter((t) => !t.done_at);
    const done = inList.filter((t) => t.done_at);

    // Najpierw zaległe i pilne, potem reszta - tak, jak człowiek by je ułożył.
    open.sort((a, b) => {
      const aDue = a.due_date ?? "9999-12-31";
      const bDue = b.due_date ?? "9999-12-31";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.order_index - b.order_index;
    });
    done.sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1));

    return { open, done };
  }, [todos, activeList]);

  const overdue = visible.open.filter((t) => t.due_date && t.due_date < today).length;

  async function toggle(todo: Todo) {
    setBusy(todo.id);
    const { error } = await supabase
      .from("todos")
      .update({ done_at: todo.done_at ? null : new Date().toISOString() })
      .eq("id", todo.id);
    setBusy(null);
    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      if (!todo.done_at) navigator.vibrate?.(12);
      router.refresh();
    }
  }

  async function addQuick() {
    const title = quick.trim();
    if (!title) return;
    setAdding(true);
    setError(null);

    const { error } = await supabase.from("todos").insert({
      user_id: userId,
      list_id: activeList === "all" || activeList === INBOX ? null : activeList,
      title,
      order_index: todos.length,
    });

    setAdding(false);
    if (error) setError(`Nie udało się dodać: ${error.message}`);
    else {
      setQuick("");
      router.refresh();
    }
  }

  async function saveDetails(patch: Partial<Todo>) {
    if (!editing) return;
    const { error } = await supabase.from("todos").update(patch).eq("id", editing.id);
    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      setEditing(null);
      router.refresh();
    }
  }

  async function removeTodo(id: string) {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else {
      setEditing(null);
      router.refresh();
    }
  }

  async function addList() {
    if (!listDraft.name.trim()) return;
    const { error } = await supabase.from("todo_lists").insert({
      user_id: userId,
      name: listDraft.name.trim(),
      icon: listDraft.icon,
      order_index: lists.length,
    });
    if (error) setError(`Nie udało się dodać listy: ${error.message}`);
    else {
      setListDraft({ name: "", icon: "📝" });
      setListSheet(false);
      router.refresh();
    }
  }

  async function removeList(list: TodoList) {
    if (!confirm(`Usunąć listę "${list.name}"? Zadania z niej trafią do "Bez listy".`)) return;
    const { error } = await supabase.from("todo_lists").delete().eq("id", list.id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else router.refresh();
  }

  const counts = new Map<string, number>();
  for (const t of todos) {
    if (t.done_at) continue;
    const key = t.list_id ?? INBOX;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const openAll = todos.filter((t) => !t.done_at).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Zadania</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {openAll === 0
              ? "Nic nie czeka. Ładnie."
              : `${openAll} do zrobienia${overdue ? ` · ${overdue} zaległe` : ""}`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setListSheet(true)}>
          + Lista
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* Filtr list - poziomy pasek, bo list bywa więcej niż mieści się w rzędzie. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <ListChip
          label="Wszystkie"
          icon="📋"
          count={openAll}
          active={activeList === "all"}
          onClick={() => setActiveList("all")}
        />
        {lists.map((list) => (
          <ListChip
            key={list.id}
            label={list.name}
            icon={list.icon}
            count={counts.get(list.id) ?? 0}
            active={activeList === list.id}
            onClick={() => setActiveList(list.id)}
            onLongPress={() => removeList(list)}
          />
        ))}
        {(counts.get(INBOX) ?? 0) > 0 && (
          <ListChip
            label="Bez listy"
            icon="📥"
            count={counts.get(INBOX) ?? 0}
            active={activeList === INBOX}
            onClick={() => setActiveList(INBOX)}
          />
        )}
      </div>

      {/* Szybkie dodanie - jedno pole, bez wchodzenia w formularz. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addQuick();
        }}
        className="flex gap-2"
      >
        <Input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Co masz do zrobienia?"
          enterKeyHint="done"
        />
        <Button type="submit" variant="primary" loading={adding} disabled={!quick.trim()}>
          Dodaj
        </Button>
      </form>

      {visible.open.length === 0 && visible.done.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗒️"
            title="Pusto"
            description="Dopisz coś w polu wyżej - sprzęt do kupienia, wizyta u fizjo, cokolwiek."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {visible.open.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                today={today}
                lists={lists}
                busy={busy === todo.id}
                onToggle={() => toggle(todo)}
                onOpen={() => setEditing(todo)}
              />
            ))}
          </ul>

          {visible.open.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              Wszystko odhaczone 🎉
            </p>
          )}
        </Card>
      )}

      {visible.done.length > 0 && (
        <Card padded={false}>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium text-muted"
          >
            Zrobione ({visible.done.length})
            <span aria-hidden>{showDone ? "▾" : "▸"}</span>
          </button>
          {showDone && (
            <ul className="divide-y divide-border border-t border-border">
              {visible.done.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  today={today}
                  lists={lists}
                  busy={busy === todo.id}
                  onToggle={() => toggle(todo)}
                  onOpen={() => setEditing(todo)}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Szczegóły zadania */}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Zadanie">
        {editing && (
          <TodoDetails
            todo={editing}
            lists={lists}
            onSave={saveDetails}
            onDelete={() => removeTodo(editing.id)}
          />
        )}
      </Sheet>

      {/* Nowa lista */}
      <Sheet open={listSheet} onClose={() => setListSheet(false)} title="Nowa lista">
        <div className="flex flex-col gap-4">
          <Field label="Nazwa">
            <Input
              value={listDraft.name}
              onChange={(e) => setListDraft({ ...listDraft, name: e.target.value })}
              placeholder="np. Sprzęt na siłownię"
              autoFocus
            />
          </Field>
          <Field label="Ikona">
            <div className="grid grid-cols-10 gap-1.5">
              {LIST_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setListDraft({ ...listDraft, icon })}
                  aria-pressed={listDraft.icon === icon}
                  aria-label={`Ikona ${icon}`}
                  className={clsx(
                    "flex min-h-10 items-center justify-center rounded-xl text-[18px]",
                    listDraft.icon === icon ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </Field>
          <Button variant="primary" size="lg" block disabled={!listDraft.name.trim()} onClick={addList}>
            Dodaj listę
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ListChip({
  label,
  icon,
  count,
  active,
  onClick,
  onLongPress,
}: {
  label: string;
  icon: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onLongPress?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onLongPress) return;
        e.preventDefault();
        onLongPress();
      }}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-accent text-[var(--accent-fg)]" : "bg-surface-2 text-muted",
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
      {count > 0 && (
        <span
          className={clsx(
            "tabular rounded-full px-1.5 text-[11px]",
            active ? "bg-black/15" : "bg-surface-3",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function TodoRow({
  todo,
  today,
  lists,
  busy,
  onToggle,
  onOpen,
}: {
  todo: Todo;
  today: string;
  lists: TodoList[];
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = Boolean(todo.done_at);
  const due = dueLabel(todo.due_date, today);
  const list = lists.find((l) => l.id === todo.list_id);
  const prio = TODO_PRIORITIES.find((p) => p.value === todo.priority);

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? `Cofnij: ${todo.title}` : `Odhacz: ${todo.title}`}
        className={clsx(
          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[14px] transition-transform active:scale-90",
          done ? "border-success bg-success text-white" : "border-border text-transparent",
        )}
      >
        ✓
      </button>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={clsx("block truncate text-[15px]", done && "text-faint line-through")}>
          {todo.title}
        </span>
        {(due || list || todo.priority > 0) && !done && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {due && (
              <span className={clsx("text-[12px]", due.overdue ? "font-semibold text-danger" : "text-muted")}>
                {due.overdue ? "⚠ " : "📅 "}
                {due.text}
              </span>
            )}
            {prio?.chip && <span className="text-[12px]">{prio.chip}</span>}
            {list && <span className="text-[12px] text-faint">{list.icon} {list.name}</span>}
          </span>
        )}
      </button>

      <span className="text-faint" aria-hidden>
        ›
      </span>
    </li>
  );
}

function TodoDetails({
  todo,
  lists,
  onSave,
  onDelete,
}: {
  todo: Todo;
  lists: TodoList[];
  onSave: (patch: Partial<Todo>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note ?? "");
  const [due, setDue] = useState(todo.due_date ?? "");
  const [priority, setPriority] = useState(todo.priority);
  const [listId, setListId] = useState(todo.list_id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <Field label="Treść">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Termin">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Priorytet">
          <Select value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))}>
            {TODO_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.chip ? `${p.chip} ` : ""}
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Lista">
        <Select value={listId} onChange={(e) => setListId(e.target.value)}>
          <option value="">Bez listy</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.icon} {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notatka">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Field>

      <div className="flex items-center gap-2">
        <Chip tone={priorityTone(priority)}>
          {TODO_PRIORITIES.find((p) => p.value === priority)?.label}
        </Chip>
      </div>

      <Button
        variant="primary"
        size="lg"
        block
        disabled={!title.trim()}
        onClick={() =>
          onSave({
            title: title.trim(),
            note: note.trim() || null,
            due_date: due || null,
            priority,
            list_id: listId || null,
          })
        }
      >
        Zapisz
      </Button>

      <Button variant="danger" block onClick={onDelete}>
        Usuń zadanie
      </Button>
    </div>
  );
}
