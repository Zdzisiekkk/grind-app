"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Sheet,
  Stat,
  Textarea,
} from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { BOOK_STATUSES, bookProgress, bookStatus, pagesLabel } from "@/lib/books";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { humanDate, plural, todayISO } from "@/lib/format";
import type { Book, BookNote, BookStatus } from "@/lib/database.types";

const EMPTY = {
  title: "",
  author: "",
  status: "reading" as BookStatus,
  pages: null as number | null,
  current_page: 0,
  rating: null as number | null,
  summary: "",
};

export function BooksScreen({
  userId,
  books,
  notes,
  streak,
  readThisYear,
  pagesThisMonth,
}: {
  userId: string;
  books: Book[];
  /** Notatki wszystkich książek, pogrupowane po stronie serwera. */
  notes: Record<string, BookNote[]>;
  streak: number;
  readThisYear: number;
  pagesThisMonth: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [filter, setFilter] = useState<BookStatus>("reading");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [detail, setDetail] = useState<Book | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<BookStatus, number>();
    for (const b of books) map.set(b.status, (map.get(b.status) ?? 0) + 1);
    return map;
  }, [books]);

  const shown = books.filter((b) => b.status === filter);
  const reading = books.filter((b) => b.status === "reading");

  function openNew() {
    setEditing(null);
    setDraft({ ...EMPTY, status: filter === "read" ? "read" : filter });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(book: Book) {
    setEditing(book);
    setDraft({
      title: book.title,
      author: book.author ?? "",
      status: book.status,
      pages: book.pages,
      current_page: book.current_page,
      rating: book.rating,
      summary: book.summary ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);

    const today = todayISO();
    const payload = {
      user_id: userId,
      title: draft.title.trim(),
      author: draft.author.trim() || null,
      status: draft.status,
      pages: draft.pages,
      // Baza pilnuje, żeby postęp nie przekroczył liczby stron — obcinamy tu,
      // żeby zamiast błędu z bazy pokazać rozsądną wartość.
      current_page: draft.pages ? Math.min(draft.current_page, draft.pages) : draft.current_page,
      rating: draft.status === "read" ? draft.rating : null,
      summary: draft.summary.trim() || null,
      started_at: draft.status === "want" ? null : (editing?.started_at ?? today),
      finished_at: draft.status === "read" ? (editing?.finished_at ?? today) : null,
    };

    const { error } = editing
      ? await supabase.from("books").update(payload).eq("id", editing.id)
      : await supabase.from("books").insert(payload);

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  /**
   * Dopisanie stron przeczytanych dzisiaj.
   *
   * Aktualizuje książkę i osobno zapisuje sesję — dzięki temu passa liczy się
   * z faktu „czytałem dziś", a nie z tego, czy ktoś pamiętał zmienić numer strony.
   */
  async function addPages(book: Book, pages: number) {
    const today = todayISO();
    const next = book.pages
      ? Math.min(book.pages, book.current_page + pages)
      : book.current_page + pages;
    const done = book.pages != null && next >= book.pages;

    const { error: bookError } = await supabase
      .from("books")
      .update({
        current_page: next,
        started_at: book.started_at ?? today,
        ...(done ? { status: "read" as BookStatus, finished_at: today } : {}),
      })
      .eq("id", book.id);

    if (bookError) {
      setError(`Nie udało się zapisać: ${bookError.message}`);
      return;
    }

    // Ta sama książka tego samego dnia sumuje strony zamiast tworzyć drugi wpis.
    const { data: existing } = await supabase
      .from("reading_logs")
      .select("id, pages_read")
      .eq("user_id", userId)
      .eq("book_id", book.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("reading_logs")
        .update({ pages_read: existing.pages_read + pages })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("reading_logs")
        .insert({ user_id: userId, book_id: book.id, date: today, pages_read: pages });
    }

    navigator.vibrate?.(12);
    router.refresh();
  }

  async function remove(book: Book) {
    if (!confirm(`Usunąć „${book.title}" razem z notatkami?`)) return;
    const { error } = await supabase.from("books").delete().eq("id", book.id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else {
      setFormOpen(false);
      setDetail(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Czytanie</h1>
          <p className="text-[13px] text-muted">
            {streak > 0
              ? `🔥 ${streak} ${plural(streak, "dzień", "dni", "dni")} z rzędu`
              : "Przeczytaj dziś choćby stronę, żeby zacząć passę."}
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>
          + Książka
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* --- Co czytam teraz --- */}
      {reading.length > 0 && (
        <div className="flex flex-col gap-2">
          {reading.map((book) => {
            const progress = bookProgress(book);
            return (
              <Card key={book.id}>
                <button
                  type="button"
                  onClick={() => setDetail(book)}
                  className="block w-full text-left"
                >
                  <p className="text-[16px] font-bold leading-tight">{book.title}</p>
                  {book.author && <p className="text-[13px] text-muted">{book.author}</p>}
                  <p className="tabular mt-1 text-[13px] text-muted">{pagesLabel(book)}</p>

                  {progress != null && (
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Postęp w książce ${book.title}`}
                    >
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </button>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[5, 10, 20, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => addPages(book, n)}
                      className="min-h-9 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-muted active:scale-95"
                    >
                      +{n} str.
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDetail(book)}
                    className="min-h-9 rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent active:scale-95"
                  >
                    Notatka
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- Liczby --- */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="W tym roku" value={readThisYear} sub="przeczytane" />
        <Stat label="Ten miesiąc" value={pagesThisMonth} sub="stron" />
        <Stat label="Passa" value={streak} sub={plural(streak, "dzień", "dni", "dni")} tone={streak >= 7 ? "success" : undefined} />
      </div>

      {/* --- Półki --- */}
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={BOOK_STATUSES.map((s) => ({
          value: s.value,
          label: `${s.icon} ${counts.get(s.value) ?? 0}`,
        }))}
      />

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={bookStatus(filter).icon}
            title={`Pusto: ${bookStatus(filter).label.toLowerCase()}`}
            description="Dodaj tytuł, a resztę — strony, notatki, ocenę — uzupełnisz po drodze."
            action={
              <Button variant="primary" onClick={openNew}>
                Dodaj książkę
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {shown.map((book) => {
              const progress = bookProgress(book);
              const count = notes[book.id]?.length ?? 0;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(book)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
                      {bookStatus(book.status).icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold leading-tight">
                        {book.title}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {[book.author, progress != null ? `${progress}%` : null,
                          count > 0 ? `${count} ${plural(count, "notatka", "notatki", "notatek")}` : null]
                          .filter(Boolean)
                          .join(" · ") || pagesLabel(book)}
                      </span>
                    </span>
                    {book.rating && (
                      <span className="text-[12px] text-warn" aria-label={`Ocena ${book.rating} na 5`}>
                        {"★".repeat(book.rating)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ------------------------------ Szczegóły ------------------------------ */}
      <BookDetail
        book={detail}
        notes={detail ? (notes[detail.id] ?? []) : []}
        userId={userId}
        onClose={() => setDetail(null)}
        onEdit={() => {
          if (detail) {
            setDetail(null);
            openEdit(detail);
          }
        }}
        onChanged={() => router.refresh()}
      />

      {/* ------------------------------ Formularz ------------------------------ */}
      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edytuj książkę" : "Nowa książka"}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" onClick={() => remove(editing)}>
                Usuń
              </Button>
            )}
            <Button variant="primary" size="lg" block loading={saving} onClick={save}>
              Zapisz
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Tytuł">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="np. Atomowe nawyki"
              autoFocus
            />
          </Field>

          <Field label="Autor (opcjonalnie)">
            <Input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              placeholder="np. James Clear"
            />
          </Field>

          <Field label="Półka">
            <div className="grid grid-cols-2 gap-1.5">
              {BOOK_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, status: s.value })}
                  aria-pressed={draft.status === s.value}
                  className={clsx(
                    "flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors",
                    draft.status === s.value
                      ? "bg-accent text-[var(--accent-fg)]"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  <span aria-hidden>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ile stron" hint="Można zostawić puste.">
              <NumberStepper
                ariaLabel="Liczba stron książki"
                value={draft.pages}
                onChange={(v) => setDraft({ ...draft, pages: v })}
                step={10}
                min={0}
                max={10000}
              />
            </Field>
            <Field label="Jestem na stronie">
              <NumberStepper
                ariaLabel="Aktualna strona"
                value={draft.current_page}
                onChange={(v) => setDraft({ ...draft, current_page: v ?? 0 })}
                step={10}
                min={0}
                max={10000}
              />
            </Field>
          </div>

          {draft.status === "read" && (
            <Field label="Ocena">
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft({ ...draft, rating: draft.rating === n ? null : n })}
                    aria-pressed={draft.rating === n}
                    aria-label={`Ocena ${n} na 5`}
                    className={clsx(
                      "min-h-12 rounded-xl text-[18px] transition-transform active:scale-95",
                      (draft.rating ?? 0) >= n ? "bg-accent-soft text-warn" : "bg-surface-2 text-faint",
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Wrażenia (opcjonalnie)" hint="Po co Ci była ta książka i co z niej zostaje.">
            <Textarea
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------ Szczegóły książki --------------------------- */

function BookDetail({
  book,
  notes,
  userId,
  onClose,
  onEdit,
  onChanged,
}: {
  book: Book | null;
  notes: BookNote[];
  userId: string;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [page, setPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    if (!book) return;
    if (!quote.trim() && !note.trim()) return;

    setSaving(true);
    setError(null);
    const { error } = await supabase.from("book_notes").insert({
      user_id: userId,
      book_id: book.id,
      page: page ?? null,
      quote: quote.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);

    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setQuote("");
    setNote("");
    onChanged();
  }

  async function removeNote(id: string) {
    await supabase.from("book_notes").delete().eq("id", id);
    onChanged();
  }

  return (
    <Sheet open={Boolean(book)} onClose={onClose} title={book?.title ?? ""}>
      {book && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {book.author && <p className="text-[14px] text-muted">{book.author}</p>}
              <p className="tabular mt-1 text-[13px] text-muted">{pagesLabel(book)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Chip>{bookStatus(book.status).label}</Chip>
              <button type="button" onClick={onEdit} className="text-[13px] font-medium text-accent">
                Edytuj
              </button>
            </div>
          </div>

          {book.summary && (
            <Card title="Wrażenia">
              <p className="whitespace-pre-line text-[14px] leading-relaxed">{book.summary}</p>
            </Card>
          )}

          {error && <Alert>{error}</Alert>}

          {/* --- Nowa notatka --- */}
          <Card title="Dopisz notatkę">
            <div className="flex flex-col gap-3">
              <Field label="Cytat (opcjonalnie)">
                <Textarea
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="Fragment, do którego chcesz wrócić"
                  rows={2}
                />
              </Field>
              <Field label="Twoja myśl (opcjonalnie)" hint="Wystarczy jedno z dwóch pól.">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Co z tego dla Ciebie wynika"
                  rows={2}
                />
              </Field>
              <Field label="Strona (opcjonalnie)">
                <NumberStepper
                  ariaLabel="Numer strony"
                  value={page}
                  onChange={setPage}
                  step={1}
                  min={0}
                  max={10000}
                />
              </Field>
              <Button
                variant="primary"
                block
                loading={saving}
                disabled={!quote.trim() && !note.trim()}
                onClick={addNote}
              >
                Zapisz notatkę
              </Button>
            </div>
          </Card>

          {/* --- Istniejące notatki --- */}
          {notes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-faint">
                {notes.length} {plural(notes.length, "notatka", "notatki", "notatek")}
              </h3>
              {notes.map((n) => (
                <Card key={n.id}>
                  {n.quote && (
                    <blockquote className="border-l-2 border-accent pl-3 text-[14px] italic leading-relaxed">
                      {n.quote}
                    </blockquote>
                  )}
                  {n.note && (
                    <p className={clsx("text-[14px] leading-relaxed", n.quote && "mt-2")}>{n.note}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
                    <span>
                      {n.page != null ? `s. ${n.page} · ` : ""}
                      {humanDate(n.created_at.slice(0, 10))}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNote(n.id)}
                      className="font-medium text-danger"
                    >
                      Usuń
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
