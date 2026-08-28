/*
 * Kawałek Supabase odwzorowany w PGlite.
 *
 * Migracje piszemy pod bazę, która ma schematy `auth` i `storage`, role
 * `authenticated`/`anon` oraz `auth.uid()`. PGlite tego nie ma, więc przed
 * sprawdzeniem czegokolwiek trzeba to podstawić. Jeden plik dla walidatora
 * i dla testów dostępu — dwie kopie tego stubu rozjechałyby się przy pierwszej
 * zmianie i test sprawdzałby inną bazę niż walidator.
 */
export const SUPABASE_STUB = `
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

  -- Supabase nadaje domyślne uprawnienia na KAŻDĄ nową tabelę w public.
  -- Bez tego migracja, która o tym zapomni, przechodzi lokalnie i wywala się
  -- dopiero na produkcji — dokładnie tak było z rejestrem kosztów w 0043.
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;

  -- Magazyn plików. Odwzorowane tyle, ile dotyka migracja 0039: kubełki,
  -- obiekty i foldername() — czyli funkcja, na której stoją polityki dostępu
  -- do zdjęć. Bez tego moduł „Wygląd" nie dałby się sprawdzić przed wdrożeniem.
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    created_at timestamptz default now()
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[]
  language plpgsql immutable as $fn$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[1 : array_length(_parts, 1) - 1];
  end
  $fn$;
  grant usage on schema storage to authenticated;
`;

/** Świeża baza z nałożonymi wszystkimi migracjami. */
export async function bazaZMigracjami() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFileSync, readdirSync } = await import('node:fs');
  const path = (await import('node:path')).default;

  const MIG = new URL('../supabase/migrations', import.meta.url).pathname;
  const db = await new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(MIG, f), 'utf8').replace(/^create extension[^;]*;/gim, ''));
  }
  return db;
}
