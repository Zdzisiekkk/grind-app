/**
 * Liczby i etykiety modułu finansowego.
 *
 * Reguły liczenia trzymamy tutaj, a nie w komponentach, z tego samego powodu
 * co przy wyniku snu: te same liczby pokazuje ekran Finansów i pulpit, a dwie
 * kopie wzoru to prosta droga do dwóch różnych odpowiedzi na to samo pytanie.
 */

import type { KategoriaStalego, KategoriaWydatku } from "@/lib/database.types";

export const KATEGORIE_WYDATKOW: ReadonlyArray<{
  value: KategoriaWydatku;
  label: string;
  icon: string;
}> = [
  { value: "jedzenie", label: "Jedzenie na mieście", icon: "🍔" },
  { value: "zakupy", label: "Zakupy", icon: "🛍️" },
  { value: "rozrywka", label: "Rozrywka", icon: "🎬" },
  { value: "transport", label: "Transport", icon: "🚕" },
  { value: "zdrowie", label: "Zdrowie", icon: "💊" },
  { value: "prezenty", label: "Prezenty", icon: "🎁" },
  { value: "subskrypcje", label: "Subskrypcje", icon: "📺" },
  { value: "inne", label: "Inne", icon: "💸" },
];

export function kategoriaWydatku(value: string) {
  return (
    KATEGORIE_WYDATKOW.find((k) => k.value === value) ??
    KATEGORIE_WYDATKOW[KATEGORIE_WYDATKOW.length - 1]
  );
}

/**
 * Kwota po polsku: "12 400 zł", "1 250,50 zł".
 *
 * Grosze pokazujemy tylko wtedy, gdy są niezerowe. Przy majątku "12 400 zł"
 * czyta się jednym rzutem oka, a "12 400,00 zł" to dwa znaki szumu w miejscu,
 * w którym i tak nikt nie liczy co do grosza.
 */
export function zl(kwota: number | null | undefined, zawszeGrosze = false): string {
  if (kwota == null || !Number.isFinite(kwota)) return "-";
  const grosze = zawszeGrosze || Math.round(kwota * 100) % 100 !== 0;
  return (
    kwota.toLocaleString("pl-PL", {
      minimumFractionDigits: grosze ? 2 : 0,
      maximumFractionDigits: grosze ? 2 : 0,
    }) + " zł"
  );
}

/** Zmiana ze znakiem: "+1 200 zł", "-340 zł". Zero bez znaku. */
export function zmiana(kwota: number | null | undefined): string {
  if (kwota == null || !Number.isFinite(kwota)) return "-";
  if (kwota === 0) return zl(0);
  return (kwota > 0 ? "+" : "") + zl(kwota);
}

/**
 * Ile miesięcy przeżycia dają płynne środki.
 *
 * Świadomie BEZ inwestycji: akcji nie sprzedaje się w dniu, w którym psuje
 * się pralka, a poduszka ma odpowiadać na pytanie "ile wytrzymam bez
 * przychodu", nie "ile jestem wart".
 */
export function miesiaceProzycia(
  plynne: number | null | undefined,
  kosztyMiesieczne: number | null | undefined,
): number | null {
  if (plynne == null || kosztyMiesieczne == null || kosztyMiesieczne <= 0) return null;
  return Math.round((plynne / kosztyMiesieczne) * 10) / 10;
}

/** Jak blisko celu poduszki, 0-100. */
export function poduszkaProcent(
  miesiace: number | null,
  cel: number,
): number | null {
  if (miesiace == null || cel <= 0) return null;
  return Math.min(100, Math.round((miesiace / cel) * 100));
}

/**
 * Ile z miesięcznego budżetu wypada na dzień, żeby wyrobić się do końca.
 *
 * Liczone od dziś do końca miesiąca, a nie ze średniej z całego miesiąca -
 * człowiek, który przepalił połowę w tydzień, ma wiedzieć, ile mu realnie
 * zostało na dzień, a nie ile "powinien był" wydawać.
 */
