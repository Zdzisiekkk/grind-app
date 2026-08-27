/**
 * Etykiety i drobna logika czytania.
 *
 * Osobno od komponentu, żeby ten sam podział na stany był używany w liście,
 * w formularzu i na pulpicie — a nie przepisywany trzy razy.
 */

import type { Book, BookStatus } from "@/lib/database.types";

export const BOOK_STATUSES: {
  value: BookStatus;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { value: "reading", label: "Czytam", icon: "📖", hint: "W trakcie" },
  { value: "want", label: "Chcę przeczytać", icon: "🔖", hint: "Na później" },
  { value: "read", label: "Przeczytane", icon: "✅", hint: "Skończone" },
  // Porzucenie to uczciwy stan, nie porażka. Książka, której nie da się
  // dokończyć, nie powinna blokować listy „czytam" przez pół roku.
  { value: "abandoned", label: "Porzucone", icon: "🚪", hint: "Odpuszczone" },
];

export function bookStatus(value: string) {
  return BOOK_STATUSES.find((s) => s.value === value) ?? BOOK_STATUSES[0];
}

/** Postęp w procentach albo null, gdy nie wiadomo, ile książka ma stron. */
export function bookProgress(book: Pick<Book, "pages" | "current_page">): number | null {
  if (!book.pages || book.pages <= 0) return null;
  return Math.min(100, Math.round((book.current_page / book.pages) * 100));
}

/** „124 z 320 stron" albo „124 strony", gdy całości nie znamy. */
export function pagesLabel(book: Pick<Book, "pages" | "current_page">): string {
  if (book.pages) return `${book.current_page} z ${book.pages} stron`;
  return book.current_page > 0 ? `${book.current_page} stron` : "brak postępu";
}

/**
 * Ile dni z rzędu (wstecz od dziś) coś przeczytałeś.
 *
 * Dzisiejszy brak jeszcze nie zrywa serii — dzień się nie skończył. Ta sama
 * zasada co przy nawykach, żeby wieczorne zaglądanie do apki nie karało.
 */
export function readingStreak(dates: Set<string>, today: string, addDays: (iso: string, n: number) => string): number {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const date = addDays(today, -i);
    if (dates.has(date)) {
      streak++;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}
