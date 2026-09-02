/*
 * Plany Starter i Pro (migracja 0056) - sprawdzenie na żywej bazie.
 *
 * Trzy rzeczy muszą tu być prawdziwe, bo wiszą na nich pieniądze:
 *  - plan_poziom() odpowiada 0/1/2 dokładnie według stanu subskrypcji i bonusów,
 *  - apply_subscription zapisuje plan i nie daje się oszukać złym sekretem,
 *  - licznik miesięczny odlicza osobno od dziennego i faktycznie odmawia.
 *
 * Uruchom: npm run test:plany
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

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;

// Webhook uwierzytelnia się sekretem z private.config - w teście wstawiamy własny.
await db.exec(`insert into private.config (key, value) values ('stripe_webhook_secret', 'sekret-test')
               on conflict (key) do update set value = excluded.value`);

/** Skrót: zdarzenie Stripe'a jak z webhooka. */
const zdarzenie = (uid, status, plan, koniec = `now() + interval '30 days'`, sekret = 'sekret-test') =>
  db.query(`select public.apply_subscription(
    '${sekret}', '${uid}', '${status}', 'cus_${uid.slice(0, 8)}', 'sub_${uid.slice(0, 8)}',
    'price_x', ${koniec}, false, null, null, now(), ${plan === null ? 'null' : `'${plan}'`}
  ) as w`);

console.log('\n  Poziomy dostępu\n');

let r = await as(A, `select public.plan_poziom() as p, public.has_pro() as pro`);
check('świeże konto ma poziom 0 i brak pro', r.ok && r.rows[0].p === 0 && r.rows[0].pro === false, r.err);

r = await zdarzenie(A, 'active', 'starter');
check('zdarzenie z dobrym sekretem przechodzi', r.rows[0].w === true);
r = await as(A, `select public.plan_poziom() as p, public.has_pro() as pro`);
check('aktywny Starter to poziom 1 i pro=true (bramki AI otwarte)',
  r.ok && r.rows[0].p === 1 && r.rows[0].pro === true, JSON.stringify(r.rows?.[0]));

r = await zdarzenie(A, 'active', 'pro');
r = await as(A, `select public.plan_poziom() as p`);
check('po zmianie na Pro poziom 2', r.ok && r.rows[0].p === 2);

r = await zdarzenie(A, 'canceled', 'pro');
r = await as(A, `select public.plan_poziom() as p, public.has_pro() as pro`);
check('anulowana subskrypcja gasi dostęp', r.ok && r.rows[0].p === 0 && r.rows[0].pro === false);

r = await zdarzenie(A, 'active', 'pro', `now() - interval '1 day'`);
r = await as(A, `select public.plan_poziom() as p`);
check('status active z minioną datą opłacenia nie daje dostępu', r.ok && r.rows[0].p === 0);

console.log('\n  Odporność webhooka\n');

r = await zdarzenie(B, 'active', 'pro', `now() + interval '30 days'`, 'zly-sekret');
check('zły sekret odbity', r.rows[0].w === false);
r = await as(B, `select public.plan_poziom() as p`);
check('po odbitym zdarzeniu B dalej na poziomie 0', r.ok && r.rows[0].p === 0);

r = await zdarzenie(B, 'active', 'vip');
r = await db.query(`select plan from public.subscriptions where user_id = '${B}'`);
check('nieznana nazwa planu ucięta do pro, nie do błędu', r.rows[0]?.plan === 'pro');

// Kod sprzed 0056 woła funkcję bez parametru planu - musi dalej działać.
r = await db.query(`select public.apply_subscription(
  'sekret-test', '${B}', 'active', null, null, null, now() + interval '30 days', false, null
) as w`);
check('wywołanie starą sygnaturą (bez planu) przechodzi', r.rows[0].w === true);

console.log('\n  Bonusowy dostęp (nagrody XP)\n');

r = await as(B, `insert into public.bonus_plan (user_id, plan, do_kiedy, zrodlo)
                 values ('${B}', 'pro', now() + interval '3 days', 'test')`);
check('użytkownik nie dopisze sobie bonusu', !r.ok, r.ok ? 'ZAPISAŁO SIĘ' : '');

await zdarzenie(B, 'canceled', 'pro');
await db.query(`insert into public.bonus_plan (user_id, plan, do_kiedy, zrodlo)
                values ('${B}', 'starter', now() + interval '3 days', 'xp_level_5')`);
r = await as(B, `select public.plan_poziom() as p`);
check('ważny bonus daje poziom mimo braku subskrypcji', r.ok && r.rows[0].p === 1);

await db.query(`update public.bonus_plan set do_kiedy = now() - interval '1 hour' where user_id = '${B}'`);
r = await as(B, `select public.plan_poziom() as p`);
check('przeterminowany bonus przestaje działać', r.ok && r.rows[0].p === 0);

console.log('\n  Licznik miesięczny\n');

r = await as(A, `select public.ai_licznik_zuzyj_mies('test', 2) as w`);
check('pierwsze wywołanie w puli przechodzi', r.ok && r.rows[0].w === true, r.err);
r = await as(A, `select public.ai_licznik_zuzyj_mies('test', 2) as w`);
check('drugie wywołanie przechodzi', r.ok && r.rows[0].w === true);
r = await as(A, `select public.ai_licznik_zuzyj_mies('test', 2) as w`);
check('trzecie odbite - pula 2 wyczerpana', r.ok && r.rows[0].w === false);

r = await as(A, `select public.ai_licznik_zuzyj('test', 100) as w`);
check('licznik dzienny tej samej kategorii liczy osobno', r.ok && r.rows[0].w === true);
r = await db.query(`select count(*)::int as n from public.ai_licznik
                    where user_id = '${A}' and kategoria in ('test', 'mies:test')`);
check('wiersze dzienne i miesięczne nie zlewają się', r.rows[0].n === 2, `wierszy: ${r.rows[0].n}`);

console.log('\n  Limity zależne od planu\n');

await zdarzenie(A, 'active', 'starter');
r = await as(A, `select (public.wyglad_limit() ->> 'limit_miesiaca')::int as lm,
                        (public.plan_ai_limit() ->> 'odstep_dni')::int as od`);
check('Starter: 1 skan/mies i plan co 30 dni', r.ok && r.rows[0].lm === 1 && r.rows[0].od === 30,
  JSON.stringify(r.rows?.[0]));

await zdarzenie(A, 'active', 'pro');
r = await as(A, `select (public.wyglad_limit() ->> 'limit_miesiaca')::int as lm,
                        (public.plan_ai_limit() ->> 'odstep_dni')::int as od`);
check('Pro: 5 skanów/mies i plan co 7 dni', r.ok && r.rows[0].lm === 5 && r.rows[0].od === 7,
  JSON.stringify(r.rows?.[0]));

console.log(`\n  Wynik: ${ok} ✅ / ${bad} ❌\n`);
if (bad > 0) process.exit(1);
