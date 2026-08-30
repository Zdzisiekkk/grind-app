/*
 * Moduł "Wygląd" - sprawdzenie reguł dostępu na żywej bazie.
 *
 * Migracja, która "się nałożyła", nie mówi nic o tym, czy polityki działają.
 * Tutaj są dwie osoby i lista rzeczy, których jedna NIE MOŻE zrobić drugiej -
 * plus limity, bo limit kosztowy sprawdzany wyłącznie w interfejsie nie jest
 * limitem, tylko sugestią.
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

console.log('\n  Zgoda jako warunek zapisu\n');
let r = await as(A, `insert into public.wyglad_skany (user_id, ocena_ogolna) values ('${A}', 70) returning id`);
check('bez zgody skan nie przechodzi', !r.ok, r.ok ? 'ZAPISAŁO SIĘ' : '');

await as(A, `insert into public.wyglad_zgoda (user_id, wiek_potwierdzony) values ('${A}', false)`);
r = await as(A, `insert into public.wyglad_skany (user_id, ocena_ogolna) values ('${A}', 70) returning id`);
check('samo kliknięcie bez potwierdzenia wieku nie wystarcza', !r.ok);

await as(A, `update public.wyglad_zgoda set wiek_potwierdzony = true where user_id = '${A}'`);
r = await as(A, `insert into public.wyglad_skany (user_id, ocena_ogolna) values ('${A}', 70) returning id`);
check('po potwierdzeniu 16+ skan się zapisuje', r.ok, r.err);
const skanA = r.ok ? r.rows[0].id : null;

console.log('\n  Cudze dane\n');
r = await as(B, `select * from public.wyglad_skany`);
check('B nie widzi skanów A', r.ok && r.rows.length === 0, `wierszy: ${r.rows?.length}`);

await as(B, `insert into public.wyglad_zgoda (user_id, wiek_potwierdzony) values ('${B}', true)`);
r = await as(B, `insert into public.wyglad_zdjecia (user_id, skan_id, ujecie, storage_path)
                 values ('${B}', '${skanA}', 'front', '${B}/x/front.jpg')`);
check('B nie dopisze zdjęcia do skanu A', !r.ok, r.ok ? 'PRZESZŁO' : '');

r = await as(B, `update public.wyglad_skany set ocena_ogolna = 1 where id = '${skanA}'`);
check('B nie zmieni oceny w skanie A', r.ok && (await db.query(`select ocena_ogolna from public.wyglad_skany where id='${skanA}'`)).rows[0].ocena_ogolna === 70);

r = await as(A, `insert into public.wyglad_zdjecia (user_id, skan_id, ujecie, storage_path)
                 values ('${A}', '${skanA}', 'front', '${A}/${skanA}/front.jpg') returning id`);
check('A dopisuje zdjęcie do własnego skanu', r.ok, r.err);

r = await as(A, `insert into public.wyglad_zdjecia (user_id, skan_id, ujecie, storage_path)
                 values ('${A}', '${skanA}', 'front', '${A}/${skanA}/front2.jpg')`);
check('to samo ujęcie drugi raz odrzucone', !r.ok);

console.log('\n  Cofnięcie zgody nie zabiera własnych skanów\n');
await as(A, `update public.wyglad_zgoda set wiek_potwierdzony = false where user_id = '${A}'`);
r = await as(A, `select ocena_ogolna from public.wyglad_skany where id = '${skanA}'`);
check('A dalej czyta swój raport', r.ok && r.rows.length === 1);
r = await as(A, `insert into public.wyglad_skany (user_id) values ('${A}')`);
check('ale nowego skanu już nie zrobi', !r.ok);
await as(A, `update public.wyglad_zgoda set wiek_potwierdzony = true where user_id = '${A}'`);

console.log('\n  Rutyny\n');
r = await as(A, `insert into public.wyglad_rutyny (user_id, klucz, nazwa, pora) values ('${A}','wieczor_baza','Wieczór','wieczor') returning id`);
const rutA = r.rows?.[0]?.id;
check('rutyna zapisana', r.ok, r.err);
r = await as(A, `insert into public.wyglad_rutyny (user_id, klucz, nazwa, pora) values ('${A}','wieczor_baza','Wieczór 2','wieczor')`);
check('ten sam klucz nie tworzy duplikatu', !r.ok);
r = await as(B, `insert into public.wyglad_rutyna_log (user_id, rutyna_id) values ('${B}', '${rutA}')`);
check('B nie odhaczy rutyny A', !r.ok);
r = await as(A, `insert into public.wyglad_rutyna_log (user_id, rutyna_id) values ('${A}', '${rutA}') returning id`);
check('A odhacza swoją', r.ok, r.err);

console.log('\n  Limity skanowania\n');
r = await as(A, `select public.wyglad_limit() as l`);
check('po pierwszym skanie kolejny jest zablokowany', r.ok && r.rows[0].l.mozna === false && r.rows[0].l.powod === 'odstep', JSON.stringify(r.rows?.[0]?.l));
r = await as(A, `insert into public.wyglad_skany (user_id, ocena_ogolna) values ('${A}', 71)`);
check('próba drugiego skanu tego samego dnia odrzucona', !r.ok);

// Cofamy pierwszy skan o osiem dni - odstęp minął.
await db.exec(`update public.wyglad_skany set utworzono = now() - interval '8 days' where id = '${skanA}'`);
r = await as(A, `select public.wyglad_limit() as l`);
check('po ośmiu dniach znowu można', r.ok && r.rows[0].l.mozna === true, JSON.stringify(r.rows?.[0]?.l));

// Miesięczny limit osobno: odstęp na zero, żeby sprawdzać jedną rzecz naraz.
await db.exec(`update public.app_settings set value = jsonb_set(value, '{odstep_dni}', '0') where key = 'wyglad'`);
let doszlo = 1;
for (let i = 0; i < 6; i++) {
  const res = await as(A, `insert into public.wyglad_skany (user_id) values ('${A}') returning id`);
  if (res.ok) doszlo++; else break;
}
check('miesięczny limit przepuszcza dokładnie pięć skanów', doszlo === 5, `doszło: ${doszlo}`);
r = await as(A, `select public.wyglad_limit() as l`);
check('powodem odmowy jest wyczerpany miesiąc', r.ok && r.rows[0].l.powod === 'limit_miesiaca', JSON.stringify(r.rows?.[0]?.l));
r = await as(A, `insert into public.wyglad_skany (user_id) values ('${A}')`);
check('szósty skan odrzucony przez bazę, nie przez ekran', !r.ok);
await db.exec(`update public.app_settings set value = jsonb_set(value, '{odstep_dni}', '7') where key = 'wyglad'`);

console.log('\n  Administrator bez limitu\n');

/*
 * Limity mają pilnować rachunku i chronić przed codziennym ocenianiem się.
 * Osoba budująca aplikację musi móc sprawdzić skaner pięć razy pod rząd,
 * więc zwolnienie idzie przez is_admin() - tę samą funkcję co reszta
 * uprawnień, a nie przez osobną listę adresów.
 */