export function dziennieDoKonca(
  zostalo: number | null,
  dzisiaj = new Date(),
): number | null {
  if (zostalo == null) return null;
  const wMiesiacu = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() + 1, 0).getDate();
  const doKonca = Math.max(1, wMiesiacu - dzisiaj.getDate() + 1);
  return Math.max(0, Math.round((zostalo / doKonca) * 100) / 100);
}

/**
 * Ocena stanu poduszki - do koloru i jednego zdania na ekranie.
 *
 * Progi nie są wyssane z palca: poniżej miesiąca każda awaria jest kryzysem,
 * trzy miesiące to minimum spokoju przy stabilnej pracy, sześć to standard
 * przy niepewnym dochodzie.
 */
export function stanPoduszki(miesiace: number | null): {
  tone: "danger" | "warn" | "accent" | "success";
  label: string;
} {
  if (miesiace == null) return { tone: "accent", label: "Podaj koszty miesięczne" };
  if (miesiace < 1) return { tone: "danger", label: "Poniżej miesiąca" };
  if (miesiace < 3) return { tone: "warn", label: "Na dorobku" };
  if (miesiace < 6) return { tone: "accent", label: "Bezpiecznie" };
  return { tone: "success", label: "Spokojnie" };
}

/* ------------------------------- Majątek ---------------------------------- */

/**
 * Koszyki majątku. Ta czwórka nie jest kosmetyką - decyduje o poduszce,
 * którą liczymy WYŁĄCZNIE z płynnych. Dlatego przy każdym koszyku stoi
 * zdanie o tym, co się do niego kwalifikuje: bez tego lokata na trzy lata
 * i konto oszczędnościowe lądują w tym samym miejscu, a to dwie różne
 * odpowiedzi na pytanie "ile wytrzymam bez przychodu".
 */
export const KOSZYKI_MAJATKU = [
  {
    value: "plynne",
    label: "Płynne",
    opis: "Da się z tego zapłacić w tym tygodniu. Tylko to liczy się do poduszki.",
  },
  {
    value: "inwestycje",
    label: "Inwestycje",
    opis: "Realna wartość, ale wyjście kosztuje czas albo stratę.",
  },
  {
    value: "inne",
    label: "Rzeczy i należności",
    opis: "Liczą się do majątku, nie do poduszki.",
  },
  {
    value: "dlugi",
    label: "Długi",
    opis: "Wpisuj dodatnio - ile wisisz. Odejmie się samo.",
  },
] as const;

export type KoszykMajatku = (typeof KOSZYKI_MAJATKU)[number]["value"];

/**
 * Podpowiedzi: gotowa lista tego, co ludzie faktycznie mają.
 *
 * Puste pole "nazwa pozycji" jest gorsze niż brak pola - trzeba wymyślić,
 * jak nazwać własne konto, i połowa osób na tym poprzestaje. Lista do
 * tapnięcia zamienia to w dwa ruchy, a przy okazji przypomina o rzeczach,
 * o których się zapomina: PPK, obligacjach z inflacji, debecie na koncie.
 *
 * `rodzaj` musi się zgadzać z public.finanse_kategoria_rodzaju z 0065 -
 * pilnuje tego test:finanse.
 */
