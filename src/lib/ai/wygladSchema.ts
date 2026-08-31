import { z } from "zod";
import { bezDuplikatow, liczba, przytnij, slug, zListy } from "@/lib/ai/limity";

/**
 * Kształt odpowiedzi modelu przy analizie wyglądu.
 *
 * Limity długości i liczby elementów są tu twarde, bo to jedyne miejsce, które
 * powstrzymuje model przed napisaniem eseju. Ekran ma zmieścić się na telefonie
 * i dać się przeczytać w minutę - plan z dwunastoma zaleceniami nie zostanie
 * wykonany ani razu, więc jest wart mniej niż plan z trzema.
 */

export const PODOCENA_KLUCZE = [
  "skora",
  "symetria",
  "definicja_zuchwy",
  "oczy",
  "wlosy",
  "zarost",
  "zeby",
  "postawa",
  "sklad_ciala",
] as const;

export type PodocenaKlucz = (typeof PODOCENA_KLUCZE)[number];

/** Etykiety po polsku - trzymane osobno, żeby ekran nie mapował kluczy ręcznie. */
export const PODOCENA_ETYKIETA: Record<PodocenaKlucz, string> = {
  skora: "Skóra",
  symetria: "Symetria",
  definicja_zuchwy: "Linia żuchwy",
  oczy: "Oczy",
  wlosy: "Włosy",
  zarost: "Zarost",
  zeby: "Zęby",
  postawa: "Postawa",
  sklad_ciala: "Skład ciała",
};

export const KATEGORIE = [
  "pielegnacja",
  "mewing",
  "cwiczenia_twarzy",
  "postawa",
  "trening",
  "dieta",
  "sen",
  "nawyki",
  "fryzura",
  "zeby",
  "specjalista",
] as const;

export type Kategoria = (typeof KATEGORIE)[number];

export const KATEGORIA_ETYKIETA: Record<Kategoria, string> = {
  pielegnacja: "Pielęgnacja",
  mewing: "Mewing",
  cwiczenia_twarzy: "Ćwiczenia twarzy",
  postawa: "Postawa",
  trening: "Trening",
  dieta: "Dieta",
  sen: "Sen",
  nawyki: "Nawyki",
  fryzura: "Fryzura",
  zeby: "Zęby",
  specjalista: "Specjalista",
};

const PodocenaSchema = z.object({
  klucz: z.enum(PODOCENA_KLUCZE),
  ocena: z.number().int().min(0).max(100),
  obserwacja: z.string().max(240).describe("Co konkretnie widać. Opisowo, bez ogólników."),
});

const ZalecenieSchema = z.object({
  kategoria: z.enum(KATEGORIE),
  tytul: z.string().max(80),
  dlaczego: z
    .string()
    .max(400)
    .describe("Powiąż z konkretną obserwacją ze skanu albo liczbą z FAKTÓW."),
  jak: z
    .array(z.string().max(160))
    .max(6)
    .describe("Kroki do wykonania. Konkret, nie 'zadbaj o'."),
  czestotliwosc: z.string().max(60).describe("np. 'codziennie wieczorem', '3× w tygodniu'"),
  horyzont_tygodni: z.number().int().min(1).max(52).describe("Realny czas do zauważalnego efektu."),
  priorytet: z.number().int().min(1).max(3).describe("1 = największy realny wpływ"),
  /*
   * Klucz rutyny albo protokołu, pod którym zalecenie ląduje w codziennej
   * liście. Bez niego każdy skan dokładałby nową rutynę prawie taką samą jak
   * poprzednia - po pół roku wieczór miałby dwadzieścia pozycji.
   */
  klucz: z
    .string()
    .max(40)
    .regex(/^[a-z0-9_]+$/)
    .describe("Stały identyfikator, np. 'wieczor_retinoid'. Ten sam przy kolejnych skanach."),
});

