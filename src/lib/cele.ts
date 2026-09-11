import type { Cel, CelMetryka } from "@/lib/database.types";

/**
 * Zakładka "Cele": cele kwartalne i roczne podpięte pod resztę aplikacji.
 *
 * Do tej pory każdy moduł żył osobno - dziesięć liczników bez odpowiedzi na
 * pytanie "po co". Cel spina je w jedną historię: "−6 kg do marca" czyta
 * wagę z dziennika, "40 treningów w kwartale" liczy zapisane sesje,
 * "20 000 zł majątku" bierze liczbę z Finansów. Nic nie trzeba przepisywać
 * ręcznie - poza metryką "własna", która jest furtką na wszystko inne.
 *
 * Postęp liczy ta czysta funkcja, nie baza: da się ją przetestować bez
 * serwera, a ekran i pulpit mówią dokładnie to samo.
 */

export const METRYKI: Record<
  CelMetryka,
  { ikona: string; etykieta: string; opis: string; jednostka: string | null; licznik: boolean }
> = {
  waga: {
    ikona: "⚖️",
    etykieta: "Waga",
    opis: "Waga docelowa. Postęp z Twoich pomiarów wagi.",
    jednostka: "kg",
    licznik: false,
  },
  majatek: {
    ikona: "💰",
    etykieta: "Majątek netto",
    opis: "Kwota majątku. Postęp z zakładki Finanse.",
    jednostka: "zł",
    licznik: false,
  },
  treningi: {
    ikona: "🏋️",
    etykieta: "Treningi",
    opis: "Ile treningów do terminu. Liczą się zapisane sesje.",
    jednostka: "treningów",
    licznik: true,
  },
  ksiazki: {
    ikona: "📚",
    etykieta: "Książki",
    opis: "Ile przeczytanych książek do terminu.",
    jednostka: "książek",
    licznik: true,
  },
  nauka: {
    ikona: "🎓",
    etykieta: "Godziny nauki",
    opis: "Ile godzin nauki - wszystkiego albo jednego przedmiotu.",
    jednostka: "h",
    licznik: true,
  },
  nawyk: {
    ikona: "🔥",
    etykieta: "Nawyk",
    opis: "Ile dni z odhaczonym nawykiem do terminu.",
    jednostka: "dni",
    licznik: true,
  },
  wlasna: {
    ikona: "✏️",
    etykieta: "Własna liczba",
    opis: "Cokolwiek innego. Aktualną wartość wpisujesz sam.",
    jednostka: null,
    licznik: false,
  },
  kamienie: {
    ikona: "🪜",
    etykieta: "Kroki milowe",
    opis: "Lista kroków do odhaczenia, bez liczb.",
    jednostka: null,
    licznik: false,
  },
};

export const HORYZONTY = [
  { id: "kwartal", etykieta: "Kwartał", dni: 91 },
  { id: "rok", etykieta: "Rok", dni: 365 },
  { id: "wlasny", etykieta: "Własny termin", dni: null },
] as const;

/** Wszystko, czego cele potrzebują z innych modułów - zbierane raz na stronę. */
export type DaneDoCelow = {
  dzis: string;
  /** Ostatni pomiar wagi. */
  waga: number | null;
  /** Majątek netto z Finansów (szacowany, jeśli jest, inaczej z migawki). */
  netto: number | null;
  /** Daty zapisanych treningów. */
  treningi: string[];
  /** Daty skończenia przeczytanych książek. */
  ksiazki: string[];
  /** Sesje nauki. */
  nauka: Array<{ data: string; minuty: number; temat_id: string }>;
  /** Dni z odhaczonym nawykiem, po identyfikatorze nawyku. */
  nawyki: Record<string, string[]>;
};

export type StanCelu = "osiagniety" | "na_czas" | "w_tyle" | "brak_danych";

export type PostepCelu = {
  aktualna: number | null;
  start: number;
  cel: number;
  /** 0..1 - ile drogi za Tobą. */
  procent: number;
  /** 0..1 - ile czasu minęło; do porównania z `procent`. */
  czas: number;
  stan: StanCelu;
  /** Ile trzeba robić tygodniowo do terminu; null, gdy nie ma sensu liczyć. */
  naTydzien: number | null;
};

function dniMiedzy(od: string, doo: string): number {
  return Math.round(
    (new Date(doo + "T00:00:00Z").getTime() - new Date(od + "T00:00:00Z").getTime()) / 86_400_000,
  );
}