export const RODZAJE_MAJATKU: ReadonlyArray<{
  rodzaj: string;
  koszyk: KoszykMajatku;
  label: string;
  icon: string;
  podpowiedz: string;
}> = [
  // --- Płynne ---
  { rodzaj: "konto", koszyk: "plynne", label: "Konto osobiste", icon: "🏦", podpowiedz: "To, z czego płacisz na co dzień" },
  { rodzaj: "oszczednosciowe", koszyk: "plynne", label: "Konto oszczędnościowe", icon: "🐖", podpowiedz: "Odłożone, ale wypłacalne od ręki" },
  { rodzaj: "gotowka", koszyk: "plynne", label: "Gotówka", icon: "💵", podpowiedz: "Portfel, koperta, szuflada" },
  { rodzaj: "lokata", koszyk: "plynne", label: "Lokata", icon: "🔒", podpowiedz: "Zerwiesz w każdej chwili, tracąc odsetki" },
  { rodzaj: "waluta", koszyk: "plynne", label: "Waluta obca", icon: "💱", podpowiedz: "Euro, dolary - po dzisiejszym kursie" },

  // --- Inwestycje ---
  { rodzaj: "akcje", koszyk: "inwestycje", label: "Akcje", icon: "📈", podpowiedz: "Wartość rachunku maklerskiego" },
  { rodzaj: "etf", koszyk: "inwestycje", label: "ETF", icon: "🧺", podpowiedz: "Fundusze indeksowe" },
  { rodzaj: "obligacje", koszyk: "inwestycje", label: "Obligacje skarbowe", icon: "🧾", podpowiedz: "EDO, ROD, antyinflacyjne" },
  { rodzaj: "ike", koszyk: "inwestycje", label: "IKE", icon: "🏛️", podpowiedz: "Konto emerytalne - wypłata dopiero po 60." },
  { rodzaj: "ikze", koszyk: "inwestycje", label: "IKZE", icon: "🏛️", podpowiedz: "To samo, z ulgą w PIT" },
  { rodzaj: "ppk", koszyk: "inwestycje", label: "PPK", icon: "🧑‍💼", podpowiedz: "Łatwo zapomnieć, że to Twoje pieniądze" },
  { rodzaj: "fundusz", koszyk: "inwestycje", label: "Fundusz", icon: "📊", podpowiedz: "TFI, fundusze inwestycyjne" },
  { rodzaj: "krypto", koszyk: "inwestycje", label: "Krypto", icon: "🪙", podpowiedz: "Po dzisiejszej wycenie, nie po tym, ile wpłaciłeś" },
  { rodzaj: "metale", koszyk: "inwestycje", label: "Złoto i srebro", icon: "🥇", podpowiedz: "Monety, sztabki" },
  { rodzaj: "inwestycja_inna", koszyk: "inwestycje", label: "Inna inwestycja", icon: "💼", podpowiedz: "Udziały, pożyczki, cokolwiek pracuje" },

  // --- Rzeczy i należności ---
  { rodzaj: "nieruchomosc", koszyk: "inne", label: "Nieruchomość", icon: "🏠", podpowiedz: "Wartość mieszkania - kredyt wpisz osobno jako dług" },
  { rodzaj: "samochod", koszyk: "inne", label: "Samochód", icon: "🚗", podpowiedz: "Tyle, ile realnie dostałbyś przy sprzedaży" },
  { rodzaj: "sprzet", koszyk: "inne", label: "Sprzęt", icon: "💻", podpowiedz: "Komputer, rower, aparat" },
  { rodzaj: "kolekcja", koszyk: "inne", label: "Rzeczy wartościowe", icon: "🎸", podpowiedz: "Instrumenty, zegarki, kolekcje" },
  { rodzaj: "naleznosc", koszyk: "inne", label: "Pożyczone komuś", icon: "🤝", podpowiedz: "Pieniądze, które mają wrócić" },

  // --- Długi ---
  { rodzaj: "hipoteka", koszyk: "dlugi", label: "Kredyt hipoteczny", icon: "🏚️", podpowiedz: "Pozostało do spłaty, nie rata" },
  { rodzaj: "kredyt", koszyk: "dlugi", label: "Kredyt gotówkowy", icon: "🏦", podpowiedz: "Pozostały kapitał" },
  { rodzaj: "karta", koszyk: "dlugi", label: "Karta kredytowa", icon: "💳", podpowiedz: "Wykorzystany limit" },
  { rodzaj: "raty", koszyk: "dlugi", label: "Zakupy na raty", icon: "🧾", podpowiedz: "Też dług, nawet gdy na zero procent" },
  { rodzaj: "pozyczka_prywatna", koszyk: "dlugi", label: "Pożyczka od bliskich", icon: "🤝", podpowiedz: "Bez umowy to nadal dług" },
  { rodzaj: "debet", koszyk: "dlugi", label: "Debet na koncie", icon: "📉", podpowiedz: "Minus, na którym siedzisz" },
  { rodzaj: "dlug_inny", koszyk: "dlugi", label: "Inny dług", icon: "💸", podpowiedz: "Zaległy podatek, mandat, rachunek" },
];

