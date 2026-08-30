import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pustaBaza } from './supabase-stub.mjs';

const MIG = new URL('../supabase/migrations', import.meta.url).pathname;

// Środowisko Supabase wspólne z testami dostępu - łącznie z rozszerzeniami.
// Dwie osobne konfiguracje znaczyłyby, że walidator sprawdza inną bazę
// niż testy, a rozjazd wyszedłby dopiero na produkcji.
const db = await pustaBaza();

const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
let failed = false;
for (const f of files) {
  let sql = readFileSync(path.join(MIG, f), 'utf8');
  // pgcrypto nie jest potrzebne - gen_random_uuid() jest w rdzeniu PG13+
  sql = sql.replace(/^create extension[^;]*;/gim, '');
  try {
    await db.exec(sql);
    console.log(`✅ ${f}`);
  } catch (e) {
    failed = true;
    console.log(`❌ ${f}\n   ${e.message}`);
    if (e.position) {
      const p = Number(e.position);
      console.log('   ...' + sql.slice(Math.max(0, p - 220), p + 120).replace(/\n/g, '\n   ') + '⏹');
    }
    break;
  }
}

if (!failed) {
  const counts = await db.query(`
    select 'exercise_catalog' t, count(*) n from public.exercise_catalog
    union all select 'plans', count(*) from public.plans
    union all select 'phases', count(*) from public.phases
    union all select 'workout_days', count(*) from public.workout_days
    union all select 'workout_exercises', count(*) from public.workout_exercises
    order by 1`);
  console.table(counts.rows);

  const days = await db.query(`
    select d.name, d.day_type, d.tracks_pain, count(we.id)::int as cwiczen
    from public.workout_days d
    left join public.workout_exercises we on we.workout_day_id = d.id
    group by d.id, d.name, d.day_type, d.tracks_pain, d.order_index
    order by d.order_index`);
  console.table(days.rows);
}
process.exit(failed ? 1 : 0);
