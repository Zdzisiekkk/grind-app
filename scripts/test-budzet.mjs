/*
 * Miesięczny budżet na AI - sprawdzenie na żywej bazie.
 *
 * Limit kosztowy ma jedną własność, której nie da się sprawdzić okiem:
 * czy da się go obejść. Dlatego tutaj nie ma ani jednego wywołania modelu,
 * za to jest lista rzeczy, których konto NIE MOŻE zrobić ze swoim licznikiem
 * wydatków - łącznie z rozliczeniem prawdziwego wywołania na zero.
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
const stan = async (uid) => (await as(uid, `select public.ai_budzet_stan() as s`)).rows[0].s;
const rezerwuj = async (uid, kat) =>
  (await as(uid, `select public.ai_koszt_rezerwuj('${kat}') as r`)).rows[0].r;

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;

console.log('\n  Stan na czystym koncie\n');
let s = await stan(A);
check('limit to 8 zł', Number(s.limit_pln) === 8, JSON.stringify(s));
check('nic jeszcze nie wydano', Number(s.wydano_pln) === 0 && Number(s.zostalo_pln) === 8);
check('zwykłe konto nie jest zwolnione', s.bez_limitu === false);

console.log('\n  Rezerwacja i rozliczenie\n');
let r = await rezerwuj(A, 'trener');
check('rezerwacja przechodzi', r.ok === true, JSON.stringify(r));
const id1 = r.id;
check('rezerwacja to pesymistyczne 0,06 USD', Number(r.szacunek_usd) === 0.06);

s = await stan(A);
check('nierozliczona rezerwacja liczy się po szacunku', Number(s.wydano_usd) === 0.06, JSON.stringify(s));

r = await as(A, `select public.ai_koszt_rozlicz('${id1}', 'claude-opus-5', 0.0088,
                   '{"input_tokens":1081,"output_tokens":136}'::jsonb) as r`);
check('rozliczenie się udaje', r.ok && r.rows[0].r === true, r.err);
s = await stan(A);
check('po rozliczeniu liczy się prawdziwy koszt, nie szacunek',
  Number(s.wydano_usd) === 0.0088, JSON.stringify(s));
check('kwota w złotówkach po kursie 3,65', Number(s.wydano_pln) === 0.03, JSON.stringify(s));

r = await as(A, `select public.ai_koszt_rozlicz('${id1}', '', 0, '{}'::jsonb) as r`);
check('drugie rozliczenie tego samego wywołania odrzucone', r.ok && r.rows[0].r === false);

console.log('\n  Model spoza cennika\n');
// Kosztu nie da się policzyć -> rozliczenie z NULL zostawia rezerwację.
// Zamiana na zero byłaby cichym darmowym wywołaniem przy każdej zmianie modelu.
r = await rezerwuj(A, 'trener');
const idNull = r.id;
r = await as(A, `select public.ai_koszt_rozlicz('${idNull}', 'model-spoza-cennika', null, '{}'::jsonb) as r`);
check('rozliczenie bez kwoty przechodzi', r.ok && r.rows[0].r === true, r.err);
check('ale kwota zostaje pesymistyczna, nie zerowa',
  Number((await stan(A)).wydano_usd) === 0.0688, JSON.stringify(await stan(A)));
await db.exec(`delete from public.ai_wydatki where id = '${idNull}'`);

console.log('\n  Nieudane wywołanie zwalnia rezerwację\n');
r = await rezerwuj(A, 'trener');
const id2 = r.id;
await as(A, `select public.ai_koszt_rozlicz('${id2}', '', 0, '{}'::jsonb)`);
s = await stan(A);
check('po zwolnieniu budżet wraca do stanu sprzed próby',
  Number(s.wydano_usd) === 0.0088, JSON.stringify(s));

console.log('\n  Twardy próg\n');
// Do progu 8 zł / 3,65 = 2,191780 USD. Dokładamy jedno drogie wywołanie,
// żeby zobaczyć, że rezerwacja planu (0,30 USD) przestaje się mieścić.
r = await rezerwuj(A, 'plan');
check('plan rezerwuje 0,30 USD', Number(r.szacunek_usd) === 0.30, JSON.stringify(r));
await as(A, `select public.ai_koszt_rozlicz('${r.id}', 'claude-opus-5', 2.0, '{}'::jsonb)`);

s = await stan(A);
check('po drogim wywołaniu zostało niecałe 0,70 zł',
  Number(s.zostalo_pln) > 0 && Number(s.zostalo_pln) < 0.72, JSON.stringify(s));

r = await rezerwuj(A, 'plan');
check('kolejny plan (0,30 USD = 1,10 zł) się NIE mieści', r.ok === false, JSON.stringify(r));
check('podany powód to wyczerpany miesiąc', r.powod === 'limit_miesiaca');

const przed = Number((await stan(A)).wywolan);
await rezerwuj(A, 'plan');
check('odmowa nie zapisuje wiersza, więc sama nie kosztuje',
  Number((await stan(A)).wywolan) === przed);

r = await rezerwuj(A, 'trener');
check('ale tańsze pytanie do trenera jeszcze wchodzi', r.ok === true, JSON.stringify(r));
await as(A, `select public.ai_koszt_rozlicz('${r.id}', 'claude-opus-5', 0.19, '{}'::jsonb)`);

r = await rezerwuj(A, 'trener');
check('po przekroczeniu progu trener też jest zamknięty', r.ok === false, JSON.stringify(r));

console.log('\n  Skan wyglądu ma własny limit i nie zjada budżetu trenera\n');
r = await rezerwuj(A, 'wyglad');
check('skan przechodzi mimo wyczerpanego budżetu trenera', r.ok === true, JSON.stringify(r));
await as(A, `select public.ai_koszt_rozlicz('${r.id}', 'claude-sonnet-5', 0.04, '{}'::jsonb)`);
const poSkanie = Number((await stan(A)).wydano_usd);
r = await rezerwuj(A, 'wyglad');
await as(A, `select public.ai_koszt_rozlicz('${r.id}', 'claude-sonnet-5', 0.04, '{}'::jsonb)`);
check('koszt skanu nie podbija licznika trenera',
  Number((await stan(A)).wydano_usd) === poSkanie);

console.log('\n  Rejestru nie da się tknąć\n');
r = await as(A, `select * from public.ai_wydatki`);
check('konto nie odczyta rejestru wydatków', !r.ok, r.ok ? 'ODCZYTAŁO' : '');
r = await as(A, `delete from public.ai_wydatki where user_id = '${A}'`);
check('konto nie skasuje swoich wydatków', !r.ok, r.ok ? 'SKASOWAŁO' : '');
r = await as(A, `insert into public.ai_wydatki (user_id, kategoria, szacunek_usd)
                 values ('${A}', 'trener', 0)`);
check('konto nie dopisze sobie wiersza za zero', !r.ok, r.ok ? 'DOPISAŁO' : '');
r = await as(A, `update public.ai_wydatki set koszt_usd = 0 where user_id = '${A}'`);
check('konto nie wyzeruje kwot', !r.ok, r.ok ? 'WYZEROWAŁO' : '');

console.log('\n  Cudze wywołania\n');
r = await rezerwuj(B, 'trener');
const idB = r.id;
r = await as(A, `select public.ai_koszt_rozlicz('${idB}', '', 0, '{}'::jsonb) as r`);
check('A nie rozliczy wywołania B', r.ok && r.rows[0].r === false);
check('budżet B pozostał obciążony', Number((await stan(B)).wydano_usd) === 0.06);
check('B nie widzi wydatków A', Number((await stan(B)).wywolan) === 1);

console.log('\n  Nowy miesiąc\n');
await db.exec(`update public.ai_wydatki set utworzono = public.poczatek_miesiaca() - interval '1 day'
                where user_id = '${A}'`);
s = await stan(A);
check('wydatki z poprzedniego miesiąca nie liczą się do progu',
  Number(s.wydano_usd) === 0 && Number(s.zostalo_pln) === 8, JSON.stringify(s));
check('licznik wywołań też startuje od zera', Number(s.wywolan) === 0);
r = await rezerwuj(A, 'plan');
check('po odnowieniu miesiąca plan znowu przechodzi', r.ok === true, JSON.stringify(r));
await db.exec(`delete from public.ai_wydatki where user_id = '${A}'
                and utworzono >= public.poczatek_miesiaca()`);

console.log('\n  Administrator bez limitu\n');
await db.exec(`update public.profiles set role = 'admin' where id = '${B}'`);
s = await stan(B);
check('stan mówi wprost, że konto jest zwolnione', s.bez_limitu === true, JSON.stringify(s));

// Wpychamy administratorowi wydatki daleko ponad próg.
r = await rezerwuj(B, 'plan');
await as(B, `select public.ai_koszt_rozlicz('${r.id}', 'claude-opus-5', 5.0, '{}'::jsonb)`);
s = await stan(B);
check('licznik administratora nadal mówi prawdę',
  Number(s.wydano_usd) === 5.06 && Number(s.zostalo_pln) === 0, JSON.stringify(s));
r = await rezerwuj(B, 'plan');
check('administrator generuje plan ponad progiem', r.ok === true, JSON.stringify(r));
await as(B, `select public.ai_koszt_rozlicz('${r.id}', 'claude-opus-5', 0.1, '{}'::jsonb)`);

await db.exec(`update public.profiles set role = 'user' where id = '${B}'`);
r = await rezerwuj(B, 'plan');
check('po odebraniu roli limit wraca natychmiast', r.ok === false, JSON.stringify(r));

console.log('\n  Próg da się zmienić bez wdrożenia\n');
await db.exec(`update public.app_settings
                  set value = jsonb_set(value, '{limit_pln}', '40')
                where key = 'ai_budzet'`);
r = await rezerwuj(B, 'plan');
check('podniesiony próg działa od razu', r.ok === true, JSON.stringify(r));
check('stan pokazuje nowy limit', Number((await stan(B)).limit_pln) === 40);


/* ------------------------------------------------------------------
 * Odstęp między planami od AI (migracja 0048)
 *
 * Limit, którego da się nie zauważyć, to nie limit: reguła siedzi w bazie,
 * więc ekran nie jest jedyną drogą do jej ominięcia. Sprawdzamy obie strony:
 * że blokuje po udanym planie i że NIE blokuje po nieudanym - bo nieudane
 * wywołanie modelu nie może zabierać półtora miesiąca za coś, czego nie było.
 * ------------------------------------------------------------------ */

