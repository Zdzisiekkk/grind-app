import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CoachAnalysisSchema } from "@/lib/ai/coachSchema";
import { analyseDietVsWeight, findStrengthStalls, type SetRow } from "@/lib/ai/analysis";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { sleepDuration } from "@/lib/sleep";
import type { Goal } from "@/lib/nutrition";
import type { PeriodSummary } from "@/lib/database.types";

/** Analiza potrafi potrwać — dajemy zapas ponad domyślne 60 s Vercela. */
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Ile razy dziennie jedna osoba może uruchomić model.
 *
 * Subskrypcja jest stała, a każde wywołanie kosztuje — bez tego limitu jedna
 * osoba klikająca w kółko generuje rachunek za wszystkich pozostałych.
 * Dziesięć wystarcza na codzienną odprawę plus kilka pytań.
 */
const DAILY_LIMIT = 10;

const SYSTEM = `Jesteś trenerem przygotowania motorycznego i rozmawiasz po polsku z osobą, która prowadzi dziennik treningów, diety i snu.

Jak pracujesz:
1. WSZYSTKIE LICZBY, które dostajesz w sekcji FAKTY, są już policzone. Nie przeliczaj ich, nie szacuj na nowo i nie podważaj — twoim zadaniem jest je wyjaśnić i wyciągnąć wniosek.
2. Powołujesz się na konkretne liczby. „Waga stoi od trzech tygodni przy średnich 2700 kcal" zamiast „warto zadbać o dietę".
3. Proponujesz JEDNĄ zmianę naraz, najważniejszą. Człowiek, który dostaje pięć zaleceń, nie wykona żadnego.
4. Gdy fakty mówią, że problemem jest realizacja celu, a nie sam cel — mówisz to wprost i NIE proponujesz zmiany celu.
5. Gdy danych jest za mało, mówisz o tym otwarcie i podpowiadasz, co zapisywać. Nie zgadujesz.
6. Nie jesteś lekarzem ani fizjoterapeutą. Przy zgłoszonej kontuzji lub bólu odsyłasz do specjalisty i nie proponujesz obciążania bolącego miejsca.
7. Piszesz zwięźle, bezpośrednio i bez motywacyjnych ogólników. Nie chwalisz za samo pojawienie się.`;

async function guard(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Nie zalogowano." }, { status: 401 }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Trener AI nie jest jeszcze uruchomiony.", code: "missing_api_key" },
        { status: 503 },
      ),
    };
  }

  const { data: pro } = await supabase.rpc("has_pro", {});
  if (!pro) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Trener AI jest częścią wersji płatnej.", code: "needs_subscription" },
        { status: 402 },
      ),
    };
  }

  return { ok: true, supabase, userId: user.id };
}

/**
 * Odnotowanie zapytania do modelu.
 *
 * Wołane dopiero TUŻ PRZED wywołaniem modelu, a nie w bramce. Za bramką są
 * dwa wyjścia, które modelu nie dotykają: pusta wiadomość oraz skrót
 * „nic nie wymaga poprawki”, dodany właśnie po to, żeby nie płacić za
 * oczywistą odpowiedź. Zużywanie limitu w bramce znaczyło, że człowiek,
 * u którego wszystko idzie dobrze, mógł wyczerpać dziesięć zapytań,
 * nie dostawszy ani jednej analizy.
 */
async function consumeCall(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<NextResponse | null> {
  const { data: allowed } = await supabase.rpc("consume_ai_call", { p_limit: DAILY_LIMIT });
  if (allowed) return null;

  return NextResponse.json(
    {
      error: `Dzienny limit ${DAILY_LIMIT} zapytań do trenera został wyczerpany. Wróć jutro.`,
      code: "daily_limit",
    },
    { status: 429 },
  );
}

/** Wspólny błąd modelu — jeden komunikat zamiast surowego wyjątku na ekranie. */
function modelError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Nieznany błąd.";
  console.error("Trener AI:", message);

  if (error instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: "Klucz do modelu jest nieprawidłowy." }, { status: 502 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "Model jest chwilowo przeciążony. Spróbuj za minutę." },
      { status: 429 },
    );
  }
  return NextResponse.json({ error: "Trener nie odpowiedział. Spróbuj ponownie." }, { status: 502 });
}

