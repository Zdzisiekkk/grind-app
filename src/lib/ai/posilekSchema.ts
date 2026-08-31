import { z } from "zod";
import { przytnij, ulamek, zListy } from "@/lib/ai/limity";

/**
 * Kształt odpowiedzi na opis posiłku.
 *
 * Model dostaje zdanie ("dwa jajka sadzone i kromka razowego"), a oddaje
 * listę składników. Ten sam schemat wymusza format odpowiedzi i waliduje ją
 * przed pokazaniem - modelowi nie wierzymy na słowo.
 *
 * Wartości są NA 100 G, a gramatura osobno - mimo że model mógłby od razu
 * podać sumy. Powód jest praktyczny: `meal_entries` trzyma dokładnie taką
 * parę i sam wylicza sumy, a człowiek, który poprawi "dwa jajka" na trzy,
 * dostaje przeliczone kalorie bez kolejnego pytania do modelu. Suma zamiast
 * gęstości znaczyłaby, że każda poprawka kosztuje pieniądze.
 */

/** Tłuszcz to około 900 kcal/100 g i nic jadalnego nie jest gęstsze. */
const NA_100G = z.number().min(0).max(900);

export const SkladnikSchema = z.object({
  nazwa: z.string().describe("Nazwa składnika po polsku, np. \"jajko sadzone\"."),
  gramatura: z
    .number()
    .min(1)
    .max(5000)
    .describe("Waga tego składnika w gramach, po przygotowaniu - tyle, ile realnie zjedzono."),
  kcal_100g: NA_100G.describe("Kalorie na 100 g."),
  bialko_100g: NA_100G.describe("Białko w gramach na 100 g."),
  wegle_100g: NA_100G.describe("Węglowodany w gramach na 100 g."),
  tluszcz_100g: NA_100G.describe("Tłuszcz w gramach na 100 g."),
  pewnosc: z
    .enum(["wysoka", "srednia", "niska"])
    .describe(
      "wysoka - produkt jednoznaczny i zważony; srednia - typowa porcja bez wagi; " +
        "niska - potrawa złożona albo opis nieprecyzyjny.",
    ),
});

export const OpisPosilkuSchema = z.object({
  rozpoznane: z
    .boolean()
    .describe("false, jeśli opis nie jest o jedzeniu albo nie da się z niego nic wywnioskować."),
  uwaga: z
    .string()
    .describe(
      "Jedno krótkie zdanie po polsku o przyjętych założeniach, np. \"Liczyłem średnie jajko 55 g\". " +
        "Przy rozpoznane=false - dlaczego się nie da.",
    ),
  skladniki: z.array(SkladnikSchema).max(15),
});

export type Skladnik = z.infer<typeof SkladnikSchema>;
export type OpisPosilku = z.infer<typeof OpisPosilkuSchema>;

/* ------------------------------------------------------------------
 * Schemat dla modelu i sprowadzanie odpowiedzi do limitów
 *
 * Powód w src/lib/ai/limity.ts. Kolejność ma tu znaczenie: najpierw
 * dociskamy wartości do zakresów, DOPIERO POTEM działa filtr spójności.
 * Odwrotnie sprawdzalibyśmy fizykę na liczbach, o których już wiadomo,
 * że są poza skalą.
 * ------------------------------------------------------------------ */

export const PEWNOSCI = ["wysoka", "srednia", "niska"] as const;
export type Pewnosc = (typeof PEWNOSCI)[number];

const SkladnikWire = z.object({
  nazwa: z.string().describe('Nazwa składnika po polsku, np. "jajko sadzone".'),
  gramatura: z
    .number()
    .describe("Waga w gramach po przygotowaniu, 1-5000 - tyle, ile realnie zjedzono."),
  kcal_100g: z.number().describe("Kalorie na 100 g, 0-900."),
  bialko_100g: z.number().describe("Białko w gramach na 100 g, 0-100."),
  wegle_100g: z.number().describe("Węglowodany w gramach na 100 g, 0-100."),
  tluszcz_100g: z.number().describe("Tłuszcz w gramach na 100 g, 0-100."),
  pewnosc: z
    .string()
    .describe(
      "Dokładnie jeden z: wysoka (produkt jednoznaczny i zważony), srednia (typowa porcja bez wagi), niska (potrawa złożona albo opis nieprecyzyjny).",
    ),
});

export const OpisPosilkuWireSchema = z.object({
  rozpoznane: z
    .boolean()
    .describe("false, jeśli opis nie jest o jedzeniu albo nie da się z niego nic wywnioskować."),
  uwaga: z
    .string()
    .describe(
      'Jedno krótkie zdanie po polsku o przyjętych założeniach, np. "Liczyłem średnie jajko 55 g". Przy rozpoznane=false - dlaczego się nie da.',
    ),
  skladniki: z.array(SkladnikWire).describe("Najwyżej 15 pozycji."),
});