console.log('\n  Odstęp między planami\n');

const limitPlanu = async (uid) => (await as(uid, 'select public.plan_ai_limit() as l')).rows[0].l;

const wejscie = `'{"goal":"siła","days_per_week":4,"experience":"intermediate","session_minutes":60,"equipment":[],"limitations":""}'::jsonb`;
const zgloszenie = (uid, status) => as(uid,
  `insert into public.ai_plan_requests (user_id, input, model, status)
   values ('${uid}', ${wejscie}, 'claude-opus-5', '${status}') returning id`);

let stanPlanu = await limitPlanu(A);
check('bez historii wolno ułożyć plan', stanPlanu.mozna === true, JSON.stringify(stanPlanu));
check('odstęp to 45 dni', stanPlanu.odstep_dni === 45, String(stanPlanu.odstep_dni));
check('bez planu nie ma na co czekać', stanPlanu.ostatni_plan === null);

let wynikPlanu = await zgloszenie(A, 'ok');
check('pierwszy plan przechodzi', wynikPlanu.ok === true, wynikPlanu.err);

stanPlanu = await limitPlanu(A);
check('po udanym planie kolejny jest zablokowany', stanPlanu.mozna === false, JSON.stringify(stanPlanu));
check('powód mówi wprost o odstępie', stanPlanu.powod === 'odstep', String(stanPlanu.powod));
check('ekran wie, od kiedy wolno następny', typeof stanPlanu.nastepny_od === 'string' && stanPlanu.nastepny_od > new Date().toISOString());