export const WygladAnalysisSchema = z.object({
  ocena_ogolna: z.number().int().min(0).max(100),
  podsumowanie: z
    .string()
    .max(500)
    .describe("3-4 zdania. Rzeczowo, bez komplementów i bez straszenia."),
  /*
   * Minimum jest tu jedynką, choć ekran chce trzech pozycji.
   *
   * Normalizacja potrafi odrzucić wadliwą pozycję (nieznany obszar, zalecenie
   * bez tytułu) i wtedy zostaje mniej, niż model obiecał. Prawdziwe minimum
   * pilnuje trasa /api/ai/wyglad: raport z mniej niż trzema podocenami albo
   * bez żadnego zalecenia nie zostaje zapisany, tylko wraca jako prośba
   * o powtórzenie. Schemat, który tego nie odzwierciedla, kłamie o danych,
   * które faktycznie przez niego przechodzą.
   */
  podoceny: z.array(PodocenaSchema).min(1).max(9),
  mocne_strony: z.array(z.string().max(120)).max(3),
  plan: z.array(ZalecenieSchema).min(1).max(6).describe("Uszeregowane po priorytecie."),
  najwieksza_dzwignia: z.string().max(160).describe("JEDNA rzecz na najbliższe 30 dni."),
  jakosc_zdjecia: z.object({
    wystarczajaca: z.boolean(),
    uwagi: z
      .string()
      .max(200)
      .describe("np. 'zdjęcie prześwietlone, oceny skóry są niepewne'"),
  }),
});

export type WygladAnalysis = z.infer<typeof WygladAnalysisSchema>;
export type Zalecenie = WygladAnalysis["plan"][number];
export type Podocena = WygladAnalysis["podoceny"][number];

/* ============================================================
 * Schemat wysyłany do modelu i sprowadzanie odpowiedzi do limitów
 * ============================================================
 *
 * Tu leżała przyczyna błędu "Analiza się nie udała. Spróbuj ponownie."
 *
 * `zodOutputFormat` NIE przenosi ograniczeń Zoda do gramatyki, którą model
 * jest wiązany. `z.enum(...)`, `.max(240)`, `.min(3)` i `.regex(...)` lądują
 * w OPISIE pola jako tekst w rodzaju "{maxLength: 240}" - czyli jako prośba,
 * nie jako reguła. Model ją zwykle spełnia, ale nie zawsze: przy prawdziwym
 * zdjęciu obserwacje są bogatsze i 240 znaków łatwo przekroczyć.
 *
 * Za to `messages.parse()` waliduje odpowiedź PEŁNYM schematem i rzuca
 * wyjątkiem, gdy obserwacja ma 241 znaków. Efekt: opłacone wywołanie modelu
 * lądowało w koszu, a użytkownik widział "spróbuj ponownie" - i próbował,
 * z tym samym skutkiem.
 *
 * Rozwiązanie: model odpowiada na schemat bez twardych limitów (opisy dalej
 * mówią, jak ma być), a limity egzekwujemy sami - przycinając. Przycięte
 * zdanie jest o niebo lepsze niż brak analizy za te same pieniądze.
 */

/** Wersja pola bez limitu - limit zostaje w opisie, bo tylko tam działa. */
const luznyTekst = (opis?: string) => (opis ? z.string().describe(opis) : z.string());

const PodocenaWire = z.object({
  klucz: z
    .string()
    .describe(`Jeden z: ${PODOCENA_KLUCZE.join(", ")}. Dokładnie ten napis, bez odmiany.`),
  ocena: z.number().describe("Liczba całkowita 0-100."),
  obserwacja: luznyTekst("Co konkretnie widać. Opisowo, bez ogólników. Do 240 znaków."),
});

const ZalecenieWire = z.object({
  kategoria: z.string().describe(`Jedna z: ${KATEGORIE.join(", ")}. Dokładnie ten napis.`),
  tytul: luznyTekst("Do 80 znaków."),
  dlaczego: luznyTekst("Powiąż z obserwacją ze skanu albo liczbą z FAKTÓW. Do 400 znaków."),
  jak: z.array(z.string()).describe("Do 6 kroków, każdy do 160 znaków. Konkret, nie 'zadbaj o'."),
  czestotliwosc: luznyTekst("np. 'codziennie wieczorem', '3× w tygodniu'. Do 60 znaków."),
  horyzont_tygodni: z.number().describe("Liczba całkowita 1-52. Realny czas do efektu."),
  priorytet: z.number().describe("Liczba całkowita 1-3, gdzie 1 = największy wpływ."),
  klucz: luznyTekst(
    "Stały identyfikator: małe litery, cyfry i podkreślenia, np. 'wieczor_retinoid'. Ten sam przy kolejnych skanach.",
  ),
});

