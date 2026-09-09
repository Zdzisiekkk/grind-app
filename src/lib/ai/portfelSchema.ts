import { z } from "zod";

/**
 * Kształt odczytu portfela ze zrzutu ekranu.
 *
 * Model ma tu jedno zadanie: PRZEPISAĆ to, co widzi. Nie wycenia, nie
 * uzupełnia z pamięci i nie domyśla się kursów - każda taka uprzejmość
 * kończyłaby się liczbą, która wygląda wiarygodnie i jest zmyślona.
 *
 * Stąd `suma_z_ekranu`: broker prawie zawsze pokazuje wartość całego portfela.
 * Porównanie jej z sumą odczytanych pozycji to jedyny automatyczny sposób
 * sprawdzenia, czy model czegoś nie przeoczył albo nie pomylił separatora.
 */
export const AktywoWireSchema = z.object({
  symbol: z.string().max(16).nullable().describe("Ticker widoczny na ekranie, np. CDR. null gdy go nie ma."),
  nazwa: z.string().min(1).max(80).describe("Nazwa instrumentu tak, jak widnieje na ekranie."),
  typ: z
    .enum(["akcje", "etf", "obligacje", "krypto", "metale", "fundusz", "inne"])
    .describe("Rodzaj instrumentu. Gdy nie wiadomo: inne."),
  ilosc: z.number().nonnegative().describe("Liczba sztuk lub jednostek."),
  cena: z.number().nonnegative().describe("Cena za jedną sztukę, w walucie notowania."),
  waluta: z.string().length(3).describe("Trzyliterowy kod waluty ceny, np. PLN, USD, EUR."),
  wartosc: z.number().nonnegative().nullable().describe("Wartość pozycji pokazana na ekranie, jeśli widoczna."),
  pewnosc: z.enum(["wysoka", "srednia", "niska"]).describe("Jak czytelne były liczby tej pozycji."),
});

export const OdczytPortfelaWireSchema = z.object({
  rozpoznane: z.boolean().describe("Czy to w ogóle jest zrzut ekranu portfela."),
  uwaga: z.string().max(300).describe("Jedno zdanie o tym, co było nieczytelne albo warte sprawdzenia."),
  waluta_portfela: z.string().length(3).nullable(),
  suma_z_ekranu: z
    .number()
    .nonnegative()
    .nullable()
    .describe("Łączna wartość portfela wypisana na ekranie. null, gdy nie widać."),
  pozycje: z.array(AktywoWireSchema).max(60),
});

export type OdczytPortfela = z.infer<typeof OdczytPortfelaWireSchema>;
export type AktywoZOdczytu = z.infer<typeof AktywoWireSchema>;

/** Ile procent może się rozjechać suma pozycji od sumy pokazanej na ekranie. */
export const TOLERANCJA_SUMY = 0.01;

/**
 * Czy odczyt spina się z sumą wypisaną przez brokera.
 *
 * Zwraca `null`, gdy nie ma czego porównać - brak sumy na ekranie to nie
 * to samo co rozjazd i nie wolno tego pokazywać jako ostrzeżenia.
 */
export function zgodnoscSumy(odczyt: OdczytPortfela): {
  suma: number;
  rozjazd: number | null;
  ok: boolean;
} {
  const suma = odczyt.pozycje.reduce(
    (s, p) => s + (p.wartosc ?? p.ilosc * p.cena),
    0,
  );
  if (odczyt.suma_z_ekranu == null || odczyt.suma_z_ekranu <= 0) {
    return { suma, rozjazd: null, ok: true };
  }
  const rozjazd = suma - odczyt.suma_z_ekranu;
  return {
    suma,
    rozjazd,
    ok: Math.abs(rozjazd) <= odczyt.suma_z_ekranu * TOLERANCJA_SUMY,
  };
}
