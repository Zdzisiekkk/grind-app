import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  PODOCENA_ETYKIETA,
  PODOCENA_KLUCZE,
  WYMAGANE_UJECIE,
  WygladWireSchema,
  normalizujAnalize,
  type PodocenaKlucz,
} from "@/lib/ai/wygladSchema";
import { rezerwuj, rozlicz, zwolnij } from "@/lib/ai/budzet";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import { sleepDuration } from "@/lib/sleep";
import type { PeriodSummary, PoraDnia, Ujecie, WygladLimit } from "@/lib/database.types";

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

/** Wersja promptu zapisywana przy skanie. 2 = porównanie ze zdjęciami poprzedniego skanu. */
const WERSJA_PROMPTU = 2;

/**
 * Skan młodszy niż tyle jest "w toku" - jego limit sprawdziła trasa startowa.
 * Ta sama wartość co w wyglad_limit() (migracja 0078).
 */
const SKAN_W_TOKU_MS = 15 * 60_000;

/*
 * Świadomie NIE wołamy tu `consume_ai_call`.
 *
 * Ten licznik jest wspólny z trenerem i ma limit dzienny. Skan ma własne,
 * ostrzejsze ograniczenia w bazie (odstęp 7 dni, pula miesięczna), więc
 * dokładanie go do puli trenera odbierałoby pytania komuś, kto raz w tygodniu
 * zrobił zdjęcie - bez żadnego zysku dla rachunku.
 */

