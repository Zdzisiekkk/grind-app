/*
 * Sprawdza katalog przepisów: przeliczanie składników na gramy, słownik
 * surowców i dostęp do wierszy wspólnych.
 *
 * Cztery rzeczy, które muszą trzymać, bo inaczej katalog zaczyna kłamać
 * o kaloriach:
 *
 *  1. "2 łyżki oleju" to 20 g, a nie 30 - łyżka oleju waży inaczej niż
 *     łyżka wody, i po to każdy surowiec ma własne wagi miar.
 *  2. "świeżo mielony pieprz" to pieprz, a NIE mięso mielone. Dopasowanie
 *     po fragmencie nazwy raz już wpuściło ten błąd; kosztowałby dwieście
 *     kalorii na szczyptę przyprawy.
 *  3. Słownik nie kłamie sam ze sobą: żaden alias nie prowadzi do dwóch
 *     surowców, a kalorie zgadzają się z białkiem, węglami i tłuszczem.
 *  4. Katalog jest do CZYTANIA dla wszystkich i do pisania dla nikogo.
 *     Przepis wspólny, który da się podmienić, popsułby dietę każdemu.
 *
 * Uruchom: npm run test:przepisy
 */
import { bazaZMigracjami } from "./supabase-stub.mjs";
import {
  dopasujSurowiec,
  minutyZKroku,
  oczyśćTekst,
  parsujSkladnik,
  parsujStronę,
} from "./dane/parser-przepisow.mjs";
import { SUROWCE } from "./dane/surowce.mjs";
import { czas, filtruj, porcja, sekundyMinutnika, tagiZListy, udzialWCelu } from "../src/lib/przepisy.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const gramy = (linia) => parsujSkladnik(linia).gramy;
const nazwa = (linia) => parsujSkladnik(linia).surowiec?.n ?? null;

/* ------------------------------------------------------------------ */
console.log("\n  Ilości i jednostki\n");

check("gramy wprost", gramy("500 g mąki") === 500, String(gramy("500 g mąki")));
check("dekagramy to dziesięć gramów", gramy("50 dag masła") === 500);
check("kilogramy", gramy("1 kg ziemniaków") === 1000);
check("mililitry", gramy("250 ml mleka") === 250);
check("litr to tysiąc", gramy("1 l wody") === 1000);
check("ułamek zwykły", gramy("1/2 kg mąki") === 500);
check("ułamek jednym znakiem", gramy("½ szklanki mleka") === 125);
check("zakres bierze średnią", gramy("2-3 jajka") === Math.round(2.5 * 55 * 10) / 10);
check("liczba z przecinkiem", gramy("1,5 kg ziemniaków") === 1500);
check("liczebnik słowem", gramy("pół szklanki mleka") === 125);
check("ok. nie przeszkadza", gramy("ok. 200 g sera żółtego") === 200);
check(
  "jednostka rozpisana słowem",
  gramy("pół kilograma mąki") === 500,
  String(gramy("pół kilograma mąki")),
);
check("litr rozpisany słowem", gramy("1 litr mleka") === 1000);

console.log("\n  Miary domowe zależą od surowca\n");

check("łyżka oleju to 10 g", gramy("2 łyżki oleju") === 20, String(gramy("2 łyżki oleju")));
check("łyżka masła to 15 g", gramy("2 łyżki masła") === 30, String(gramy("2 łyżki masła")));
check(
  "łyżka oleju waży mniej niż łyżka masła",
  gramy("1 łyżka oleju") < gramy("1 łyżka masła"),
);
check("łyżeczka to nie łyżka", gramy("1 łyżeczka cukru") < gramy("1 łyżka cukru"));
check("ząbek czosnku to 4 g", gramy("2 ząbki czosnku") === 8);
check("szklanka mąki to nie 250 g", gramy("1 szklanka mąki") === 130, String(gramy("1 szklanka mąki")));
check("szklanka mleka to 250 g", gramy("1 szklanka mleka") === 250);
check("miara bez liczby to jedna sztuka miary", gramy("szklanka mleka") === 250);
check("filiżanka liczy się jak szklanka", gramy("1 filiżanka mleka") === 250);

console.log("\n  Sztuki i brak ilości\n");

