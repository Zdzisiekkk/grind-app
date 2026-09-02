import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { WygladWireSchema, normalizujAnalize } from "@/lib/ai/wygladSchema";
import { rezerwuj, rozlicz, zwolnij } from "@/lib/ai/budzet";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { sleepDuration } from "@/lib/sleep";
import type { PeriodSummary, PoraDnia } from "@/lib/database.types";

/** Analiza obrazu trwa dłużej niż tekst - dajemy zapas ponad domyślne 60 s. */
export const maxDuration = 120;

/*
 * Osobna zmienna niż trener.
 *
 * Trener rozumuje na liczbach i zostaje na Opusie. Skan w dużej mierze polega
 * na opisaniu tego, co widać na zdjęciu - a analiza obrazu jest wielokrotnie
 * droższa od tekstu. Jeden model dla obu znaczyłby, że nie da się potanieć
 * tam, gdzie to nic nie kosztuje jakościowo.
 */
const MODEL = process.env.ANTHROPIC_MODEL_WYGLAD || "claude-sonnet-5";

/*
 * Świadomie NIE wołamy tu `consume_ai_call`.
 *
 * Ten licznik jest wspólny z trenerem i ma limit dzienny. Skan ma własne,
 * ostrzejsze ograniczenia w bazie (odstęp 7 dni, 5 w miesiącu), więc dokładanie
 * go do puli trenera odbierałoby pytania komuś, kto raz w tygodniu zrobił
 * zdjęcie - bez żadnego zysku dla rachunku.
 */

const SYSTEM = `Jesteś doświadczonym konsultantem wizerunku i pielęgnacji, rozmawiasz po polsku z osobą, która sama poprosiła o ocenę swojego wyglądu i prowadzi w aplikacji dziennik treningu, diety, snu i nawyków.

Jak pracujesz:
1. Oceniasz WYŁĄCZNIE to, co widać na zdjęciu i co wynika z liczb w sekcji FAKTY. Nie zgadujesz wieku, pochodzenia, statusu ani charakteru.
2. Każda podocena musi mieć konkretną obserwację. "Cienie podoczodołowe i lekki obrzęk powiek" zamiast "zmęczony wygląd".
3. Wszystkie liczby w FAKTACH są już policzone. Nie przeliczaj ich - wyjaśnij je i połącz z tym, co widzisz. Jeżeli widzisz stan skóry, a FAKTY mówią o 5h snu i alkoholu 3× w tygodniu, powiedz to wprost.
4. Plan zawiera maksymalnie sześć zaleceń, uszeregowanych po realnym wpływie. Podajesz uczciwy horyzont czasowy: pielęgnacja skóry 8-12 tygodni, skład ciała 12-24 tygodnie, włosy 16+ tygodni.
5. Mewing i ćwiczenia mięśni twarzy opisujesz uczciwie: to praca nad postawą języka, żuchwy i szyi. U dorosłych nie przebudowują kości - dają umiarkowaną poprawę napięcia i linii żuchwy, zwłaszcza przy niskim poziomie tkanki tłuszczowej. Nie obiecujesz zmiany budowy czaszki.
6. NIGDY nie proponujesz: zabiegów chirurgicznych, sterydów anaboliczno-androgennych, leków na receptę, głodówek, "bone smashing" ani żadnego urazu zadawanego celowo. Przy podejrzeniu problemu medycznego (nasilony trądzik, gwałtowne wypadanie włosów, zmiana barwnikowa) piszesz jedno zdanie o wizycie u dermatologa i przechodzisz dalej.
6a. Zęby oceniasz WYŁĄCZNIE kosmetycznie i tylko to, co faktycznie widać na zdjęciu ze zdjęcia "zeby" - odcień/przebarwienia, kamień nazębny widoczny gołym okiem, ewentualnie w oczy rzucającą się nierówność ustawienia. Nigdy nie diagnozujesz próchnicy, chorób dziąseł ani wad zgryzu - to nie jest zdjęcie rentgenowskie ani badanie stomatologiczne. Rekomendacje ograniczasz do higieny (szczotkowanie, nić, płukanka) i kosmetycznego wybielania pastą/paskami; przy czymkolwiek, co wygląda niepokojąco (widoczny stan zapalny dziąseł, ubytek), piszesz jedno zdanie o wizycie u dentysty i przechodzisz dalej. Brak zdjęcia "zeby" znaczy: nie oceniasz zębów wcale, nie zgadujesz na podstawie zdjęcia "front" z zamkniętymi ustami.
7. Nie porównujesz użytkownika do innych ludzi ani do żadnych "średnich". Punktem odniesienia jest wyłącznie jego własny poprzedni skan.
8. Gdy zdjęcie jest złej jakości (prześwietlone, rozmyte, w cieniu, twarz częściowo zasłonięta), ustawiasz jakosc_zdjecia.wystarczajaca = false, obniżasz pewność ocen i mówisz, co poprawić. Nie zmyślasz obserwacji, których nie widać.
9. Piszesz zwięźle i bezpośrednio. Bez motywacyjnych ogólników, bez komplementów z grzeczności i bez straszenia.
10. Każde zalecenie dostaje stały klucz (małe litery i podkreślenia). Ten sam nawyk przy kolejnym skanie ma dostać TEN SAM klucz, żeby lista wieczorna się nie rozmnażała.`;

