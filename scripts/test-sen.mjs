/*
 * Wynik nocy a drzemki.
 *
 * Sedno: trzy drzemki po 20 minut i jedna sześćdziesięciominutowa dają tę samą
 * sumę minut, ale nie to samo dla organizmu - i wynik ma to widzieć. Do tego
 * dzień bez drzemki nie może być z tego powodu ani lepszy, ani gorszy.
 */
import { scoreNight, SLEEP_WEIGHTS } from "@/lib/sleep";

let ok = 0, bad = 0;
const check = (n, c, d = "") => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? " - " + d : ""}`); }
};

/** Porządna noc, żeby zmiana wyniku brała się wyłącznie z drzemek. */
const noc = (naps) => ({
  date: "2026-08-29",
  bedtime: "23:00",
  wake_time: "07:00",
  sleep_min: 450,
  time_in_bed_min: 480,
  fell_asleep_min: 15,
  awakenings: 0,
  awake_min: 15,
  quality: 4,
  morning_energy: 4,
  nap_min: (naps ?? []).reduce((s, n) => s + n.minutes, 0),
  naps,
  factors: [],
  note: null,
});

const wynik = (naps) => scoreNight(noc(naps), { goalMin: 480, referenceBedtime: 1380 }).total;
const czesc = (naps, klucz) =>
  scoreNight(noc(naps), { goalMin: 480, referenceBedtime: 1380 }).parts.find((p) => p.key === klucz);

console.log("\n  Dzień bez drzemki\n");
const bezDrzemki = scoreNight(noc([]), { goalMin: 480, referenceBedtime: 1380 });
check("brak drzemek nie tworzy składowej", !bezDrzemki.parts.some((p) => p.key === "naps"));
check("brak drzemek jest zgłoszony jako pominięty", bezDrzemki.skipped.includes("naps"));
check("waga rozdziela się na resztę, wynik zostaje pełny",
  bezDrzemki.parts.reduce((s, p) => s + p.points, 0) === bezDrzemki.total,
  `${bezDrzemki.parts.reduce((s, p) => s + p.points, 0)} vs ${bezDrzemki.total}`);

console.log("\n  Trzy krótkie kontra jedna długa\n");
const trzyPo20 = [{ minutes: 20, start: 13 * 60 }, { minutes: 20, start: 15 * 60 }, { minutes: 20, start: 16 * 60 }];
const jednaGodzina = [{ minutes: 60, start: 13 * 60 }];

check("obie mają tę samą sumę minut",
  trzyPo20.reduce((s, n) => s + n.minutes, 0) === jednaGodzina.reduce((s, n) => s + n.minutes, 0));
check("mimo to wynik jest inny", wynik(trzyPo20) !== wynik(jednaGodzina),
  `3×20 = ${wynik(trzyPo20)}, 1×60 = ${wynik(jednaGodzina)}`);
check("trzy krótkie wypadają lepiej niż jedna godzinna",
  wynik(trzyPo20) > wynik(jednaGodzina), `${wynik(trzyPo20)} vs ${wynik(jednaGodzina)}`);

console.log("\n  Długość pojedynczej drzemki\n");
check("dwadzieścia minut to pełne punkty", czesc([{ minutes: 20, start: null }], "naps").ratio === 1);
check("godzinna wyraźnie traci", czesc([{ minutes: 60, start: null }], "naps").ratio < 0.6,
  String(czesc([{ minutes: 60, start: null }], "naps").ratio));
check("dwie godziny to już prawie nic",
  czesc([{ minutes: 120, start: null }], "naps").ratio < 0.3,
  String(czesc([{ minutes: 120, start: null }], "naps").ratio));

console.log("\n  Pora dnia\n");
const poludnie = czesc([{ minutes: 20, start: 13 * 60 }], "naps").ratio;
const wieczor = czesc([{ minutes: 20, start: 21 * 60 }], "naps").ratio;
check("drzemka o 21:00 kosztuje więcej niż ta o 13:00", wieczor < poludnie,
  `${wieczor} vs ${poludnie}`);
check("bez podanej godziny nie ma kary za porę",
  czesc([{ minutes: 20, start: null }], "naps").ratio === poludnie);

console.log("\n  Liczba drzemek\n");
const jednaKrotka = czesc([{ minutes: 15, start: null }], "naps").ratio;
const piecKrotkich = czesc(Array.from({ length: 5 }, () => ({ minutes: 15, start: null })), "naps").ratio;
check("pięć drzemek dziennie to sygnał, nie regeneracja", piecKrotkich < jednaKrotka,
  `${piecKrotkich} vs ${jednaKrotka}`);

console.log("\n  Skala wpływu\n");
const najgorsze = wynik([{ minutes: 180, start: 21 * 60 }]);
check("nawet najgorsze drzemki nie przewracają dobrej nocy",
  bezDrzemki.total - najgorsze <= SLEEP_WEIGHTS.naps + 2,
  `bez: ${bezDrzemki.total}, najgorsze: ${najgorsze}`);
check("idealna drzemka nie zmienia wyniku dobrej nocy",
  Math.abs(wynik([{ minutes: 20, start: 13 * 60 }]) - bezDrzemki.total) <= 1,
  `${wynik([{ minutes: 20, start: 13 * 60 }])} vs ${bezDrzemki.total}`);

console.log("\n  Zgodność ze starymi zapisami\n");
// Wiersz sprzed migracji nie ma pola `naps` w ogóle - ma tylko sumę minut.
const bezPola = noc([]);
delete bezPola.naps;
const stary = scoreNight({ ...bezPola, nap_min: 60 }, { goalMin: 480, referenceBedtime: 1380 });
check("wiersz sprzed migracji liczy się jak jedna drzemka o tej długości",
  stary.total === wynik(jednaGodzina), `${stary.total} vs ${wynik(jednaGodzina)}`);

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : " - WSZYSTKO PRZESZŁO"}\n`);
process.exit(bad ? 1 : 0);