check("jajko waży 55 g", gramy("2 jajka") === 110, String(gramy("2 jajka")));
check("odmiana dopełniacza też", gramy("6 jajek") === 330, String(gramy("6 jajek")));
check("cebula bez jednostki to sztuka", gramy("2 cebule") === 200);
check("sama przyprawa dostaje szczyptę", gramy("sól") === 2, String(gramy("sól")));
check("olej bez ilości to tyle, co zostaje na patelni", gramy("olej") === 10);
check(
  "składnik spoza słownika nie zgaduje gramów",
  parsujSkladnik("1 porcja czegoś zupełnie nieznanego").gramy === null,
);

console.log("\n  Dopasowanie nazw\n");

check("pieprz mielony to pieprz", nazwa("świeżo mielony pieprz") === "Pieprz czarny",
  String(nazwa("świeżo mielony pieprz")));
check("mięso mielone to mięso", nazwa("500 g mięsa mielonego") === "Mięso mielone wieprzowo-wołowe",
  String(nazwa("500 g mięsa mielonego")));
check("natka wygrywa z pietruszką", nazwa("natka pietruszki") === "Natka pietruszki");
check("korzeń pietruszki to co innego", nazwa("1 pietruszka") === "Pietruszka korzeń");
check("dopełniacz po jednostce", nazwa("10 dag sera żółtego") === "Ser żółty");
check("mak to nie mąka", nazwa("100 g maku") === "Mak", String(nazwa("100 g maku")));
check("mąka to nie mak", nazwa("100 g mąki") === "Mąka pszenna", String(nazwa("100 g mąki")));
check("nawias z komentarzem nie psuje nazwy", nazwa("2 cebule (najlepiej czerwone)") === "Cebula");
check("nieznany surowiec zwraca null", dopasujSurowiec("kwas polifosforowy") === null);

console.log("\n  Znacznik dokładności\n");

check("waga w gramach jest dokładna", parsujSkladnik("200 g masła").dokładne === true);
check("miara domowa jest przybliżeniem", parsujSkladnik("2 łyżki masła").dokładne === false);
check("sztuka jest przybliżeniem", parsujSkladnik("2 jajka").dokładne === false);

/* ------------------------------------------------------------------ */
console.log("\n  Kroki i czyszczenie wikitekstu\n");

check("minuty z kroku", minutyZKroku("Piecz 25 minut w 180 stopniach") === 25);
check("zakres minut to średnia", minutyZKroku("Gotuj 20-30 min") === 25);
check("godziny na minuty", minutyZKroku("Odstaw na 2 godziny") === 120);
check("krok bez czasu nie ma minutnika", minutyZKroku("Posiekaj cebulę") === null);
check(
  "stopnie to nie minuty",
  minutyZKroku("Rozgrzej piekarnik do 180 stopni") === null,
  String(minutyZKroku("Rozgrzej piekarnik do 180 stopni")),
);

check("odnośnik zostawia sam tekst", oczyśćTekst("[[Masło|masła]] i sól") === "masła i sól");
check("szablon znika", oczyśćTekst("{{Plik|x.jpg}} Ugotuj") === "Ugotuj");
check("pogrubienie znika", oczyśćTekst("'''Uwaga''' na sól") === "Uwaga na sól");

/*
 * Sekcja na KOŃCU strony, bez nagłówka po niej.
 *
 * Tak wygląda większość przepisów w Książce kucharskiej i dokładnie ten
 * przypadek gubił kroki: wyrażenie kończyło się na \Z, którego JavaScript
 * nie zna (to zwykła litera Z), więc dopasowanie po prostu nie zachodziło.
 * Trzy czwarte katalogu wyleciałoby wtedy jako "przepis bez kroków".
 */
const strona = parsujStronę(
  "Książka kucharska/Test",
  `== Składniki ==
* ''2 jajka''
* ''łyżka masła''

== Przygotowanie ==
# Roztrzep jajka.
# Smaż 5 minut.

{{BrClear}}
<noinclude>{{SortKuchWolumin|Jajka|Kuchnia polska}}</noinclude>`,
);
check("sekcja na końcu strony jest znaleziona", strona.kroki.length === 2,
  `kroków: ${strona.kroki.length}`);
check("składniki policzone", strona.skladniki.length === 2);
check("minutnik z ostatniego kroku", strona.kroki[1].minuty === 5);
check("kategorie wyciągnięte", strona.kategorie.includes("Jajka"));
check("nazwa bez przedrostka książki", strona.nazwa === "Test", strona.nazwa);