const SYSTEM = `Jesteś doświadczonym konsultantem wizerunku i pielęgnacji, rozmawiasz po polsku z osobą, która sama poprosiła o ocenę swojego wyglądu i prowadzi w aplikacji dziennik treningu, diety, snu i nawyków.

Jak pracujesz:
1. Oceniasz WYŁĄCZNIE to, co widać na zdjęciu i co wynika z liczb w sekcji FAKTY. Nie zgadujesz wieku, pochodzenia, statusu ani charakteru.
2. Każda podocena musi mieć konkretną obserwację. "Cienie podoczodołowe i lekki obrzęk powiek" zamiast "zmęczony wygląd".
3. Wszystkie liczby w FAKTACH są już policzone. Nie przeliczaj ich - wyjaśnij je i połącz z tym, co widzisz. Jeżeli widzisz stan skóry, a FAKTY mówią o 5h snu i alkoholu 3× w tygodniu, powiedz to wprost.
4. Plan zawiera maksymalnie sześć zaleceń, uszeregowanych po realnym wpływie. Podajesz uczciwy horyzont czasowy: pielęgnacja skóry 8-12 tygodni, skład ciała 12-24 tygodnie, włosy 16+ tygodni.
5. Mewing i ćwiczenia mięśni twarzy opisujesz uczciwie: to praca nad postawą języka, żuchwy i szyi. U dorosłych nie przebudowują kości - dają umiarkowaną poprawę napięcia i linii żuchwy, zwłaszcza przy niskim poziomie tkanki tłuszczowej. Nie obiecujesz zmiany budowy czaszki.
6. NIGDY nie proponujesz: zabiegów chirurgicznych, sterydów anaboliczno-androgennych, leków na receptę, głodówek, "bone smashing" ani żadnego urazu zadawanego celowo. Przy podejrzeniu problemu medycznego (nasilony trądzik, gwałtowne wypadanie włosów, zmiana barwnikowa) piszesz jedno zdanie o wizycie u dermatologa i przechodzisz dalej.
6a. Zęby oceniasz WYŁĄCZNIE kosmetycznie i tylko to, co faktycznie widać na zdjęciu "zęby" - odcień/przebarwienia, kamień nazębny widoczny gołym okiem, ewentualnie w oczy rzucającą się nierówność ustawienia. Nigdy nie diagnozujesz próchnicy, chorób dziąseł ani wad zgryzu - to nie jest zdjęcie rentgenowskie ani badanie stomatologiczne. Rekomendacje ograniczasz do higieny (szczotkowanie, nić, płukanka) i kosmetycznego wybielania pastą/paskami; przy czymkolwiek, co wygląda niepokojąco (widoczny stan zapalny dziąseł, ubytek), piszesz jedno zdanie o wizycie u dentysty i przechodzisz dalej.
7. Nie porównujesz użytkownika do innych ludzi ani do żadnych "średnich". Porównujesz go wyłącznie z nim samym - ze zdjęciami poprzedniego skanu, jeśli są dołączone (oznaczone POPRZEDNI).
8. Gdy zdjęcie jest złej jakości (prześwietlone, rozmyte, w cieniu, twarz częściowo zasłonięta), ustawiasz jakosc_zdjecia.wystarczajaca = false, obniżasz pewność ocen i mówisz, co poprawić. Nie zmyślasz obserwacji, których nie widać.
9. Piszesz zwięźle i bezpośrednio. Bez motywacyjnych ogólników, bez komplementów z grzeczności i bez straszenia.
10. Każde zalecenie dostaje stały klucz (małe litery i podkreślenia). Ten sam nawyk przy kolejnym skanie ma dostać TEN SAM klucz, żeby lista wieczorna się nie rozmnażała.
11. Oceniasz WYŁĄCZNIE obszary z listy DO OCENY w FAKTACH. Obszar, którego nie widać na żadnym zdjęciu, nie dostaje liczby - nawet orientacyjnej.

SKALA - ta sama twarz ma dostawać tę samą liczbę niezależnie od dnia:
- 85-100: wzorcowo, w tym obszarze nie ma czego poprawiać
- 70-84: dobrze, drobne niedoskonałości
- 55-69: rzeczy do poprawy widoczne od razu
- 40-54: wyraźny problem albo zaniedbanie
- poniżej 40: nasilony problem
Używaj całej skali. Przedział 50-65 nie jest bezpiecznym środkiem, tylko konkretnym opisem.
Kotwice:
- skora: 85 gładka, jednolity koloryt, bez aktywnych zmian; 65 pojedyncze aktywne zmiany albo przebarwienia; 45 kilkanaście aktywnych zmian, rozległe przebarwienia lub blizny
- definicja_zuchwy: 85 ostra linia i wyraźny kąt żuchwy; 65 linia widoczna, ale miękka; 45 linia zlewa się z szyją
- oczy: 85 bez cieni i obrzęku; 65 lekkie cienie lub obrzęk; 45 wyraźne cienie, obrzęk, zaczerwienienie
- wlosy: 85 zdrowe, fryzura dopasowana i ułożona; 65 zadbane, ale bez formy albo przetłuszczone; 45 zaniedbane lub wyraźnie przerzedzone
- zarost: 85 równy z wyraźnym konturem albo gładko bez podrażnień; 65 nierówny lub niedbały; 45 placki, podrażnienia
- zeby: 85 jasne, jednolity odcień, bez widocznego kamienia; 65 lekkie przebarwienia; 45 wyraźne przebarwienia lub widoczny kamień
- postawa: 85 ucho nad barkiem, barki neutralne; 65 lekko wysunięta głowa lub zaokrąglone barki; 45 wyraźnie wysunięta głowa i garbienie
- sklad_ciala: 85 niski poziom tłuszczu i widoczne mięśnie; 65 szczupło, ale mało mięśni albo trochę tłuszczu na brzuchu; 45 wyraźna nadwaga albo bardzo niska masa mięśniowa
- symetria: budowa twarzy; zmienia się tylko razem z kątem zdjęcia
Oceny ogólnej nie wystawiasz - aplikacja liczy ją sama jako średnią obszarów bez symetrii.

PORÓWNANIE - gdy dołączone są zdjęcia POPRZEDNI i OBECNY tego samego ujęcia:
1. Najpierw zestaw oba zdjęcia obszar po obszarze i ustal werdykt (pole zmiana), dopiero potem wystaw liczbę.
2. Liczba musi zgadzać się z werdyktem względem poprzedniej oceny z FAKTÓW: bez_zmian to najwyżej ±2 punkty, lepiej/gorzej to 3-9 punktów, wyraznie_lepiej/wyraznie_gorzej to 10 i więcej.
3. Gdy różnicy nie widać, właściwy werdykt to bez_zmian - nie wymyślasz postępu i nie szukasz pogorszenia na siłę. Ale gdy różnica jest widoczna gołym okiem (nowa fryzura, zejście trądziku, wyraźnie szczuplejsza albo bardziej umięśniona sylwetka, wyprostowana postawa), nazywasz ją, a liczba MA się ruszyć.
4. Oddzielasz zmianę wyglądu od zmiany warunków: inne światło, kąt, odległość czy balans bieli to nie jest zmiana skóry. Gdy warunki różnią się tak bardzo, że porównanie obszaru byłoby zgadywaniem, wybierasz brak_porownania i w co_sie_zmienilo piszesz, co przeszkadza.
5. Obszar bez poprzedniej oceny w FAKTACH dostaje brak_porownania i pusty co_sie_zmienilo.
Gdy nie ma zdjęć POPRZEDNI, każdy obszar dostaje brak_porownania, a porownanie_ogolne jest pustym napisem.`;

