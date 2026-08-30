/*
 * Sprawdza wpisywanie wstecz.
 *
 * Trzy rzeczy, które muszą trzymać, bo inaczej dziennik zaczyna kłamać:
 *
 *  1. Okno DNI_WSTECZ jest zamknięte z obu stron. Przyszłość odpada zawsze,
 *     przeszłość dalsza niż tydzień też - inaczej dopisany dzień sprzed pół
 *     roku po cichu przepisałby rekord passy.
 *  2. Dzień dopisany wstecz zrasta przerwaną serię. To jest cała istota tej
 *     funkcji: nawyk był zrobiony, tylko niewpisany.
 *  3. Baza przyjmuje wsteczny wpis od właściciela i odrzuca go od kogokolwiek
 *     innego. Data w przeszłości nie może być furtką do cudzych danych.
 *
 * Uruchom: npm run test:wstecz
 */
import { bazaZMigracjami } from "./supabase-stub.mjs";
import { addDaysISO, dateInAppZone, todayISO } from "../src/lib/format.ts";
import {
  DNI_WSTECZ,
  dataWOknie,
  dataZAdresu,
  najstarszaData,
  znacznikDnia,
} from "../src/lib/wstecz.ts";
import { bestStreakOf, streakOf } from "../src/lib/nawyki.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const dzis = "2026-08-30";

console.log("\n  Okno wpisywania wstecz\n");

check("okno ma siedem dni", DNI_WSTECZ === 7, String(DNI_WSTECZ));
check(
  "najstarsza data to dzisiaj minus okno",
  najstarszaData(dzis) === "2026-08-23",
  najstarszaData(dzis),
);

check("dzisiaj mieści się w oknie", dataWOknie(dzis, dzis));
check("wczoraj mieści się w oknie", dataWOknie("2026-08-29", dzis));
check("ostatni dzień okna jeszcze wchodzi", dataWOknie("2026-08-23", dzis));
check("dzień przed oknem już nie", !dataWOknie("2026-08-22", dzis));
check("jutro odpada", !dataWOknie("2026-08-31", dzis));
check("data sprzed roku odpada", !dataWOknie("2025-08-30", dzis));
check("śmieci zamiast daty odpadają", !dataWOknie("wczoraj", dzis));
check("pusty napis odpada", !dataWOknie("", dzis));

// Miesiąc i rok muszą się przekręcać poprawnie, bo okno liczy się na napisach.
check("okno przechodzi przez granicę miesiąca", najstarszaData("2026-09-03") === "2026-08-27");
check("okno przechodzi przez granicę roku", najstarszaData("2026-01-03") === "2025-12-27");
check("okno łapie 29 lutego", najstarszaData("2024-03-05") === "2024-02-27");

console.log("\n  Data z adresu\n");

check("brak parametru to dzisiaj", dataZAdresu(undefined, dzis) === dzis);
check("poprawna data z okna przechodzi", dataZAdresu("2026-08-27", dzis) === "2026-08-27");
check("data sprzed okna wraca na dzisiaj", dataZAdresu("2026-01-01", dzis) === dzis);
check("data z przyszłości wraca na dzisiaj", dataZAdresu("2027-01-01", dzis) === dzis);
check("śmieci w adresie wracają na dzisiaj", dataZAdresu("../../etc/passwd", dzis) === dzis);
check("połowiczna data wraca na dzisiaj", dataZAdresu("2026-08", dzis) === dzis);

console.log("\n  Znacznik czasu dla wpisów z godziną\n");

// Wpadki w nałogach i odhaczone zadania mają timestamptz, nie date. Wpis
// z dnia wstecz musi wylądować w tej samej dobie kalendarzowej niezależnie
// od strefy, w której akurat chodzi proces.
const wczorajZnacznik = znacznikDnia("2026-08-29", dzis);
check(
  "wpis wstecz ląduje w swoim dniu kalendarzowym",
  dateInAppZone(new Date(wczorajZnacznik)) === "2026-08-29",
  dateInAppZone(new Date(wczorajZnacznik)),
);
check(
  "dzisiejszy wpis dostaje bieżącą chwilę, nie południe",
  Math.abs(Date.now() - new Date(znacznikDnia(todayISO())).getTime()) < 5000,
);

console.log("\n  Passa po dopisaniu dnia\n");

const nawyk = { days_of_week: [], target_per_day: 1 };
const liczniki = (daty) => new Map(daty.map((d) => [d, 1]));

// Dziura we wtorek: seria kończy się na dniach po dziurze.
const zDziura = liczniki([
  addDaysISO(dzis, -1),
  addDaysISO(dzis, -2),
  addDaysISO(dzis, -4),
  addDaysISO(dzis, -5),
]);
check("dziura przerywa passę", streakOf(nawyk, zDziura, dzis) === 2, String(streakOf(nawyk, zDziura, dzis)));

const zalatane = new Map(zDziura);
zalatane.set(addDaysISO(dzis, -3), 1);
check(
  "dopisany dzień zrasta passę",
  streakOf(nawyk, zalatane, dzis) === 5,
  String(streakOf(nawyk, zalatane, dzis)),
);