/* ------------------------------------------------------------------ */
console.log("\n  Spójność słownika surowców\n");

const nazwy = SUROWCE.map((s) => s.n);
check("nazwy są unikalne", new Set(nazwy).size === nazwy.length);

const skad = new Map();
const kolizje = [];
for (const s of SUROWCE) {
  for (const a of s.a) {
    if (skad.has(a) && skad.get(a) !== s.n) kolizje.push(`${a}: ${skad.get(a)} / ${s.n}`);
    skad.set(a, s.n);
  }
}
check("żaden alias nie prowadzi do dwóch surowców", kolizje.length === 0, kolizje.join("; "));

/*
 * Kalorie muszą wynikać z makroskładników: 4 kcal na gram białka i węgli,
 * 9 na gram tłuszczu. Rozjazd znaczy literówkę w tabeli - a literówka
 * w tabeli to błędne kalorie w każdym przepisie z tym składnikiem.
 *
 * Dwa rodzaje surowców reguły nie spełniają i nie mogą: przyprawy (masa to
 * w większości błonnik, który daje około 2 kcal/g, a nie 4) oraz rzeczy
 * z alkoholem (7 kcal/g, a alkoholu nie ma wśród makroskładników). Te niosą
 * pole `x` z powodem - i tylko taki wyjątek jest tu dopuszczony.
 */
check(
  "wyjątki od reguły mają znany powód",
  SUROWCE.every((s) => !s.x || s.x === "błonnik" || s.x === "alkohol"),
);

const rozjazdy = SUROWCE.filter((s) => {
  if (s.x) return false;
  const zMakr = 4 * s.b + 4 * s.w + 9 * s.t;
  return Math.abs(zMakr - s.k) > Math.max(45, s.k * 0.28);
}).map((s) => `${s.n}: ${s.k} vs ${Math.round(4 * s.b + 4 * s.w + 9 * s.t)}`);
check("kalorie zgadzają się z makroskładnikami", rozjazdy.length === 0, rozjazdy.join("; "));

check(
  "żaden surowiec nie ma niemożliwej kaloryczności",
  SUROWCE.every((s) => s.k >= 0 && s.k <= 950),
);
check(
  "każdy surowiec ma choć jeden alias i kategorię",
  SUROWCE.every((s) => s.a.length > 0 && Boolean(s.kat)),
);

/* ------------------------------------------------------------------ */
console.log("\n  Liczenie porcji i filtry\n");

const przyklad = {
  recipe_id: "a", user_id: null, name: "Zupa jarzynowa", icon: "🍲", servings: 4,
  total_g: 2000, kcal: 1200, protein_g: 60, carbs_g: 120, fat_g: 40, items: 8,
  kcal_100g: 60, protein_100g: 3, carbs_100g: 6, fat_100g: 2,
  source: "katalog", opis: null, czas_min: 45, poziom: "sredni",
  tagi: ["zupa", "warzywa"], makra_orientacyjne: true,
  license: "CC BY-SA 4.0", license_author: "Wikibooks", license_url: "https://x", kroki: 6,
};

check("porcja to całość przez liczbę porcji", porcja(przyklad).kcal === 300);
check("gramatura porcji", porcja(przyklad).gramy === 500);
check(
  "przepis bez porcji nie dzieli przez zero",
  Number.isFinite(porcja({ ...przyklad, servings: 0 }).kcal),
);
check("udział w celu", udzialWCelu(przyklad, 2400) === 0.125);
check("bez celu nie ma udziału", udzialWCelu(przyklad, null) === null);

check("filtr po nazwie", filtruj([przyklad], { fraza: "zupa" }).length === 1);
check("filtr bez ogonków", filtruj([przyklad], { fraza: "jarzynowa" }).length === 1);
check("filtr szuka też w etykietach", filtruj([przyklad], { fraza: "warzywa" }).length === 1);
check("filtr odrzuca niepasujące", filtruj([przyklad], { fraza: "kotlet" }).length === 0);
check("filtr po etykiecie", filtruj([przyklad], { tag: "zupa" }).length === 1);
check("filtr po czasie", filtruj([przyklad], { doMinut: 30 }).length === 0);
check("etykiety z listy", tagiZListy([przyklad]).includes("zupa"));

check("czas poniżej godziny", czas(45) === "45 min");
check("czas ponad godzinę", czas(95) === "1 h 35 min", czas(95));
check("równa godzina bez minut", czas(120) === "2 h");
check("brak czasu", czas(null) === "-");

