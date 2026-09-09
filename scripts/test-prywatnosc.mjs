/*
 * Izolacja danych między kontami - test na żywej bazie.
 *
 * Pytanie brzmi prosto: czy ktokolwiek inny widzi moje dane. Odpowiedź
 * "polityki wyglądają dobrze" nie jest odpowiedzią - polityka, która nie
 * została sprawdzona przez próbę, jest tylko deklaracją.
 *
 * Dlatego tutaj są dwie osoby. A zapisuje coś w KAŻDYM module aplikacji,
 * B próbuje to zobaczyć - przez zwykły odczyt, przez zapytanie po cudzym
 * identyfikatorze i przez wyszukiwarkę produktów. Każdy taki odczyt musi
 * zwrócić zero wierszy.
 *
 * Uruchom: npm run test:prywatnosc
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

console.log('\n  A zapisuje dane w każdym module\n');

// Każdy wpis idzie JAKO A, przez RLS - nie kluczem serwisowym. Inaczej test
// sprawdzałby tylko odczyt, a nie to, czy zapis w ogóle podlega regułom.
const zapisy = [
  ['waga',        `insert into public.body_weight_logs (user_id, date, weight_kg) values ('${A}', current_date, 82.5)`],
  ['posiłek',     `insert into public.meals (user_id, meal_type) values ('${A}', 'lunch')`],
  ['woda',        `insert into public.water_logs (user_id, ml) values ('${A}', 500)`],
  ['trening',     `insert into public.workout_sessions (user_id, day_label) values ('${A}', 'Push A')`],
  ['aktywność',   `insert into public.activities (user_id, type, duration_min) values ('${A}', 'running', 45)`],
  ['sen',         `insert into public.sleep_logs (user_id, bedtime, wake_time, quality) values ('${A}', '23:00', '07:00', 4)`],
  ['nawyk',       `insert into public.habits (user_id, name) values ('${A}', 'Czytanie')`],
  ['nałóg',       `insert into public.vices (user_id, name) values ('${A}', 'Papierosy')`],
  ['kontuzja',    `insert into public.injuries (user_id, name) values ('${A}', 'Kolano')`],
  ['książka',     `insert into public.books (user_id, title) values ('${A}', 'Meditations')`],
  ['zadanie',     `insert into public.todos (user_id, title) values ('${A}', 'Zadzwonić do mamy')`],
  ['produkt własny', `insert into public.foods (user_id, name, source, kcal_100g) values ('${A}', 'Sekretne ciasto babci', 'custom', 400)`],
  ['przepis',     `insert into public.recipes (user_id, name) values ('${A}', 'Mój przepis')`],
];

for (const [nazwa, sql] of zapisy) {
  const r = await as(A, sql);
  check(`A zapisuje: ${nazwa}`, r.ok, r.err);
}

// Moduł wyglądu wymaga zgody - zdjęcia twarzy to dane najwrażliwsze w apce.
await as(A, `insert into public.wyglad_zgoda (user_id, wiek_potwierdzony) values ('${A}', true)`);
const skanA = await as(A, `insert into public.wyglad_skany (user_id, ocena_ogolna) values ('${A}', 71) returning id`);
check('A zapisuje: skan wyglądu', skanA.ok, skanA.err);

console.log('\n  B nie widzi niczego z tego\n');

const odczyty = [
  ['wagi',         `select * from public.body_weight_logs`],
  ['posiłków',     `select * from public.meals`],
  ['wpisów wody',  `select * from public.water_logs`],
  ['treningów',    `select * from public.workout_sessions`],
  ['aktywności',   `select * from public.activities`],
  ['snu',          `select * from public.sleep_logs`],
  ['nawyków',      `select * from public.habits`],
  ['nałogów',      `select * from public.vices`],
  ['kontuzji',     `select * from public.injuries`],
  ['książek',      `select * from public.books`],
  ['zadań',        `select * from public.todos`],
  ['skanów wyglądu', `select * from public.wyglad_skany`],
  ['zdjęć',        `select * from public.wyglad_zdjecia`],
  ['profilu',      `select * from public.profiles where id = '${A}'`],
  ['subskrypcji',  `select * from public.subscriptions`],
  ['punktów XP',   `select * from public.xp_zdarzenia`],
  ['rozmów z trenerem', `select * from public.coach_messages`],
];

for (const [nazwa, sql] of odczyty) {
  const r = await as(B, sql);
  check(`B nie widzi ${nazwa}`, r.ok && r.rows.length === 0, r.ok ? `WIDZI ${r.rows.length}` : r.err);
}

console.log('\n  Wyszukiwarka produktów i przepisów\n');

let r = await as(B, `select * from public.foods where name ilike '%sekretne%'`);
check('cudzy produkt nie wychodzi w wyszukiwarce', r.ok && r.rows.length === 0,
  r.ok ? `ZNALAZŁ ${r.rows.length}` : r.err);

r = await as(B, `select * from public.recipes where user_id is not null`);
check('cudze przepisy nie wychodzą na liście', r.ok && r.rows.length === 0,
  r.ok ? `ZNALAZŁ ${r.rows.length}` : r.err);

// Wspólny katalog MA być widoczny - to dane produktowe, nie osobowe.
// Gdyby ten test padł, znaczyłoby to, że zamykając prywatność zamknęliśmy
// przy okazji wyszukiwarkę wszystkim.
// Nazwa celowo taka, jakiej nie ma w katalogu wgrywanym przez migracje -
// "Mleko 2%" już tam siedzi i test liczyłby dwa wiersze zamiast jednego.
await db.query(`insert into public.foods (user_id, name, source, kcal_100g) values (null, 'Testowy produkt wspólny 0001', 'off', 51)`);
r = await as(B, `select * from public.foods where name = 'Testowy produkt wspólny 0001'`);
check('wspólny katalog produktów dalej działa', r.ok && r.rows.length === 1,
  r.ok ? `wierszy: ${r.rows.length}` : r.err);

console.log('\n  Celowanie w konkretny cudzy wiersz\n');

const idSkanuA = skanA.ok ? skanA.rows[0].id : null;
r = await as(B, `select * from public.wyglad_skany where id = '${idSkanuA}'`);
check('B nie odczyta skanu A po jego identyfikatorze', r.ok && r.rows.length === 0);

r = await as(B, `update public.body_weight_logs set weight_kg = 999 where user_id = '${A}'`);
const waga = (await db.query(`select weight_kg from public.body_weight_logs where user_id = '${A}'`)).rows[0];
check('B nie podmieni wagi A', Number(waga.weight_kg) === 82.5, `jest ${waga.weight_kg}`);

r = await as(B, `delete from public.workout_sessions where user_id = '${A}'`);
const ileTreningow = (await db.query(`select count(*)::int as n from public.workout_sessions where user_id = '${A}'`)).rows[0].n;
check('B nie skasuje treningów A', ileTreningow > 0);

/*
 * A DOSTAJE SUBSKRYPCJĘ, zanim B o nią zapyta.
 *
 * Bez tego sprawdzenie przechodziło z niewłaściwego powodu: A nie miał planu,
 * więc funkcja i tak zwracała zero i nie dało się odróżnić szczelności od
 * pustego konta. Test, który przechodzi przypadkiem, jest gorszy niż jego brak,
 * bo daje spokój tam, gdzie go nie ma.
 */
