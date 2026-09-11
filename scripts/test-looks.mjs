/*
 * Moduł "Wygląd" - liczenie, które NIE należy do modelu.
 *
 * Konflikt retinoidu z kwasami jest regułą, a nie opinią. Model, który raz na
 * dziesięć razy o niej zapomni, jest gorszy niż kod, który nie zapomina nigdy -
 * pod warunkiem, że ten kod ktoś sprawdził.
 */
import { konflikty, delty, deltaOdPoprzedniego, adherencja, zestawienia, grupaSkladnika } from "@/lib/looks";
import {
  WygladAnalysisSchema,
  normalizujAnalize,
  ocenaOgolna,
  uzgodnijZPorownaniem,
} from "@/lib/ai/wygladSchema";

let ok = 0, bad = 0;
const check = (n, c, d = "") => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? " - " + d : ""}`); }
};

console.log("\n  Rozpoznawanie składników\n");
check("retinol to retinoid", grupaSkladnika("Retinol 0,3%") === "retinoid");
check("tretynoina też", grupaSkladnika("tretynoina") === "retinoid");
check("kwas salicylowy to BHA", grupaSkladnika("Kwas salicylowy 2%") === "aha_bha");
check("nieznany składnik nie jest zgadywany", grupaSkladnika("gliceryna") === null);

console.log("\n  Konflikty\n");
const wieczorem = (nazwa, ...s) => ({ id: nazwa, nazwa, skladniki_aktywne: s, pora: "wieczor" });
const rano = (nazwa, ...s) => ({ id: nazwa, nazwa, skladniki_aktywne: s, pora: "rano" });

let k = konflikty([wieczorem("Serum A", "retinol"), wieczorem("Peeling", "kwas glikolowy"), rano("Filtr", "SPF 50")]);
check("retinoid i kwasy tego samego wieczoru wyłapane", k.some((x) => x.tytul.includes("kwasy")), JSON.stringify(k.map((x) => x.tytul)));
check("ostrzeżenie wymienia oba produkty", k.find((x) => x.tytul.includes("kwasy"))?.produkty.length === 2);

k = konflikty([wieczorem("Serum A", "retinol")]);
check("retinoid bez filtru rano to ostrzeżenie", k.some((x) => x.tytul.includes("bez filtru")));

k = konflikty([wieczorem("Serum A", "retinol"), rano("Filtr", "SPF 30")]);
check("z filtrem rano ostrzeżenie znika", !k.some((x) => x.tytul.includes("bez filtru")), JSON.stringify(k.map((x) => x.tytul)));

k = konflikty([wieczorem("A", "retinol"), wieczorem("B", "nadtlenek benzoilu"), rano("F", "spf")]);
check("retinoid z nadtlenkiem benzoilu wyłapany", k.some((x) => x.tytul.includes("nadtlenek")));

k = konflikty([rano("C", "witamina C"), wieczorem("R", "retinal"), rano("F", "spf")]);
check("witamina C rano i retinoid wieczorem to nie konflikt", !k.some((x) => x.tytul.includes("witamina")), JSON.stringify(k.map((x) => x.tytul)));

check("czysty zestaw nie generuje ostrzeżeń", konflikty([rano("Krem", "gliceryna"), rano("F", "spf")]).length === 0);

console.log("\n  Ocena ogólna liczona przez aplikację\n");

/*
 * Tu mieszkała połowa problemu "moja zmiana nie rusza oceny". Ocena ogólna
 * była liczbą wybraną przez model, bez żadnej reguły, i zawierała symetrię,
 * której nie da się zmienić. Teraz to średnia obszarów zmiennych.
 */
check("ocena ogólna to średnia obszarów", ocenaOgolna({ skora: 60, wlosy: 70 }) === 65);
check("symetria nie wchodzi do średniej", ocenaOgolna({ skora: 60, wlosy: 70, symetria: 10 }) === 65);
check("sama symetria to lepsze niż nic", ocenaOgolna({ symetria: 80 }) === 80);
check("brak ocen to brak oceny ogólnej, nie zero", ocenaOgolna({}) === null);
check("zaokrąglenie połówek w górę, jak round() w bazie", ocenaOgolna({ skora: 55, oczy: 50 }) === 53);

/*
 * Rozcieńczenie liczbowo: poprawa jednego obszaru o 20 punktów przy ośmiu
 * obszarach zmiennych to +2,5 w ogólnej. To jest uczciwa średnia - dlatego
 * ekran pokazuje obok zmianę każdego obszaru, a nie tylko jedną liczbę.
 */
const osiem = { skora: 60, oczy: 60, wlosy: 60, zarost: 60, zeby: 60, postawa: 60, sklad_ciala: 60, definicja_zuchwy: 60 };
check("+20 w jednym z ośmiu obszarów to +3 w ogólnej (średnia, zaokrąglona)",
  ocenaOgolna({ ...osiem, skora: 80 }) - ocenaOgolna(osiem) === 3,
  String(ocenaOgolna({ ...osiem, skora: 80 })));

console.log("\n  Delty między skanami\n");
const skan = (dzien, ogolna, skora, jakosc = true) => ({
  id: dzien, utworzono: `2026-0${dzien}-01T10:00:00Z`, ocena_ogolna: ogolna,
  oceny: { skora, definicja_zuchwy: 50 }, jakosc_ok: jakosc,
});

let d = delty([skan(1, 60, 55), skan(3, 68, 70)]);
check("ogólna delta liczona na wspólnych obszarach", d.find((x) => x.klucz === "ogolna")?.zmiana === 7, JSON.stringify(d));
check("delta podoceny policzona", d.find((x) => x.klucz === "skora")?.zmiana === 15);
check("największa zmiana jest pierwsza", d[0].klucz === "skora");

d = delty([skan(1, 60, 55), skan(2, 20, 20, false), skan(3, 68, 70)]);
check("skan ze złym zdjęciem nie psuje delty", d.find((x) => x.klucz === "ogolna")?.zmiana === 7, JSON.stringify(d));
check("jeden skan nie daje żadnej delty", delty([skan(1, 60, 55)]).length === 0);

d = delty([skan(1, 60, 55), { ...skan(2, null, 0), oceny: null }, skan(3, 68, 70)]);
check("skan bez oceny (nieudana analiza) nie liczy się do delty", d.find((x) => x.klucz === "ogolna")?.zmiana === 7, JSON.stringify(d));

/*
 * Dołożenie zdjęcia zębów nie jest zmianą wyglądu. Stara ocena ogólna 55
 * i nowa 62 różniły się wyłącznie tym, że doszedł obszar z oceną 90.
 */
const bezZebow = { id: "a", utworzono: "2026-01-01T10:00:00Z", ocena_ogolna: 55, jakosc_ok: true, oceny: { skora: 55, oczy: 55 } };
const zZebami = { id: "b", utworzono: "2026-02-01T10:00:00Z", ocena_ogolna: 67, jakosc_ok: true, oceny: { skora: 55, oczy: 55, zeby: 90 } };
d = delty([bezZebow, zZebami]);
check("nowe zdjęcie nie udaje poprawy w ocenie ogólnej", d.find((x) => x.klucz === "ogolna")?.zmiana === 0, JSON.stringify(d));

let dp = deltaOdPoprzedniego([skan(1, 60, 55), skan(3, 68, 70)]);
check("delta od poprzedniego liczona od nowszego", dp?.zmiana === 7 && dp?.obszarow === 2, JSON.stringify(dp));

dp = deltaOdPoprzedniego([skan(1, 60, 55), skan(3, 68, 70), { ...skan(4, null, 0), oceny: null }]);
check("nieudana analiza na szczycie nie chowa delty", dp?.zmiana === 7, JSON.stringify(dp));

dp = deltaOdPoprzedniego([{ ...skan(1, 0, 0), oceny: { skora: 0 } }, { ...skan(3, 10, 10), oceny: { skora: 10 } }]);
check("zero w ocenie to ocena, a nie jej brak", dp?.zmiana === 10, JSON.stringify(dp));

console.log("\n  Adherencja\n");
check("połowa dni to 50%", adherencja(["2026-08-01", "2026-08-03"], "2026-08-01", "2026-08-04") === 50,
  String(adherencja(["2026-08-01", "2026-08-03"], "2026-08-01", "2026-08-04")));
check("brak odhaczeń to 0%", adherencja([], "2026-08-01", "2026-08-30") === 0);
check("komplet to 100%", adherencja(["2026-08-01", "2026-08-02"], "2026-08-01", "2026-08-02") === 100);

console.log("\n  Zestawienia\n");
const s4 = [1, 2, 3, 4].map((i) => ({ utworzono: `2026-0${i}-01`, oceny: { skora: 40 + i * 10 } }));
let z = zestawienia({ skany: s4, senPrzedSkanem: [300, 380, 420, 470], czysteDniPrzedSkanem: [], wagaPrzySkanie: [] });
check("dłuższy sen i lepsza skóra dają dodatni związek", z[0]?.r > 0.9, JSON.stringify(z));
check("opis mówi o kierunku, nie o przyczynie", z[0]?.opis.includes("wyżej") && !z[0].opis.includes("powoduje"));
check("dwa punkty to za mało na jakikolwiek wniosek",
  zestawienia({ skany: s4.slice(0, 2), senPrzedSkanem: [300, 400], czysteDniPrzedSkanem: [], wagaPrzySkanie: [] }).length === 0);


/* ------------------------------------------------------------------
 * Sprowadzanie odpowiedzi modelu do limitów
 *
 * Tu mieszkał błąd "Analiza się nie udała. Spróbuj ponownie.": limity ze
 * schematu Zoda NIE trafiają do gramatyki modelu (zodOutputFormat przenosi je
 * do opisu pola), za to messages.parse() waliduje nimi odpowiedź. Obserwacja
 * dłuższa o dziewięć znaków wyrzucała całą, opłaconą już analizę.
 *
 * Reguła, której pilnują te testy: cokolwiek przyjdzie od modelu, po
 * normalizacji ma spełniać kontrakt ekranu. Nic nie leci do kosza.
 * ------------------------------------------------------------------ */

console.log("\n  Odpowiedź modelu poza limitami\n");

const dlugie = "Skóra w strefie T wykazuje wyraźne rozszerzenie porów oraz zaczerwienienie. ".repeat(6);

const surowa = {
  ocena_ogolna: 143,
  podsumowanie: dlugie,
  podoceny: [
    { klucz: "skora", ocena: 62.6, obserwacja: dlugie },
    { klucz: "Symetria", ocena: -12, obserwacja: "Lekka asymetria łuków brwiowych." },
    { klucz: "skora", ocena: 40, obserwacja: "Powtórka tego samego obszaru." },
    { klucz: "aura_energetyczna", ocena: 50, obserwacja: "Klucz spoza listy." },
    { klucz: "postawa", ocena: 71, obserwacja: "Barki lekko do przodu." },
  ],
  mocne_strony: [dlugie, "Gęste włosy.", "Symetryczne oczy.", "Czwarta pozycja ponad limit."],
  plan: [
    { kategoria: "Pielęgnacja", tytul: "Wieczorny retinoid", dlaczego: dlugie,
      jak: ["krok " .repeat(40), "b", "c", "d", "e", "f", "g", "h"],
      czestotliwosc: "codziennie wieczorem", horyzont_tygodni: 999, priorytet: 7,
      klucz: "Wieczór-Retinoid" },
    { kategoria: "wymyslona_kategoria", tytul: "Sen", dlaczego: "Za krótki sen.",
      jak: ["Kładź się o 23:00"], czestotliwosc: "codziennie", horyzont_tygodni: 0,
      priorytet: 0, klucz: "sen_dluzszy" },
    { kategoria: "dieta", tytul: "", dlaczego: "Pozycja bez tytułu.", jak: [],
      czestotliwosc: "", horyzont_tygodni: 4, priorytet: 2, klucz: "bez_tytulu" },
  ],
  najwieksza_dzwignia: dlugie,
  jakosc_zdjecia: { wystarczajaca: true, uwagi: dlugie },
};

const n = normalizujAnalize(surowa);
const kontrakt = WygladAnalysisSchema.safeParse(n);

check("odpowiedź poza limitami spełnia kontrakt po normalizacji", kontrakt.success,
  kontrakt.success ? "" : JSON.stringify(kontrakt.error.issues[0]));

check("obserwacja przycięta do 240 znaków",
  n.podoceny[0].obserwacja.length <= 240 && n.podoceny[0].obserwacja.endsWith("…"),
  `${n.podoceny[0].obserwacja.length} znaków`);
check("przycinamy na granicy słowa, nie w połowie wyrazu",
  !/\s…$/.test(n.podoceny[0].obserwacja) && n.podoceny[0].obserwacja.split(" ").pop().length > 1);
// skóra 63 i postawa 71; symetria (0) nie wchodzi. 143 od modelu jest ignorowane.
check("ocena ogólna od modelu jest ignorowana, liczy ją aplikacja", n.ocena_ogolna === 67, String(n.ocena_ogolna));
check("ocena ujemna wraca do zera", n.podoceny[1].ocena === 0, String(n.podoceny[1].ocena));
check("ułamek oceny zaokrągla się do całości", n.podoceny[0].ocena === 63, String(n.podoceny[0].ocena));
check("klucz z wielkiej litery rozpoznany jako znany obszar",
  n.podoceny.some((p) => p.klucz === "symetria"));
check("nieznany obszar wypada zamiast psuć raport",
  !n.podoceny.some((p) => p.klucz === "aura_energetyczna"));
check("ten sam obszar nie występuje dwa razy",
  new Set(n.podoceny.map((p) => p.klucz)).size === n.podoceny.length,
  n.podoceny.map((p) => p.klucz).join(", "));
check("mocne strony przycięte do trzech", n.mocne_strony.length === 3, String(n.mocne_strony.length));

check("polski klucz zalecenia sprowadzony do bezpiecznej postaci",
  n.plan[0].klucz === "wieczor_retinoid", n.plan[0].klucz);
check("nieznana kategoria ląduje w nawykach",
  n.plan[1].kategoria === "nawyki", n.plan[1].kategoria);
check("horyzont ponad rok docięty do 52 tygodni", n.plan[0].horyzont_tygodni === 52);
check("priorytet spoza skali docięty do 3", n.plan[0].priorytet === 3);
check("zero w priorytecie podniesione do 1", n.plan[1].priorytet === 1);
check("kroków najwyżej sześć", n.plan[0].jak.length === 6, String(n.plan[0].jak.length));
check("każdy krok mieści się w 160 znakach", n.plan[0].jak.every((k) => k.length <= 160));
check("zalecenie bez tytułu wypada", !n.plan.some((z) => z.tytul === ""), String(n.plan.length));

// Skan z jedną obserwacją nie jest raportem - trasa ma go odrzucić, nie zapisać.
const chudy = normalizujAnalize({ ...surowa, podoceny: [surowa.podoceny[0]], plan: [] });
check("z pustego planu nie robi się plan", chudy.plan.length === 0);
check("chudy raport zostaje chudy, a nie zmyślony", chudy.podoceny.length === 1);

// Odpowiedź w limitach ma przechodzić bez tknięcia - normalizacja nie może
// psuć tego, co model zrobił dobrze. Jedyny wyjątek to ocena ogólna.
const dobra = {
  ocena_ogolna: 68,
  podsumowanie: "Skóra w porządku, sen do poprawy.",
  podoceny: [
    { klucz: "skora", ocena: 70, obserwacja: "Równy koloryt." },
    { klucz: "oczy", ocena: 60, obserwacja: "Lekkie cienie podoczodołowe." },
    { klucz: "postawa", ocena: 75, obserwacja: "Barki w linii." },
  ],
  mocne_strony: ["Gęste włosy."],
  plan: [{ kategoria: "sen", tytul: "Stała pora snu", dlaczego: "Cienie pod oczami.",
    jak: ["Kładź się o 23:00"], czestotliwosc: "codziennie", horyzont_tygodni: 6,
    priorytet: 1, klucz: "stala_pora_snu" }],
  najwieksza_dzwignia: "Sen o stałej porze.",
  jakosc_zdjecia: { wystarczajaca: true, uwagi: "Kadr w porządku." },
};
const bezZmian = normalizujAnalize(dobra);
check("poprawna odpowiedź przechodzi bez zmian",
  JSON.stringify(bezZmian) === JSON.stringify(dobra),
  JSON.stringify(bezZmian).slice(0, 120));

/* ------------------------------------------------------------------
 * Wersja 2: widoczność obszarów i porównanie z poprzednim skanem
 *
 * Dwie reguły, których model nie może złamać, bo pilnuje ich kod:
 * obszar bez swojego zdjęcia nie dostaje liczby, a liczba musi zgadzać
 * się z werdyktem porównania.
 * ------------------------------------------------------------------ */

console.log("\n  Obszary bez zdjęcia\n");

const zWszystkim = {
  ...dobra,
  podoceny: [
    { klucz: "skora", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 60, obserwacja: "a" },
    { klucz: "zeby", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 40, obserwacja: "zgadnięte" },
    { klucz: "postawa", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 40, obserwacja: "zgadnięte" },
    { klucz: "sklad_ciala", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 75, obserwacja: "zgadnięte" },
    { klucz: "oczy", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 65, obserwacja: "b" },
    { klucz: "wlosy", zmiana: "brak_porownania", co_sie_zmienilo: "", ocena: 70, obserwacja: "c" },
  ],
};

let v2 = normalizujAnalize(zWszystkim, { ujecia: ["front", "profil"], poprzednie: {} });
check("zęby bez zdjęcia uśmiechu nie dostają oceny", !v2.podoceny.some((p) => p.klucz === "zeby"));
check("postawa i skład ciała bez sylwetki też nie",
  !v2.podoceny.some((p) => p.klucz === "postawa" || p.klucz === "sklad_ciala"));
check("ocena ogólna liczona tylko z tego, co widać", v2.ocena_ogolna === 65, String(v2.ocena_ogolna));
check("pierwszy skan nie udaje porównania", v2.porownanie_ogolne === undefined);
check("każdy obszar pierwszego skanu jest bez porównania",
  v2.podoceny.every((p) => p.zmiana === "brak_porownania" && p.co_sie_zmienilo === ""));
check("raport wersji 2 spełnia kontrakt", WygladAnalysisSchema.safeParse(v2).success);

v2 = normalizujAnalize(zWszystkim, { ujecia: ["front", "zeby", "sylwetka"], poprzednie: {} });
check("z kompletem zdjęć oceniane są wszystkie obszary", v2.podoceny.length === 6, String(v2.podoceny.length));

console.log("\n  Porównanie z poprzednim skanem\n");

check("bez zmian: skok o 8 docięty do +2", uzgodnijZPorownaniem(68, 60, "bez_zmian") === 62);
check("bez zmian: spadek o 8 docięty do -2", uzgodnijZPorownaniem(52, 60, "bez_zmian") === 58);
check("lepiej: liczba niższa niż poprzednia podniesiona do +3", uzgodnijZPorownaniem(59, 60, "lepiej") === 63);
check("wyraźnie lepiej: +4 to za mało, podniesione do +10", uzgodnijZPorownaniem(64, 60, "wyraznie_lepiej") === 70);
check("wyraźnie gorzej: dociśnięte do co najmniej -10", uzgodnijZPorownaniem(58, 60, "wyraznie_gorzej") === 50);
check("liczba w paśmie zostaje nietknięta", uzgodnijZPorownaniem(66, 60, "lepiej") === 66);
check("brak porównania nie rusza liczby", uzgodnijZPorownaniem(80, 60, "brak_porownania") === 80);
check("pasmo nie wychodzi poza skalę", uzgodnijZPorownaniem(100, 95, "wyraznie_lepiej") === 100);

const porownana = normalizujAnalize(
  {
    ...dobra,
    porownanie_ogolne: "Wyraźnie mniej aktywnych zmian na policzkach, nowa fryzura.",
    podoceny: [
      { klucz: "skora", zmiana: "wyraznie_lepiej", co_sie_zmienilo: "Zeszły zmiany z policzków.", ocena: 61, obserwacja: "a" },
      { klucz: "wlosy", zmiana: "Lepiej", co_sie_zmienilo: "Krótsze boki.", ocena: 70, obserwacja: "b" },
      { klucz: "oczy", zmiana: "bez_zmian", co_sie_zmienilo: "Bez widocznej różnicy.", ocena: 71, obserwacja: "c" },
      { klucz: "zarost", zmiana: "wyraznie_lepiej", co_sie_zmienilo: "zmyślone", ocena: 90, obserwacja: "d" },
    ],
  },
  { ujecia: ["front"], poprzednie: { skora: 55, wlosy: 60, oczy: 65 } },
);
const po = Object.fromEntries(porownana.podoceny.map((p) => [p.klucz, p]));
check("wyraźna poprawa skóry rusza liczbę o co najmniej 10", po.skora.ocena === 65, String(po.skora.ocena));
check("werdykt z wielkiej litery rozpoznany", po.wlosy.zmiana === "lepiej" && po.wlosy.ocena === 69, JSON.stringify(po.wlosy));
check("bez zmian trzyma liczbę przy poprzedniej", po.oczy.ocena === 67, String(po.oczy.ocena));
check("obszar bez poprzedniej oceny nie ma werdyktu, nawet gdy model go wymyślił",
  po.zarost.zmiana === "brak_porownania" && po.zarost.co_sie_zmienilo === "" && po.zarost.ocena === 90,
  JSON.stringify(po.zarost));
check("opis zmiany zostaje przy obszarze", po.skora.co_sie_zmienilo === "Zeszły zmiany z policzków.");
check("porównanie ogólne trafia do raportu", porownana.porownanie_ogolne?.startsWith("Wyraźnie mniej"));
check("raport z porównaniem spełnia kontrakt", WygladAnalysisSchema.safeParse(porownana).success);

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : " - WSZYSTKO PRZESZŁO"}\n`);
process.exit(bad ? 1 : 0);
