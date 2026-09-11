import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Kopia wszystkich swoich danych - jeden plik JSON.
 *
 * RODO daje do tego prawo (art. 20), ale to nie jedyny powód: bez eksportu
 * człowiek jest zakładnikiem aplikacji. Jeśli jutro zamknę serwer, jego dwa
 * lata treningów mają wyjść razem z nim.
 *
 * Zdjęcia ze skanów wyglądu NIE idą tędy - dokłada je przeglądarka przy
 * składaniu ZIP-a (DataControls), bo funkcja na Vercelu oddaje najwyżej
 * kilka megabajtów.
 *
 * KAŻDA tabela jest filtrowana jawnie po właścicielu, a nie tylko przez RLS.
 * Wcześniejsza wersja pytała bez filtra i zdawała się na reguły dostępu -
 * a te przepuszczają administratorowi cudze zgłoszenia i odpowiedzi,
 * a każdemu publiczne szablony planów i katalog przepisów. Eksport konta
 * administratora zawierałby wtedy cudze problemy opisane cudzymi słowami.
 */
export const maxDuration = 60;

/** Tabele z kolumną user_id. Kolejność = kolejność w pliku. */
const Z_WLASCICIELEM = [
  "plans",
  "workout_sessions",
  "workout_logs",
  "activities",
  "body_weight_logs",
  "injuries",
  "pain_logs",
  "sleep_logs",
  "sleep_naps",
  "habits",
  "habit_logs",
  "water_logs",
  "meals",
  "meal_entries",
  "foods",
  "recipes",
  "todo_lists",
  "todos",
  "books",
  "book_notes",
  "reading_logs",
  "vices",
  "vice_events",
  "glowa_dzien",
  "glowa_sesje",
  "glowa_wpisy",
  "nauka_tematy",
  "nauka_sesje",
  "nauka_powtorki",
  "cele",
  "cele_kamienie",
  "finanse_stan",
  "finanse_pozycje",
  "finanse_aktywa",
  "finanse_notowania",
  "finanse_zrodla",
  "finanse_wplywy",
  "finanse_stale",
  "finanse_naliczenia",
  "finanse_rozliczenia",
  "finanse_wydatki",
  "finanse_cele",
  "finanse_wplaty",
  "finanse_dni_zero",
  "wyglad_zgoda",
  "wyglad_skany",
  "wyglad_zdjecia",
  "wyglad_pomiary",
  "wyglad_rutyny",
  "wyglad_rutyna_log",
  "wyglad_protokoly",
  "wyglad_produkty",
  "coach_proposals",
  "coach_messages",
  "ai_plan_requests",
  "zgloszenia",
  "xp_zdarzenia",
  "bonus_plan",
  "subscriptions",
] as const;

const LIMIT = 50_000;
/** Identyfikatorów w jednym `in (...)` - dłuższy adres zapytania potrafi zostać odrzucony. */
const KAWALEK = 100;

type Wynik = unknown[] | { blad: string };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  /*
   * Klient bez typów tylko tutaj. Pętla po sześćdziesięciu nazwach tabel
   * robi z typowanego klienta sumę sześćdziesięciu typów i kompilator się
   * poddaje - a ta trasa i tak tylko przepisuje wiersze do pliku.
   */
  const db = supabase as unknown as SupabaseClient;

  const odczyt = (r: { data: unknown[] | null; error: { message: string } | null }): Wynik =>
    r.error ? { blad: r.error.message } : (r.data ?? []);

  // Wszystkie tabele naraz: przy sześćdziesięciu zapytaniach po kolei czas
  // eksportu to suma opóźnień sieci, a funkcja ma na wszystko 60 sekund.
  const [profil, ...wlasne] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).then(odczyt),
    ...Z_WLASCICIELEM.map((t) => db.from(t).select("*").eq("user_id", user.id).limit(LIMIT).then(odczyt)),
  ]);

  const dane: Record<string, Wynik> = { profiles: profil };
  Z_WLASCICIELEM.forEach((t, i) => (dane[t] = wlasne[i]));

  const idy = (t: string): string[] => {
    const v = dane[t];
    return Array.isArray(v) ? v.map((w) => (w as { id: string }).id) : [];
  };

  /** Tabele bez user_id - wyłącznie wiersze podpięte pod własne wiersze rodzica. */
  async function podrzedne(tabela: string, kolumna: string, rodzice: string[]): Promise<Wynik> {
    const wszystkie: unknown[] = [];
    for (let i = 0; i < rodzice.length; i += KAWALEK) {
      const r = await db.from(tabela).select("*").in(kolumna, rodzice.slice(i, i + KAWALEK));
      if (r.error) return { blad: r.error.message };
      wszystkie.push(...(r.data ?? []));
    }
    return wszystkie;
  }

  const [fazy, skladniki, kroki, odpowiedzi] = await Promise.all([
    podrzedne("phases", "plan_id", idy("plans")),
    podrzedne("recipe_items", "recipe_id", idy("recipes")),
    podrzedne("recipe_steps", "recipe_id", idy("recipes")),
    podrzedne("zgloszenia_odpowiedzi", "zgloszenie_id", idy("zgloszenia")),
  ]);
  dane.phases = fazy;
  dane.recipe_items = skladniki;
  dane.recipe_steps = kroki;
  dane.zgloszenia_odpowiedzi = odpowiedzi;
  dane.workout_days = await podrzedne("workout_days", "phase_id", idy("phases"));
  dane.workout_exercises = await podrzedne("workout_exercises", "workout_day_id", idy("workout_days"));

  const plik = {
    aplikacja: "Grind",
    wersja_eksportu: 2,
    pobrano: new Date().toISOString(),
    konto: { id: user.id, email: user.email },
    informacja:
      "To jest komplet Twoich danych z Grinda w formacie JSON. Możesz go zachować, " +
      "przenieść gdzie indziej albo otworzyć w dowolnym edytorze. Zdjęcia ze skanów " +
      "wyglądu są w ZIP-ie pobieranym z Profilu. Katalog ćwiczeń, katalog przepisów " +
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
