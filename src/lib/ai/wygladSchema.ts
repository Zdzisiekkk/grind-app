import { z } from "zod";

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
  podoceny: z.array(PodocenaSchema).min(3).max(9),
  mocne_strony: z.array(z.string().max(120)).max(3),
  plan: z.array(ZalecenieSchema).min(3).max(6).describe("Uszeregowane po priorytecie."),
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