await db.query(`insert into public.subscriptions (user_id, status, plan, current_period_end)
                values ('${A}', 'active', 'pro', now() + interval '30 days')
                on conflict (user_id) do update
                set status = 'active', plan = 'pro',
                    current_period_end = now() + interval '30 days'`);

r = await as(A, `select public.plan_poziom() as p`);
check('A faktycznie ma plan, więc jest co ukrywać', r.ok && r.rows[0].p === 2, JSON.stringify(r.rows?.[0]));

r = await as(B, `select public.has_pro('${A}') as p`);
check('B nie sprawdzi cudzej subskrypcji', r.ok && r.rows[0].p === false, r.err);

r = await as(B, `select public.plan_poziom('${A}') as p`);
check('B nie sprawdzi cudzego planu', r.ok && r.rows[0].p === 0, r.err);

console.log('\n  Audyt schematu\n');

/*
 * Sprawdzenia strukturalne, nie scenariuszowe. Powyższe testy pokazują, że
 * KONKRETNE dane są szczelne; te pokazują, że nie da się dołożyć nowej tabeli
 * albo widoku, który wypadnie poza ten mechanizm. Nowa zakładka to zwykle
 * nowa tabela - i to jest moment, w którym rodzi się wyciek.
 */
r = await db.query(`
  select c.relname, c.relrowsecurity,
         (select count(*) from pg_policy p where p.polrelid = c.oid) as polityk,
         has_table_privilege('authenticated', c.oid, 'SELECT') as czyta
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped)`);

const bezRls = r.rows.filter((t) => !t.relrowsecurity).map((t) => t.relname);
check('każda tabela z user_id ma włączone RLS', bezRls.length === 0, bezRls.join(', '));

// Zero polityk jest w porządku TYLKO wtedy, gdy nikt nie ma też prawa czytać -
// to celowa blokada rejestrów wewnętrznych, a nie zapomniana polityka.
const dziurawe = r.rows.filter((t) => Number(t.polityk) === 0 && t.czyta).map((t) => t.relname);
check('tabela bez polityki jest też bez prawa odczytu', dziurawe.length === 0, dziurawe.join(', '));

r = await db.query(`
  select c.relname,
         coalesce((select true from unnest(c.reloptions) o
                    where o = 'security_invoker=on'), false) as pytajacy
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'`);
const cudzePrawa = r.rows.filter((w) => !w.pytajacy).map((w) => w.relname);
check(
  'każdy widok działa z prawami pytającego, nie właściciela',
  cudzePrawa.length === 0,
  cudzePrawa.join(', '),
);

/*
 * Funkcje SECURITY DEFINER omijają RLS z definicji. Te, które przyjmują
 * identyfikator użytkownika jako argument, są więc pytaniem "powiedz mi coś
 * o tym koncie" - i muszą same pilnować, żeby odpowiadać wyłącznie o pytającym.
 * Lista jest zamknięta: nowa funkcja z takim argumentem ma zapalić lampkę.
 */
const DOZWOLONE_Z_ID = ['has_pro', 'plan_poziom'];
r = await db.query(`
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_function_arguments(p.oid) like '%p_user uuid%'`);
const nowe = r.rows.map((f) => f.proname).filter((f) => !DOZWOLONE_Z_ID.includes(f));
check(
  'żadna nowa funkcja nie przyjmuje cudzego id od zalogowanych',
  nowe.length === 0,
  nowe.join(', '),
);

console.log('\n  Bez logowania\n');

await db.exec(`set role anon;`);
let anon;
try {
  const q = await db.query(`select count(*)::int as n from public.body_weight_logs`);
  anon = q.rows[0].n;
} catch { anon = 'odmowa'; }
await db.exec('reset role;');
check('niezalogowany nie czyta żadnych wag', anon === 0 || anon === 'odmowa', String(anon));

console.log(`\n  Wynik: ${ok} ✅ / ${bad} ❌\n`);
if (bad > 0) process.exit(1);
