/*
 * Liczenie posiłku z opisu - część, której NIE wolno zostawić modelowi.
 *
 * Model szacuje wartości odżywcze i robi to nieźle, ale potrafi też podać
 * sensowne makra przy rozjechanych kaloriach. Taki wpis wchodzi do bilansu
 * dnia i przekłamuje go po cichu - człowiek nie ma jak tego zauważyć, bo
 * liczba wygląda normalnie. Dlatego spójność sprawdza kod, nie prompt.
 */
import { kcalSkladnika, makraSieZgadzaja, OpisPosilkuSchema, SkladnikSchema } from "@/lib/ai/posilekSchema";

let ok = 0, bad = 0;
const check = (n, c, d = "") => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? " - " + d : ""}`); }
};

const s = (o) => ({
  nazwa: "x", gramatura: 100, kcal_100g: 0,
  bialko_100g: 0, wegle_100g: 0, tluszcz_100g: 0, pewnosc: "srednia", ...o,
});

console.log("\n  Kalorie z gramatury\n");
check("100 g przy 155 kcal/100 g to 155 kcal", kcalSkladnika(s({ kcal_100g: 155 })) === 155);
check("dwa jajka (110 g) to 171 kcal", kcalSkladnika(s({ kcal_100g: 155, gramatura: 110 })) === 171);
check("pół porcji to połowa kalorii", kcalSkladnika(s({ kcal_100g: 200, gramatura: 50 })) === 100);
check("wynik jest liczbą całkowitą", Number.isInteger(kcalSkladnika(s({ kcal_100g: 155, gramatura: 37 }))));

console.log("\n  Spójność makroskładników\n");
// Prawdziwe wartości z tablic - te MUSZĄ przechodzić, inaczej filtr wycina
// poprawne pozycje i funkcja przestaje działać przy zwyczajnym jedzeniu.
check("jajko (155 kcal, B13 W1,1 T11)", makraSieZgadzaja(s({ kcal_100g: 155, bialko_100g: 13, wegle_100g: 1.1, tluszcz_100g: 11 })));
check("pierś z kurczaka (165 kcal, B31 W0 T3,6)", makraSieZgadzaja(s({ kcal_100g: 165, bialko_100g: 31, wegle_100g: 0, tluszcz_100g: 3.6 })));
check("masło (717 kcal, B0,9 W0,1 T81)", makraSieZgadzaja(s({ kcal_100g: 717, bialko_100g: 0.9, wegle_100g: 0.1, tluszcz_100g: 81 })));
check("chleb razowy (247 kcal, B8,5 W41 T3,4)", makraSieZgadzaja(s({ kcal_100g: 247, bialko_100g: 8.5, wegle_100g: 41, tluszcz_100g: 3.4 })));
check("ryż gotowany (130 kcal, B2,7 W28 T0,3)", makraSieZgadzaja(s({ kcal_100g: 130, bialko_100g: 2.7, wegle_100g: 28, tluszcz_100g: 0.3 })));
check("twaróg półtłusty (133 kcal, B18 W3,7 T5)", makraSieZgadzaja(s({ kcal_100g: 133, bialko_100g: 18, wegle_100g: 3.7, tluszcz_100g: 5 })));

// Błonnik i alkohol realnie rozjeżdżają sumę - tolerancja musi je przepuścić.
check("otręby z dużym błonnikiem przechodzą", makraSieZgadzaja(s({ kcal_100g: 185, bialko_100g: 16, wegle_100g: 64, tluszcz_100g: 4 })));

console.log("\n  Wartości, które muszą zostać odrzucone\n");
check("kalorie dwa razy za wysokie", !makraSieZgadzaja(s({ kcal_100g: 400, bialko_100g: 13, wegle_100g: 1, tluszcz_100g: 11 })));
check("kalorie dwa razy za niskie", !makraSieZgadzaja(s({ kcal_100g: 60, bialko_100g: 13, wegle_100g: 1, tluszcz_100g: 11 })));
check("same zera przy 300 kcal", !makraSieZgadzaja(s({ kcal_100g: 300 })));
check("makra bez kalorii", !makraSieZgadzaja(s({ kcal_100g: 0, bialko_100g: 20, wegle_100g: 20, tluszcz_100g: 10 })));

console.log("\n  Produkty prawie bezkaloryczne\n");
// Ogórek ma 15 kcal - błąd 5 kcal to 33%, czyli powyżej progu procentowego,
// a w praktyce nie znaczy nic. Bez osobnej gałęzi filtr wycinałby warzywa.
check("ogórek (15 kcal, B0,7 W3,6 T0,1)", makraSieZgadzaja(s({ kcal_100g: 15, bialko_100g: 0.7, wegle_100g: 3.6, tluszcz_100g: 0.1 })));
check("woda (0 kcal, zera)", makraSieZgadzaja(s({ kcal_100g: 0 })));
check("herbata bez cukru", makraSieZgadzaja(s({ kcal_100g: 1, bialko_100g: 0, wegle_100g: 0.2, tluszcz_100g: 0 })));
check("ale 'napój 5 kcal' z 20 g cukru już nie", !makraSieZgadzaja(s({ kcal_100g: 5, bialko_100g: 0, wegle_100g: 20, tluszcz_100g: 0 })));

console.log("\n  Granice, na których filtr się rozjeżdżał\n");
// Blonnik liczy sie do wegli, ale daje ~2 kcal/g zamiast 4. Bez osobnej
// dolnej granicy filtr wycinal produkty pelnoziarniste - czyli te, ktore
// ludzie jedza swiadomie. Ten test zlapal wade w mojej pierwszej regule.
check("otręby pszenne (216 kcal, B15 W65 T4) - dużo błonnika",
  makraSieZgadzaja(s({ kcal_100g: 216, bialko_100g: 15, wegle_100g: 65, tluszcz_100g: 4 })));
check("płatki owsiane (389 kcal, B17 W66 T7)",
  makraSieZgadzaja(s({ kcal_100g: 389, bialko_100g: 17, wegle_100g: 66, tluszcz_100g: 7 })));
check("soczewica gotowana (116 kcal, B9 W20 T0,4)",
  makraSieZgadzaja(s({ kcal_100g: 116, bialko_100g: 9, wegle_100g: 20, tluszcz_100g: 0.4 })));

// Alkohol daje 7 kcal/g i nie ma go wsrod makr, wiec kalorii jest wiecej,
// niz wynika z sumy - gorna granica musi to przepuscic.
check("piwo (43 kcal, B0,5 W3,6 T0)",
  makraSieZgadzaja(s({ kcal_100g: 43, bialko_100g: 0.5, wegle_100g: 3.6, tluszcz_100g: 0 })));

// ŚWIADOME OGRANICZENIE, nie przeoczenie: czystego alkoholu nie da się
// zweryfikować bez pola na alkohol, więc wpis jest odrzucany zamiast
// wpuszczany na słowo. Gdyby to kiedyś miało się zmienić, ten test upadnie
// i zmusi do decyzji, zamiast pozwolić jej się wydarzyć po cichu.
check("wódka (231 kcal, zerowe makra) jest odrzucana - udokumentowane ograniczenie",
  !makraSieZgadzaja(s({ kcal_100g: 231 })));

// Fizyka: w 100 g nie zmiesci sie 150 g skladnikow.
check("suma makr ponad 100 g na 100 g odrzucona",
  !makraSieZgadzaja(s({ kcal_100g: 500, bialko_100g: 50, wegle_100g: 50, tluszcz_100g: 50 })));
check("ale 99 g makr na 100 g przechodzi (produkty prawie czyste)",
  makraSieZgadzaja(s({ kcal_100g: 396, bialko_100g: 90, wegle_100g: 5, tluszcz_100g: 4 })));

console.log("\n  Schemat odpowiedzi\n");
const dobry = { nazwa: "jajko sadzone", gramatura: 55, kcal_100g: 196, bialko_100g: 13, wegle_100g: 0.8, tluszcz_100g: 15, pewnosc: "wysoka" };
check("poprawny składnik przechodzi", SkladnikSchema.safeParse(dobry).success);
check("gramatura zero odrzucona", !SkladnikSchema.safeParse({ ...dobry, gramatura: 0 }).success);
check("gramatura ponad 5 kg odrzucona", !SkladnikSchema.safeParse({ ...dobry, gramatura: 9000 }).success);
check("ujemne kalorie odrzucone", !SkladnikSchema.safeParse({ ...dobry, kcal_100g: -10 }).success);
// Nic jadalnego nie jest gęstsze od czystego tłuszczu (~900 kcal/100 g).
check("kalorie ponad gęstość tłuszczu odrzucone", !SkladnikSchema.safeParse({ ...dobry, kcal_100g: 5000 }).success);
check("wymyślona pewność odrzucona", !SkladnikSchema.safeParse({ ...dobry, pewnosc: "bardzo wysoka" }).success);

check("odmowa rozpoznania to poprawna odpowiedź",
  OpisPosilkuSchema.safeParse({ rozpoznane: false, uwaga: "To nie jest opis jedzenia.", skladniki: [] }).success);
check("lista dłuższa niż 15 pozycji odrzucona",
  !OpisPosilkuSchema.safeParse({ rozpoznane: true, uwaga: "", skladniki: Array(16).fill(dobry) }).success);

console.log(`\n  zielone: ${ok}   czerwone: ${bad}\n`);
if (bad) { console.log("  SĄ BŁĘDY\n"); process.exit(1); }
console.log("  WSZYSTKO PRZESZŁO\n");
