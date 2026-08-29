import { bazaZMigracjami } from './supabase-stub.mjs';

// Ta sama baza, co walidator migracji i testy dostępu.
//
// Wcześniej ten plik budował WŁASNY, uproszczony stub: bez schematu storage,
// bez roli service_role i bez domyślnych uprawnień Supabase. Skutek był taki,
// że test sprawdzał inną bazę niż ta, na której stoi aplikacja — a migracja
// dotykająca magazynu plików wywalała się dopiero tutaj, po wdrożeniu.
// Trzy kopie stubu znaczyły trzy okazje do rozjazdu; została jedna.
const db = await bazaZMigracjami();

// --- dwaj użytkownicy ---
const A = (await db.query(
  `insert into auth.users (email) values ('zdzis.paschalski@gmail.com') returning id`)).rows[0].id;
const B = (await db.query(
  `insert into auth.users (email) values ('kolega@example.com') returning id`)).rows[0].id;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ test: name, wynik: pass ? '✅' : '❌ BŁĄD', detail });
  if (!pass) process.exitCode = 1;
};

// pomocnik: uruchom jako zwykły zalogowany user
async function asUser(uid, fn) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${uid}';`);
  try { return await fn(); }
  finally { await db.exec(`reset role; reset request.jwt.claim.sub;`); }
}
async function expectFail(uid, sql) {
  try { await asUser(uid, () => db.exec(sql)); return false; }
  catch { return true; }
}

// 1. trigger nadał rolę admina po e-mailu
const roleA = (await db.query(`select role from public.profiles where id=$1`, [A])).rows[0]?.role;
const roleB = (await db.query(`select role from public.profiles where id=$1`, [B])).rows[0]?.role;
check('profil tworzony automatycznie + rola admina po e-mailu', roleA === 'admin' && roleB === 'user',
      `A=${roleA} B=${roleB}`);

// 2. A klonuje publiczny szablon
//
// Liczymy dni i ćwiczenia W ŹRÓDLE, zamiast wpisywać je na sztywno.
// Wcześniej stało tu „7 dni / 41 ćwiczeń" — prawda w dniu pisania testu,
// nieprawda po dołożeniu kolejnych szablonów. Test pilnuje tego, o co chodzi:
// że klon jest KOMPLETNY, a nie że szablon ma akurat tyle a tyle dni.
let szablon;
const planA = await asUser(A, async () => {
  const tpl = (await db.query(`select id from public.plans where is_template and is_public limit 1`)).rows[0].id;
  szablon = tpl;
  return (await db.query(`select public.clone_plan($1, 'Mój plan', true) as id`, [tpl])).rows[0].id;
});
const policz = async (planId) => ({
  dni: (await db.query(
    `select count(*)::int n from public.workout_days d
       join public.phases p on p.id=d.phase_id where p.plan_id=$1`, [planId])).rows[0].n,
  cwiczen: (await db.query(
    `select count(*)::int n from public.workout_exercises we
       join public.workout_days d on d.id=we.workout_day_id
       join public.phases p on p.id=d.phase_id where p.plan_id=$1`, [planId])).rows[0].n,
});
const zrodlo = await policz(szablon);
const klon = await policz(planA);
check('clone_plan kopiuje szablon co do dnia i ćwiczenia',
      klon.dni === zrodlo.dni && klon.cwiczen === zrodlo.cwiczen && klon.dni > 0,
      `klon: ${klon.dni} dni / ${klon.cwiczen} ćwiczeń, źródło: ${zrodlo.dni} / ${zrodlo.cwiczen}`);

// 3. B nie widzi planu A, ale widzi szablon publiczny
const bSeesPlans = await asUser(B, async () =>
  (await db.query(`select id, name from public.plans order by name`)).rows);
check('B nie widzi prywatnego planu A', !bSeesPlans.some(p => p.id === planA),
      `B widzi: ${bSeesPlans.map(p => p.name).join(', ')}`);
check('B widzi publiczne szablony', bSeesPlans.length >= 1, `widzi ${bSeesPlans.length}`);

// Każdy plan widziany przez B musi być publiczny albo jego własny. To jest
// pytanie, o które naprawdę chodzi — wcześniej test pytał „czy widzi dokładnie
// jeden", co przestało być prawdą, gdy przybyło szablonów, i przez to
// przestało cokolwiek chronić.
const bCudze = await asUser(B, async () =>
  (await db.query(
    `select count(*)::int n from public.plans where not is_public and user_id is distinct from $1`,
    [B])).rows[0].n);
check('B nie widzi ŻADNEGO nieopublikowanego cudzego planu', bCudze === 0, `widzi ${bCudze}`);

// 4. B nie widzi ćwiczeń z planu A (dziedziczenie RLS przez fazy/dni)
const bCudzeDni = await asUser(B, async () =>
  (await db.query(
    `select count(*)::int n from public.workout_days d
       join public.phases f on f.id = d.phase_id
       join public.plans p on p.id = f.plan_id
      where not p.is_public and p.user_id is distinct from $1`, [B])).rows[0].n);
check('B nie widzi dni treningowych z cudzego prywatnego planu', bCudzeDni === 0,
      `widzi ${bCudzeDni}`);

