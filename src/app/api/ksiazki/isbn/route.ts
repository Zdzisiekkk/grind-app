import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bookFromGoogleBooks,
  bookFromOpenLibrary,
  bookFromOpenLibraryEdition,
  normalizeIsbn,
} from "@/lib/isbn";
import type { IsbnBook } from "@/lib/isbn";

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
const UA = "Grind (grind-app-iota.vercel.app)";

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
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const get = async (url: string): Promise<unknown> => {
    const res = await fetch(url, { signal, headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };

  // Trzy źródła, bo żadne nie zna wszystkiego. Open Library ma dwa rejestry
  // o różnym pokryciu — „jscmd=data" bywa puste tam, gdzie surowy rekord
  // wydania istnieje — a polskich wydań często nie ma w żadnym z nich.
  let book: IsbnBook | null = null;

  try {
    book = bookFromOpenLibrary(
      isbn,
      await get(`${OPEN_LIBRARY}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
    );
  } catch {
    // Milczymy: to dopiero pierwsza z trzech prób.
  }

  if (!book) {
    try {
      const edition = (await get(`https://openlibrary.org/isbn/${isbn}.json`)) as Record<
        string,
        unknown
      >;

      // Autorzy przychodzą jako same klucze — nazwiska trzeba dobrać osobno.
      const keys = Array.isArray(edition.authors)
        ? edition.authors
            .map((a) =>
              typeof a === "object" && a !== null ? (a as Record<string, unknown>).key : null,
            )
            .filter((k): k is string => typeof k === "string")
            .slice(0, 3)
        : [];

      const names = (
        await Promise.all(
          keys.map(async (key) => {
            try {
              const author = (await get(`https://openlibrary.org${key}.json`)) as Record<
                string,
                unknown
              >;
              return typeof author.name === "string" ? author.name : null;
            } catch {
              return null;
            }
          }),
        )
      ).filter((n): n is string => n !== null);

      book = bookFromOpenLibraryEdition(isbn, edition, names);
    } catch {
      // Zostaje trzecia próba.
    }
  }

  // Google Books tylko z kluczem: bez niego wszyscy dzielą jeden, stale
  // wyczerpany limit, więc źródło działałoby losowo — a losowo działające
  // wyszukiwanie jest gorsze niż jego brak.
  if (!book && process.env.GOOGLE_BOOKS_API_KEY) {
    try {
      book = bookFromGoogleBooks(
        isbn,
        await get(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}` +
            `&country=PL&key=${process.env.GOOGLE_BOOKS_API_KEY}`,
        ),
      );
    } catch {
      // Zostaje uczciwe „nie znaleziono".
    }
  }

  if (!book) {
    // 404 z numerem w środku: ekran otworzy formularz z zapamiętanym ISBN-em,
    // więc do wpisania zostaje sam tytuł. Ślepy zaułek byłby tu gorszy niż
    // brak skanera.
    return NextResponse.json(
      {
        error: "Nie znamy tej książki — wpisz tytuł sam, resztę zapamiętamy.",
        code: "not_found",
        isbn,
      },
      { status: 404 },
    );
  }

  return NextResponse.json(book, {
    // Dane bibliograficzne się nie zmieniają, a ten sam ISBN skanuje wiele osób.
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