export type OpisPosilkuWire = z.infer<typeof OpisPosilkuWireSchema>;

/**
 * Opis posiłku sprowadzony do zakresów, w których liczy dziennik.
 *
 * Makroskładniki dociskamy do 100 g na 100 g produktu, bo więcej się w nim
 * fizycznie nie zmieści - a filtr spójności i tak sprawdzi to jeszcze raz,
 * już na czystych liczbach.
 */
export function normalizujPosilek(surowy: OpisPosilkuWire): OpisPosilku {
  const skladniki = (surowy.skladniki ?? [])
    .map((s) => ({
      nazwa: przytnij(s.nazwa ?? "", 80),
      gramatura: ulamek(s.gramatura, 1, 5000),
      kcal_100g: ulamek(s.kcal_100g, 0, 900),
      bialko_100g: ulamek(s.bialko_100g, 0, 100),
      wegle_100g: ulamek(s.wegle_100g, 0, 100),
      tluszcz_100g: ulamek(s.tluszcz_100g, 0, 100),
      pewnosc: zListy<Pewnosc>(s.pewnosc ?? "", PEWNOSCI, "niska"),
    }))
    .filter((s) => s.nazwa.length > 0)
    .slice(0, 15);

  return {
    rozpoznane: Boolean(surowy.rozpoznane),
    uwaga: przytnij(surowy.uwaga ?? "", 200),
    skladniki,
  };
}


/** Kalorie jednej pozycji po uwzględnieniu gramatury. */
export function kcalSkladnika(s: Pick<Skladnik, "kcal_100g" | "gramatura">): number {
  return Math.round((s.kcal_100g * s.gramatura) / 100);
}

/**
 * Siatka bezpieczeństwa na wartości, które nie trzymają się fizyki.
 *
 * To NIE jest audyt żywieniowy, tylko wyłapanie grubych pomyłek, zanim wejdą
 * do bilansu dnia i cicho go przekłamią. Prosta reguła "białko i węglowodany
 * po 4 kcal/g, tłuszcz 9" nie nadaje się na jeden próg, bo rozjeżdża się
 * w OBIE strony przy zwyczajnym jedzeniu - sprawdziłem na tablicach:
 *
 *   - błonnik liczy się do węglowodanów, ale daje około 2 kcal/g zamiast 4,
 *     więc otręby wychodzą z sumy na dwa razy więcej, niż mają naprawdę.
 *     Ostry próg wycinałby produkty pełnoziarniste - czyli akurat te, które
 *     ludzie jedzą świadomie;
 *   - alkohol daje 7 kcal/g i nie ma go wśród makroskładników, więc piwo
 *     ma więcej kalorii, niż wynika z jego makr.
 *
 * Stąd trzy reguły zamiast jednej. Każda pilnuje czegoś, co nie ma legalnego
 * wyjątku, a wspólnie zostawiają szeroki środek na prawdziwe jedzenie.
 *
 * ZNANE OGRANICZENIE: czysty alkohol (wódka - 231 kcal przy zerowych makrach)
 * zostanie odrzucony, bo bez pola na alkohol nie ma czym tych kalorii
 * wytłumaczyć. Wolę odrzucić wpis niewerfikowalny, niż wpuścić do dziennika
 * zdrowia kalorie, których nie da się sprawdzić - od alkoholu jest w aplikacji
 * osobny moduł nałogów.
 */
export function makraSieZgadzaja(s: Skladnik): boolean {
  const { bialko_100g: bialko, wegle_100g: wegle, tluszcz_100g: tluszcz } = s;
  const kcal = s.kcal_100g;

  // 1. Fizyka: w 100 g produktu nie zmieści się więcej niż 100 g składników.
  //    Zapas na zaokrąglenia w tablicach, które potrafią sumować się do 101.
  if (bialko + wegle + tluszcz > 105) return false;

  // 2. Dolna granica od białka i tłuszczu. Te dwa nie mają odpowiednika
  //    błonnika - nie istnieje białko dające mniej niż 4 kcal/g. "81 g
  //    tłuszczu i 100 kcal" to pomyłka, nie produkt.
  if (bialko * 4 + tluszcz * 9 > kcal * 1.3 + 40) return false;

  // 3. Pasmo wokół sumy Atwatera. Dolna granica dzieli przez 2,2, bo tyle
  //    najwyżej potrafi zawyżyć błonnik. Górna mnoży przez 1,6 z zapasem,
  //    żeby przepuścić alkohol i zaokrąglenia. Stała +60/−25 ratuje produkty
  //    prawie bezkaloryczne, gdzie błąd procentowy jest duży, a bezwzględny
  //    nie znaczy nic (ogórek, herbata).
  const atwater = bialko * 4 + wegle * 4 + tluszcz * 9;
  if (kcal < atwater / 2.2 - 25) return false;
  if (kcal > atwater * 1.6 + 60) return false;

  return true;
}