export function rodzajMajatku(rodzaj: string) {
  return (
    RODZAJE_MAJATKU.find((r) => r.rodzaj === rodzaj) ??
    RODZAJE_MAJATKU[RODZAJE_MAJATKU.length - 1]
  );
}

/** Odpowiednik public.finanse_kategoria_rodzaju - null dla nieznanego rodzaju. */
export function koszykRodzaju(rodzaj: string): KoszykMajatku | null {
  return RODZAJE_MAJATKU.find((r) => r.rodzaj === rodzaj)?.koszyk ?? null;
}

/**
 * Podgląd sum przy wpisywaniu.
 *
 * To tylko podgląd: zapisu dokonuje public.finanse_zapisz_migawke i to baza
 * ma ostatnie słowo. Liczymy tu drugi raz wyłącznie po to, żeby suma zmieniała
 * się pod palcem - bez tego nie wiadomo, czy wpisana kwota trafiła tam, gdzie
 * miała.
 */
export function sumyKoszykow(
  pozycje: ReadonlyArray<{ kategoria: string; kwota: number; archiwalna?: boolean }>,
): Record<KoszykMajatku, number> & { netto: number } {
  const s = { plynne: 0, inwestycje: 0, inne: 0, dlugi: 0 };
  for (const p of pozycje) {
    if (p.archiwalna) continue;
    if (p.kategoria in s) s[p.kategoria as KoszykMajatku] += p.kwota || 0;
  }
  return { ...s, netto: s.plynne + s.inwestycje + s.inne - s.dlugi };
}

/* --------------------------- Wpływy i koszty stałe ------------------------ */

export const KATEGORIE_STALYCH: ReadonlyArray<{
  value: KategoriaStalego;
  label: string;
  icon: string;
}> = [
  { value: "mieszkanie", label: "Mieszkanie", icon: "🏠" },
  { value: "rachunki", label: "Rachunki", icon: "🧾" },
  { value: "subskrypcje", label: "Subskrypcje", icon: "📺" },
  { value: "transport", label: "Transport", icon: "🚌" },
  { value: "zdrowie", label: "Zdrowie", icon: "💊" },
  { value: "jedzenie", label: "Jedzenie w domu", icon: "🛒" },
  { value: "raty", label: "Raty i kredyty", icon: "🏦" },
  { value: "inne", label: "Inne", icon: "💸" },
];

export function kategoriaStalego(value: string) {
  return (
    KATEGORIE_STALYCH.find((k) => k.value === value) ??
    KATEGORIE_STALYCH[KATEGORIE_STALYCH.length - 1]
  );
}

/**
 * Podpowiedzi kosztów stałych.
 *
 * Ta sama zasada co przy majątku: puste pole "nazwa" jest gorsze niż jego
 * brak. Lista jest też ściągą - czynsz każdy pamięta, ale ubezpieczenie
 * płacone raz na pół roku i trzy abonamenty po dwadzieścia złotych to
 * dokładnie te pozycje, przez które bilans nigdy się nie spina.
 */
export const PODPOWIEDZI_STALYCH: ReadonlyArray<{
  nazwa: string;
  kategoria: KategoriaStalego;
  icon: string;
}> = [
  { nazwa: "Czynsz", kategoria: "mieszkanie", icon: "🏠" },
  { nazwa: "Prąd", kategoria: "rachunki", icon: "💡" },
  { nazwa: "Internet", kategoria: "rachunki", icon: "📶" },
  { nazwa: "Telefon", kategoria: "rachunki", icon: "📱" },
  { nazwa: "Zakupy spożywcze", kategoria: "jedzenie", icon: "🛒" },
  { nazwa: "Bilet miesięczny", kategoria: "transport", icon: "🚌" },
  { nazwa: "Siłownia", kategoria: "zdrowie", icon: "🏋️" },
  { nazwa: "Netflix / Spotify", kategoria: "subskrypcje", icon: "📺" },
  { nazwa: "Ubezpieczenie", kategoria: "zdrowie", icon: "🛡️" },
  { nazwa: "Rata kredytu", kategoria: "raty", icon: "🏦" },
];

