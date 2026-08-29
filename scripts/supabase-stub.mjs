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
  -- Uprawnienie do WYWOLANIA funkcji Supabase nadaje roli anon JAWNIE,
  -- a nie przez PUBLIC (sprawdzone w pg_default_acl: anon=X/postgres).
  -- Bez tej linii revoke ... from public wygladal lokalnie na skuteczny,
  -- a na produkcji zostawialby funkcje otwarte dla niezalogowanych.
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

  -- Magazyn plików. Odwzorowane tyle, ile dotyka migracja 0039: kubełki,
  -- obiekty i foldername() — czyli funkcja, na której stoją polityki dostępu
  -- do zdjęć. Bez tego moduł „Wygląd" nie dałby się sprawdzić przed wdrożeniem.
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    -- Prawdziwy Supabase trzyma tu granice wgrywanych plikow. Bez tych dwoch
    -- kolumn migracja, ktora je ustawia, przechodzi lokalnie i wywala sie
    -- dopiero na produkcji -- dokladnie ten rozjazd co przy uprawnieniach.
    file_size_limit bigint,
    allowed_mime_types text[],
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

  -- U Supabase rozszerzenia siedzą w osobnym schemacie, nie w public.
  -- Migracje muszą móc się do nich odwołać tą samą nazwą co na produkcji.
  create schema if not exists extensions;
  grant usage on schema extensions to authenticated, anon;
`;

/*
 * Pusta baza z odwzorowanym Supabase.
 *
 * Rozszerzenia ładujemy tutaj, a nie zostawiamy migracjom, bo `create extension`
 * jest z nich wycinane (pgcrypto i pg_cron nie mają odpowiednika w PGlite).
 * Gdyby wyciąć również pg_trgm, wyszukiwarka produktów przechodziłaby lokalnie
 * na innym silniku niż na produkcji — czyli test sprawdzałby co innego.
 */
export async function pustaBaza() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');

  const db = await new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  await db.exec('create extension if not exists pg_trgm with schema extensions;');
  return db;
}

/** Świeża baza z nałożonymi wszystkimi migracjami. */
export async function bazaZMigracjami() {
  const { readFileSync, readdirSync } = await import('node:fs');
  const path = (await import('node:path')).default;

  const MIG = new URL('../supabase/migrations', import.meta.url).pathname;
  const db = await pustaBaza();
  for (const f of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(MIG, f), 'utf8').replace(/^create extension[^;]*;/gim, ''));
  }
  return db;
}