// 5. logi treningowe są prywatne
await asUser(A, () => db.exec(`
  insert into public.workout_sessions (user_id, date, day_label) values ('${A}', current_date, 'Dzień A');
  insert into public.workout_logs (user_id, exercise_name, date, set_number, weight_kg, reps)
    values ('${A}', 'Wyciskanie sztangi', current_date, 1, 80, 8);
  insert into public.injuries (user_id, name, body_part, side) values ('${A}', 'Lewe kolano', 'knee', 'left');
  insert into public.pain_logs (user_id, injury_id, date, level)
    select '${A}', id, current_date, 3 from public.injuries where user_id = '${A}';
  insert into public.body_weight_logs (user_id, date, weight_kg) values ('${A}', current_date, 84.5);
`));
const bSeesLogs = await asUser(B, async () => (await db.query(
  `select (select count(*) from public.workout_logs)::int l,
          (select count(*) from public.pain_logs)::int k,
          (select count(*) from public.injuries)::int i,
          (select count(*) from public.body_weight_logs)::int w`)).rows[0]);
check('B nie widzi logów / kontuzji / bólu / wagi użytkownika A',
      bSeesLogs.l === 0 && bSeesLogs.k === 0 && bSeesLogs.i === 0 && bSeesLogs.w === 0,
      JSON.stringify(bSeesLogs));

// 5b. ocena bólu nie może wskazywać na cudzą kontuzję
const injuryOfA = await asUser(A, async () =>
  (await db.query(`select id from public.injuries where user_id = '${A}' limit 1`)).rows[0].id);
check('B nie podepnie oceny bólu pod kontuzję użytkownika A',
      await expectFail(B, `insert into public.pain_logs (user_id, injury_id, date, level)
                           values ('${B}', '${injuryOfA}', current_date, 5)`));

// 6. B nie może podszyć się pod A przy zapisie
check('B nie może zapisać loga z cudzym user_id',
      await expectFail(B, `insert into public.workout_logs (user_id, exercise_name, date, set_number)
                           values ('${A}', 'hack', current_date, 1)`));

// 7. eskalacja uprawnień
check('B nie może awansować się na admina',
      await expectFail(B, `update public.profiles set role='admin' where id='${B}'`));

// 8. katalog globalny
const bCatalog = await asUser(B, async () =>
  (await db.query(`select count(*)::int n from public.exercise_catalog`)).rows[0].n);
check('B widzi globalny katalog ćwiczeń', bCatalog > 0, `${bCatalog} ćwiczeń`);
// RLS przy UPDATE nie rzuca wyjątku — po prostu nie widzi wierszy.
// Sprawdzamy realny skutek: ile wierszy poszło i czy nazwa faktycznie została nietknięta.
const bUpdated = await asUser(B, async () =>
  (await db.query(`update public.exercise_catalog set name='zepsute' where user_id is null returning id`)).rows.length);
const stillIntact = (await db.query(
  `select count(*)::int n from public.exercise_catalog where name='zepsute'`)).rows[0].n;
check('zwykły user nie edytuje globalnego katalogu', bUpdated === 0 && stillIntact === 0,
      `zmienionych wierszy=${bUpdated}`);
check('zwykły user nie usunie ćwiczenia z globalnego katalogu',
      (await asUser(B, async () =>
        (await db.query(`delete from public.exercise_catalog where user_id is null returning id`)).rows.length)) === 0);
const adminCanEdit = !(await expectFail(A,
  `update public.exercise_catalog set cues = cues where user_id is null`));
check('admin MOŻE edytować globalny katalog', adminCanEdit);

// 9. dieta: kolumny wyliczane + izolacja
await asUser(A, () => db.exec(`
  insert into public.foods (user_id, source, name, kcal_100g, protein_100g, carbs_100g, fat_100g)
    values ('${A}', 'custom', 'Twaróg chudy', 71, 18, 3.5, 0.5);
  insert into public.meals (user_id, date, meal_type) values ('${A}', current_date, 'breakfast');
  insert into public.meal_entries (user_id, meal_id, food_name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g)
    select '${A}', m.id, 'Twaróg chudy', 250, 71, 18, 3.5, 0.5
    from public.meals m where m.user_id='${A}';
`));
const nutri = await asUser(A, async () =>
  (await db.query(`select kcal, protein_g from public.v_daily_nutrition where date=current_date`)).rows[0]);
check('kalorie liczone automatycznie (250g twarogu = 178 kcal / 45 g białka)',
      nutri && Number(nutri.kcal) === 178 && Number(nutri.protein_g) === 45, JSON.stringify(nutri));

const bNutri = await asUser(B, async () =>
  (await db.query(`select count(*)::int n from public.v_daily_nutrition`)).rows[0].n);
check('widok v_daily_nutrition respektuje RLS (B nie widzi diety A)', bNutri === 0);

// 10. podsumowanie okresu
const summary = await asUser(A, async () => (await db.query(
  `select public.period_summary(current_date - 7, current_date) as s`)).rows[0].s);
check('period_summary zwraca sensowne dane',
      summary.workouts === 1 && summary.volume_kg === 640 && summary.avg_kcal === 178,
      JSON.stringify(summary));

console.table(results);