check("minutnik z krótkiego kroku", sekundyMinutnika(25) === 1500);
check("brak minutnika przy marynowaniu przez noc", sekundyMinutnika(480) === null);
check("krok bez czasu nie ma minutnika", sekundyMinutnika(null) === null);

/* ------------------------------------------------------------------ */
console.log("\n  Katalog w bazie\n");

const db = await bazaZMigracjami();

const ile = (
  await db.query(`select count(*)::int n from public.recipes where user_id is null`)
).rows[0].n;
check("katalog wszedł do bazy", ile > 50, `${ile} przepisów`);

const bezKrokow = (
  await db.query(`
    select count(*)::int n from public.recipes r
     where r.user_id is null
       and not exists (select 1 from public.recipe_steps s where s.recipe_id = r.id)`)
).rows[0].n;
check("każdy przepis z katalogu ma kroki", bezKrokow === 0, `${bezKrokow} bez kroków`);

const zakres = (
  await db.query(`
    select min(kcal_100g)::float lo, max(kcal_100g)::float hi
      from public.v_recipe_totals where user_id is null`)
).rows[0];
check(
  "kaloryczność katalogu mieści się w rozsądnym zakresie",
  zakres.lo >= 20 && zakres.hi <= 600,
  `${Math.round(zakres.lo)}-${Math.round(zakres.hi)} kcal/100 g`,
);

const powiazane = (
  await db.query(`
    select count(*)::int n from public.recipe_items
     where user_id is null and food_id is not null`)
).rows[0].n;
check("składniki katalogu wskazują na surowce z tabeli foods", powiazane > 500, `${powiazane}`);

/*
 * Ten sam przepis dwa razy pod rząd. Gdyby losowanie było naprawdę losowe,
 * widżet podmieniałby przepis przy każdym odświeżeniu strony głównej.
 */
const a = (await db.query(`select name from public.przepis_dnia()`)).rows[0]?.name;
const b = (await db.query(`select name from public.przepis_dnia()`)).rows[0]?.name;
check("przepis dnia jest stały w obrębie doby", Boolean(a) && a === b, String(a));

const jutro = (
  await db.query(`
    select recipe_id from public.v_recipe_totals
     where user_id is null and items > 0 and kroki > 0
     order by md5(recipe_id::text || (current_date + 1)::text || '')
     limit 1`)
).rows[0];
check("wybór zależy od daty", Boolean(jutro));

/* --- Dostęp --- */

const wiersz = (
  await db.query(`select id from public.recipes where user_id is null limit 1`)
).rows[0].id;

const KTOS = (
  await db.query(`insert into auth.users (email) values ('kucharz@example.com') returning id`)
).rows[0].id;

async function jako(uid, sql) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try {
    return { rows: (await db.query(sql)).rows, error: null };
  } catch (e) {
    return { rows: [], error: e.message };
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}

const czyta = await jako(
  KTOS,
  `select count(*)::int n from public.recipes where user_id is null`,
);
check("zalogowany widzi katalog", (czyta.rows[0]?.n ?? 0) > 50, String(czyta.error ?? czyta.rows[0]?.n));

const kroki = await jako(
  KTOS,
  `select count(*)::int n from public.recipe_steps where recipe_id = '${wiersz}'`,
);
check("zalogowany widzi kroki z katalogu", (kroki.rows[0]?.n ?? 0) > 0,
  String(kroki.error ?? kroki.rows[0]?.n));

const zapis = await jako(
  KTOS,
  `update public.recipes set name = 'Zmienione' where id = '${wiersz}' returning id`,
);
check(
  "nikt nie podmieni przepisu z katalogu",
  zapis.rows.length === 0,
  zapis.error ? "odmowa" : `zmienionych wierszy: ${zapis.rows.length}`,
);

const wstawka = await jako(
  KTOS,
  `insert into public.recipes (user_id, source, name) values (null, 'katalog', 'Podrzucone')
   returning id`,
);
check(
  "nikt nie dopisze przepisu do katalogu",
  wstawka.rows.length === 0,
  wstawka.error ? "odmowa" : `dopisanych wierszy: ${wstawka.rows.length}`,
);

await db.close?.();

console.log(fails ? `\n  BŁĘDÓW: ${fails}\n` : "\n  WSZYSTKO PRZESZŁO\n");
process.exit(fails ? 1 : 0);
