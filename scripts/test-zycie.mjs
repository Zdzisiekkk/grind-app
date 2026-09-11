/*
 * Głowa, Nauka i Cele (migracja 0079).
 *
 * Dwie połowy. Pierwsza to liczenie w kodzie: powtórki, tydzień nauki,
 * postęp celów, zestawienia nastroju - wszystko, co ekran pokazuje jako
 * fakt, więc musi się zgadzać co do dnia. Druga to baza: dwie osoby
 * i lista rzeczy, których jedna NIE MOŻE zrobić drugiej, plus XP, które
 * nie może dać się wyklikać.
 *
 * Uruchom: npm run test:zycie
 */
import { bazaZMigracjami } from './supabase-stub.mjs';
import {
  ETAP_OPANOWANE,
  doPowtorki,
  minuty,
  minutyWTygodniu,
  passaNauki,
  poPowtorce,
  poczatekTygodnia,
} from '../src/lib/nauka.ts';
import { postepCelu, terminDlaHoryzontu } from '../src/lib/cele.ts';
import { czynnikiZlychDni, nastrojASen, passaWpisow, trendTygodnia } from '../src/lib/glowa.ts';

let ok = 0, bad = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? ' - ' + d : ''}`); }
};
const dzien = (iso, o) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

/* ============================ Nauka ============================ */

console.log('\n  Powtórki\n');

let s = poPowtorce(0, '2026-09-11', true);
check('pamiętam na starcie: etap 1, następna za 3 dni', s.etap === 1 && s.nastepna === '2026-09-14', JSON.stringify(s));
s = poPowtorce(4, '2026-09-11', true);
check('etap 4 → 5, następna za 60 dni', s.etap === 5 && s.nastepna === '2026-11-10', JSON.stringify(s));
s = poPowtorce(5, '2026-09-11', true);
check('szósta udana powtórka: opanowana i bez daty', s.etap === ETAP_OPANOWANE && s.nastepna === null, JSON.stringify(s));
s = poPowtorce(5, '2026-09-11', false);
check('"nie pamiętam" cofa na sam początek, powtórka jutro', s.etap === 0 && s.nastepna === '2026-09-12', JSON.stringify(s));

const lista = [
  { id: 'c', etap: 1, nastepna: '2026-09-12' },
  { id: 'b', etap: 2, nastepna: '2026-09-11' },
  { id: 'a', etap: 0, nastepna: '2026-09-09' },
  { id: 'd', etap: 6, nastepna: null },
];
check('na dziś: zaległe i dzisiejsze, najstarsze pierwsze',
  doPowtorki(lista, '2026-09-11').map((x) => x.id).join() === 'a,b',
  doPowtorki(lista, '2026-09-11').map((x) => x.id).join());

console.log('\n  Tydzień nauki\n');

check('tydzień zaczyna się w poniedziałek', poczatekTygodnia('2026-09-11') === '2026-09-07');
check('poniedziałek jest swoim początkiem', poczatekTygodnia('2026-09-07') === '2026-09-07');
check('niedziela należy do tygodnia od poniedziałku', poczatekTygodnia('2026-09-13') === '2026-09-07');

const tydz = minutyWTygodniu([
  { data: '2026-09-06', minuty: 60, temat_id: 'x' },
  { data: '2026-09-07', minuty: 30, temat_id: 'x' },
  { data: '2026-09-11', minuty: 15, temat_id: 'x' },
  { data: '2026-09-10', minuty: 20, temat_id: 'y' },
], '2026-09-11');
check('liczą się minuty z tego tygodnia, bez niedzieli z poprzedniego', tydz.get('x') === 45 && tydz.get('y') === 20,
  JSON.stringify([...tydz]));

check('passa liczy się do wczoraj, gdy dziś jeszcze nic', passaNauki(new Set(['2026-09-09', '2026-09-10']), '2026-09-11') === 2);
check('dziura przerywa passę', passaNauki(new Set(['2026-09-08', '2026-09-10', '2026-09-11']), '2026-09-11') === 2);
check('minuty po ludzku', minuty(45) === '45 min' && minuty(60) === '1 h' && minuty(135) === '2 h 15 min');

/* ============================= Cele ============================ */

console.log('\n  Postęp celów\n');

const baza = { dzis: '2026-09-11', waga: null, netto: null, treningi: [], ksiazki: [], nauka: [], nawyki: {} };
const cel = (o) => ({
  metryka: 'treningi', od: '2026-09-01', termin: '2026-11-30', wartosc_cel: 40,
  wartosc_start: null, wartosc_reczna: null, habit_id: null, temat_id: null, ...o,
});

let p = postepCelu(cel({}), { ...baza, treningi: ['2026-08-30', '2026-09-02', '2026-09-05', '2026-09-10'] });
check('treningi sprzed startu celu się nie liczą', p.aktualna === 3, String(p.aktualna));
check('procent to przebyta droga przez całą drogę', Math.abs(p.procent - 3 / 40) < 1e-9, String(p.procent));
check('mało, ale na początku terminu - dalej na czas', p.stan === 'na_czas', p.stan);

p = postepCelu(cel({ od: '2026-06-01' }), { ...baza, treningi: ['2026-06-02', '2026-07-01'] });
check('mało w połowie terminu - w tyle', p.stan === 'w_tyle', p.stan);
check('tempo potrzebne do terminu', Math.abs(p.naTydzien - (38 / 80) * 7) < 1e-9, String(p.naTydzien));

p = postepCelu(cel({ metryka: 'waga', wartosc_start: 85, wartosc_cel: 78 }), { ...baza, waga: 81.5 });
check('redukcja: połowa drogi z 85 do 78 to 50%', Math.abs(p.procent - 0.5) < 1e-9, String(p.procent));
p = postepCelu(cel({ metryka: 'waga', wartosc_start: 70, wartosc_cel: 75 }), { ...baza, waga: 72 });
check('masa: z 70 do 75, dziś 72 - 40%', Math.abs(p.procent - 0.4) < 1e-9, String(p.procent));
p = postepCelu(cel({ metryka: 'waga', wartosc_start: 85, wartosc_cel: 78 }), { ...baza, waga: 86 });
check('przytycie przy redukcji to zero, nie liczba ujemna', p.procent === 0, String(p.procent));
p = postepCelu(cel({ metryka: 'waga', wartosc_start: 85, wartosc_cel: 78 }), baza);
check('bez pomiaru wagi - brak danych, a nie zero', p.stan === 'brak_danych');

p = postepCelu(cel({ metryka: 'majatek', wartosc_start: 10000, wartosc_cel: 20000 }), { ...baza, netto: 15000 });
check('majątek: połowa drogi', Math.abs(p.procent - 0.5) < 1e-9);

p = postepCelu(cel({ metryka: 'wlasna', wartosc_start: 0, wartosc_cel: 10, wartosc_reczna: 10 }), baza);
check('własna liczba na celu - osiągnięty', p.stan === 'osiagniety' && p.naTydzien === null, JSON.stringify(p));

p = postepCelu(cel({ metryka: 'kamienie', wartosc_cel: null }), baza,
  [{ zrobione_at: '2026-09-05' }, { zrobione_at: null }, { zrobione_at: null }]);
check('kroki milowe: jeden z trzech', p.aktualna === 1 && p.cel === 3 && Math.abs(p.procent - 1 / 3) < 1e-9);
check('kroki milowe bez kroków - brak danych', postepCelu(cel({ metryka: 'kamienie', wartosc_cel: null }), baza, []).stan === 'brak_danych');

p = postepCelu(cel({ metryka: 'nawyk', habit_id: 'h1', wartosc_cel: 30 }),
  { ...baza, nawyki: { h1: ['2026-08-31', '2026-09-02', '2026-09-03'], h2: ['2026-09-04'] } });
check('nawyk: tylko dni tego nawyku i tylko od startu', p.aktualna === 2, String(p.aktualna));

const sesjeNauki = [
  { data: '2026-09-02', minuty: 90, temat_id: 'x' },
  { data: '2026-09-03', minuty: 30, temat_id: 'y' },
  { data: '2026-08-20', minuty: 600, temat_id: 'x' },
];
p = postepCelu(cel({ metryka: 'nauka', temat_id: 'x', wartosc_cel: 100 }), { ...baza, nauka: sesjeNauki });
check('nauka jednego przedmiotu liczona w godzinach', p.aktualna === 1.5, String(p.aktualna));
p = postepCelu(cel({ metryka: 'nauka', wartosc_cel: 100 }), { ...baza, nauka: sesjeNauki });
check('nauka bez przedmiotu - cała nauka od startu', p.aktualna === 2, String(p.aktualna));

p = postepCelu(cel({ metryka: 'ksiazki', wartosc_cel: 12 }), { ...baza, ksiazki: ['2026-08-01', '2026-09-05'] });
check('książki przeczytane przed startem się nie liczą', p.aktualna === 1);

p = postepCelu(cel({ od: '2026-06-01', termin: '2026-08-31' }), { ...baza, treningi: ['2026-07-01'] });
check('po terminie czas to 100% i nie ma już tempa do liczenia', p.czas === 1 && p.naTydzien === null, JSON.stringify(p));

check('kwartał od 11 września kończy się 11 grudnia', terminDlaHoryzontu('kwartal', '2026-09-11') === '2026-12-11');
check('rok to 365 dni', terminDlaHoryzontu('rok', '2026-09-11') === '2027-09-11');

/* ============================ Głowa ============================ */

console.log('\n  Głowa\n');

const dni = Array.from({ length: 14 }, (_, i) => ({
  data: dzien('2026-09-11', -i),
  nastroj: i < 7 ? 4 : 2,
  stres: i < 7 ? 2 : 4,
  czynniki: i >= 7 ? ['praca'] : i % 2 ? ['praca'] : [],
}));

const tr = trendTygodnia(dni, '2026-09-11');
check('średnia tygodnia wobec poprzedniego', tr.nastroj === 4 && tr.nastrojPrzed === 2 && tr.stres === 2 && tr.stresPrzed === 4,
  JSON.stringify(tr));

const noce = dni.map((d, i) => ({ date: d.data, sleep_min: i < 7 ? 480 : 360 }));
const ns = nastrojASen(dni, noce);
check('nastrój po dobrze przespanych nocach wobec krótkich', ns?.poDobrych === 4 && ns?.poKrotkich === 2, JSON.stringify(ns));
check('przy dwóch dniach w grupie nie ma żadnego wniosku',
  nastrojASen(dni.slice(0, 9), noce) === null, JSON.stringify(nastrojASen(dni.slice(0, 9), noce)));

const cz = czynnikiZlychDni(dni);
check('praca wyraźnie częstsza w słabe dni', cz[0]?.id === 'praca' && cz[0].wZle === 1, JSON.stringify(cz));
check('czynnik obecny zawsze tak samo nie jest wskazywany',
  czynnikiZlychDni(dni.map((d) => ({ ...d, czynniki: ['ludzie'] }))).length === 0);

check('passa wpisów nastroju', passaWpisow(new Set(dni.map((d) => d.data)), '2026-09-11') === 14);

/* ============================= Baza ============================ */

const db = await bazaZMigracjami();
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};
const xp = async (uid, zrodlo) =>
  (await db.query(`select coalesce(sum(xp), 0)::int n from public.xp_zdarzenia where user_id = '${uid}' and zrodlo = '${zrodlo}'`)).rows[0].n;

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;

console.log('\n  Dane A\n');

let r = await as(A, `insert into public.glowa_dzien (user_id, nastroj, stres, czynniki) values ('${A}', 4, 2, '{praca}') returning id`);
check('A zapisuje nastrój', r.ok, r.err);
r = await as(A, `insert into public.glowa_dzien (user_id, nastroj, stres) values ('${A}', 2, 4)`);
check('drugi wpis tego samego dnia odrzucony (poprawia się, nie dokłada)', !r.ok);
r = await as(A, `insert into public.glowa_wpisy (user_id, tresc) values ('${A}', '   ')`);
check('pusty wpis w dzienniku odrzucony', !r.ok);
r = await as(A, `insert into public.glowa_wpisy (user_id, wdziecznosc) values ('${A}', '{"Dobry trening"}') returning id`);
check('sama wdzięczność wystarczy na wpis', r.ok, r.err);

r = await as(A, `insert into public.nauka_tematy (user_id, nazwa, rodzaj) values ('${A}', 'Angielski', 'jezyk') returning id`);
const temA = r.rows?.[0]?.id;
check('A dodaje przedmiot', r.ok, r.err);
r = await as(A, `insert into public.nauka_powtorki (user_id, temat_id, tresc) values ('${A}', '${temA}', 'present perfect') returning id, nastepna`);
const powA = r.rows?.[0]?.id;
check('nowa powtórka dostaje datę jutrzejszą sama', r.ok && r.rows[0].nastepna !== null, r.err);

r = await as(A, `insert into public.habits (user_id, name) values ('${A}', 'Medytacja') returning id`);
const nawA = r.rows?.[0]?.id;
r = await as(A, `insert into public.cele (user_id, tytul, metryka, termin, wartosc_cel, habit_id)
                 values ('${A}', '60 dni medytacji', 'nawyk', current_date + 60, 60, '${nawA}') returning id`);
const celA = r.rows?.[0]?.id;
check('A ustala cel podpięty pod swój nawyk', r.ok, r.err);
r = await as(A, `insert into public.cele_kamienie (user_id, cel_id, tytul) values ('${A}', '${celA}', 'Pierwszy tydzień') returning id`);
check('A dodaje krok milowy do swojego celu', r.ok, r.err);

console.log('\n  Reguły celów\n');

r = await as(A, `insert into public.cele (user_id, tytul, metryka, termin, od) values ('${A}', 'x', 'treningi', current_date - 1, current_date)`);
check('termin przed startem odrzucony', !r.ok);
r = await as(A, `insert into public.cele (user_id, tytul, metryka, termin, wartosc_cel) values ('${A}', 'x', 'treningi', current_date + 9, 0)`);
check('licznik z celem zero odrzucony', !r.ok);
r = await as(A, `insert into public.cele (user_id, tytul, metryka, termin) values ('${A}', 'x', 'waga', current_date + 9)`);
check('cel liczbowy bez wartości docelowej odrzucony', !r.ok);
r = await as(A, `insert into public.cele (user_id, tytul, metryka, termin) values ('${A}', 'Licencjat', 'kamienie', current_date + 90) returning id`);
check('kroki milowe nie potrzebują liczby', r.ok, r.err);

console.log('\n  Cudze dane\n');

for (const t of ['glowa_dzien', 'glowa_wpisy', 'glowa_sesje', 'nauka_tematy', 'nauka_sesje', 'nauka_powtorki', 'cele', 'cele_kamienie']) {
  r = await as(B, `select count(*)::int n from public.${t}`);
  check(`B nie widzi ${t} należących do A`, r.ok && r.rows[0].n === 0, r.err ?? `widzi: ${r.rows?.[0]?.n}`);
}

r = await as(B, `insert into public.nauka_sesje (user_id, temat_id, minuty) values ('${B}', '${temA}', 60)`);
check('B nie dopisze godzin do przedmiotu A', !r.ok, 'PRZESZŁO');
r = await as(B, `insert into public.nauka_powtorki (user_id, temat_id, tresc) values ('${B}', '${temA}', 'x')`);
check('B nie doda powtórki do przedmiotu A', !r.ok, 'PRZESZŁO');
r = await as(B, `insert into public.cele (user_id, tytul, metryka, termin, wartosc_cel, habit_id)
                 values ('${B}', 'x', 'nawyk', current_date + 9, 5, '${nawA}')`);
check('B nie podepnie swojego celu pod nawyk A', !r.ok, 'PRZESZŁO');
r = await as(B, `insert into public.cele (user_id, tytul, metryka, termin, wartosc_cel, temat_id)
                 values ('${B}', 'x', 'nauka', current_date + 9, 5, '${temA}')`);
check('ani pod przedmiot A', !r.ok, 'PRZESZŁO');
r = await as(B, `insert into public.cele_kamienie (user_id, cel_id, tytul) values ('${B}', '${celA}', 'x')`);
check('B nie dopisze kroku do celu A', !r.ok, 'PRZESZŁO');
r = await as(B, `update public.cele set status = 'porzucony' where id = '${celA}'`);
const statusA = (await db.query(`select status from public.cele where id = '${celA}'`)).rows[0].status;
check('B nie zmieni statusu celu A', statusA === 'aktywny', statusA);
r = await as(B, `delete from public.nauka_tematy where id = '${temA}'`);
const zostal = (await db.query(`select count(*)::int n from public.nauka_tematy where id = '${temA}'`)).rows[0].n;
check('B nie skasuje przedmiotu A', zostal === 1);

console.log('\n  XP, którego nie da się wyklikać\n');

check('wpis nastroju dał 5 XP', (await xp(A, 'glowa')) === 5, String(await xp(A, 'glowa')));
await as(A, `insert into public.glowa_dzien (user_id, data, nastroj, stres) values ('${A}', current_date - 3, 3, 3)`);
check('wpis wstecz nie dokłada punktów ponad dzienny limit', (await xp(A, 'glowa')) === 5, String(await xp(A, 'glowa')));

await as(A, `insert into public.nauka_sesje (user_id, temat_id, minuty) values ('${A}', '${temA}', 5)`);
check('pięć minut nauki to za mało na punkty', (await xp(A, 'nauka')) === 0);
await as(A, `insert into public.nauka_sesje (user_id, temat_id, minuty, data) values ('${A}', '${temA}', 45, current_date - 20)`);
const dzienXp = (await db.query(`select dzien::text from public.xp_zdarzenia where user_id = '${A}' and zrodlo = 'nauka'`)).rows;
check('sesja wpisana wstecz punktuje dziś, nie w przeszłości',
  dzienXp.length === 1 && dzienXp[0].dzien === (await db.query(`select current_date::text d`)).rows[0].d,
  JSON.stringify(dzienXp));
await as(A, `insert into public.nauka_sesje (user_id, temat_id, minuty) values ('${A}', '${temA}', 30)`);
await as(A, `insert into public.nauka_sesje (user_id, temat_id, minuty) values ('${A}', '${temA}', 30)`);
check('nauka: najwyżej dwie punktowane sesje dziennie', (await xp(A, 'nauka')) === 30, String(await xp(A, 'nauka')));

await as(A, `update public.nauka_powtorki set etap = 1, nastepna = current_date + 3 where id = '${powA}'`);
check('pamiętana powtórka daje 2 XP', (await xp(A, 'powtorka')) === 2);
await as(A, `update public.nauka_powtorki set etap = 0, nastepna = current_date + 1 where id = '${powA}'`);
check('cofnięcie na początek nie punktuje', (await xp(A, 'powtorka')) === 2);

await as(A, `insert into public.glowa_sesje (user_id, rodzaj, minuty) values ('${A}', 'oddech', 2)`);
check('dwie minuty oddechu to za mało na punkty', (await xp(A, 'medytacja')) === 0);
await as(A, `insert into public.glowa_sesje (user_id, rodzaj, minuty) values ('${A}', 'medytacja', 10)`);
check('dziesięć minut medytacji daje 10 XP', (await xp(A, 'medytacja')) === 10);

r = await as(A, `update public.cele set status = 'osiagniety' where id = '${celA}'`);
check('odhaczenie celu działa', r.ok, r.err);
const xpCel = (await db.query(`select count(*)::int n from public.xp_zdarzenia where user_id = '${A}' and zrodlo not in ('glowa','nauka','powtorka','medytacja')`)).rows[0].n;
check('sam przycisk "osiągnięty" nie daje punktów (inaczej byłby przyciskiem "daj mi Pro")', xpCel === 0, String(xpCel));

console.log('\n  Kasowanie\n');

await as(A, `delete from public.nauka_tematy where id = '${temA}'`);
const poSesje = (await db.query(`select count(*)::int n from public.nauka_sesje where temat_id = '${temA}'`)).rows[0].n;
const poPowt = (await db.query(`select count(*)::int n from public.nauka_powtorki where temat_id = '${temA}'`)).rows[0].n;
check('przedmiot znika razem z sesjami i powtórkami', poSesje === 0 && poPowt === 0);

r = await as(A, `delete from public.habits where id = '${nawA}'`);
check('nawyk podpięty pod cel da się skasować', r.ok, r.err);
const celPo = (await db.query(`select habit_id from public.cele where id = '${celA}'`)).rows[0];
check('cel zostaje, tylko bez nawyku', celPo && celPo.habit_id === null);

await db.exec(`delete from auth.users where id = '${A}'`);
let zostalo = 0;
for (const t of ['glowa_dzien', 'glowa_wpisy', 'glowa_sesje', 'nauka_tematy', 'cele', 'cele_kamienie']) {
  zostalo += (await db.query(`select count(*)::int n from public.${t} where user_id = '${A}'`)).rows[0].n;
}
check('usunięte konto nie zostawia nic w nowych tabelach', zostalo === 0, `wierszy: ${zostalo}`);

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : ' - WSZYSTKO PRZESZŁO'}\n`);
process.exit(bad ? 1 : 0);
