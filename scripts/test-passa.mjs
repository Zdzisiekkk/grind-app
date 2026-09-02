/*
 * Sprawdza passę ogólną (nawyki na dany dzień + dziennik diety tego dnia).
 *
 * Reguła jest świadomie węższa niż mogłaby być: trening zostaje poza nią,
 * bo w odróżnieniu od nawyków nie ma pojęcia "dnia wolnego" zapisanego
 * w danych - wymaganie treningu co dzień psułoby serię każdemu, kto ma
 * legalny dzień odpoczynku w planie.
 *
 * Uruchom: npm run test:passa
 */
import { addDaysISO } from "../src/lib/format.ts";
import { ogolnaPassa } from "../src/lib/passa.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const dzis = "2026-08-30";
const habit = { id: "h1", days_of_week: [], target_per_day: 1 };

const dieta = (daty) => new Set(daty);
const byHabit = (mapa) => new Map([["h1", mapa]]);

console.log("\n  Passa ogólna\n");

// Trzy dni z rzędu: nawyk zrobiony i dieta zalogowana.
const trzyDni = [addDaysISO(dzis, -1), addDaysISO(dzis, -2), addDaysISO(dzis, -3)];
check(
  "nawyk i dieta w komplecie liczą się do passy",
  ogolnaPassa([habit], byHabit(new Map(trzyDni.map((d) => [d, 1]))), dieta(trzyDni), dzis) === 3,
);

check(
  "dzień bez wpisu diety przerywa passę, mimo zrobionego nawyku",
  ogolnaPassa(
    [habit],
    byHabit(new Map(trzyDni.map((d) => [d, 1]))),
    dieta([addDaysISO(dzis, -1)]), // dieta tylko wczoraj
    dzis,
  ) === 1,
);

check(
  "dzień bez zrobionego nawyku przerywa passę, mimo zalogowanej diety",
  ogolnaPassa(
    [habit],
    byHabit(new Map([[addDaysISO(dzis, -1), 1]])), // nawyk tylko wczoraj
    dieta(trzyDni),
    dzis,
  ) === 1,
);

check(
  "brak dzisiejszego wpisu jeszcze nie zrywa passy - dzień trwa",
  ogolnaPassa([habit], byHabit(new Map(trzyDni.map((d) => [d, 1]))), dieta(trzyDni), dzis) === 3,
);

check(
  "bez żadnych nawyków liczy się sama dieta",
  ogolnaPassa([], new Map(), dieta(trzyDni), dzis) === 3,
);

check(
  "bez żadnego wpisu diety passa stoi w miejscu",
  ogolnaPassa([habit], byHabit(new Map(trzyDni.map((d) => [d, 1]))), dieta([]), dzis) === 0,
);

console.log(`\n  BŁĘDÓW: ${fails}\n`);
process.exit(fails > 0 ? 1 : 0);
