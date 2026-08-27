/*
 * Sprawdza wykrywanie sytuacji, o których trener ma się odezwać.
 *
 * To jest część, w której pomyłka boli najbardziej: zła diagnoza to zła
 * porada wygłoszona z pełnym przekonaniem. Dlatego arytmetyka siedzi w kodzie,
 * a nie w modelu — i dlatego ma test.
 *
 * Uruchom: npm run test:analysis
 */
import { analyseDietVsWeight, findStrengthStalls, weeklyWeightTrend }
  from "../src/lib/ai/analysis.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
};

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

console.log("\n  Trend wagi\n");

// Chudnięcie 0,5 kg/tydzień z jednym absurdalnym skokiem po słonym obiedzie.
const chudnie = [
  { date: day(20), kg: 85.0 }, { date: day(17), kg: 84.7 },
  { date: day(14), kg: 84.5 }, { date: day(11), kg: 86.2 }, // skok po soli
  { date: day(8),  kg: 84.0 }, { date: day(5),  kg: 83.8 },
  { date: day(2),  kg: 83.6 },
];
const trend = weeklyWeightTrend(chudnie);
check("regresja nie daje się zwieść jednemu skokowi", trend < -0.2 && trend > -0.9,
  `${trend.toFixed(2)} kg/tydz.`);

check("dwa pomiary to za mało", weeklyWeightTrend(chudnie.slice(0, 2)) === null);

console.log("\n  Dieta kontra waga\n");

const trafia = { avgKcal: 2000, kcalGoal: 2000, daysLogged: 18, periodDays: 21 };

const stoi = analyseDietVsWeight({
  weights: [
    { date: day(20), kg: 85.0 }, { date: day(15), kg: 85.1 },
    { date: day(10), kg: 85.0 }, { date: day(5), kg: 85.1 }, { date: day(1), kg: 85.0 },
  ],
  goal: "cut", ...trafia,
});
check("redukcja bez efektu to problem z celem", stoi.problem === "pace" && stoi.suggestKcal < 0,
  `${stoi.problem}, ${stoi.suggestKcal} kcal`);

// Ta sama stojąca waga, ale człowiek zjada 700 kcal ponad cel.
const nieTrafia = analyseDietVsWeight({
  weights: [
    { date: day(20), kg: 85.0 }, { date: day(15), kg: 85.1 },
    { date: day(10), kg: 85.0 }, { date: day(5), kg: 85.1 }, { date: day(1), kg: 85.0 },
  ],
  goal: "cut", avgKcal: 2700, kcalGoal: 2000, daysLogged: 18, periodDays: 21,
});
check("gdy nie trafiasz w cel, winny jest nawyk, nie cel",
  nieTrafia.problem === "adherence" && nieTrafia.suggestKcal === 0, nieTrafia.problem);
check("nie proponujemy obniżenia celu, którego nikt nie realizuje", nieTrafia.suggestKcal === 0);

const dobre = analyseDietVsWeight({
  weights: chudnie, goal: "cut", ...trafia,
});
check("tempo 0,5 kg/tydz. na redukcji jest w porządku", dobre.onTrack && dobre.problem === "none",
  `${dobre.weeklyChangeKg.toFixed(2)} kg/tydz.`);

const brakDanych = analyseDietVsWeight({
  weights: [{ date: day(3), kg: 85 }, { date: day(2), kg: 85 }, { date: day(1), kg: 85 }],
  goal: "cut", ...trafia,
});
check("trzy pomiary z trzech dni to za krótko", brakDanych.problem === "no_data");

const bezDziennika = analyseDietVsWeight({
  weights: chudnie, goal: "cut", avgKcal: 2000, kcalGoal: 2000, daysLogged: 4, periodDays: 21,
});
check("pusty dziennik zamyka temat celu", bezDziennika.problem === "no_data");

console.log("\n  Stagnacja siłowa\n");

const set = (d, name, kg, reps) =>
  ({ date: day(d), exercise_name: name, catalog_exercise_id: null, weight_kg: kg, reps, is_warmup: false });

const stoiPrzysiad = [
  set(50, "Przysiad", 100, 5), set(43, "Przysiad", 100, 5),
  set(36, "Przysiad", 100, 5), set(22, "Przysiad", 100, 5),
  set(12, "Przysiad", 100, 5), set(4,  "Przysiad", 100, 5),
];
const stalls = findStrengthStalls(stoiPrzysiad, day(0));
check("stojący ciężar mimo regularnej pracy to stagnacja",
  stalls[0]?.problem === "stall", stalls[0]?.message ?? "brak");

const rosnie = [
  set(50, "Wyciskanie", 80, 5), set(40, "Wyciskanie", 85, 5),
  set(25, "Wyciskanie", 90, 5), set(10, "Wyciskanie", 95, 5), set(3, "Wyciskanie", 100, 5),
];
check("rosnący ciężar nie jest zgłaszany", findStrengthStalls(rosnie, day(0)).length === 0);

const rzadko = [
  set(55, "Martwy ciąg", 140, 3), set(40, "Martwy ciąg", 140, 3),
  set(26, "Martwy ciąg", 140, 3), set(9, "Martwy ciąg", 140, 3),
];
const rzadkoOut = findStrengthStalls(rzadko, day(0));
check("rzadkie ćwiczenie to problem z częstotliwością, nie ze stagnacją",
  rzadkoOut[0]?.problem === "frequency", rzadkoOut[0]?.message ?? "brak");

check("trzy sesje to za mało na jakikolwiek wniosek",
  findStrengthStalls(stoiPrzysiad.slice(0, 3), day(0)).length === 0);

// Rekord sprzed tygodnia to normalny progres, nie zastój.
const swiezyRekord = [
  set(50, "Wiosłowanie", 60, 8), set(40, "Wiosłowanie", 60, 8),
  set(25, "Wiosłowanie", 60, 8), set(12, "Wiosłowanie", 60, 8), set(5, "Wiosłowanie", 70, 8),
];
check("świeży rekord nie jest stagnacją", findStrengthStalls(swiezyRekord, day(0)).length === 0);

console.log(fails === 0 ? "\n  WSZYSTKO PRZESZŁO\n" : `\n  BŁĘDÓW: ${fails}\n`);
process.exit(fails ? 1 : 0);