await db.exec(`update public.profiles set role = 'admin' where id = '${B}'`);

// B ma już wyczerpany odstęp? Nie - B nie zrobił dotąd żadnego skanu.
// Robimy dwa pod rząd: dla zwykłego konta drugi odbiłby się od reguły 7 dni.
let r1 = await as(B, `insert into public.wyglad_skany (user_id) values ('${B}') returning id`);
let r2 = await as(B, `insert into public.wyglad_skany (user_id) values ('${B}') returning id`);
check('administrator robi dwa skany pod rząd', r1.ok && r2.ok, r2.err ?? '');

r = await as(B, `select public.wyglad_limit() as l`);
check('limit zgłasza brak ograniczeń', r.ok && r.rows[0].l.bez_limitu === true && r.rows[0].l.mozna === true,
  JSON.stringify(r.rows?.[0]?.l));
check('licznik miesiąca nadal mówi prawdę', r.ok && r.rows[0].l.w_miesiacu === 2,
  `w_miesiacu=${r.rows?.[0]?.l?.w_miesiacu}`);

// I odwrotnie: odebranie roli natychmiast przywraca limit.
await db.exec(`update public.profiles set role = 'user' where id = '${B}'`);
r = await as(B, `insert into public.wyglad_skany (user_id) values ('${B}')`);
check('po odebraniu roli limit wraca', !r.ok, r.ok ? 'ZAPISAŁO SIĘ' : '');

console.log('\n  Po usunięciu konta\n');

/*
 * Baza gwarantuje kaskadę na wierszach - i tylko tyle.
 *
 * Pierwsza wersja migracji miała wyzwalacz kasujący też wiersze ze
 * storage.objects. Supabase broni tej tabeli przed bezpośrednim DELETE, więc
 * wyzwalacz wywracał usunięcie KAŻDEGO konta, także takiego bez jednego zdjęcia.
 * PGlite tej blokady nie ma, dlatego test przechodził, a produkcja nie.
 * Same pliki kasuje deleteAccount() przez API magazynu, przed skasowaniem konta.
 */
await db.exec(`insert into storage.objects (bucket_id, name) values ('wyglad', '${A}/${skanA}/front.jpg')`);
await db.exec(`delete from auth.users where id = '${A}'`);

const poSkany = (await db.query(`select id from public.wyglad_skany where user_id = '${A}'`)).rows;
const poZdjecia = (await db.query(`select id from public.wyglad_zdjecia where user_id = '${A}'`)).rows;
const poRutyny = (await db.query(`select id from public.wyglad_rutyny where user_id = '${A}'`)).rows;
check('skany usuniętego konta znikają kaskadą', poSkany.length === 0, `wierszy: ${poSkany.length}`);
check('wiersze zdjęć znikają razem ze skanem', poZdjecia.length === 0, `wierszy: ${poZdjecia.length}`);
check('rutyny znikają razem z kontem', poRutyny.length === 0, `wierszy: ${poRutyny.length}`);

const drugieKonto = (await db.query(`select id from auth.users where id = '${B}'`)).rows;
check('drugie konto zostaje nietknięte', drugieKonto.length === 1);

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : ' - WSZYSTKO PRZESZŁO'}\n`);
process.exit(bad ? 1 : 0);
