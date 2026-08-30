/**
 * Kody kreskowe produktów spożywczych.
 *
 * Sprawdzamy sumę kontrolną, zanim pójdziemy do Open Food Facts. Aparat potrafi
 * odczytać kod z wygniecionej folii o jedną cyfrę za dobrze i zwrócić numer,
 * który nie istnieje. Zapytanie o niego to sekunda czekania i komunikat
 * "nie znaleziono" zamiast prośby o ponowne przyłożenie kodu - a to dwie różne
 * rzeczy dla człowieka stojącego w kuchni z otwartym jogurtem.
 *
 * Obsługujemy trzy formaty, bo tyle chodzi po polskich sklepach:
 *   EAN-13 - standard europejski,
 *   EAN-8  - małe opakowania (guma, batony),
 *   UPC-A  - 12 cyfr, głównie import z USA.
 */

/** Suma kontrolna EAN/UPC: wagi 3 i 1 naprzemiennie, licząc od prawej. */
function checksum(cyfry: string): number {
  let suma = 0;
  const odwrotnie = [...cyfry].reverse();
  for (let i = 0; i < odwrotnie.length; i++) {
    suma += Number(odwrotnie[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (suma % 10)) % 10;
}

function poprawny(kod: string): boolean {
  const bezOstatniej = kod.slice(0, -1);
  return checksum(bezOstatniej) === Number(kod.slice(-1));
}

/**
 * Sprowadza odczyt do postaci, jakiej używa Open Food Facts.
 *
 * UPC-A rozszerzamy do EAN-13 zerem z przodu - OFF trzyma amerykańskie
 * produkty właśnie tak, więc bez tego ten sam batonik raz by się znajdował,
 * a raz nie, zależnie od tego, czym go zeskanowano.
 */
export function normalizeFoodBarcode(raw: string): string | null {
  const kod = raw.replace(/[^0-9]/g, "");

  if (kod.length === 13 && poprawny(kod)) return kod;
  if (kod.length === 12 && poprawny(kod)) return "0" + kod;
  if (kod.length === 8 && poprawny(kod)) return kod;

  return null;
}

/** Czy odczyt z aparatu w ogóle wygląda na kod produktu. */
export function looksLikeFoodBarcode(raw: string): boolean {
  return normalizeFoodBarcode(raw) !== null;
}