export async function POST(request: Request) {
  const gate = await guard();
  if (!gate.ok) return gate.response;
  const { supabase, userId } = gate;

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "chat" ? "chat" : "analyze";
  const today = todayISO();

  /* ----------------------------- Zbieranie faktów ---------------------------- */

  const [{ data: profile }, { data: weights }, { data: summary }, { data: logs }, { data: injuries }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("body_weight_logs")
        .select("date, weight_kg")
        .eq("user_id", userId)
        .gte("date", addDaysISO(today, -27))
        .order("date"),
      supabase.rpc("period_summary", { p_from: addDaysISO(today, -27), p_to: today }),
      supabase
        .from("workout_logs")
        .select("date, exercise_name, catalog_exercise_id, weight_kg, reps, is_warmup")
        .eq("user_id", userId)
        .gte("date", addDaysISO(today, -55))
        .order("date")
        .limit(2000),
      supabase
        .from("injuries")
        .select("name, body_part, status")
        .eq("user_id", userId)
        .neq("status", "healed"),
    ]);

  const period = summary as PeriodSummary | null;

  const diet = analyseDietVsWeight({
    weights: (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
    goal: (profile?.goal ?? "maintain") as Goal,
    kcalGoal: profile?.daily_kcal ?? null,
    avgKcal: period?.avg_kcal || null,
    daysLogged: period?.days_logged_food ?? 0,
    periodDays: period?.days_in_period ?? 28,
  });

  const stalls = findStrengthStalls((logs ?? []) as SetRow[], today).slice(0, 3);

  const facts = [
    `Okres: ostatnie ${period?.days_in_period ?? 28} dni.`,
    `Cel: ${profile?.goal ?? "nie podano"}. Staż: ${profile?.experience ?? "nie podano"}. Sprzęt: ${profile?.equipment ?? "nie podano"}.`,
    "",
    "DIETA I WAGA (policzone przez aplikację, regresja liniowa po pomiarach wagi):",
    `- zmiana wagi: ${diet.weeklyChangeKg.toFixed(2)} kg/tydzień, z ${diet.measurements} pomiarów przez ${diet.spanDays} dni`,
    `- cel kaloryczny: ${diet.kcalGoal ?? "nie ustawiony"}, realne spożycie: ${diet.avgKcal ?? "brak danych"} kcal`,
    `- dziennik wypełniony: ${diet.daysLogged} z ${diet.periodDays} dni`,
    `- diagnoza aplikacji: ${diet.problem} — ${diet.message}`,
    diet.suggestKcal !== 0
      ? `- wyliczona korekta celu: ${diet.suggestKcal > 0 ? "+" : ""}${diet.suggestKcal} kcal`
      : "- korekta celu: nie jest potrzebna albo nie jest tym, co naprawi sytuację",
    "",
    "TRENING:",
    `- sesje: ${period?.workouts ?? 0}, serie: ${period?.sets ?? 0}, objętość: ${Math.round(period?.volume_kg ?? 0)} kg`,
    `- deklarowany cel tygodniowy: ${profile?.weekly_workouts ?? "nie podano"} treningów`,
    stalls.length
      ? stalls
          .map((s) => `- ${s.message} (${s.sessions} sesji, ${s.perWeek}/tydz., zmiana ${s.changeKg} kg)`)
          .join("\n")
      : "- nie wykryto stagnacji w żadnym ćwiczeniu",
    "",
    "SEN:",
    period?.nights_logged
      ? `- średnio ${sleepDuration(period.avg_sleep_min ?? 0)} przez ${period.nights_logged} nocy, ocena ${period.avg_sleep_quality}/5`
      : "- brak zapisanych nocy",
    "",
    "KONTUZJE:",
    (injuries ?? []).length
      ? (injuries ?? []).map((i) => `- ${i.name} (${i.body_part}, ${i.status})`).join("\n") +
        `\n- średni ból w okresie: ${period?.avg_pain ?? "brak ocen"}`
      : "- brak zgłoszonych kontuzji",
  ].join("\n");

  /* --------------------------------- Rozmowa -------------------------------- */

  if (mode === "chat") {
    const question = String(body?.message ?? "").trim();
    if (!question) return NextResponse.json({ error: "Pusta wiadomość." }, { status: 400 });

    const { data: history } = await supabase
      .from("coach_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const overLimit = await consumeCall(supabase);
    if (overLimit) return overLimit;

    try {
      const client = new Anthropic({ maxRetries: 1 });
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: 2000,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system: [
            { type: "text", text: SYSTEM },
            // Fakty zmieniają się raz dziennie, a pytań w rozmowie bywa
            // kilkanaście — dlatego trafiają do pamięci podręcznej.
            {
              type: "text",
              text: `FAKTY O UŻYTKOWNIKU:\n${facts}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            ...[...(history ?? [])].reverse().map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user" as const, content: question },
          ],
        },
        { timeout: 110_000 },
      );

      if (response.stop_reason === "refusal") {
        return NextResponse.json(
          { error: "Model nie chce odpowiedzieć na to pytanie." },
          { status: 422 },
        );
      }

      const answer = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      // Pytanie i odpowiedź zapisujemy RAZEM, po udanym wywołaniu. Zapis pytania
      // przed wywołaniem zostawiał po nieudanej próbie sierotę: wiadomość bez
      // odpowiedzi, na którą trener już nigdy nie odpowie, a przy następnym
      // pytaniu do modelu szły dwie wiadomości użytkownika pod rząd.
      await supabase.from("coach_messages").insert([
        { user_id: userId, role: "user", content: question },
        { user_id: userId, role: "assistant", content: answer },
      ]);
      return NextResponse.json({ answer });
    } catch (error) {
      return modelError(error);
    }
  }

  /* --------------------------------- Analiza -------------------------------- */

  // Gdy nie ma o czym mówić, NIE wołamy modelu. Wywołanie kosztuje przy każdym
  // użyciu, a „wszystko idzie dobrze" umiemy stwierdzić sami.
  if (diet.problem === "none" && stalls.length === 0) {
    return NextResponse.json({
      summary:
        "Nic nie wymaga poprawki: waga idzie w zaplanowanym tempie, a żadne ćwiczenie nie stoi w miejscu. Rób dalej to samo.",
      proposals: [],
      skippedModel: true,
    });
  }

  const overLimit = await consumeCall(supabase);
  if (overLimit) return overLimit;

  try {
    const client = new Anthropic({ maxRetries: 1 });
    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: zodOutputFormat(CoachAnalysisSchema) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Przeanalizuj mój ostatni okres i zaproponuj najwyżej trzy zmiany.\n\nFAKTY:\n${facts}`,
          },
        ],
      },
      { timeout: 110_000 },
    );

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Model odmówił wykonania analizy." }, { status: 422 });
    }

    const analysis = response.parsed_output;
    if (!analysis) {
      return NextResponse.json(
        { error: "Model nie zwrócił analizy w oczekiwanym formacie." },
        { status: 502 },
      );
    }

    // Wcześniejsze oczekujące propozycje przestają być aktualne — nowa analiza
    // patrzy na świeższe dane. Ale ich NIE kasujemy: „miesiąc temu trener kazał
    // zejść o 200 kcal, zrobiłeś to, waga ruszyła" to jedyna rzecz, której
    // trener nie umiał powiedzieć o samym sobie, choć ma na to wszystkie dane.
    // Dostają status 'superseded' i zostają w historii (migracja 0033).
    await supabase.rpc("supersede_coach_proposals", {});

    if (analysis.proposals.length > 0) {
      await supabase.from("coach_proposals").insert(
        analysis.proposals.map((p) => ({
          user_id: userId,
          kind: p.kind,
          title: p.title,
          rationale: p.rationale,
          facts: {
            weeklyChangeKg: diet.weeklyChangeKg,
            avgKcal: diet.avgKcal,
            kcalGoal: diet.kcalGoal,
            stalls: stalls.map((s) => s.exercise),
          },
          // Propozycja zmiany kalorii dostaje konkretną liczbę do zastosowania;
          // rady treningowe nie zmieniają niczego automatycznie.
          action: p.kind === "diet_kcal" && p.daily_kcal ? { daily_kcal: p.daily_kcal } : {},
        })),
      );
    }

    return NextResponse.json({ summary: analysis.summary, proposals: analysis.proposals });
  } catch (error) {
    return modelError(error);
  }
}