check(
  "dopisany dzień podnosi też rekord",
  bestStreakOf(nawyk, zalatane, dzis) > bestStreakOf(nawyk, zDziura, dzis),
  `${bestStreakOf(nawyk, zDziura, dzis)} -> ${bestStreakOf(nawyk, zalatane, dzis)}`,
);

// Brak dzisiejszego odhaczenia nie zrywa serii, bo dzień jeszcze trwa.
// Ta reguła nie może się zmienić przez to, że dołożyliśmy wpisywanie wstecz.
const bezDzisiaj = liczniki([addDaysISO(dzis, -1), addDaysISO(dzis, -2)]);
check("brak dzisiejszego wpisu nie zrywa passy", streakOf(nawyk, bezDzisiaj, dzis) === 2);

// Nawyk tylko w dni robocze: dopisanie soboty nie ma prawa niczego zmienić.
const tylkoRobocze = { days_of_week: [1, 2, 3, 4, 5], target_per_day: 1 };
const roboczeBezSoboty = liczniki(["2026-08-28", "2026-08-27", "2026-08-26"]);
const roboczeZSobota = new Map(roboczeBezSoboty).set("2026-08-29", 1);
check(
  "dopisanie dnia wolnego nie rusza passy",
  streakOf(tylkoRobocze, roboczeBezSoboty, "2026-08-28") ===
    streakOf(tylkoRobocze, roboczeZSobota, "2026-08-28"),
);

console.log("\n  Baza: zapis z datą wsteczną\n");

const db = await bazaZMigracjami();

const A = (
  await db.query(`insert into auth.users (email) values ('zdzis.paschalski@gmail.com') returning id`)
).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('obcy@example.com') returning id`))
  .rows[0].id;

async function asUser(uid, fn) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}

const nawykId = await asUser(A, async () =>
  (
    await db.query(
      `insert into public.habits (user_id, name, icon, target_per_day)
       values ($1, 'Kreatyna', '💊', 1) returning id`,
      [A],
    )
  ).rows[0].id,
);

const wczoraj = addDaysISO(todayISO(), -1);

await asUser(A, () =>
  db.query(
    `insert into public.habit_logs (user_id, habit_id, date, count) values ($1, $2, $3, 1)`,
    [A, nawykId, wczoraj],
  ),
);

const zapisane = (
  await db.query(`select date::text, count from public.habit_logs where habit_id = $1`, [nawykId])
).rows;
check(
  "właściciel dopisuje wczorajszy wpis",
  zapisane.length === 1 && zapisane[0].date === wczoraj,
  JSON.stringify(zapisane),
);

// Drugie odhaczenie tego samego dnia ma podbić licznik, a nie założyć
// drugiego wiersza - na tym stoi cofanie odhaczenia w ekranie nawyków.
await asUser(A, () =>
  db.query(
    `insert into public.habit_logs (user_id, habit_id, date, count) values ($1, $2, $3, 2)
     on conflict (user_id, habit_id, date) do update set count = excluded.count`,
    [A, nawykId, wczoraj],
  ),
);
const poPodbiciu = (
  await db.query(`select count(*)::int n, max(count) c from public.habit_logs where habit_id = $1`, [
    nawykId,
  ])
).rows[0];
check(
  "powtórny zapis tego dnia nadpisuje licznik, nie dubluje wiersza",
  poPodbiciu.n === 1 && Number(poPodbiciu.c) === 2,
  JSON.stringify(poPodbiciu),
);

let obcyDopisal = true;
try {
  await asUser(B, () =>
    db.query(
      `insert into public.habit_logs (user_id, habit_id, date, count) values ($1, $2, $3, 1)`,
      [B, nawykId, wczoraj],
    ),
  );
} catch {
  obcyDopisal = false;
}
check("obcy nie dopisze wpisu do cudzego nawyku", !obcyDopisal);

let podszycie = true;
try {
  await asUser(B, () =>
    db.query(
      `insert into public.habit_logs (user_id, habit_id, date, count) values ($1, $2, $3, 1)`,
      [A, nawykId, wczoraj],
    ),
  );
} catch {
  podszycie = false;
}
check("obcy nie podszyje się pod właściciela w polu user_id", !podszycie);

// Waga i sen mają unikat po (user_id, date), więc wsteczny wpis nie może
// nadpisać dzisiejszego pomiaru.
await asUser(A, () =>
  db.query(`insert into public.body_weight_logs (user_id, date, weight_kg) values ($1, $2, 82.4)`, [
    A,
    todayISO(),
  ]),
);
await asUser(A, () =>
  db.query(`insert into public.body_weight_logs (user_id, date, weight_kg) values ($1, $2, 83.1)`, [
    A,
    wczoraj,
  ]),
);
const wagi = (
  await db.query(
    `select date::text, weight_kg from public.body_weight_logs where user_id = $1 order by date`,
    [A],
  )
).rows;
check(
  "wsteczna waga to osobny dzień, nie nadpisanie dzisiejszej",
  wagi.length === 2 && Number(wagi[0].weight_kg) === 83.1,
  JSON.stringify(wagi),
);

await db.close?.();

console.log(fails ? `\n  BŁĘDÓW: ${fails}\n` : "\n  WSZYSTKO PRZESZŁO\n");
process.exit(fails ? 1 : 0);
