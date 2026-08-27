/*
 * Sprawdza czytanie numerów ISBN.
 *
 * Kod z okładki bywa odczytany z jedną przekłamaną cyfrą — i wtedy suma
 * kontrolna jest jedyną rzeczą, która stoi między „przeskanuj jeszcze raz"
 * a cichym dodaniem cudzej książki na półkę.
 *
 * Uruchom: npm run test:isbn
 */
import { bookFromOpenLibrary, cleanIsbn, looksLikeBookBarcode, normalizeIsbn }
  from "../src/lib/isbn.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
};

console.log("\n  Normalizacja\n");

check("myślniki i spacje nie przeszkadzają",
  normalizeIsbn("978-0-7352-1129-2") === "9780735211292",
  normalizeIsbn("978-0-7352-1129-2"));

check("ISBN-10 przelicza się na ISBN-13",
  normalizeIsbn("0735211299") === "9780735211292",
  normalizeIsbn("0735211299"));

check("ISBN-10 z końcówką X jest poprawny",
  normalizeIsbn("080442957X") !== null, normalizeIsbn("080442957X"));

check("polska książka z prefiksem 978-83",
  normalizeIsbn("9788324631766") === "9788324631766");

console.log("\n  Suma kontrolna\n");

// Ta sama książka z jedną przekłamaną cyfrą — dokładnie to, co robi zły odczyt.
check("jedna zmieniona cyfra odrzucona",
  normalizeIsbn("9780735211293") === null, String(normalizeIsbn("9780735211293")));

check("dwie zamienione cyfry odrzucone",
  normalizeIsbn("9780735211922") === null);

check("za krótki numer odrzucony", normalizeIsbn("97807352") === null);
check("litery odrzucone", normalizeIsbn("97807352112AB") === null);
check("pusty ciąg odrzucony", normalizeIsbn("") === null);
check("X w środku odrzucony", normalizeIsbn("07X5211299") === null);

console.log("\n  Kody kreskowe\n");

check("kod książki rozpoznany", looksLikeBookBarcode("9780735211292"));
check("kod z prefiksem 979 też jest książką", looksLikeBookBarcode("9791234567896"),
  String(looksLikeBookBarcode("9791234567896")));
// Kod produktu spożywczego ma poprawną sumę EAN-13, ale nie jest ISBN-em —
// bez sprawdzenia prefiksu skaner łapałby paczkę ryżu leżącą obok książki.
check("kod zwykłego produktu odrzucony", !looksLikeBookBarcode("5901234123457"));
check("czyszczenie zostawia same znaki numeru",
  cleanIsbn(" 978-0-7352 1129-2 ") === "9780735211292");

console.log("\n  Odpowiedź Open Library\n");

const pelna = {
  "ISBN:9780735211292": {
    title: "Atomic Habits",
    authors: [{ name: "James Clear" }],
    number_of_pages: 319,
    cover: { small: "s.jpg", medium: "m.jpg", large: "l.jpg" },
  },
};
const book = bookFromOpenLibrary("9780735211292", pelna);
check("tytuł, autor i strony odczytane",
  book.title === "Atomic Habits" && book.author === "James Clear" && book.pages === 319,
  JSON.stringify(book));
check("okładka średnia ma pierwszeństwo", book.coverUrl === "m.jpg");

const dwoje = bookFromOpenLibrary("9780735211292", {
  "ISBN:9780735211292": {
    title: "Coś",
    authors: [{ name: "A. Kowalska" }, { name: "B. Nowak" }],
  },
});
check("dwóch autorów łączy się przecinkiem",
  dwoje.author === "A. Kowalska, B. Nowak", dwoje.author);

const ubogi = bookFromOpenLibrary("9780735211292", {
  "ISBN:9780735211292": { title: "Bez reszty" },
});
check("brak autora i stron to nie awaria",
  ubogi.title === "Bez reszty" && ubogi.author === null && ubogi.pages === null,
  JSON.stringify(ubogi));

check("pusta odpowiedź daje null", bookFromOpenLibrary("9780735211292", {}) === null);
check("odpowiedź o innym numerze daje null",
  bookFromOpenLibrary("9780735211292", { "ISBN:9788324631766": { title: "X" } }) === null);
check("wpis bez tytułu daje null",
  bookFromOpenLibrary("9780735211292", { "ISBN:9780735211292": { authors: [] } }) === null);
check("śmieci zamiast JSON-a nie wywracają odczytu",
  bookFromOpenLibrary("9780735211292", "nie-obiekt") === null);
check("absurdalna liczba stron pomijana",
  bookFromOpenLibrary("9780735211292", {
    "ISBN:9780735211292": { title: "T", number_of_pages: 99999 },
  }).pages === null);

console.log(fails ? `\n  BŁĘDÓW: ${fails}\n` : "\n  WSZYSTKO PRZESZŁO\n");
process.exit(fails ? 1 : 0);
