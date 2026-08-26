/**
 * Sprawdza, czy plan w bazie zgadza się co do znaku z plan_treningowy.json.
 *
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
 *   node scripts/verify-plan-import.mjs <plan.json>
 *
 * Porównuje dzień po dniu, po nazwie dnia — nie po kolejności, żeby zmiana
 * układu faz nie dawała fałszywych alarmów.
 */
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const file = process.argv[2];
if (!token || !ref || !file) {
  console.error("Użycie: SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/verify-plan-import.mjs <plan.json>");
  process.exit(1);
}

const { readFileSync } = await import("node:fs");
const src = JSON.parse(readFileSync(file, "utf8"));

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message);
  return body;
}

const rows = await query(`
  select d.name as dzien, e.order_index,
         coalesce(e.name_override, c.name) as cwiczenie,
         e.target_sets, e.target_reps, e.target_note,
         e.technique_notes, c.icon_key
    from public.plans p
    join public.phases f on f.plan_id = p.id
    join public.workout_days d on d.phase_id = f.id
    join public.workout_exercises e on e.workout_day_id = d.id
    left join public.exercise_catalog c on c.id = e.catalog_exercise_id
   where p.user_id is not null
   order by d.name, e.order_index
`);

// Oczekiwana treść, pogrupowana po nazwie dnia
const expected = new Map();
for (const phase of src.phases) {
  for (const day of phase.workout_days) expected.set(day.name, day.exercises);
}
const rehab = [];
let order = 0;
for (const grp of ["czworogłowy", "dwugłowy", "pośladki"]) {
  for (const e of src.rehab_stretches[grp] ?? []) rehab.push({ ...e, order: ++order });
}
expected.set("Rozciąganie rehabilitacyjne (zalecenia fizjo)", rehab);

const actual = new Map();
for (const r of rows) {
  const list = actual.get(r.dzien) ?? [];
  list.push(r);
  actual.set(r.dzien, list);
}

let problems = 0;
const fail = (msg) => { problems++; console.log(`  ❌ ${msg}`); };

for (const [dayName, exercises] of expected) {
  const got = actual.get(dayName);
  if (!got) { fail(`brak dnia „${dayName}" w bazie`); continue; }
  if (got.length !== exercises.length) {
    fail(`„${dayName}": ${got.length} pozycji w bazie, ${exercises.length} w pliku`);
    continue;
  }
  for (let i = 0; i < exercises.length; i++) {
    const want = exercises[i];
    const has = got[i];
    const rebuilt = has.target_sets ? `${has.target_sets}x${has.target_reps}` : has.target_note;

    if (has.cwiczenie !== want.name) fail(`„${dayName}" #${i + 1} nazwa: baza=${has.cwiczenie} plik=${want.name}`);
    if ((rebuilt || null) !== (want.target_sets_reps || null))
      fail(`„${dayName}" #${i + 1} serie: baza=${rebuilt} plik=${want.target_sets_reps}`);
    if ((has.technique_notes || null) !== (want.technique || null))
      fail(`„${dayName}" #${i + 1} technika różni się`);
    if (has.icon_key !== want.icon_key)
      fail(`„${dayName}" #${i + 1} ikona: baza=${has.icon_key} plik=${want.icon_key}`);
  }
  console.log(`  ✅ ${dayName} — ${exercises.length} pozycji zgodnych`);
}

const extra = [...actual.keys()].filter((d) => !expected.has(d));
for (const d of extra) fail(`w bazie jest dzień spoza pliku: „${d}"`);

const dupes = await query(`
  select name, count(*) as ile from public.exercise_catalog
   where user_id is null group by name having count(*) > 1
`);
for (const d of dupes) fail(`duplikat w katalogu: „${d.name}" ×${d.ile}`);

console.log(problems === 0 ? "\n  PLAN ZGODNY Z PLIKIEM" : `\n  PROBLEMÓW: ${problems}`);
process.exit(problems ? 1 : 0);
