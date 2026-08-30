/*
 * Kody kreskowe produktów - suma kontrolna przed pytaniem do sieci.
 *
 * Aparat potrafi odczytać kod z wygniecionej folii o jedną cyfrę za dobrze.
 * Bez tej walidacji człowiek stojący w kuchni dostaje "nie znaleziono
 * produktu" zamiast "przyłóż kod jeszcze raz" - a to dwie różne informacje.
 */
import { normalizeFoodBarcode, looksLikeFoodBarcode } from "@/lib/barcode";

let ok = 0, bad = 0;
const check = (n, c, d = "") => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? " - " + d : ""}`); }
};

console.log("\n  Poprawne kody\n");
// Prawdziwe kody: woda Żywiec Zdrój, Nutella, Coca-Cola.
check("EAN-13 przechodzi", normalizeFoodBarcode("5900541000109") === "5900541000109",
  String(normalizeFoodBarcode("5900541000109")));
check("EAN-13 ze spacjami i myślnikami", normalizeFoodBarcode("3017 620-422003") === "3017620422003",
  String(normalizeFoodBarcode("3017 620-422003")));
check("EAN-8 przechodzi", normalizeFoodBarcode("96385074") === "96385074",
  String(normalizeFoodBarcode("96385074")));

console.log("\n  UPC-A z importu\n");
// UPC-A ma 12 cyfr; Open Food Facts trzyma je jako EAN-13 z zerem z przodu.
check("UPC-A dostaje wiodące zero", normalizeFoodBarcode("036000291452") === "0036000291452",
  String(normalizeFoodBarcode("036000291452")));
check("ten sam produkt zeskanowany jako EAN-13 daje ten sam numer",
  normalizeFoodBarcode("0036000291452") === normalizeFoodBarcode("036000291452"));

console.log("\n  Błędne odczyty\n");
check("zła suma kontrolna odrzucona", normalizeFoodBarcode("5900541000101") === null);
check("za krótki numer odrzucony", normalizeFoodBarcode("59005") === null);
check("dziesięć cyfr to nie kod produktu", normalizeFoodBarcode("5900541000") === null);
check("puste wejście odrzucone", normalizeFoodBarcode("") === null);
check("same litery odrzucone", normalizeFoodBarcode("jogurt") === null);

console.log("\n  Filtr dla aparatu\n");
check("looksLike przepuszcza poprawny kod", looksLikeFoodBarcode("3017620422003"));
check("looksLike odrzuca przekłamany odczyt", !looksLikeFoodBarcode("3017620422004"));
// ISBN to też poprawny EAN-13 - filtr aparatu go przepuści i tak ma być.
// Rozstrzyga dopiero Open Food Facts, które książki po prostu nie zna.
check("kod książki przechodzi filtr, bo formalnie jest kodem EAN",
  looksLikeFoodBarcode("9780201616224"));

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : " - WSZYSTKO PRZESZŁO"}\n`);
process.exit(bad ? 1 : 0);