wynikPlanu = await zgloszenie(A, 'ok');
check('baza odrzuca drugi plan w oknie odstępu', wynikPlanu.ok === false, wynikPlanu.ok ? 'ZAPISAŁO SIĘ' : '');

check('limit dotyczy konta, nie całej aplikacji', (await limitPlanu(B)).mozna === true);

// Nieudane wywołanie modelu nie może kosztować półtora miesiąca.
wynikPlanu = await zgloszenie(B, 'error');
check('nieudane zgłoszenie przechodzi', wynikPlanu.ok === true, wynikPlanu.err);
check('nieudane zgłoszenie nie blokuje kolejnego planu',
  (await limitPlanu(B)).mozna === true, JSON.stringify(await limitPlanu(B)));

// Przesuwamy stary plan poza okno - limit ma puścić sam z siebie.
await db.query(
  `update public.ai_plan_requests set created_at = now() - interval '46 days' where user_id = $1`, [A]);
stanPlanu = await limitPlanu(A);
check('po 46 dniach wolno układać od nowa', stanPlanu.mozna === true, JSON.stringify(stanPlanu));
check('plan sprzed 46 dni nadal jest widoczny jako ostatni', stanPlanu.ostatni_plan !== null);

// Próg leży w app_settings, żeby zmiana nie wymagała wdrożenia.
await db.query(`update public.app_settings set value = jsonb_build_object('odstep_dni', 90) where key = 'plan_ai'`);
check('zmiana progu w app_settings działa od razu',
  (await limitPlanu(A)).odstep_dni === 90 && (await limitPlanu(A)).mozna === false);
await db.query(`update public.app_settings set value = jsonb_build_object('odstep_dni', 45) where key = 'plan_ai'`);

// Funkcje limitu nie mogą odpowiadać niezalogowanym (pułapka z 0045).
const anonLimit = await db.query(`select count(*)::int n from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.proname in ('plan_ai_limit','plan_ai_moze_generowac')
   and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('public', p.oid, 'execute'))`);
check('funkcje limitu milczą wobec niezalogowanych', anonLimit.rows[0].n === 0,
  `otwartych: ${anonLimit.rows[0].n}`);

console.log(`\n  ${ok} przeszło, ${bad} nie przeszło\n`);
process.exit(bad ? 1 : 0);
