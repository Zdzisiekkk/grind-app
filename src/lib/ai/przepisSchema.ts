import { z } from "zod";
import { przytnij, ulamek } from "@/lib/ai/limity";

/**
 * Przepisy z tego, co masz w domu.
 *
 * Model dostaje listę produktów ("kurczak, ryż, papryka, jogurt") i oddaje
 * trzy propozycje. Trzy, a nie jedną: przy jednej trafienie albo nie trafienie
 * decyduje o tym, czy wywołanie było warte pieniędzy, a przy trzech prawie
 * zawsze coś pasuje - i nie trzeba pytać po raz drugi.
 *
 * Składniki mają dokładnie ten sam kształt co przy opisie posiłku (wartości
 * NA 100 G osobno od gramatury), bo trafiają do tych samych tabel i tego
 * samego ekranu przeglądu. Jeden kształt znaczy jeden zestaw błędów do
 * przemyślenia, a nie dwa.
 */

const NA_100G = z.number().min(0).max(900);

export const SkladnikPrzepisuSchema = z.object({
  nazwa: z.string(),
  gramatura: z.number().min(1).max(5000),
  kcal_100g: NA_100G,
  bialko_100g: NA_100G,
  wegle_100g: NA_100G,
  tluszcz_100g: NA_100G,
  /** Czy to produkt z listy człowieka, czy coś, co trzeba dokupić. */
  masz: z.boolean(),
});

export const PropozycjaSchema = z.object({
  nazwa: z.string(),
  opis: z.string(),
  ikona: z.string(),
  porcje: z.number().min(1).max(12),
  czas_min: z.number().min(1).max(480),
  skladniki: z.array(SkladnikPrzepisuSchema).max(20),
  kroki: z.array(z.string()).max(12),
});

export const PropozycjePrzepisowSchema = z.object({
  rozpoznane: z.boolean(),
  uwaga: z.string(),
  propozycje: z.array(PropozycjaSchema).max(3),
});

export type SkladnikPrzepisu = z.infer<typeof SkladnikPrzepisuSchema>;
export type Propozycja = z.infer<typeof PropozycjaSchema>;
export type PropozycjePrzepisow = z.infer<typeof PropozycjePrzepisowSchema>;

/* ------------------------------------------------------------------
 * Schemat dla modelu
 *
 * Luźny, bez `.max()` i `.enum()` - te ograniczenia i tak nie wiążą modelu,
 * a `messages.parse()` rzuciłoby wyjątkiem przy pierwszym przekroczeniu.
 * Zamiast odrzucać całą odpowiedź, dociskamy ją niżej w `normalizujPrzepisy`.
 * Powód opisany szerzej w src/lib/ai/limity.ts.
 * ------------------------------------------------------------------ */

const SkladnikWire = z.object({
  nazwa: z.string().describe('Nazwa składnika po polsku, np. "pierś z kurczaka".'),
  gramatura: z.number().describe("Waga w gramach na CAŁY przepis, 1-5000."),
  kcal_100g: z.number().describe("Kalorie na 100 g, 0-900."),
  bialko_100g: z.number().describe("Białko w gramach na 100 g, 0-100."),
  wegle_100g: z.number().describe("Węglowodany w gramach na 100 g, 0-100."),
  tluszcz_100g: z.number().describe("Tłuszcz w gramach na 100 g, 0-100."),
  masz: z
    .boolean()
    .describe("true, jeśli składnik jest na liście produktów podanej przez człowieka."),
});

const PropozycjaWire = z.object({
  nazwa: z.string().describe("Nazwa dania po polsku, do sześciu słów."),
  opis: z.string().describe("Jedno zdanie: co to jest i dlaczego pasuje do tych produktów."),
  ikona: z.string().describe("Jedno emoji pasujące do dania, np. 🍲."),
  porcje: z.number().describe("Na ile porcji wychodzi całość, 1-12."),
  czas_min: z.number().describe("Czas przygotowania w minutach, 1-480."),
  skladniki: z.array(SkladnikWire).describe("Najwyżej 20 pozycji."),
  kroki: z
    .array(z.string())
    .describe("Kolejne kroki przygotowania, każdy jednym zdaniem. Najwyżej 12."),
});

export const PropozycjePrzepisowWireSchema = z.object({
  rozpoznane: z
    .boolean()
    .describe("false, jeśli lista nie zawiera jedzenia albo nie da się z niej nic ugotować."),
  uwaga: z
    .string()
    .describe(
      "Jedno zdanie po polsku o przyjętych założeniach albo o tym, czego zabrakło. " +
        "Przy rozpoznane=false - dlaczego się nie da.",
    ),
  propozycje: z.array(PropozycjaWire).describe("Dokładnie trzy propozycje, chyba że się nie da."),
});

export type PropozycjePrzepisowWire = z.infer<typeof PropozycjePrzepisowWireSchema>;

/** Kalorie całego przepisu - suma po składnikach. */
export function kcalPrzepisu(skladniki: SkladnikPrzepisu[]): number {
  return Math.round(
    skladniki.reduce((sum, s) => sum + (s.kcal_100g * s.gramatura) / 100, 0),
  );
}

/** Kalorie jednej porcji - to jest liczba, którą człowiek realnie zje. */
export function kcalPorcji(p: Propozycja): number {
  return Math.round(kcalPrzepisu(p.skladniki) / Math.max(1, p.porcje));
}

/**
 * Odpowiedź modelu sprowadzona do zakresów, w których liczy dziennik.
 *
 * Nic tu nie odrzucamy w całości: propozycja z jednym dziwnym składnikiem
 * jest wciąż użyteczna, a człowiek i tak ogląda ją przed zapisaniem.
 */
export function normalizujPrzepisy(surowy: PropozycjePrzepisowWire): PropozycjePrzepisow {
  const propozycje = (surowy.propozycje ?? [])
    .slice(0, 3)
    .map((p) => ({
      nazwa: przytnij(p.nazwa ?? "", 60) || "Przepis",
      opis: przytnij(p.opis ?? "", 200),
      // Emoji bywa parą znaków (rodzina, flagi), więc tniemy po punktach kodu,
      // a nie po jednostkach UTF-16 - inaczej zostałaby połówka znaku.
      ikona: [...(p.ikona ?? "🍲")].slice(0, 2).join("") || "🍲",
      porcje: ulamek(p.porcje, 1, 12),
      czas_min: Math.round(ulamek(p.czas_min, 1, 480)),
      skladniki: (p.skladniki ?? []).slice(0, 20).map((s) => ({
        nazwa: przytnij(s.nazwa ?? "", 80) || "Składnik",
        gramatura: ulamek(s.gramatura, 1, 5000),
        kcal_100g: ulamek(s.kcal_100g, 0, 900),
        bialko_100g: ulamek(s.bialko_100g, 0, 100),
        wegle_100g: ulamek(s.wegle_100g, 0, 100),
        tluszcz_100g: ulamek(s.tluszcz_100g, 0, 100),
        masz: Boolean(s.masz),
      })),
      kroki: (p.kroki ?? [])
        .slice(0, 12)
        .map((k) => przytnij(k ?? "", 300))
        .filter((k) => k.trim().length > 0),
    }))
    // Propozycja bez składników nie jest przepisem, tylko nazwą dania.
    .filter((p) => p.skladniki.length > 0);

  return {
    rozpoznane: Boolean(surowy.rozpoznane) && propozycje.length > 0,
    uwaga: przytnij(surowy.uwaga ?? "", 300),
    propozycje,
  };
}