const UJECIE_OPIS: Record<string, string> = {
  front: "twarz na wprost",
  zeby: "twarz na wprost, uśmiech - zdjęcie zrobione specjalnie pod ocenę zębów",
  profil: "twarz z profilu",
  sylwetka: "sylwetka",
};

function modelError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Nieznany błąd.";

  /*
   * Nazwa klasy błędu w logu, nie sam komunikat.
   *
   * Przez ten log przewijał się miesiąc "Analiza się nie udała": za każdym
   * razem winna była walidacja odpowiedzi, ale w logu stała tylko treść
   * wyjątku, więc wyglądało to jak losowa awaria modelu. Klasa błędu
   * rozstrzyga to jednym słowem.
   */
  console.error(`Skan wyglądu [${error?.constructor?.name ?? "?"}]:`, message);

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return NextResponse.json(
      { error: "Model nie odpowiedział na czas. Spróbuj jeszcze raz." },
      { status: 504 },
    );
  }

  if (error instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: "Klucz do modelu jest nieprawidłowy." }, { status: 502 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "Model jest chwilowo przeciążony. Spróbuj za minutę." },
      { status: 429 },
    );
  }
  return NextResponse.json({ error: "Analiza się nie udała. Spróbuj ponownie." }, { status: 502 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Skan wyglądu nie jest jeszcze uruchomiony.", code: "missing_api_key" },
      { status: 503 },
    );
  }

  const { data: pro } = await supabase.rpc("has_pro", {});
  if (!pro) {
    return NextResponse.json(
      { error: "Skan wyglądu jest częścią wersji płatnej.", code: "needs_subscription" },
      { status: 402 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const skanId = String(body?.skanId ?? "");
  if (!skanId) return NextResponse.json({ error: "Brak identyfikatora skanu." }, { status: 400 });

  /* ------------------------------ Zdjęcia ---------------------------------- */

  // RLS pilnuje, żeby to był własny skan - nie trzeba sprawdzać drugi raz.
  const { data: zdjecia } = await supabase
    .from("wyglad_zdjecia")
    .select("ujecie, storage_path")
    .eq("skan_id", skanId);

  if (!zdjecia?.length) {
    return NextResponse.json({ error: "Ten skan nie ma zdjęć." }, { status: 404 });
  }

  const obrazy: Array<{ ujecie: string; base64: string }> = [];
  for (const z of zdjecia) {
    const { data: signed } = await supabase.storage
      .from("wyglad")
      .createSignedUrl(z.storage_path, 120);
    if (!signed?.signedUrl) continue;

    const odpowiedz = await fetch(signed.signedUrl);
    if (!odpowiedz.ok) continue;
    const bytes = Buffer.from(await odpowiedz.arrayBuffer());
    obrazy.push({ ujecie: z.ujecie, base64: bytes.toString("base64") });
  }

  if (obrazy.length === 0) {
    return NextResponse.json({ error: "Nie udało się odczytać zdjęć." }, { status: 500 });
  }

  /* ------------------------------- Fakty ----------------------------------- */

  const today = todayISO();
  const [{ data: summary }, { data: weights }, { data: vices }, { data: poprzedni }] =
    await Promise.all([
      supabase.rpc("period_summary", { p_from: addDaysISO(today, -13), p_to: today }),
      supabase
        .from("body_weight_logs")
        .select("date, weight_kg")
        .eq("user_id", user.id)
        .gte("date", addDaysISO(today, -27))
        .order("date"),
      supabase.from("vices").select("name, started_at").eq("user_id", user.id).eq("is_archived", false),
      supabase
        .from("wyglad_skany")
        .select("utworzono, ocena_ogolna, oceny")
        .eq("user_id", user.id)
        .neq("id", skanId)
        .not("ocena_ogolna", "is", null)
        .order("utworzono", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const period = summary as PeriodSummary | null;
  const wagi = (weights ?? []).map((w) => Number(w.weight_kg));
  const trendWagi =
    wagi.length >= 2 ? (wagi[wagi.length - 1] - wagi[0]).toFixed(1) : null;

  const facts = [
    "SEN (ostatnie 14 dni):",
    period?.nights_logged
      ? `- średnio ${sleepDuration(period.avg_sleep_min ?? 0)} przez ${period.nights_logged} nocy, ocena jakości ${period.avg_sleep_quality}/5`
      : "- brak zapisanych nocy",
    "",
    "DIETA I WAGA:",
    period?.avg_kcal ? `- średnio ${Math.round(period.avg_kcal)} kcal dziennie` : "- brak zapisanych posiłków",
    wagi.length
      ? `- waga: ${wagi[wagi.length - 1]} kg, zmiana przez 4 tygodnie: ${trendWagi ?? "za mało pomiarów"} kg`
      : "- brak pomiarów wagi",
    "",
    "NAWODNIENIE:",
    period?.avg_water_ml ? `- średnio ${Math.round(period.avg_water_ml)} ml dziennie` : "- brak zapisów",
    "",
    "NAŁOGI (aktywnie rzucane):",
    (vices ?? []).length
      ? (vices ?? []).map((v) => `- ${v.name}, rzucone ${String(v.started_at).slice(0, 10)}`).join("\n")
      : "- brak",
    "",
    "POPRZEDNI SKAN:",
    poprzedni
      ? `- ${String(poprzedni.utworzono).slice(0, 10)}, ocena ogólna ${poprzedni.ocena_ogolna}/100, podoceny: ${JSON.stringify(poprzedni.oceny)}`
      : "- to jest pierwszy skan, nie ma do czego porównać",
  ].join("\n");

  /* -------------------------------- Model ---------------------------------- */

  const tresc: Anthropic.ContentBlockParam[] = [
    ...obrazy.flatMap((o): Anthropic.ContentBlockParam[] => [
      { type: "text", text: `Zdjęcie: ${UJECIE_OPIS[o.ujecie] ?? o.ujecie}.` },
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: o.base64 },
      },
    ]),
    {
      type: "text",
      text: `Oceń mój wygląd na podstawie tych zdjęć i podaj plan.\n\nFAKTY:\n${facts}`,
    },
  ];

  /*
   * Skan trafia do tego samego rejestru kosztów co trener, ale NIE zjada jego
   * budżetu (`liczone` w app_settings, migracja 0043). Ma własne, ostrzejsze
   * ograniczenia - odstęp 7 dni i 5 skanów miesięcznie, czyli około 1,40 zł -
   * więc wliczanie go do puli trenera odbierałoby pytania komuś, kto raz
   * w tygodniu zrobił zdjęcie. Zapisujemy go po to, żeby rachunek za AI dało
   * się zobaczyć w całości, a nie w kawałkach.
   */
  const limit = await rezerwuj(supabase, "wyglad");
  if (!limit.ok) return limit.response;

  let analiza;
  try {
    /*
     * Bez ponowień - nie ma na nie budżetu czasu.
     *
     * Funkcja żyje 120 s (maxDuration), a jedno wywołanie ma 110 s limitu.
     * Ponowienie po timeoucie nigdy się nie zmieści: platforma ubije funkcję
     * w połowie i przeglądarka dostanie błąd sieci zamiast naszego komunikatu.
     * Przeciążenie modelu i tak wraca do użytkownika osobnym zdaniem.
     */
    const client = new Anthropic({ maxRetries: 0 });
    const response = await client.messages.parse(
      {
        model: MODEL,
        /*
         * Dużo więcej niż u trenera i nie bez powodu.
         *
         * Pierwsze prawdziwe skany wywalały się na "Unterminated string in
         * JSON": model nie zdążył domknąć odpowiedzi przed limitem i parser
         * dostawał urwany tekst. Ten schemat jest po prostu duży - do dziewięciu
         * podocen z obserwacjami i do sześciu zaleceń po sześć kroków, wszystko
         * po polsku - a przy myśleniu adaptacyjnym rozumowanie liczy się do tego
         * samego limitu. Cięcie tego kosztuje jeden nieudany skan z limitu
         * pięciu miesięcznie, więc zapas jest tańszy niż oszczędność.
         */
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: zodOutputFormat(WygladWireSchema) },
        system: SYSTEM,
        messages: [{ role: "user", content: tresc }],
      },
      { timeout: 110_000 },
    );

    await rozlicz(supabase, limit.id, "wyglad", MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Model odmówił oceny tych zdjęć." }, { status: 422 });
    }

    // Osobny komunikat, bo "spróbuj ponownie" przy uciętej odpowiedzi jest radą
    // donikąd - powtórka skończy się tak samo, dopóki limit się nie zmieni.
    if (response.stop_reason === "max_tokens") {
      console.error("Skan wyglądu: odpowiedź ucięta na limicie tokenów");
      return NextResponse.json(
        { error: "Model nie zmieścił się z odpowiedzią. Zgłoś to - limit wymaga podniesienia." },
        { status: 502 },
      );
    }

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Model nie zwrócił oceny w oczekiwanym formacie." },
        { status: 502 },
      );
    }

    /*
     * Przycięcie do limitów robimy tutaj, a nie schematem.
     *
     * Ograniczenia Zoda nie trafiają do gramatyki modelu - `zodOutputFormat`
     * przenosi je do opisu pola. Waliduje je za to `messages.parse()`, więc
     * obserwacja dłuższa o jeden znak wywracała CAŁĄ analizę, już po zapłaceniu
     * za wywołanie. Teraz odpowiedź jest sprowadzana do limitów zamiast
     * odrzucana. Szczegóły w komentarzu przy `normalizujAnalize`.
     */
    analiza = normalizujAnalize(response.parsed_output);
  } catch (error) {
    await zwolnij(supabase, limit.id);
    return modelError(error);
  }

  /*
   * Po normalizacji może zostać mniej pozycji, niż obiecuje ekran (nieznany
   * klucz podoceny albo zalecenie bez tytułu wypada). Raport z jedną oceną
   * i bez planu nie jest wart zapisania jako skan - lepiej powiedzieć wprost,
   * że trzeba powtórzyć.
   */
  if (analiza.podoceny.length < 3 || analiza.plan.length < 1) {
    console.error(
      `Skan wyglądu: po normalizacji za mało treści (podoceny: ${analiza.podoceny.length}, plan: ${analiza.plan.length})`,
    );
    return NextResponse.json(
      { error: "Model nie zwrócił pełnej oceny. Spróbuj jeszcze raz." },
      { status: 502 },
    );
  }

  /* -------------------------------- Zapis ---------------------------------- */

  const oceny = Object.fromEntries(analiza.podoceny.map((p) => [p.klucz, p.ocena]));

  await supabase
    .from("wyglad_skany")
    .update({
      ocena_ogolna: analiza.ocena_ogolna,
      oceny,
      raport: analiza,
      jakosc_ok: analiza.jakosc_zdjecia.wystarczajaca,
      model: MODEL,
    })
    .eq("id", skanId);

  /*
   * Rutyny z planu - upsert po kluczu, nigdy insert.
   *
   * Zalecenie "wieczorny retinoid" wraca przy każdym skanie. Bez klucza po
   * pięciu skanach lista wieczorna miałaby pięć prawie identycznych pozycji
   * i nikt by jej nie otworzył. Rutyn stworzonych ręcznie nie ruszamy -
   * upsert dotyczy wyłącznie tych ze źródłem 'ai'.
   */
  const doRutyn = analiza.plan.filter((z) =>
    ["pielegnacja", "zeby", "nawyki", "fryzura"].includes(z.kategoria),
  );

  if (doRutyn.length) {
    const { data: wlasne } = await supabase
      .from("wyglad_rutyny")
      .select("klucz, zrodlo")
      .eq("user_id", user.id)
      .neq("zrodlo", "ai");
    const nieRuszaj = new Set((wlasne ?? []).map((r) => r.klucz));

    const wiersze = doRutyn
      .filter((z) => !nieRuszaj.has(z.klucz))
      .map((z) => ({
        user_id: user.id,
        klucz: z.klucz,
        nazwa: z.tytul,
        pora: (z.czestotliwosc.toLowerCase().includes("rano") ? "rano" : "wieczor") as PoraDnia,
        kroki: z.jak,
        zrodlo: "ai" as const,
        aktywna: true,
      }));

    if (wiersze.length) {
      await supabase.from("wyglad_rutyny").upsert(wiersze, { onConflict: "user_id,klucz" });
    }
  }

  /*
   * Protokołów NIE włączamy automatycznie.
   *
   * Mewing i ćwiczenia twarzy to zobowiązanie na kilka miesięcy. Włączone bez
   * pytania stają się listą, której nikt nie wybrał - a passa, której się nie
   * zaczęło świadomie, nic nie znaczy. Raport pokazuje przycisk "Włącz protokół"
   * i to jest właściwe miejsce na tę decyzję.
   */

  return NextResponse.json({ skanId, analiza });
}
