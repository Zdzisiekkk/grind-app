import { NextResponse } from "next/server";
import { searchOff } from "@/lib/off";
import { createClient } from "@/lib/supabase/server";

/** 300 / dzień - dużo jak na człowieka, mało jak na skrypt (migracja 0054). */
const LIMIT_DZIENNY = 300;

/**
 * Proxy do Open Food Facts.
 * Idzie przez serwer, a nie prosto z przeglądarki, z trzech powodów:
 * brak problemów z CORS, wymagany przez OFF nagłówek User-Agent
 * oraz wspólny cache dla wszystkich użytkowników.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const { data: wolno } = await supabase.rpc("zewn_licznik_zuzyj", {
    p_kategoria: "food_search",
    p_limit: LIMIT_DZIENNY,
  });
  if (!wolno) {
    return NextResponse.json(
      { results: [], error: "Dzienny limit wyszukiwań wyczerpany. Wróć jutro." },
      { status: 429 },
    );
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchOff(query, 20);
    return NextResponse.json({ results });
  } catch (error) {
    // Zwracamy 200 z pustą listą i miękkim komunikatem: baza produktów jest
    // dodatkiem, a nie warunkiem działania - własny produkt można dodać zawsze.
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "baza produktów nie odpowiedziała na czas"
        : error instanceof Error
          ? error.message
          : "nieznany błąd";
    return NextResponse.json({
      results: [],
      error: `Wyszukiwarka produktów chwilowo nie odpowiada (${message}). Dodaj produkt ręcznie - zostanie u Ciebie na stałe.`,
    });
  }
}
