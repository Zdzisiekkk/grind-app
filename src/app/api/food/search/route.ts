import { NextResponse } from "next/server";
import { searchOff } from "@/lib/off";
import { getUser } from "@/lib/supabase/server";

/**
 * Proxy do Open Food Facts.
 * Idzie przez serwer, a nie prosto z przeglądarki, z trzech powodów:
 * brak problemów z CORS, wymagany przez OFF nagłówek User-Agent
 * oraz wspólny cache dla wszystkich użytkowników.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchOff(query, 20);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd";
    return NextResponse.json(
      { error: `Nie udało się połączyć z bazą produktów: ${message}`, results: [] },
      { status: 502 },
    );
  }
}
