/**
 * Czyste decyzje o żądaniach PostgREST — bez IndexedDB, bez fetcha, bez Reacta.
 *
 * Wydzielone, żeby dało się to sprawdzić testem w Node, a nie dopiero w piwnicy
 * z wyłączonym LTE.
 */

const REST = "/rest/v1/";
const AUTH = "/auth/v1/";
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** Nazwa tabeli z adresu — służy tylko do pokazania, co czeka w kolejce. */
export function tableFromUrl(url: string): string {
  const path = url.split(REST)[1] ?? "";
  return path.split("?")[0].replace(/^\/+/, "") || "dane";
}

/**
 * Czy to zapis, który wolno odłożyć na później.
 *
 * Odczytów nie kolejkujemy — nie da się wymyślić danych, których się nie ma.
 * Logowania też nie: sfałszowana sesja byłaby gorsza niż uczciwy komunikat.
 * Wywołania funkcji (rpc) zmieniają stan i zwracają wynik naraz, więc nie
 * umiemy udawać ich odpowiedzi.
 */
export function isQueueableWrite(url: string, method: string): boolean {
  if (!url.includes(REST) || url.includes(AUTH)) return false;
  if (!WRITE_METHODS.has(method.toUpperCase())) return false;
  return !url.includes(`${REST}rpc/`);
}

/**
 * Wstawienie dostaje identyfikator nadany tutaj, w przeglądarce.
 *
 * Bez tego ekran treningu trzymałby w pamięci wiersz z wymyślonym id, a serwer
 * przy wysyłce nadałby własne — i usunięcie tej serii trafiałoby w próżnię.
 * Wszystkie te tabele mają `id uuid default gen_random_uuid()`, więc podanie
 * własnego jest legalne, a przy powtórce wysyłki daje darmową ochronę przed
 * dubletem: baza odbije je błędem 409.
 *
 * Wyjątkiem jest upsert — PostgREST wpisuje wtedy do `do update set` wszystkie
 * podane kolumny, więc dorzucone `id` nadpisałoby klucz istniejącego wiersza.
 */
export function withLocalIds(
  body: string | null,
  isUpsert: boolean,
  newId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): { body: string | null; rows: unknown[] } {
  if (!body) return { body, rows: [] };

  try {
    const parsed = JSON.parse(body);
    const rows: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
    const stamped = rows.map((row) => {
      const record = { ...row };
      if (!isUpsert && record.id === undefined) record.id = newId();
      if (record.created_at === undefined) record.created_at = now();
      return record;
    });
    return {
      body: JSON.stringify(Array.isArray(parsed) ? stamped : stamped[0]),
      rows: stamped,
    };
  } catch {
    // Nie każde ciało jest JSON-em. Kolejkujemy je bez zmian — lepiej wysłać
    // dokładnie to, co przyszło, niż zgadywać.
    return { body, rows: [] };
  }
}

/** Czy z nagłówka Prefer wynika, że to upsert. */
export const isUpsertPrefer = (prefer: string) => prefer.includes("merge-duplicates");

/** Czy wołający czeka na wstawione wiersze w odpowiedzi. */
export const wantsRepresentation = (prefer: string) => prefer.includes("return=representation");
