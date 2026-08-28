import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Kopia wszystkich swoich danych — jeden plik JSON.
 *
 * RODO daje do tego prawo (art. 20), ale to nie jedyny powód: bez eksportu
 * człowiek jest zakładnikiem aplikacji. Jeśli jutro zamknę serwer, jego dwa
 * lata treningów mają wyjść razem z nim.
 *
 * Czytamy zwykłym klientem użytkownika, więc RLS sam pilnuje, żeby do pliku
 * trafiło dokładnie to, co jego — nie trzeba tego sprawdzać drugi raz.
 */
export const maxDuration = 60;

/** Tabele, które trzymają dane użytkownika. Kolejność = kolejność w pliku. */
const TABLES = [
  "profiles",
  "plans",
  "phases",
  "workout_days",
  "workout_exercises",
  "workout_sessions",
  "workout_logs",
  "body_weight_logs",
  "injuries",
  "pain_logs",
  "sleep_logs",
  "habits",
  "habit_logs",
  "water_logs",
  "todo_lists",
  "todos",
  "books",
  "book_notes",
  "reading_logs",
  "vices",
  "vice_events",
  "recipes",
  "recipe_items",
  "meals",
  "meal_entries",
  "activities",
  "coach_proposals",
  "coach_messages",
  "subscriptions",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  // Wszystkie tabele naraz, nie jedna po drugiej. Przy 29 zapytaniach po kolei
  // czas eksportu to suma opóźnień sieci; równolegle to najwolniejsze z nich —
  // a funkcja ma na wszystko 60 sekund.
  //
  // Plany i ich części nie mają user_id na każdym poziomie, więc pytamy bez
  // filtra: RLS i tak pokaże wyłącznie własne i nie musimy zgadywać schematu.
  const wyniki = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*").limit(10000);
      return [table, error ? { blad: error.message } : (data ?? [])] as const;
    }),
  );

  const dane: Record<string, unknown> = Object.fromEntries(wyniki);

  const plik = {
    aplikacja: "Grind",
    wersja_eksportu: 1,
    pobrano: new Date().toISOString(),
    konto: { id: user.id, email: user.email },
    informacja:
      "To jest komplet Twoich danych z Grinda w formacie JSON. Możesz go zachować, " +
      "przenieść gdzie indziej albo otworzyć w dowolnym edytorze. Katalog ćwiczeń " +
      "i publiczne szablony planów nie są tu ujęte, bo nie należą do Ciebie.",
    dane,
  };

  const nazwa = `grind-dane-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(plik, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nazwa}"`,
      // Kopia danych nie może wylądować w żadnym pośredniku.
      "Cache-Control": "no-store, private",
    },
  });
}
