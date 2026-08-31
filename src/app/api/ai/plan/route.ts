import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  AiPlanWireSchema,
  EXPERIENCE_LABEL,
  PlanRequestSchema,
  normalizujPlan,
} from "@/lib/ai/planSchema";
import { rezerwuj, rozlicz, zwolnij } from "@/lib/ai/budzet";
import { createClient } from "@/lib/supabase/server";

/** Układanie planu potrafi potrwać - dajemy zapas ponad domyślne 60 s Vercela. */
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/** Wspólny z trenerem dzienny limit wywołań modelu na konto. */
const DAILY_LIMIT = 10;

const SYSTEM = `Jesteś doświadczonym trenerem przygotowania motorycznego. Układasz plany treningowe po polsku.

Zasady, których nie łamiesz:
1. Każde ćwiczenie wybierasz z KATALOGU podanego przez użytkownika i przepisujesz jego "slug" dokładnie tak, jak w katalogu. Tylko jeśli w katalogu naprawdę nie ma odpowiednika, zostawiasz slug pusty i podajesz samą nazwę po polsku.
2. Liczba dni treningowych w planie musi zgadzać się z deklarowaną liczbą dni w tygodniu.
3. Objętość dopasowujesz do zadeklarowanego czasu sesji - licz około 3-4 minuty na serię razem z przerwą.
4. Ograniczenia zdrowotne traktujesz priorytetowo. Dla każdej zgłoszonej kontuzji w dniach, które ją obciążają, ustawiasz tracks_pain na true, a ćwiczenia dobierasz tak, żeby jej nie prowokować. Przy kontuzji kolana unikasz głębokich przysiadów i plyometrii, przy barku - wyciskania zza głowy i dipów, przy dolnym odcinku pleców - martwego ciągu z podłogi i skłonów z obciążeniem, dopóki nie ma mowy o zgodzie fizjoterapeuty.
5. Używasz wyłącznie sprzętu, który użytkownik ma do dyspozycji.
6. Ćwiczenia w dniu układasz w sensownej kolejności: najpierw złożone i najcięższe, potem izolowane, na końcu core i mobilność.
7. Nie jesteś fizjoterapeutą ani lekarzem. Przy zgłoszonej kontuzji zaznaczasz w coach_notes, żeby skonsultować plan ze specjalistą.

Piszesz zwięźle i konkretnie. Bez motywacyjnych ogólników.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "AI-trener nie jest jeszcze skonfigurowany. Dodaj zmienną środowiskową ANTHROPIC_API_KEY " +
          "(klucz z console.anthropic.com) w ustawieniach projektu na Vercel albo w pliku .env.local, " +
          "a potem zrestartuj aplikację.",
        code: "missing_api_key",
      },
      { status: 503 },
    );
  }

  // Układanie planu przez model kosztuje realne pieniądze na koncie Anthropic,
  // a aplikacja jest publiczna. Bez tej bramki każde świeżo założone konto
  // generowało plany na cudzy rachunek - sprawdzone, tak właśnie było.
  const { data: pro } = await supabase.rpc("has_pro", {});
  if (!pro) {
    return NextResponse.json(
      { error: "Układanie planu przez AI jest częścią wersji płatnej.", code: "needs_subscription" },
      { status: 402 },
    );
  }

  // Ten sam dzienny licznik, co u trenera - jedno konto nie wyczerpie budżetu
  // w kwadrans, nawet mając subskrypcję.
  const { data: allowed } = await supabase.rpc("consume_ai_call", { p_limit: DAILY_LIMIT });
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Dzienny limit ${DAILY_LIMIT} zapytań do AI został wyczerpany. Wróć jutro.`,
        code: "daily_limit",
      },
      { status: 429 },
    );
  }

  // I ten sam miesięczny budżet. Plan jest najdroższą rzeczą w aplikacji -
  // około 3500 tokenów wyjścia - więc rezerwacja jest pięć razy większa niż
  // przy pytaniu do trenera. Bez tego dziesięć planów dziennie mieściłoby się
  // w limicie wywołań i zjadało budżet miesiąca w jedno popołudnie.
  const limit = await rezerwuj(supabase, "plan");
  if (!limit.ok) return limit.response;

  const parsedInput = PlanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedInput.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }
  const input = parsedInput.data;

  // Katalog trafia do promptu, żeby model wybierał z realnie istniejących ćwiczeń.
  const { data: catalog } = await supabase
    .from("exercise_catalog")
    .select("slug, name, muscle_group, equipment, metric, source")
    .not("slug", "is", null)
    .order("source")
    .limit(600);

  const catalogText = (catalog ?? [])
    .map(
      (e) =>
        `${e.slug} | ${e.name} | ${e.muscle_group ?? "-"} | ${e.equipment.join(", ") || "-"} | ${e.metric}`,
    )
    .join("\n");

  const { data: logRow } = await supabase
    .from("ai_plan_requests")
    .insert({ user_id: user.id, input, model: MODEL, status: "pending" })
    .select("id")
    .single();

  try {
    /*
     * Bez ponowień - nie ma na nie budżetu czasu.
     *
     * Funkcja żyje 300 s, a jedno wywołanie ma 280 s limitu.
     * Druga próba po timeoucie nigdy się nie zmieści: platforma ubije funkcję
     * w połowie, a przeglądarka dostanie surowy błąd zamiast naszego
     * komunikatu. Przeciążenie modelu i tak wraca osobnym zdaniem.
     */
    const client = new Anthropic({ maxRetries: 0 });

    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 16000,
        system: [
          {
            type: "text",
            text: SYSTEM,
          },
          {
            type: "text",
            text: `KATALOG ĆWICZEŃ (slug | nazwa | partia | sprzęt | metryka zapisu):\n${catalogText}`,
            // Katalog jest ten sam przy każdym generowaniu - trzymamy go w cache'u.
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              "Ułóż dla mnie plan treningowy.",
              `Cel: ${input.goal}`,
              `Doświadczenie: ${EXPERIENCE_LABEL[input.experience]}`,
              `Dni treningowych w tygodniu: ${input.days_per_week}`,
              `Czas pojedynczej sesji: około ${input.session_minutes} minut`,
              `Dostępny sprzęt: ${input.equipment.length ? input.equipment.join(", ") : "brak informacji"}`,
              `Ograniczenia i kontuzje: ${input.limitations.trim() || "brak"}`,
            ].join("\n"),
          },
        ],
        output_config: { format: zodOutputFormat(AiPlanWireSchema) },
      },
      { timeout: 280_000 },
    );

    await rozlicz(supabase, limit.id, "plan", MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      throw new Error("Model odmówił wykonania tego zadania.");
    }

    if (!response.parsed_output) throw new Error("Model nie zwrócił planu w oczekiwanym formacie.");

    // Limity ze schematu nie wiążą modelu (patrz src/lib/ai/limity.ts), więc
    // dociskamy je tutaj. Dzień bez ćwiczeń albo faza bez dni wypada - taki
    // plan i tak nie dałby się wykonać, a w bazie zostawiłby puste gałęzie.
    const draft = normalizujPlan(response.parsed_output);
    if (draft.phases.length === 0) {
      throw new Error("Model nie zwrócił żadnego wykonalnego dnia treningowego.");
    }

    if (logRow) {
      await supabase
        .from("ai_plan_requests")
        .update({ output: draft, status: "ok" })
        .eq("id", logRow.id);
    }

    return NextResponse.json({ requestId: logRow?.id ?? null, draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd.";

    // Plan się nie ułożył - rezerwacja idzie z powrotem do budżetu.
    await zwolnij(supabase, limit.id);

    if (logRow) {
      await supabase
        .from("ai_plan_requests")
        .update({ status: "error", error: message })
        .eq("id", logRow.id);
    }

    const status =
      error instanceof Anthropic.AuthenticationError
        ? 401
        : error instanceof Anthropic.RateLimitError
          ? 429
          : 502;

    const friendly =
      error instanceof Anthropic.AuthenticationError
        ? "Klucz ANTHROPIC_API_KEY jest nieprawidłowy."
        : error instanceof Anthropic.RateLimitError
          ? "Zbyt wiele zapytań do AI. Spróbuj za chwilę."
          : `Nie udało się ułożyć planu: ${message}`;

    return NextResponse.json({ error: friendly }, { status });
  }
}
