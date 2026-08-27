import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookFromOpenLibrary, normalizeIsbn } from "@/lib/isbn";

/**
 * Wyszukanie książki po numerze ISBN.
 *
 * Open Library jest darmowe i nie wymaga klucza, ale pytamy z serwera, nie
 * z przeglądarki: dzięki temu odpowiedź da się zbuforować dla wszystkich,
 * a przeglądarka nie walczy z CORS-em.
 *
 * Trasa wymaga zalogowania — inaczej byłaby otwartym pośrednikiem do cudzego
 * API, wystawionym pod naszą domeną i naszym limitem zapytań.
 */

const OPEN_LIBRARY = "https://openlibrary.org/api/books";
const TIMEOUT_MS = 6000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("isbn") ?? "";
  const isbn = normalizeIsbn(raw);

  if (!isbn) {
    return NextResponse.json(
      { error: "To nie jest poprawny numer ISBN. Sprawdź, czy wszystkie cyfry się zgadzają." },
      { status: 400 },
    );
  }

  // Bez limitu czasu jedno zawieszone zapytanie trzymałoby otwarty arkusz
  // „Nowa książka" tak długo, aż człowiek zamknie apkę.
  const abort = AbortSignal.timeout(TIMEOUT_MS);

  let payload: unknown;
  try {
    const res = await fetch(
      `${OPEN_LIBRARY}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { signal: abort, headers: { "User-Agent": "Grind (grind-app-iota.vercel.app)" } },
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    payload = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Baza książek nie odpowiada. Wpisz dane ręcznie." },
      { status: 502 },
    );
  }

  const book = bookFromOpenLibrary(isbn, payload);

  if (!book) {
    return NextResponse.json(
      { error: "Nie znaleziono tej książki. Wpisz dane ręcznie.", isbn },
      { status: 404 },
    );
  }

  return NextResponse.json(book, {
    // Dane bibliograficzne się nie zmieniają, a ten sam ISBN skanuje wiele osób.
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
