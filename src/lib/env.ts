/**
 * Zmienne środowiskowe — czytelny błąd zamiast zagadkowego crashu,
 * gdy ktoś odpali projekt bez skonfigurowanego Supabase.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Brak zmiennej środowiskowej ${name}. ` +
        `Skopiuj .env.example do .env.local i uzupełnij dane swojego projektu Supabase ` +
        `(Project Settings → API). Szczegóły w README.md.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Czy Supabase jest w ogóle skonfigurowany (do przyjaznego ekranu powitalnego). */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
