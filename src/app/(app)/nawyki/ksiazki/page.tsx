import { BooksScreen } from "@/components/books/BooksScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { readingStreak } from "@/lib/books";
import type { Book, BookNote } from "@/lib/database.types";

export const metadata = { title: "Czytanie" };

export default async function BooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: books }, { data: notes }, { data: logs }] = await Promise.all([
    supabase
      .from("books")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("book_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    // Rok wstecz wystarcza na passę i statystyki; starsze wpisy nic tu nie wnoszą.
    supabase
      .from("reading_logs")
      .select("date, pages_read")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -400)),
  ]);

  // Notatki grupujemy po stronie serwera - komponent dostaje je gotowe,
  // zamiast filtrować całą listę przy każdym otwarciu książki.
  const byBook: Record<string, BookNote[]> = {};
  for (const note of (notes ?? []) as BookNote[]) {
    (byBook[note.book_id] ??= []).push(note);
  }

  const days = new Set((logs ?? []).map((l) => l.date));
  const pagesThisMonth = (logs ?? [])
    .filter((l) => l.date >= monthStart)
    .reduce((sum, l) => sum + l.pages_read, 0);

  const readThisYear = ((books ?? []) as Book[]).filter(
    (b) => b.status === "read" && (b.finished_at ?? "") >= yearStart,
  ).length;

  return (
    <BooksScreen
      userId={user.id}
      books={(books ?? []) as Book[]}
      notes={byBook}
      streak={readingStreak(days, today, addDaysISO)}
      readThisYear={readThisYear}
      pagesThisMonth={pagesThisMonth}
    />
  );
}
