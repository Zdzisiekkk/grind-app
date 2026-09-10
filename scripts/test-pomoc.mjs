/*
 * Pomoc, zgłoszenia i panel administratora.
 *
 * Sedno jest tu jedno: panel administratora to jedyne miejsce w aplikacji,
 * które z założenia sięga poza własne konto. Każda taka droga musi być
 * zamknięta na klucz po stronie bazy, a nie ukryta brakiem linku - dlatego
 * połowa tego pliku to próby wejścia tam z konta bez uprawnień.
 *
 * Uruchom: npm run test:pomoc
 */
import { bazaZMigracjami } from './supabase-stub.mjs';
import { KROKI_SAMOUCZKA, OSTATNI_KROK } from '../src/lib/samouczek.ts';

let ok = 0, bad = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? ' - ' + d : ''}`); }
};

const db = await bazaZMigracjami();
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};

const ADMIN = (await db.query(`insert into auth.users (email) values ('admin@x.pl') returning id`)).rows[0].id;
const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;
await db.query(`update public.profiles set role = 'admin' where id = '${ADMIN}'`);

console.log('\n  Treść samouczka\n');

check('kroki mają unikalne identyfikatory',
  new Set(KROKI_SAMOUCZKA.map((k) => k.id)).size === KROKI_SAMOUCZKA.length);
check('ostatni krok wskazuje na koniec tablicy', OSTATNI_KROK === KROKI_SAMOUCZKA.length - 1);
check('żaden krok nie jest pusty',
  KROKI_SAMOUCZKA.every((k) => k.tytul.trim() && k.tresc.trim() && k.ikona.trim()));
/*
 * Górny limit długości, bo samouczek czyta się na telefonie w kolejce.
 * Ekran, na którym trzeba przewijać tekst, zostaje pominięty - i wtedy cała
 * reszta też, bo pomijanie jest jednym przyciskiem.
 */
check('żaden krok nie jest ścianą tekstu',
  KROKI_SAMOUCZKA.every((k) => k.tresc.length <= 320),
  KROKI_SAMOUCZKA.filter((k) => k.tresc.length > 320).map((k) => k.id).join(', '));
check('samouczek kończy się drogą do pomocy',
  KROKI_SAMOUCZKA[OSTATNI_KROK].tresc.toLowerCase().includes('pomoc'));
check('samouczek mówi o prywatności danych',
  KROKI_SAMOUCZKA.some((k) => k.id === 'prywatnosc'));

console.log('\n  Samouczek\n');

let r = await as(A, `select samouczek_stan from public.profiles where id = '${A}'`);
check('nowe konto zaczyna od samouczka', r.ok && r.rows[0].samouczek_stan === 'nowy', r.err);

r = await as(A, `update public.profiles set samouczek_stan = 'pominiety' where id = '${A}'`);
check('samouczek da się pominąć', r.ok, r.err);

r = await as(A, `update public.profiles set samouczek_stan = 'nowy' where id = '${A}'`);
check('i włączyć z powrotem z Pomocy', r.ok, r.err);

r = await as(A, `update public.profiles set samouczek_stan = 'wlasny' where id = '${A}'`);
check('wymyślony stan samouczka nie przechodzi', !r.ok, 'przeszedł');

console.log('\n  Zgłoszenia\n');

r = await as(A, `insert into public.zgloszenia (user_id, typ, tytul, tresc, strona)
                 values ('${A}', 'blad', 'Waga się nie zapisuje', 'Klikam i nic.', '/profil')
                 returning id, status`);
const zglA = r.ok ? r.rows[0].id : null;
check('A zgłasza problem', r.ok && r.rows[0].status === 'nowe', r.err);

r = await as(A, `insert into public.zgloszenia (user_id, tytul, tresc) values ('${A}', '', 'x')`);
check('puste zgłoszenie odpada', !r.ok, 'przeszło');

// Sedno prywatności: cudzy problem bywa opisem cudzego życia.
r = await as(B, `select * from public.zgloszenia`);
check('B nie widzi zgłoszeń A', r.ok && r.rows.length === 0,
  r.ok ? `WIDZI ${r.rows.length}` : r.err);

r = await as(B, `select * from public.zgloszenia where id = '${zglA}'`);
check('B nie podejrzy zgłoszenia A po identyfikatorze', r.ok && r.rows.length === 0);

r = await as(B, `select public.zgloszenie_dostepne('${zglA}') as d`);
check('funkcja dostępu odmawia obcemu', r.ok && r.rows[0].d === false, r.err);

r = await as(B, `insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, tresc)
                 values ('${zglA}', '${B}', 'Dopisuję się')`);
check('B nie dopisze się do cudzego wątku', !r.ok, 'przeszło');

r = await as(B, `update public.zgloszenia set status = 'rozwiazane' where id = '${zglA}'`);
const statusPo = (await db.query(`select status from public.zgloszenia where id = '${zglA}'`)).rows[0].status;
check('B nie zamknie cudzego zgłoszenia', statusPo === 'nowe', statusPo);

console.log('\n  Odpowiedzi\n');

r = await as(A, `insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, tresc)
                 values ('${zglA}', '${A}', 'Dzieje się na telefonie.') returning od_admina`);
check('odpowiedź użytkownika nie udaje obsługi', r.ok && r.rows[0].od_admina === false, r.err);

r = await as(A, `insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, od_admina, tresc)
                 values ('${zglA}', '${A}', true, 'Tu obsługa, zwracamy pieniądze') returning od_admina`);
check('podrzucony znacznik obsługi zostaje nadpisany',
  r.ok && r.rows[0].od_admina === false, JSON.stringify(r.rows?.[0]));

r = await as(ADMIN, `insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, tresc)
                     values ('${zglA}', '${ADMIN}', 'Poprawione.') returning od_admina`);
check('odpowiedź administratora jest oznaczona', r.ok && r.rows[0].od_admina === true, r.err);

r = await as(A, `select status from public.zgloszenia where id = '${zglA}'`);
check('odpowiedź obsługi przestawia zgłoszenie w toku',
  r.ok && r.rows[0].status === 'w_toku', JSON.stringify(r.rows?.[0]));

r = await as(A, `select count(*)::int as n from public.zgloszenia_odpowiedzi where zgloszenie_id = '${zglA}'`);
check('A widzi odpowiedź na swoje zgłoszenie', r.ok && r.rows[0].n === 3, JSON.stringify(r.rows?.[0]));

console.log('\n  Panel administratora\n');

r = await as(A, `select public.admin_statystyki()`);
check('zwykłe konto nie otworzy statystyk', !r.ok, 'przeszło');

r = await as(A, `select * from public.admin_uzytkownicy()`);
check('zwykłe konto nie pobierze listy kont', !r.ok, 'przeszło');

r = await as(A, `select * from public.admin_uzycie(7)`);
check('zwykłe konto nie pobierze wykresu użycia', !r.ok, 'przeszło');

r = await as(ADMIN, `select public.admin_statystyki() as s`);
check('administrator dostaje statystyki', r.ok && Number(r.rows[0].s.kont) >= 3, r.err);
check('statystyki liczą zgłoszenia',
  r.ok && Number(r.rows[0].s.zgloszenia.razem) >= 1, JSON.stringify(r.rows?.[0]?.s?.zgloszenia));

r = await as(ADMIN, `select * from public.admin_uzytkownicy()`);
check('administrator widzi listę kont', r.ok && r.rows.length >= 3, r.err);

/*
 * Granica panelu: metadane owszem, treść dziennika nie. Gdyby kiedyś ktoś
 * dopisał tu kolumnę z wagą albo posiłkiem, ten test ma o tym powiedzieć.
 */
const kolumny = r.ok ? Object.keys(r.rows[0]) : [];
const zakazane = kolumny.filter((k) =>
  /waga|weight|posilek|meal|kcal|sen|sleep|kontuzj|injur|finans|kwota|netto|nalog|vice/i.test(k),
);
check('lista kont nie wystawia treści dziennika', zakazane.length === 0, zakazane.join(', '));

r = await as(ADMIN, `select count(*)::int as n from public.admin_uzycie(14)`);
check('wykres użycia zwraca żądaną liczbę dni', r.ok && r.rows[0].n === 14, JSON.stringify(r.rows?.[0]));

r = await as(ADMIN, `select count(*)::int as n from public.admin_uzycie(9999)`);
check('zakres wykresu jest przycinany, a nie wierzy klientowi',
  r.ok && r.rows[0].n === 180, JSON.stringify(r.rows?.[0]));

r = await as(ADMIN, `update public.zgloszenia set status = 'rozwiazane' where id = '${zglA}'`);
check('administrator zamyka zgłoszenie', r.ok, r.err);

console.log(`\n  Wynik: ${ok} ✅ / ${bad} ❌\n`);
if (bad > 0) process.exit(1);
