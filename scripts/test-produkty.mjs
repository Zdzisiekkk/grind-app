/*
 * Wyszukiwanie produktów po nazwie - sprawdzenie na żywej bazie.
 *
 * Trzy przypadki, na których wywracała się poprzednia wersja (`ilike '%fraza%'`),
 * zmierzone wcześniej na produkcji: ogonki, kolejność słów i marka. Do tego
 * rzecz, której wyszukiwarka nie ma prawa zrobić - pokazać cudzych produktów
 * własnych. Wyszukiwarka omijająca RLS jest wyciekiem, nie funkcją.
 */
import { bazaZMigracjami } from './supabase-stub.mjs';

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
/** Nazwy znalezione dla frazy, w kolejności zwróconej przez bazę. */
const szukaj = async (uid, fraza) => {
  const r = await as(uid, `select name from public.szukaj_produktow('${fraza.replace(/'/g, "''")}')`);
  if (!r.ok) throw new Error(r.err);
  return r.rows.map((x) => x.name);
};

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;

// Wspólny cache Open Food Facts (user_id NULL) - tak zapisuje go skaner kodów.
await db.exec(`
  insert into public.foods (user_id, source, off_id, name, brand, kcal_100g) values
    (null, 'off', '5900000000001', 'Żurek śląski w słoiku', 'Krakus',   45),
    (null, 'off', '5900000000002', 'Serek wiejski light',   'Piątnica', 89),
    (null, 'off', '5900000000003', 'Mleko UHT 3,2%',        'Łaciate',  62),
    (null, 'off', '5900000000004', 'Jogurt naturalny',      'Bakoma',   61),
    (null, 'off', '5900000000005', 'Płatki owsiane górskie', null,     372);
`);

console.log('\n  Polskie ogonki\n');
let w = await szukaj(A, 'zurek');
check('"zurek" znajduje "Żurek"', w.some((n) => n.startsWith('Żurek')), JSON.stringify(w));
w = await szukaj(A, 'ŻUREK');
check('wielkość liter nie ma znaczenia', w.some((n) => n.startsWith('Żurek')), JSON.stringify(w));
w = await szukaj(A, 'platki gorskie');
check('ogonki znikają też w środku frazy',
  w.some((n) => n.startsWith('Płatki')), JSON.stringify(w));

console.log('\n  Kolejność słów\n');
w = await szukaj(A, 'serek wiejski');
check('"serek wiejski" znajduje', w.some((n) => n.startsWith('Serek')), JSON.stringify(w));
w = await szukaj(A, 'wiejski serek');
check('"wiejski serek" znajduje to samo', w.some((n) => n.startsWith('Serek')), JSON.stringify(w));
w = await szukaj(A, 'light wiejski');
check('słowa nie muszą sąsiadować', w.some((n) => n.startsWith('Serek')), JSON.stringify(w));

console.log('\n  Marka\n');
w = await szukaj(A, 'łaciate');
check('szukanie po marce działa', w.some((n) => n.startsWith('Mleko')), JSON.stringify(w));
w = await szukaj(A, 'laciate mleko');
check('marka i nazwa naraz, bez ogonków', w.some((n) => n.startsWith('Mleko')), JSON.stringify(w));

console.log('\n  Odsiewanie\n');
w = await szukaj(A, 'serek jogurt');
check('słowa z różnych produktów nie dają trafienia', w.length === 0, JSON.stringify(w));
w = await szukaj(A, 'krakus');
check('marka jednego produktu nie wyciąga pozostałych', w.length === 1, JSON.stringify(w));

console.log('\n  Kolejność wyników\n');
await db.exec(`
  insert into public.foods (user_id, source, off_id, name, brand, kcal_100g) values
    (null, 'off', '5900000000006', 'Sos do makaronu z serkiem wiejskim', null, 120);
`);
w = await szukaj(A, 'serek');
check('nazwa zaczynająca się od frazy jest pierwsza',
  w[0] === 'Serek wiejski light', JSON.stringify(w));

console.log('\n  Pusta fraza\n');
w = await szukaj(A, '');
check('pusta fraza pokazuje ostatnio używane, a nie pustkę', w.length > 0, JSON.stringify(w));
w = await szukaj(A, '   ');
check('same spacje zachowują się jak pusta fraza', w.length > 0, JSON.stringify(w));
w = await szukaj(A, '%');
check('znak wieloznaczny nie wyciąga wszystkiego jako fraza', Array.isArray(w));

console.log('\n  Cudze produkty\n');
await as(A, `insert into public.foods (user_id, source, name, kcal_100g)
             values ('${A}', 'custom', 'Sekretna owsianka Adama', 300)`);
w = await szukaj(A, 'owsianka');
check('A znajduje swój własny produkt', w.includes('Sekretna owsianka Adama'), JSON.stringify(w));
w = await szukaj(B, 'owsianka');
check('B NIE widzi produktu własnego A przez wyszukiwarkę',
  !w.includes('Sekretna owsianka Adama'), JSON.stringify(w));
w = await szukaj(B, 'zurek');
check('ale wspólny cache widzą oboje', w.some((n) => n.startsWith('Żurek')), JSON.stringify(w));

// Postgres domyślnie daje EXECUTE każdemu, łącznie z `anon` - sprawdzamy,
// czy revoke z migracji faktycznie zadziałał.
const anon = (await db.query(
  `select has_function_privilege('anon', 'public.szukaj_produktow(text, integer)', 'execute') as moze`
)).rows[0].moze;
check('niezalogowany nie może wywołać wyszukiwarki', anon === false, String(anon));

console.log('\n  Limit\n');
const ile = (await as(A, `select count(*)::int as n from public.szukaj_produktow('', 3)`)).rows[0].n;
check('limit jest respektowany', ile === 3, `zwrócono ${ile}`);

console.log(`\n  ${ok} przeszło, ${bad} nie przeszło\n`);
process.exit(bad ? 1 : 0);
