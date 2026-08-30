/*
 * Moduł "Wygląd" - liczenie, które NIE należy do modelu.
 *
 * Konflikt retinoidu z kwasami jest regułą, a nie opinią. Model, który raz na
 * dziesięć razy o niej zapomni, jest gorszy niż kod, który nie zapomina nigdy -
 * pod warunkiem, że ten kod ktoś sprawdził.
 */
import { konflikty, delty, deltaOdPoprzedniego, adherencja, zestawienia, grupaSkladnika } from "@/lib/looks";
import { WygladAnalysisSchema, normalizujAnalize } from "@/lib/ai/wygladSchema";

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

console.log("\n  Delty między skanami\n");
const skan = (dzien, ogolna, skora, jakosc = true) => ({
  id: dzien, utworzono: `2026-0${dzien}-01T10:00:00Z`, ocena_ogolna: ogolna,
  oceny: { skora, definicja_zuchwy: 50 }, jakosc_ok: jakosc,
});

let d = delty([skan(1, 60, 55), skan(3, 68, 70)]);
check("ogólna delta policzona", d.find((x) => x.klucz === "ogolna")?.zmiana === 8, JSON.stringify(d));
check("delta podoceny policzona", d.find((x) => x.klucz === "skora")?.zmiana === 15);
check("największa zmiana jest pierwsza", d[0].klucz === "skora");

d = delty([skan(1, 60, 55), skan(2, 20, 20, false), skan(3, 68, 70)]);
check("skan ze złym zdjęciem nie psuje delty", d.find((x) => x.klucz === "ogolna")?.zmiana === 8, JSON.stringify(d));
check("jeden skan nie daje żadnej delty", delty([skan(1, 60, 55)]).length === 0);

const dp = deltaOdPoprzedniego([skan(1, 60, 55), skan(3, 68, 70)]);
check("delta od poprzedniego liczona od nowszego", dp?.zmiana === 8, JSON.stringify(dp));

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
check("ocena ponad skalę wraca do setki", n.ocena_ogolna === 100, String(n.ocena_ogolna));
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
// psuć tego, co model zrobił dobrze.
const dobra = {
  ocena_ogolna: 71,
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

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : " - WSZYSTKO PRZESZŁO"}\n`);
process.exit(bad ? 1 : 0);
