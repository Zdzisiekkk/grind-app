import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Rozpoczęcie skanu - rezerwacja miejsca, zanim polecą zdjęcia.
 *
 * Zdjęcia lądują w kubełku pod ścieżką `<user>/<skanId>/<ujecie>.jpg`, więc
 * identyfikator skanu musi istnieć PRZED wysyłką. Wymyślanie go po stronie
 * przeglądarki znaczyłoby, że limit skanów sprawdzamy dopiero po tym, jak
 * ktoś już zapłacił transferem za trzy zdjęcia - i po tym, jak pliki wylądowały
 * w kubełku bez wiersza, który by o nich wiedział.
 *
 * Limity pilnuje baza (polityka `wyglad_skany_limit`), więc odmowa jest tutaj
 * tylko po to, żeby napisać po ludzku, dlaczego się nie da.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const { data: pro } = await supabase.rpc("has_pro", {});
  if (!pro) {
    return NextResponse.json(
      { error: "Skan wyglądu jest częścią wersji płatnej.", code: "needs_subscription" },
      { status: 402 },
    );
  }

  const { data: zgoda } = await supabase
    .from("wyglad_zgoda")
    .select("wiek_potwierdzony")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!zgoda?.wiek_potwierdzony) {
    return NextResponse.json(
      { error: "Najpierw potwierdź wiek i zapoznaj się z zastrzeżeniem.", code: "brak_zgody" },
      { status: 403 },
    );
  }

  const { data: limit } = await supabase.rpc("wyglad_limit", {});
  const stan = (limit ?? {}) as { mozna?: boolean; powod?: string; nastepny_od?: string; limit_miesiaca?: number };

  if (!stan.mozna) {
    return NextResponse.json(
      {
        error:
          stan.powod === "limit_miesiaca"
            ? `Wykorzystałeś wszystkie ${stan.limit_miesiaca ?? 5} skany w tym miesiącu.`
            : "Na kolejny skan jest za wcześnie - zmiany widać dopiero po tygodniu.",
        code: stan.powod === "limit_miesiaca" ? "limit_miesiaca" : "za_wczesnie",
        nastepny_od: stan.nastepny_od,
      },
      { status: 429 },
    );
  }

  const { data: skan, error } = await supabase
    .from("wyglad_skany")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !skan) {
    return NextResponse.json({ error: "Nie udało się rozpocząć skanu." }, { status: 500 });
  }

  return NextResponse.json({ skanId: skan.id });
}
