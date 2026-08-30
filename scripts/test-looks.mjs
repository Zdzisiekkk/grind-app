/*
 * Moduł "Wygląd" - liczenie, które NIE należy do modelu.
 *
 * Konflikt retinoidu z kwasami jest regułą, a nie opinią. Model, który raz na
 * dziesięć razy o niej zapomni, jest gorszy niż kod, który nie zapomina nigdy -
 * pod warunkiem, że ten kod ktoś sprawdził.
 */
import { konflikty, delty, deltaOdPoprzedniego, adherencja, zestawienia, grupaSkladnika } from "@/lib/looks";

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

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : " - WSZYSTKO PRZESZŁO"}\n`);
process.exit(bad ? 1 : 0);
