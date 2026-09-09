/*
 * Moduł finansowy - liczby i reguły dostępu.
 *
 * Dwie części, bo są tu dwa różne rodzaje błędów: źle policzona poduszka
 * (człowiek myśli, że ma zapas, a nie ma) i cudze pieniądze widoczne
 * z innego konta. Pierwsze sprawdzamy na czystych funkcjach, drugie
 * na żywej bazie z dwiema osobami.
 *
 * Uruchom: npm run test:finanse
 */
import { bazaZMigracjami } from './supabase-stub.mjs';
import {
  RODZAJE_MAJATKU,
  dziennieDoKonca,
  koszykRodzaju,
  miesiaceProzycia,
  poduszkaProcent,
  stanPoduszki,
  sumyKoszykow,
  zl,
  zmiana,
} from '../src/lib/finanse.ts';

let ok = 0, bad = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? ' - ' + d : ''}`); }
};

console.log('\n  Poduszka finansowa\n');

check('płynne dzielone przez koszty', miesiaceProzycia(12000, 4000) === 3);
check('zaokrągla do jednego miejsca', miesiaceProzycia(10000, 4000) === 2.5);
check(
  'bez podanych kosztów nie zgadujemy - null, nie zero',
  miesiaceProzycia(10000, null) === null && miesiaceProzycia(10000, 0) === null,
);
check('brak migawki majątku też daje null', miesiaceProzycia(null, 4000) === null);
check('procent celu przycięty do 100', poduszkaProcent(9, 6) === 100 && poduszkaProcent(3, 6) === 50);

check('poniżej miesiąca to alarm', stanPoduszki(0.5).tone === 'danger');
check('trzy miesiące to już bezpiecznie', stanPoduszki(3).tone === 'accent');
check('sześć miesięcy to spokój', stanPoduszki(6).tone === 'success');
check('bez danych nie straszymy kolorem', stanPoduszki(null).tone === 'accent');

console.log('\n  Budżet dzienny\n');

// 10 dnia stycznia zostają 22 dni (10..31 włącznie).
const styczen10 = new Date(2026, 0, 10);
check(
  'dzieli resztę budżetu przez dni DO KOŃCA, nie przez cały miesiąc',
  dziennieDoKonca(220, styczen10) === 10,
  String(dziennieDoKonca(220, styczen10)),
);
check(
  'ostatniego dnia miesiąca zostaje cała kwota na jeden dzień',
  dziennieDoKonca(50, new Date(2026, 0, 31)) === 50,
);
check('przekroczony budżet nie schodzi poniżej zera', dziennieDoKonca(-100, styczen10) === 0);
check('brak budżetu to brak liczby', dziennieDoKonca(null) === null);

console.log('\n  Formatowanie kwot\n');

/*
 * Polski locale wstawia SPACJĘ NIEROZDZIELAJĄCĄ (U+00A0) jako separator
 * tysięcy, a nie zwykłą spację - porównanie z ' ' zawsze by tu padało.
 * Do tego grupuje dopiero od pięciu cyfr, więc "1250,50" jest poprawne,
 * a "1 250,50" nie. Normalizujemy zamiast wpisywać niewidoczny znak
 * w kod testu.
 */
const zwykleSpacje = (t) => t.replace(/\u00a0/g, ' ');

check('okrągła kwota bez groszy', zwykleSpacje(zl(12400)) === '12 400 zł', zl(12400));
check('niepełna kwota z groszami', zwykleSpacje(zl(1250.5)) === '1250,50 zł', zl(1250.5));
check('zmiana dodatnia ze znakiem', zwykleSpacje(zmiana(12400)) === '+12 400 zł', zmiana(12400));
check('zmiana ujemna ze znakiem', zmiana(-340) === '-340 zł', zmiana(-340));
check('zero bez znaku', zmiana(0) === '0 zł', zmiana(0));

console.log('\n  Pieniądze na żywej bazie\n');

const db = await bazaZMigracjami();
const as = async (uid, sql) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};

const A = (await db.query(`insert into auth.users (email) values ('a@x.pl') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.pl') returning id`)).rows[0].id;

let r = await as(A, `insert into public.finanse_stan (user_id, plynne, inwestycje, dlugi)
                     values ('${A}', 20000, 15000, 5000) returning netto`);
check('A zapisuje migawkę majątku', r.ok && Number(r.rows[0].netto) === 30000, r.err);

r = await as(A, `insert into public.finanse_cele (user_id, nazwa, kwota_cel)
                 values ('${A}', 'Mieszkanie', 50000) returning id`);
const celA = r.ok ? r.rows[0].id : null;
check('A zakłada cel oszczędnościowy', r.ok, r.err);

