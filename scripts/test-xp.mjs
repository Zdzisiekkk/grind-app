/*
 * System XP (migracja 0057) - naliczanie na żywej bazie + zgodność krzywej.
 *
 * Trzy rzeczy, które muszą być prawdziwe:
 *  - XP przyznają wyzwalacze według stawek i dziennych sufitów, nie klient,
 *  - krzywa leveli w bazie i w src/lib/xp.ts to ta sama funkcja,
 *  - nagrody (dni planu gratis) wpadają przy właściwych levelach i tylko raz.
 *
 * Uruchom: npm run test:xp
 */
import { bazaZMigracjami } from './supabase-stub.mjs';
import { poziomZXp, progPoziomu, tytulPoziomu } from '../src/lib/xp.ts';

const db = await bazaZMigracjami();

let ok = 0, bad = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? ' - ' + d : ''}`); }
};
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};
const suma = async (uid) =>
  (await db.query(`select coalesce(sum(xp), 0)::int as s from public.xp_zdarzenia where user_id = '${uid}'`)).rows[0].s;

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;

console.log('\n  Zgodność krzywej baza <-> aplikacja\n');

let zgodne = true;
for (let xp = 0; xp <= 5000; xp += 37) {
  const wBazie = (await db.query(`select public.xp_poziom(${xp}) as p`)).rows[0].p;
  if (wBazie !== poziomZXp(xp)) { zgodne = false; check(`rozjazd przy ${xp} XP`, false, `baza ${wBazie}, ts ${poziomZXp(xp)}`); break; }
}
check('poziomZXp zgodne z public.xp_poziom dla 0..5000', zgodne);
check('progi kolejnych leveli trafiają we własny level',
  [1, 2, 3, 5, 10, 20].every((l) => poziomZXp(progPoziomu(l)) === l && poziomZXp(progPoziomu(l) - 1) === l - 1));
check('tytuły rosną z levelem', tytulPoziomu(0) === 'Świeżak' && tytulPoziomu(6) === 'Zawodnik' && tytulPoziomu(31) === 'Legenda');

console.log('\n  Stawki i sufity\n');

await as(A, `insert into public.workout_sessions (user_id) values ('${A}')`);
check('trening daje 25 XP', (await suma(A)) === 25, `jest ${await suma(A)}`);
await as(A, `insert into public.workout_sessions (user_id) values ('${A}')`);
await as(A, `insert into public.workout_sessions (user_id) values ('${A}')`);
check('trzeci trening dnia już nie punktuje (sufit 2)', (await suma(A)) === 50, `jest ${await suma(A)}`);

await as(A, `insert into public.habits (user_id, name) values ('${A}', 'woda z cytryną')`);
const habitId = (await db.query(`select id from public.habits where user_id = '${A}'`)).rows[0].id;
await as(A, `insert into public.habit_logs (user_id, habit_id) values ('${A}', '${habitId}')`);
check('nawyk daje 5 XP', (await suma(A)) === 55);

await as(A, `insert into public.meals (user_id, meal_type) values ('${A}', 'breakfast')`);
check('posiłek daje 5 XP', (await suma(A)) === 60);

await db.query(`update public.profiles set daily_water_ml = 1000 where id = '${A}'`);
await as(A, `insert into public.water_logs (user_id, ml) values ('${A}', 400)`);
check('woda poniżej celu nie punktuje', (await suma(A)) === 60);
await as(A, `insert into public.water_logs (user_id, ml) values ('${A}', 700)`);
check('przekroczenie celu wody daje 10 XP', (await suma(A)) === 70, `jest ${await suma(A)}`);
await as(A, `insert into public.water_logs (user_id, ml) values ('${A}', 500)`);
check('kolejne szklanki po celu już nie punktują (sufit 1)', (await suma(A)) === 70);

await as(A, `insert into public.sleep_logs (user_id, bedtime, wake_time, quality) values ('${A}', '23:00', '07:00', 3)`);
check('sen daje 10 XP', (await suma(A)) === 80);

await as(A, `insert into public.books (user_id, title, status) values ('${A}', 'Meditations', 'reading')`);
check('książka w trakcie nie punktuje', (await suma(A)) === 80);
await as(A, `update public.books set status = 'read' where user_id = '${A}'`);
check('skończenie książki daje 50 XP', (await suma(A)) === 130, `jest ${await suma(A)}`);
await as(A, `update public.books set status = 'reading' where user_id = '${A}'`);
await as(A, `update public.books set status = 'read' where user_id = '${A}'`);
await as(A, `update public.books set status = 'reading' where user_id = '${A}'`);
await as(A, `update public.books set status = 'read' where user_id = '${A}'`);
check('żonglowanie statusem odbija się o dzienny sufit (2)', (await suma(A)) === 180, `jest ${await suma(A)}`);

console.log('\n  Tylko baza pisze XP\n');

let r = await as(A, `insert into public.xp_zdarzenia (user_id, dzien, zrodlo, xp) values ('${A}', current_date, 'oszustwo', 9999)`);
check('użytkownik nie dopisze sobie XP', !r.ok, r.ok ? 'ZAPISAŁO SIĘ' : '');
r = await as(A, `update public.xp_zdarzenia set xp = 9999 where user_id = '${A}'`);
const poUpdate = await suma(A);
check('użytkownik nie podbije istniejących wierszy', poUpdate === 180, `jest ${poUpdate}`);
r = await as(A, `select sum(xp)::int as s from public.xp_zdarzenia where user_id = '${A}'`);
check('ale swoje XP widzi', r.ok && r.rows[0].s === 180, r.err);

console.log('\n  Nagrody za levele\n');

// Poziom 5 wymaga 1119 XP. Dosypujemy tuż pod próg i przekraczamy go treningiem
// zapisanym na inny dzień (dzisiejszy sufit treningów jest już wyczerpany).
await db.query(`insert into public.xp_zdarzenia (user_id, dzien, zrodlo, xp)
                values ('${A}', current_date - 1, 'seed', ${1119 - 180 - 25})`);
await as(A, `insert into public.workout_sessions (user_id, date) values ('${A}', current_date - 1)`);
check('po przekroczeniu progu jest level 5', (await suma(A)) >= 1119 && poziomZXp(await suma(A)) === 5);

r = await db.query(`select plan, zrodlo from public.bonus_plan where user_id = '${A}'`);
check('level 5 przyznał 3 dni Startera', r.rows.length === 1 && r.rows[0].plan === 'starter' && r.rows[0].zrodlo === 'xp_level_5',
  JSON.stringify(r.rows));

r = await as(A, `select public.plan_poziom() as p`);
check('bonus faktycznie otwiera bramki AI (poziom dostępu 1)', r.ok && r.rows[0].p === 1);

await as(A, `insert into public.habit_logs (user_id, habit_id, date) values ('${A}', '${habitId}', current_date - 1)`);
r = await db.query(`select count(*)::int as n from public.bonus_plan where user_id = '${A}'`);
check('kolejne XP na tym samym levelu nie dubluje nagrody', r.rows[0].n === 1);

// Nagrodę przyznaje wyłącznie PRZEKROCZENIE progu w xp_przyznaj - zasiew
// musi więc zostawić konto 5 XP pod progiem levelu 10, a próg przebija posiłek.
const przedSeed2 = await suma(A);
await db.query(`insert into public.xp_zdarzenia (user_id, dzien, zrodlo, xp)
                values ('${A}', current_date - 2, 'seed2', ${progPoziomu(10) - 5} - ${przedSeed2})`);
await as(A, `insert into public.meals (user_id, meal_type, date) values ('${A}', 'lunch', current_date - 1)`);
r = await db.query(`select zrodlo, plan from public.bonus_plan where user_id = '${A}' order by zrodlo`);
check('skok do levelu 10 dodał nagrodę za 10 (Pro)',
  r.rows.length === 2 && r.rows.some((w) => w.zrodlo === 'xp_level_10' && w.plan === 'pro'),
  JSON.stringify(r.rows));

console.log('\n  Awaria naliczania nie blokuje dziennika\n');

// Zepsuta stawka nie może zatrzymać zapisu treningu - wyzwalacz łyka wyjątek.
await db.query(`create or replace function private.xp_przyznaj(p_user uuid, p_zrodlo text, p_dzien date)
                returns void language plpgsql as $$ begin raise exception 'awaria testowa'; end; $$;`);
r = await as(A, `insert into public.workout_sessions (user_id, date) values ('${A}', current_date - 3) returning id`);
check('trening zapisuje się mimo wyjątku w naliczaniu XP', r.ok, r.err);

console.log(`\n  Wynik: ${ok} ✅ / ${bad} ❌\n`);
if (bad > 0) process.exit(1);