const UJECIE_OPIS: Record<Ujecie, string> = {
  front: "twarz na wprost",
  zeby: "twarz na wprost, uśmiech - zdjęcie zrobione specjalnie pod ocenę zębów",
  profil: "twarz z profilu",
  sylwetka: "sylwetka",
};

/** Kolejność zdjęć w wiadomości - każde ujęcie w parze POPRZEDNI/OBECNY. */
const KOLEJNOSC_UJEC: Ujecie[] = ["front", "zeby", "profil", "sylwetka"];

/** Dlaczego obszar nie jest oceniany - zdanie dla modelu i dla ekranu. */
const BRAK_ZDJECIA: Record<Ujecie, string> = {
  front: "brak zdjęcia twarzy na wprost",
  zeby: "brak zdjęcia z uśmiechem",
  profil: "brak zdjęcia z profilu",
  sylwetka: "brak zdjęcia sylwetki",
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

  /* ------------------------------- Skan ------------------------------------ */

  // RLS pilnuje, żeby to był własny skan - nie trzeba sprawdzać drugi raz.
  const { data: skan } = await supabase
    .from("wyglad_skany")
    .select("id, utworzono, ocena_ogolna")
    .eq("id", skanId)
    .maybeSingle();
  if (!skan) return NextResponse.json({ error: "Nie ma takiego skanu." }, { status: 404 });

  /*
   * Skan z oceną nie jest analizowany drugi raz.
   *
   * Wcześniej ta trasa przyjmowała dowolny własny skan, więc to samo żądanie
   * wysłane dziesięć razy dawało dziesięć opłaconych analiz - limit pilnował
   * wyłącznie rozpoczęcia skanu, nie analizy.
   */
  if (skan.ocena_ogolna != null) {
    return NextResponse.json({ error: "Ten skan ma już ocenę." }, { status: 409 });
  }

  /*
   * Dokończenie starego skanu (zerwane łącze, błąd modelu) przechodzi przez
   * ten sam limit co nowy skan. Świeży skan limit ma już sprawdzony przy
   * starcie - i sam się w nim liczy, więc drugie sprawdzenie by go odrzuciło.
   */
  const swiezy = Date.now() - new Date(skan.utworzono).getTime() < SKAN_W_TOKU_MS;
  if (!swiezy) {
    const { data: limitDane } = await supabase.rpc("wyglad_limit", {});
    const stan = limitDane as WygladLimit | null;
    if (!stan?.mozna) {
      return NextResponse.json(
        {
          error:
            stan?.powod === "limit_miesiaca"
              ? "Pula skanów na ten miesiąc jest wykorzystana - dokończenie starego skanu też ją zużywa."
              : "Dokończenie starego skanu liczy się jak nowy skan, a na kolejny jest za wcześnie.",
          code: stan?.powod ?? "limit",
        },
        { status: 429 },
      );
    }
  }

  /* ------------------------------ Zdjęcia ---------------------------------- */

  const { data: zdjecia } = await supabase
    .from("wyglad_zdjecia")
    .select("ujecie, storage_path")
    .eq("skan_id", skanId);

  if (!zdjecia?.length) {
    return NextResponse.json({ error: "Ten skan nie ma zdjęć." }, { status: 404 });
  }

  /*
   * Skan odniesienia: ostatni OCENIONY skan sprzed tego, z dobrym zdjęciem.
   *
   * "Sprzed tego", a nie "ostatni poza tym" - przy dokańczaniu starego skanu
   * porównanie z nowszym pokazywałoby zmianę wstecz. Zdjęcie złej jakości
   * nie nadaje się na punkt odniesienia, bo różnica oświetlenia wyglądałaby
   * na zmianę skóry.
   */
  const { data: odniesienie } = await supabase
    .from("wyglad_skany")
    .select("id, utworzono, oceny")
    .eq("user_id", user.id)
    .lt("utworzono", skan.utworzono)
    .not("ocena_ogolna", "is", null)
    .eq("jakosc_ok", true)
    .order("utworzono", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: zdjeciaOdniesienia } = odniesienie
    ? await supabase
        .from("wyglad_zdjecia")
        .select("ujecie, storage_path")
        .eq("skan_id", odniesienie.id)
    : { data: [] as Array<{ ujecie: Ujecie; storage_path: string }> };

  async function pobierz(sciezka: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from("wyglad").download(sciezka);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer()).toString("base64");
  }

  const obecneUjecia = new Set(zdjecia.map((z) => z.ujecie as Ujecie));
  const [obecne, poprzednie] = await Promise.all([
    Promise.all(
      zdjecia.map(async (z) => ({ ujecie: z.ujecie as Ujecie, base64: await pobierz(z.storage_path) })),
    ),
    Promise.all(
      // Tylko ujęcia, które są też w obecnym skanie - reszta nie ma z czym się porównać.
      (zdjeciaOdniesienia ?? [])
        .filter((z) => obecneUjecia.has(z.ujecie as Ujecie))
        .map(async (z) => ({ ujecie: z.ujecie as Ujecie, base64: await pobierz(z.storage_path) })),
    ),
  ]);

  const obrazy = new Map<Ujecie, string>();
  for (const o of obecne) if (o.base64) obrazy.set(o.ujecie, o.base64);
  const obrazyPoprzednie = new Map<Ujecie, string>();
  for (const o of poprzednie) if (o.base64) obrazyPoprzednie.set(o.ujecie, o.base64);

  if (!obrazy.has("front")) {
    return NextResponse.json({ error: "Nie udało się odczytać zdjęć." }, { status: 500 });
  }

  /* ------------------ Co oceniamy i z czym porównujemy --------------------- */

  const ujecia = [...obrazy.keys()];
  const doOceny = PODOCENA_KLUCZE.filter((k) => obrazy.has(WYMAGANE_UJECIE[k]));
  const bezOceny = PODOCENA_KLUCZE.filter((k) => !obrazy.has(WYMAGANE_UJECIE[k]));

  /*
   * Poprzednie oceny wyłącznie dla obszarów, których zdjęcie było w OBU
   * skanach. Liczba bez zdjęcia obok to dokładnie to, co w wersji 1
   * przyklejało ocenę: model widział starą liczbę, nie widział starej twarzy.
   */
  const ocenyOdniesienia = (odniesienie?.oceny ?? {}) as Partial<Record<PodocenaKlucz, number>>;
  const poprzednieOceny: Partial<Record<PodocenaKlucz, number>> = {};
  for (const k of doOceny) {
    const v = ocenyOdniesienia[k];
    if (typeof v === "number" && obrazyPoprzednie.has(WYMAGANE_UJECIE[k])) poprzednieOceny[k] = v;
  }
  const jestPorownanie = Object.keys(poprzednieOceny).length > 0;

  /* ------------------------------- Fakty ----------------------------------- */

  const today = todayISO();
  const [{ data: summary }, { data: weights }, { data: vices }] = await Promise.all([
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -13), p_to: today }),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -27))
      .order("date"),
    supabase.from("vices").select("name, started_at").eq("user_id", user.id).eq("is_archived", false),
  ]);

  const period = summary as PeriodSummary | null;
  const wagi = (weights ?? []).map((w) => Number(w.weight_kg));
  const trendWagi =
    wagi.length >= 2 ? (wagi[wagi.length - 1] - wagi[0]).toFixed(1) : null;

  const etykieta = (k: PodocenaKlucz) => `${PODOCENA_ETYKIETA[k]} (${k})`;

  const facts = [
    "DO OCENY:",
    doOceny.map((k) => `- ${etykieta(k)}`).join("\n"),
    "",
    "NIE OCENIAJ (nie ma na czym):",
    bezOceny.length
      ? bezOceny.map((k) => `- ${etykieta(k)}: ${BRAK_ZDJECIA[WYMAGANE_UJECIE[k]]}`).join("\n")
      : "- nic, są wszystkie zdjęcia",
    "",
    "PORÓWNANIE:",
    jestPorownanie && odniesienie
      ? [
          `- poprzedni skan z ${String(odniesienie.utworzono).slice(0, 10)}, jego zdjęcia są oznaczone POPRZEDNI`,
          "- poprzednie oceny obszarów, które da się porównać:",
          ...(Object.entries(poprzednieOceny) as Array<[PodocenaKlucz, number]>).map(
            ([k, v]) => `  - ${etykieta(k)}: ${v}`,
          ),
        ].join("\n")
      : "- to jest pierwszy skan albo nie ma z czym porównać; każdy obszar dostaje zmiana = brak_porownania",
    "",
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
  ].join("\n");

  /* -------------------------------- Model ---------------------------------- */

  const obraz = (base64: string): Anthropic.ContentBlockParam => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: base64 },
  });

  /*
   * Zdjęcia parami: POPRZEDNI i zaraz po nim OBECNY z tego samego ujęcia.
   * Obok siebie model porównuje je bezpośrednio, zamiast pamiętać pierwsze
   * przez trzy inne obrazy.
   */
  const tresc: Anthropic.ContentBlockParam[] = [];
  for (const u of KOLEJNOSC_UJEC) {
    const teraz = obrazy.get(u);
    if (!teraz) continue;
    const przedtem = jestPorownanie ? obrazyPoprzednie.get(u) : undefined;
    if (przedtem && odniesienie) {
      tresc.push(
        {
          type: "text",
          text: `POPRZEDNI SKAN (${String(odniesienie.utworzono).slice(0, 10)}) - ${UJECIE_OPIS[u]}.`,
        },
        obraz(przedtem),
      );
    }
    tresc.push({ type: "text", text: `OBECNY SKAN - ${UJECIE_OPIS[u]}.` }, obraz(teraz));
  }
  tresc.push({
    type: "text",
    text: jestPorownanie
      ? `Porównaj obecny skan z poprzednim, oceń mój wygląd i podaj plan.\n\nFAKTY:\n${facts}`
      : `Oceń mój wygląd na podstawie tych zdjęć i podaj plan.\n\nFAKTY:\n${facts}`,
  });

  /*
   * Skan trafia do tego samego rejestru kosztów co trener, ale NIE zjada jego
   * budżetu (`liczone` w app_settings, migracja 0043). Ma własne, ostrzejsze
   * ograniczenia. Wpis w rejestrze jest też tym, co od 0078 liczy pulę
   * skanów - skasowanie skanu nie zwraca miejsca.
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
     */
    const client = new Anthropic({ maxRetries: 0 });
    const response = await client.messages.parse(
      {
        model: MODEL,
        /*
         * Dużo więcej niż u trenera i nie bez powodu: schemat jest duży
         * (do dziewięciu podocen z obserwacją i porównaniem, do sześciu
         * zaleceń po sześć kroków), a przy myśleniu adaptacyjnym rozumowanie
         * liczy się do tego samego limitu. Urwana odpowiedź to zmarnowany skan.
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
     * Tu model przestaje mieć ostatnie słowo. Normalizacja z kontekstem
     * wyrzuca oceny obszarów bez zdjęcia, dociska liczby do werdyktu
     * porównania i sama liczy ocenę ogólną.
     */
    analiza = normalizujAnalize(response.parsed_output, {
      ujecia,
      poprzednie: poprzednieOceny,
    });
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
      wersja_promptu: WERSJA_PROMPTU,
      skan_odniesienia: jestPorownanie && odniesienie ? odniesienie.id : null,
    })
    .eq("id", skanId);

  /*
   * Rutyny z planu - upsert po kluczu, nigdy insert.
   *
   * Zalecenie "wieczorny retinoid" wraca przy każdym skanie. Bez klucza po
   * pięciu skanach lista wieczorna miałaby pięć prawie identycznych pozycji
   * i nikt by jej nie otworzył. Rutyn stworzonych ręcznie nie ruszamy -
   * upsert dotyczy wyłącznie tych ze źródłem 'ai'.
   *
   * Dokańczany STARY skan rutyn nie rusza: jego plan jest starszy niż plan
   * z nowszego skanu i nadpisałby aktualne zalecenia nieaktualnymi.
   */
  const { count: nowszych } = await supabase
    .from("wyglad_skany")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("utworzono", skan.utworzono)
    .not("ocena_ogolna", "is", null);

  const doRutyn = (nowszych ?? 0) > 0
    ? []
    : analiza.plan.filter((z) => ["pielegnacja", "zeby", "nawyki", "fryzura"].includes(z.kategoria));

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