const wOknie = (data: string, cel: Pick<Cel, "od" | "termin">, dzis: string) =>
  data >= cel.od && data <= cel.termin && data <= dzis;

/**
 * Tolerancja, zanim cel uznamy za "w tyle": 10 punktów procentowych.
 * Ta sama, co przy celach oszczędnościowych w Finansach (0069) - dwa różne
 * progi w jednej aplikacji znaczyłyby dwie różne definicje spóźnienia.
 */
const LUZ = 0.1;

export function postepCelu(
  cel: Pick<
    Cel,
    "metryka" | "od" | "termin" | "wartosc_cel" | "wartosc_start" | "wartosc_reczna" | "habit_id" | "temat_id"
  >,
  dane: DaneDoCelow,
  kamienie: Array<{ zrobione_at: string | null }> = [],
): PostepCelu {
  const { dzis } = dane;
  const dlugosc = Math.max(1, dniMiedzy(cel.od, cel.termin));
  const czas = Math.min(1, Math.max(0, dniMiedzy(cel.od, dzis) / dlugosc));

  let aktualna: number | null = null;
  let start = cel.wartosc_start != null ? Number(cel.wartosc_start) : 0;
  let docelowa = cel.wartosc_cel != null ? Number(cel.wartosc_cel) : 0;

  switch (cel.metryka) {
    case "waga":
      aktualna = dane.waga;
      break;
    case "majatek":
      aktualna = dane.netto;
      break;
    case "wlasna":
      aktualna = cel.wartosc_reczna != null ? Number(cel.wartosc_reczna) : start;
      break;
    case "treningi":
      start = 0;
      aktualna = dane.treningi.filter((d) => wOknie(d, cel, dzis)).length;
      break;
    case "ksiazki":
      start = 0;
      aktualna = dane.ksiazki.filter((d) => wOknie(d, cel, dzis)).length;
      break;
    case "nauka": {
      start = 0;
      const min = dane.nauka
        .filter((s) => wOknie(s.data, cel, dzis) && (!cel.temat_id || s.temat_id === cel.temat_id))
        .reduce((a, s) => a + s.minuty, 0);
      aktualna = Math.round((min / 60) * 10) / 10;
      break;
    }
    case "nawyk":
      start = 0;
      aktualna = cel.habit_id
        ? (dane.nawyki[cel.habit_id] ?? []).filter((d) => wOknie(d, cel, dzis)).length
        : null;
      break;
    case "kamienie":
      start = 0;
      docelowa = kamienie.length;
      aktualna = kamienie.filter((k) => k.zrobione_at).length;
      break;
  }

  if (aktualna == null || (cel.metryka === "kamienie" && docelowa === 0)) {
    return { aktualna, start, cel: docelowa, procent: 0, czas, stan: "brak_danych", naTydzien: null };
  }

  /*
   * Kierunek wynika z liczb, nie z metryki. Waga może iść w dół (redukcja)
   * albo w górę (masa), majątek zwykle w górę, ale ktoś spłacający dług
   * ustawi cel "−5000 zł" z wyższego punktu startu. Jedna formuła obsługuje
   * oba przypadki: przebyta droga przez całą drogę.
   */
  const droga = docelowa - start;
  const procent =
    droga === 0 ? 1 : Math.min(1, Math.max(0, (aktualna - start) / droga));

  const stan: StanCelu =
    procent >= 1 ? "osiagniety" : procent + LUZ < czas ? "w_tyle" : "na_czas";

  const dniDoKonca = dniMiedzy(dzis, cel.termin);
  const zostalo = docelowa - aktualna;
  const naTydzien =
    stan === "osiagniety" || dniDoKonca <= 0 ? null : (zostalo / dniDoKonca) * 7;

  return { aktualna, start, cel: docelowa, procent, czas, stan, naTydzien };
}

/** Domyślny termin dla horyzontu - koniec kwartału albo roku od dziś. */
export function terminDlaHoryzontu(horyzont: "kwartal" | "rok", dzis: string): string {
  const d = new Date(dzis + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (horyzont === "kwartal" ? 91 : 365));
  return d.toISOString().slice(0, 10);
}

/** Liczba z jednostką, bez zbędnych zer po przecinku. */
export function wartosc(v: number | null, jednostka: string | null): string {
  if (v == null) return "-";
  const liczba = Number.isInteger(v)
    ? v.toLocaleString("pl-PL")
    : v.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  return jednostka ? `${liczba} ${jednostka}` : liczba;
}