export const IKONY_ZRODEL = ["💼", "💻", "🧾", "👨‍👩‍👦", "🎓", "🏠", "📈", "💰"] as const;

/**
 * Dzienny limit wydatków uznaniowych - ta sama reguła co w bazie.
 *
 * Liczony z tego, co ZOSTAŁO, dzielone przez dni DO KOŃCA miesiąca. Po
 * przepalonym tygodniu poprzeczka rośnie i to jest zamierzone: średnia
 * z całego miesiąca pozwalałaby przepalić połowę budżetu w pięć dni
 * i dalej "mieścić się w planie".
 */
export function dziennyLimit(
  budzet: number | null | undefined,
  wydaneWMiesiacu: number,
  dzisiaj = new Date(),
): number | null {
  if (budzet == null) return null;
  const wMiesiacu = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() + 1, 0).getDate();
  const doKonca = Math.max(1, wMiesiacu - dzisiaj.getDate() + 1);
  return Math.round(((budzet - wydaneWMiesiacu) / doKonca) * 100) / 100;
}

/**
 * Czy tempo wydawania wystarczy do końca miesiąca.
 *
 * Ostrzegamy dopiero przy realnym zagrożeniu, a nie przy pierwszym dniu
 * powyżej średniej - alarm, który wyje co drugi dzień, przestaje cokolwiek
 * znaczyć po tygodniu.
 */
export function tempoBudzetu(
  budzet: number | null | undefined,
  wydaneWMiesiacu: number,
  dzisiaj = new Date(),
): { stan: "ok" | "uwaga" | "przekroczony"; prognoza: number | null } {
  if (budzet == null || budzet <= 0) return { stan: "ok", prognoza: null };
  if (wydaneWMiesiacu > budzet) return { stan: "przekroczony", prognoza: wydaneWMiesiacu };

  const wMiesiacu = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() + 1, 0).getDate();
  const minelo = dzisiaj.getDate();
  const prognoza = Math.round((wydaneWMiesiacu / minelo) * wMiesiacu);

  // Pięć procent zapasu, bo prognoza z trzech dni miesiąca i tak jest zgadywanką.
  return { stan: prognoza > budzet * 1.05 ? "uwaga" : "ok", prognoza };
}

/**
 * Pierwszy dzień miesiąca jako YYYY-MM-DD.
 *
 * Sklejane z pól lokalnej daty, NIE przez toISOString: ta konwertuje na UTC,
 * więc pierwszy dzień miesiąca o północy czasu polskiego wychodzi jako
 * ostatni dzień poprzedniego. Błąd cichy - wpisy lądują w sąsiednim miesiącu
 * i bilans po prostu ich nie widzi.
 */
export function poczatekMiesiaca(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "wrzesień 2026" z pierwszego dnia okresu. */
export function nazwaMiesiaca(okres: string | null | undefined): string {
  if (!okres) return "";
  const d = new Date(`${okres}T00:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

/**
 * Zdanie o różnicy między rejestrem a stanem konta.
 *
 * Nazywamy rzecz po imieniu w obie strony. "Wyparowało" bez wskazania,
 * że to normalne, brzmiałoby jak oskarżenie - a te pieniądze prawie zawsze
 * poszły na drobne, o których nikt nie pamięta.
 */
export function opisNieuchwyconego(kwota: number | null): {
  tone: "success" | "warn" | "danger" | "accent";
  tekst: string;
} {
  if (kwota == null) return { tone: "accent", tekst: "Brak wcześniejszej migawki - nie ma z czym porównać." };
  if (Math.abs(kwota) < 1) return { tone: "success", tekst: "Rejestr zgadza się ze stanem konta co do złotówki." };
  if (kwota < 0)
    return {
      tone: "success",
      tekst: `Znalazło się ${zl(Math.abs(kwota))} więcej, niż wynikało z wpisów - zwrot albo zapomniany wpływ.`,
    };
  return {
    tone: kwota > 500 ? "danger" : "warn",
    tekst: `${zl(kwota)} wyparowało poza wpisami. To zwykle drobne, o których się nie pamięta.`,
  };
}