/** To dostaje model. Kształt ten sam, twardych limitów brak. */
export const WygladWireSchema = z.object({
  ocena_ogolna: z.number().describe("Liczba całkowita 0-100."),
  podsumowanie: luznyTekst("3-4 zdania, do 500 znaków. Rzeczowo."),
  podoceny: z.array(PodocenaWire).describe("Od 3 do 9 pozycji."),
  mocne_strony: z.array(z.string()).describe("Do 3 pozycji, każda do 120 znaków."),
  plan: z.array(ZalecenieWire).describe("Od 3 do 6 zaleceń, uszeregowanych po priorytecie."),
  najwieksza_dzwignia: luznyTekst("JEDNA rzecz na najbliższe 30 dni. Do 160 znaków."),
  jakosc_zdjecia: z.object({
    wystarczajaca: z.boolean(),
    uwagi: luznyTekst("np. 'zdjęcie prześwietlone, oceny skóry są niepewne'. Do 200 znaków."),
  }),
});

export type WygladWire = z.infer<typeof WygladWireSchema>;

/**
 * Odpowiedź modelu sprowadzona do tego, co obiecuje `WygladAnalysisSchema`.
 *
 * Wszystko, co da się uratować, jest ratowane: tekst przycinany, liczby
 * dociskane do zakresu, nieznane klucze podocen odrzucane, nieznana kategoria
 * lądująca w "nawyki". Nic tu nie rzuca wyjątkiem - bo cena wyjątku to
 * wyrzucone, opłacone wywołanie modelu.
 */
export function normalizujAnalize(surowa: WygladWire): WygladAnalysis {
  const podoceny = (surowa.podoceny ?? [])
    .map((p) => ({
      klucz: slug(p.klucz ?? "") as PodocenaKlucz,
      ocena: liczba(p.ocena, 0, 100),
      obserwacja: przytnij(p.obserwacja ?? "", 240),
    }))
    .filter((p) => (PODOCENA_KLUCZE as readonly string[]).includes(p.klucz));

  // Dwie oceny tego samego obszaru rozjechałyby wykres postępu.
  const podocenyBezPowtorek = bezDuplikatow(podoceny, (p) => p.klucz).slice(0, 9);

  const plan = (surowa.plan ?? [])
    .map((z, i) => {
      return {
        kategoria: zListy<Kategoria>(z.kategoria ?? "", KATEGORIE, "nawyki"),
        tytul: przytnij(z.tytul ?? "", 80),
        dlaczego: przytnij(z.dlaczego ?? "", 400),
        jak: (z.jak ?? []).map((k) => przytnij(k, 160)).slice(0, 6),
        czestotliwosc: przytnij(z.czestotliwosc ?? "", 60),
        horyzont_tygodni: liczba(z.horyzont_tygodni, 1, 52),
        priorytet: liczba(z.priorytet, 1, 3),
        klucz: slug(z.klucz ?? "", slug(z.tytul ?? "", `zalecenie_${i + 1}`)),
      };
    })
    .filter((z) => z.tytul.length > 0);

  // Ten sam klucz dwa razy zepsułby upsert rutyn (jeden wiersz na klucz).
  const planBezPowtorek = bezDuplikatow(plan, (z) => z.klucz).slice(0, 6);

  return {
    ocena_ogolna: liczba(surowa.ocena_ogolna, 0, 100),
    podsumowanie: przytnij(surowa.podsumowanie ?? "", 500),
    podoceny: podocenyBezPowtorek,
    mocne_strony: (surowa.mocne_strony ?? []).map((m) => przytnij(m, 120)).slice(0, 3),
    plan: planBezPowtorek,
    najwieksza_dzwignia: przytnij(surowa.najwieksza_dzwignia ?? "", 160),
    jakosc_zdjecia: {
      wystarczajaca: Boolean(surowa.jakosc_zdjecia?.wystarczajaca),
      uwagi: przytnij(surowa.jakosc_zdjecia?.uwagi ?? "", 200),
    },
  };
}
