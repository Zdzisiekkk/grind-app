import { NextResponse } from "next/server";
import { productByCode } from "@/lib/off";
import { normalizeFoodBarcode } from "@/lib/barcode";
import { createClient } from "@/lib/supabase/server";

/**
 * Produkt po kodzie kreskowym.
 *
 * Najpierw patrzymy do własnej bazy, dopiero potem do Open Food Facts.
 * Kod raz zeskanowany przez kogokolwiek leży już we wspólnym cache'u
 * (migracja 0029), więc drugi jogurt tej samej marki znajduje się bez sieci -
 * a to jest różnica między "działa w sklepie" a "działa w domu przy wifi".
 *
 * Suma kontrolna sprawdzana jest przed zapytaniem. Odczyt z wygniecionej folii
 * bywa o jedną cyfrę obok i szkoda na niego sekundy czekania.
 */
/** 200 / dzień - dużo jak na człowieka, mało jak na skrypt (migracja 0054). */
const LIMIT_DZIENNY = 200;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const { data: wolno } = await supabase.rpc("zewn_licznik_zuzyj", {
    p_kategoria: "food_kod",
    p_limit: LIMIT_DZIENNY,
  });
  if (!wolno) {
    return NextResponse.json(
      { error: "Dzienny limit skanów wyczerpany. Wróć jutro.", code: "daily_limit" },
      { status: 429 },
    );
  }

  const surowy = new URL(request.url).searchParams.get("kod")?.trim() ?? "";
  const kod = normalizeFoodBarcode(surowy);

  if (!kod) {
    return NextResponse.json(
      { error: "To nie wygląda na kod produktu. Przyłóż go jeszcze raz.", code: "zly_kod" },
      { status: 400 },
    );
  }

  // Własne i wspólne produkty naraz - RLS przepuści cudze tylko wtedy,
  // gdy user_id jest puste, czyli dla wpisów ze wspólnego cache'u.
  const { data: znane } = await supabase
    .from("foods")
    .select("*")
    .eq("off_id", kod)
    .limit(1)
    .maybeSingle();

  if (znane) return NextResponse.json({ zrodlo: "baza", food: znane, kod });

  try {
    const product = await productByCode(kod);
    if (!product) {
      return NextResponse.json(
        {
          error: "Nie znamy tego produktu - wpisz go ręcznie, zostanie u Ciebie na stałe.",
          code: "nieznany",
          kod,
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ zrodlo: "off", product, kod });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "baza produktów nie odpowiedziała na czas"
        : error instanceof Error
          ? error.message
          : "nieznany błąd";
    return NextResponse.json(
      {
        error: `Baza produktów chwilowo nie odpowiada (${message}). Dodaj produkt ręcznie.`,
        code: "off_nieczynne",
        kod,
      },
      { status: 503 },
    );
  }
}
