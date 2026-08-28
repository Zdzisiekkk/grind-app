import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Zapisuje wcześniej wygenerowany plan do bazy.
 *
 * Treść bierzemy z ai_plan_requests, a nie z ciała żądania — dzięki temu klient
 * nie może podmienić planu na coś, czego model nie zwrócił.
 *
 * Cały zapis robi jedna funkcja w bazie (migracja 0032). Wcześniej była tu
 * pętla: osobne zapytanie na plan, na każdą fazę, na każdy dzień i na
 * ćwiczenia — ponad trzydzieści obiegów bez transakcji, z błędami mijanymi
 * przez `continue`. Plan z brakującymi dniami potrafił zostać planem aktywnym
 * i nic o tym nie mówiło. Teraz Postgres daje transakcję: albo wszystko,
 * albo nic.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { requestId?: string } | null;
  if (!body?.requestId) {
    return NextResponse.json({ error: "Brak identyfikatora wygenerowanego planu." }, { status: 400 });
  }

  const { data: planId, error } = await supabase.rpc("save_ai_plan", {
    p_request_id: body.requestId,
  });

  if (error) {
    // P0002 = funkcja nie znalazła zgłoszenia (albo należy do kogoś innego,
    // bo RLS je wtedy ukrywa). To nie jest awaria serwera.
    if (error.code === "P0002") {
      return NextResponse.json({ error: "Nie znaleziono wygenerowanego planu." }, { status: 404 });
    }
    if (error.code === "22023") {
      return NextResponse.json(
        { error: "Wygenerowany plan ma nieprawidłowy format." },
        { status: 422 },
      );
    }
    console.error("Zapis planu AI:", error.message);
    return NextResponse.json(
      { error: "Nie udało się zapisać planu. Spróbuj ponownie." },
      { status: 500 },
    );
  }

  return NextResponse.json({ planId });
}
