import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MIG = new URL('../supabase/migrations', import.meta.url).pathname;
const db = await new PGlite();

// --- Stub środowiska Supabase ---
await db.exec(`
  create schema if not exists auth;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role;
    end if;
  end $$;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to authenticated;
`);

const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
let failed = false;
for (const f of files) {
  let sql = readFileSync(path.join(MIG, f), 'utf8');
  // pgcrypto nie jest potrzebne — gen_random_uuid() jest w rdzeniu PG13+
  sql = sql.replace(/^create extension[^;]*;/gim, '');
  try {
    await db.exec(sql);
    console.log(`✅ ${f}`);
  } catch (e) {
    failed = true;
    console.log(`❌ ${f}\n   ${e.message}`);
    if (e.position) {
      const p = Number(e.position);
      console.log('   …' + sql.slice(Math.max(0, p - 220), p + 120).replace(/\n/g, '\n   ') + '⏹');
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
    select d.name, d.day_type, d.tracks_knee_pain, count(we.id)::int as cwiczen
    from public.workout_days d
    left join public.workout_exercises we on we.workout_day_id = d.id
    group by d.id, d.name, d.day_type, d.tracks_knee_pain, d.order_index
    order by d.order_index`);
  console.table(days.rows);
}
process.exit(failed ? 1 : 0);