await as(A, `insert into public.finanse_wplaty (user_id, cel_id, kwota) values ('${A}', '${celA}', 5000)`);
await as(A, `insert into public.finanse_wydatki (user_id, kwota, kategoria) values ('${A}', 89.99, 'rozrywka')`);

// Sedno: pieniądze to dane wrażliwsze niż waga. Nikt inny nie może ich zobaczyć.
r = await as(B, `select * from public.finanse_stan`);
check('B nie widzi majątku A', r.ok && r.rows.length === 0, r.ok ? `WIDZI ${r.rows.length}` : r.err);

r = await as(B, `select * from public.finanse_wydatki`);
check('B nie widzi wydatków A', r.ok && r.rows.length === 0, r.ok ? `WIDZI ${r.rows.length}` : r.err);

r = await as(B, `select * from public.v_finanse_cele`);
check('B nie widzi celów A przez widok', r.ok && r.rows.length === 0, r.ok ? `WIDZI ${r.rows.length}` : r.err);

r = await as(B, `select * from public.finanse_wplaty where cel_id = '${celA}'`);
check('B nie podejrzy wpłat A po id celu', r.ok && r.rows.length === 0);

r = await as(B, `insert into public.finanse_wplaty (user_id, cel_id, kwota)
                 values ('${B}', '${celA}', 999)`);
const obce = (await db.query(`select count(*)::int as n from public.finanse_wplaty where cel_id = '${celA}'`)).rows[0].n;
check('B nie dopisze wpłaty do cudzego celu', obce === 1, `wpłat: ${obce}`);

r = await as(A, `select * from public.v_finanse_cele where id = '${celA}'`);
check('A widzi swój cel z policzonym postępem',
  r.ok && r.rows[0]?.procent === 10, JSON.stringify(r.rows?.[0]?.procent));

r = await as(A, `select public.finanse_podsumowanie() as p`);
check('podsumowanie liczy majątek A', r.ok && Number(r.rows[0].p.netto) === 30000, r.err);

console.log('\n  Pozycje majątku\n');

/*
 * Najważniejsze sprawdzenie w tym pliku: koszyk musi znaczyć w kliencie
 * dokładnie to, co w bazie. Gdyby TS uznał obligacje za płynne, a baza za
 * inwestycje, poduszka na ekranie pokazywałaby zapas, którego nie ma -
 * i nikt by tego nie zauważył, bo obie liczby wyglądałyby wiarygodnie.
 */
let rozjazd = null;
for (const r of RODZAJE_MAJATKU) {
  const wBazie = (await db.query(
    `select public.finanse_kategoria_rodzaju('${r.rodzaj}') as k`,
  )).rows[0].k;
  if (wBazie !== r.koszyk) rozjazd = `${r.rodzaj}: TS=${r.koszyk} baza=${wBazie}`;
}
check('każdy rodzaj wpada w bazie do tego samego koszyka co w TS', rozjazd === null, rozjazd);

check(
  'nieznany rodzaj nie dostaje koszyka po cichu',
  koszykRodzaju('skarbonka') === null,
);

check(
  'poduszka nie widzi obligacji ani IKE',
  koszykRodzaju('obligacje') === 'inwestycje' && koszykRodzaju('ike') === 'inwestycje',
);

const podglad = sumyKoszykow([
  { kategoria: 'plynne', kwota: 9000 },
  { kategoria: 'inwestycje', kwota: 15000 },
  { kategoria: 'inne', kwota: 30000 },
  { kategoria: 'dlugi', kwota: 20000 },
  { kategoria: 'plynne', kwota: 5000, archiwalna: true },
]);
check('podgląd sum odejmuje długi', podglad.netto === 34000, String(podglad.netto));
check('schowana pozycja nie wchodzi do podglądu', podglad.plynne === 9000);

r = await as(A, `insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
                 values ('${A}', 'Konto ING', 'konto', 9000), ('${A}', 'IKE', 'ike', 15000)`);
check('A opisuje majątek pozycjami', r.ok, r.err);

r = await as(A, `select public.finanse_zapisz_migawke() as m`);
check(
  'migawka z pozycji liczy płynne i inwestycje osobno',
  r.ok && Number(r.rows[0].m.plynne) === 9000 && Number(r.rows[0].m.inwestycje) === 15000,
  r.err,
);

r = await as(B, `select * from public.finanse_pozycje`);
check('B nie widzi pozycji majątku A', r.ok && r.rows.length === 0,
  r.ok ? `WIDZI ${r.rows.length}` : r.err);

r = await as(B, `insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
                 values ('${A}', 'Podrzucone', 'konto', 1)`);
check('B nie dopisze pozycji do majątku A', !r.ok, 'wiersz przeszedł');

console.log(`\n  Wynik: ${ok} ✅ / ${bad} ❌\n`);
if (bad > 0) process.exit(1);
