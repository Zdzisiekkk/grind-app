/**
 * ISBN: sprawdzanie, normalizacja i czytanie odpowiedzi Open Library.
 *
 * Moduł jest czysty — żadnego fetcha, żadnego Reacta. Kod kreskowy z okładki
 * bywa odczytany z jedną cyfrą przekłamaną, a suma kontrolna ISBN jest
 * dokładnie po to, żeby to złapać, zanim pójdzie zapytanie o cudzą książkę.
 */

/** Zostawia tylko cyfry i końcowe X — myślniki i spacje bywają w druku różnie. */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

function isbn10Valid(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i];
    const value = ch === "X" ? 10 : Number(ch);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

function isbn13Checksum(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

function isbn13Valid(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  return isbn13Checksum(isbn.slice(0, 12)) === Number(isbn[12]);
}

/**
 * Sprowadza wszystko do ISBN-13, bo tego formatu używa kod kreskowy EAN-13
 * na okładce — i tylko w nim Open Library trzyma jeden spójny klucz.
 *
 * Zwraca null, gdy suma kontrolna się nie zgadza. Cicha akceptacja błędnego
 * numeru kończy się „nie znaleziono książki" zamiast „przeskanuj jeszcze raz".
 */
export function normalizeIsbn(raw: string): string | null {
  const isbn = cleanIsbn(raw);

  if (isbn13Valid(isbn)) return isbn;

  if (isbn10Valid(isbn)) {
    const first12 = "978" + isbn.slice(0, 9);
    return first12 + String(isbn13Checksum(first12));
  }

  return null;
}

/** Kod z EAN-13 jest ISBN-em tylko wtedy, gdy zaczyna się od 978 albo 979. */
export function looksLikeBookBarcode(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  return /^97[89]\d{10}$/.test(isbn) && isbn13Valid(isbn);
}

export type IsbnBook = {
  isbn: string;
  title: string;
  author: string | null;
  pages: number | null;
  coverUrl: string | null;
};

type OpenLibraryEntry = {
  title?: unknown;
  authors?: unknown;
  number_of_pages?: unknown;
  cover?: unknown;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Wyciąga to, co wypełnia formularz.
 *
 * Open Library bywa niekompletne i niespójne — brak autora albo stron jest
 * normą, nie awarią. Dlatego każde pole może wrócić puste, a brakiem zajmuje
 * się formularz, w którym i tak da się dopisać resztę ręcznie.
 */
export function bookFromOpenLibrary(isbn: string, payload: unknown): IsbnBook | null {
  if (typeof payload !== "object" || payload === null) return null;

  const entry = (payload as Record<string, unknown>)[`ISBN:${isbn}`] as
    | OpenLibraryEntry
    | undefined;
  if (!entry) return null;

  const title = str(entry.title);
  if (!title) return null;

  const authors = Array.isArray(entry.authors)
    ? entry.authors
        .map((a) => (typeof a === "object" && a !== null ? str((a as Record<string, unknown>).name) : null))
        .filter((n): n is string => n !== null)
    : [];

  const rawPages = entry.number_of_pages;
  const pages =
    typeof rawPages === "number" && Number.isInteger(rawPages) && rawPages > 0 && rawPages <= 10000
      ? rawPages
      : null;

  const cover =
    typeof entry.cover === "object" && entry.cover !== null
      ? (entry.cover as Record<string, unknown>)
      : null;

  return {
    isbn,
    title,
    // Kilku autorów łączymy przecinkiem — pole w bazie jest jedno i tak
    // wygląda to na okładce.
    author: authors.length ? authors.join(", ") : null,
    pages,
    coverUrl: cover ? (str(cover.medium) ?? str(cover.large) ?? str(cover.small)) : null,
  };
}

/**
 * Rekord wydania z /isbn/{isbn}.json.
 *
 * Open Library ma dwa źródła o różnym pokryciu: „jscmd=data" bywa puste tam,
 * gdzie surowy rekord wydania istnieje. Nazwiska autorów są tu tylko kluczami,
 * więc dostajemy je osobno — kto je pobiera, decyduje trasa.
 */
export function bookFromOpenLibraryEdition(
  isbn: string,
  payload: unknown,
  authorNames: string[] = [],
): IsbnBook | null {
  if (typeof payload !== "object" || payload === null) return null;
  const entry = payload as Record<string, unknown>;

  const title = str(entry.title);
  if (!title) return null;

  const subtitle = str(entry.subtitle);
  const rawPages = entry.number_of_pages;
  const pages =
    typeof rawPages === "number" && Number.isInteger(rawPages) && rawPages > 0 && rawPages <= 10000
      ? rawPages
      : null;

  const covers = Array.isArray(entry.covers) ? entry.covers : [];
  const coverId = covers.find((c) => typeof c === "number" && c > 0);

  return {
    isbn,
    title: subtitle ? `${title}. ${subtitle}` : title,
    author: authorNames.length ? authorNames.join(", ") : null,
    pages,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
  };
}

/**
 * Odpowiedź Google Books.
 *
 * Sięgamy tu po polskie wydania, których Open Library po prostu nie ma.
 * Adresy okładek przychodzą czasem po http — podmieniamy na https, bo strona
 * chodzi po https i przeglądarka zablokowałaby taki obrazek.
 */
export function bookFromGoogleBooks(isbn: string, payload: unknown): IsbnBook | null {
  if (typeof payload !== "object" || payload === null) return null;

  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const info =
    typeof items[0] === "object" && items[0] !== null
      ? ((items[0] as Record<string, unknown>).volumeInfo as Record<string, unknown> | undefined)
      : undefined;
  if (!info) return null;

  const title = str(info.title);
  if (!title) return null;

  const subtitle = str(info.subtitle);

  const authors = Array.isArray(info.authors)
    ? info.authors.map(str).filter((n): n is string => n !== null)
    : [];

  const rawPages = info.pageCount;
  const pages =
    typeof rawPages === "number" && Number.isInteger(rawPages) && rawPages > 0 && rawPages <= 10000
      ? rawPages
      : null;

  const links =
    typeof info.imageLinks === "object" && info.imageLinks !== null
      ? (info.imageLinks as Record<string, unknown>)
      : null;
  const rawCover = links ? (str(links.thumbnail) ?? str(links.smallThumbnail)) : null;

  return {
    isbn,
    title: subtitle ? `${title}. ${subtitle}` : title,
    author: authors.length ? authors.join(", ") : null,
    pages,
    coverUrl: rawCover ? rawCover.replace(/^http:\/\//, "https://") : null,
  };
}
