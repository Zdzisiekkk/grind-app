/*
 * Sprawdza liczenie dat.
 *
 * Ten plik istnieje z powodu jednego błędu: `todayISO()` pytał o dzisiaj
 * URZĄDZENIE. Na telefonie urządzeniem jest telefon, ale przy renderowaniu na
 * serwerze urządzeniem jest maszyna we Frankfurcie, która chodzi na UTC -
 * latem dwie godziny za Polską. Wszystko zapisane między północą a drugą
 * w nocy lądowało na wczoraj, a serwer i przeglądarka dawały różne odpowiedzi
 * na to samo pytanie.
 *
 * Test symuluje serwer, ustawiając TZ=UTC.
 *
 * Uruchom: npm run test:daty
 */
import { addDaysISO, dateInAppZone, humanDate, todayISO } from "../src/lib/format.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

console.log("\n  Strefa czasowa (proces działa w TZ=" + (process.env.TZ ?? "systemowej") + ")\n");

// 00:30 czasu polskiego w środku lata = 22:30 UTC dnia POPRZEDNIEGO.
// To jest dokładnie ten moment, w którym aplikacja gubiła dzień.
const nocLatem = new Date("2026-07-14T22:30:00Z");
check(
  "pół godziny po polskiej północy to już nowy dzień",
  dateInAppZone(nocLatem) === "2026-07-15",
  dateInAppZone(nocLatem),
);

// Zimą Polska jest UTC+1 - ta sama pułapka, godzinę węziej.
const nocZima = new Date("2026-01-14T23:30:00Z");
check(
  "zimą też, choć przesunięcie jest inne",
  dateInAppZone(nocZima) === "2026-01-15",
  dateInAppZone(nocZima),
);

// Południe UTC to zawsze ten sam dzień w obu strefach - kontrola, że nie
// przesuwamy dat, które przesunięcia nie potrzebują.
const poludnie = new Date("2026-05-20T12:00:00Z");
check("w środku dnia nic się nie przesuwa", dateInAppZone(poludnie) === "2026-05-20");

check("dzisiaj ma poprawny kształt", /^\d{4}-\d{2}-\d{2}$/.test(todayISO()), todayISO());

console.log("\n  Arytmetyka kalendarza\n");

check("dzień wstecz", addDaysISO("2026-03-01", -1) === "2026-02-28");
check("rok przestępny", addDaysISO("2024-03-01", -1) === "2024-02-29");
check("koniec roku", addDaysISO("2025-12-31", 1) === "2026-01-01");

// Ostatnia niedziela marca: w Polsce zmiana czasu z 2:00 na 3:00. Doba ma
// wtedy 23 godziny i naiwne dodawanie 24 h potrafi zgubić dzień.
check("zmiana czasu na letni nie gubi dnia", addDaysISO("2026-03-28", 1) === "2026-03-29");
check("zmiana czasu na zimowy nie dubluje dnia", addDaysISO("2026-10-24", 1) === "2026-10-25");

check(
  "tydzień wstecz i z powrotem wraca w to samo miejsce",
  addDaysISO(addDaysISO("2026-08-28", -7), 7) === "2026-08-28",
);

console.log("\n  Nazwy dni\n");

const dzis = todayISO();
check("dzisiaj nazywa się dzisiaj", humanDate(dzis) === "dzisiaj", humanDate(dzis));
check("wczoraj nazywa się wczoraj", humanDate(addDaysISO(dzis, -1)) === "wczoraj");
check("jutro nazywa się jutro", humanDate(addDaysISO(dzis, 1)) === "jutro");
check(
  "starsza data dostaje datę, nie słowo",
  /\d/.test(humanDate(addDaysISO(dzis, -10))),
  humanDate(addDaysISO(dzis, -10)),
);

console.log(fails ? `\n  BŁĘDÓW: ${fails}\n` : "\n  WSZYSTKO PRZESZŁO\n");
process.exit(fails ? 1 : 0);
