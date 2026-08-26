-- ============================================================
-- Grind — schemat bazy (Supabase / Postgres)
-- Migracja 0001: rozszerzenia, funkcje pomocnicze, tabele
-- ============================================================

create extension if not exists "pgcrypto";


-- ------------------------------------------------------------
-- Funkcje pomocnicze
-- ------------------------------------------------------------

-- Automatyczne updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- profiles — rozszerzenie auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  display_name    text,
  role            text not null default 'user' check (role in ('user', 'admin')),

  -- cele dietetyczne (Moduł 2)
  daily_kcal      integer check (daily_kcal between 0 and 10000),
  daily_protein_g integer check (daily_protein_g between 0 and 1000),
  daily_carbs_g   integer check (daily_carbs_g between 0 and 2000),
  daily_fat_g     integer check (daily_fat_g between 0 and 1000),

  -- dane sylwetkowe
  height_cm       integer check (height_cm between 50 and 260),
  birth_year      integer check (birth_year between 1900 and 2100),
  sex             text check (sex in ('m', 'f', 'other')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Czy zalogowany user jest adminem (SECURITY DEFINER, żeby nie zapętlić RLS na profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Nowy użytkownik -> profil. Konto admina rozpoznawane po e-mailu.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when lower(new.email) in ('zdzis.paschalski@gmail.com') then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- MODUŁ 1 — TRENING
-- ============================================================

-- ------------------------------------------------------------
-- exercise_catalog — globalna biblioteka ćwiczeń
--   user_id IS NULL  -> ćwiczenie globalne (widoczne dla wszystkich)
--   user_id = uid    -> prywatne ćwiczenie użytkownika
-- ------------------------------------------------------------
create table if not exists public.exercise_catalog (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete cascade,

  slug              text,
  name              text not null,
  name_en           text,
  aliases           text[] not null default '{}',

  description       text,            -- opis techniki wykonania
  cues              text[] not null default '{}',   -- wskazówki "na co uważać"
  mistakes          text[] not null default '{}',   -- typowe błędy

  category          text,            -- np. 'Klatka piersiowa', 'Nogi', 'Mobilność'
  muscle_group      text,            -- główna partia (do filtrowania i wykresów)
  muscles           text[] not null default '{}',
  muscles_secondary text[] not null default '{}',
  equipment         text[] not null default '{}',

  -- ilustracje
  image_url         text,
  image_thumb_url   text,
  muscle_image_urls text[] not null default '{}',  -- nakładki SVG partii mięśniowych

  -- metryka / typ zapisu wyniku
  metric            text not null default 'weight_reps'
                    check (metric in ('weight_reps', 'reps', 'time', 'distance', 'rounds')),

  -- pochodzenie i licencja (wger = CC-BY-SA, wymaga atrybucji)
  source            text not null default 'curated'
                    check (source in ('curated', 'wger', 'user')),
  source_id         text,
  license           text,
  license_author    text,
  license_url       text,

  is_public         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint exercise_catalog_public_is_global
    check (not (is_public and user_id is not null))
);

create unique index if not exists exercise_catalog_slug_global_uidx
  on public.exercise_catalog (slug) where user_id is null;
create unique index if not exists exercise_catalog_source_uidx
  on public.exercise_catalog (source, source_id) where source_id is not null;
create index if not exists exercise_catalog_user_idx on public.exercise_catalog (user_id);
create index if not exists exercise_catalog_muscle_idx on public.exercise_catalog (muscle_group);
create index if not exists exercise_catalog_name_trgm_idx on public.exercise_catalog (lower(name));

drop trigger if exists exercise_catalog_set_updated_at on public.exercise_catalog;
create trigger exercise_catalog_set_updated_at
  before update on public.exercise_catalog
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- plans -> phases -> workout_days -> workout_exercises
--   user_id IS NULL + is_template -> szablon publiczny do skopiowania
-- ------------------------------------------------------------
create table if not exists public.plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  name         text not null,
  description  text,
  goal         text,                       -- np. 'Powrót po kontuzji kolana + MMA'
  is_template  boolean not null default false,
  is_public    boolean not null default false,
  is_active    boolean not null default false,
  source       text not null default 'manual' check (source in ('manual', 'template', 'ai')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint plans_public_is_template
    check (not (is_public and not is_template))
);

create index if not exists plans_user_idx on public.plans (user_id);
create unique index if not exists plans_one_active_per_user_uidx
  on public.plans (user_id) where is_active and user_id is not null;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table if not exists public.phases (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.plans (id) on delete cascade,
  name          text not null,
  description   text,
  frequency     text,                      -- np. '3x/tydzień'
  order_index   integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists phases_plan_idx on public.phases (plan_id, order_index);

create table if not exists public.workout_days (
  id               uuid primary key default gen_random_uuid(),
  phase_id         uuid not null references public.phases (id) on delete cascade,
  name             text not null,          -- 'Dzień A (górna partia)'
  short_label      text,                   -- 'A'
  description      text,
  day_type         text not null default 'gym'
                   check (day_type in ('gym', 'conditioning', 'mobility', 'mma', 'other')),
  tracks_knee_pain boolean not null default false,
  order_index      integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists workout_days_phase_idx on public.workout_days (phase_id, order_index);

create table if not exists public.workout_exercises (
  id                  uuid primary key default gen_random_uuid(),
  workout_day_id      uuid not null references public.workout_days (id) on delete cascade,
  catalog_exercise_id uuid references public.exercise_catalog (id) on delete set null,

  name_override       text,      -- gdy chcemy własną nazwę mimo pozycji z katalogu
  muscle_group        text,      -- snapshot, żeby dzień dało się czytać bez joinów
  target_sets         integer check (target_sets between 1 and 20),
  target_reps         text,      -- '6-8', '30s', '10/stronę' — celowo tekst
  target_note         text,      -- 'opcjonalnie', '2 rundy'
  technique_notes     text,      -- moje własne uwagi do tego ćwiczenia w tym dniu
  rest_seconds        integer check (rest_seconds between 0 and 900),
  order_index         integer not null default 0,
  created_at          timestamptz not null default now(),

  constraint workout_exercises_has_name
    check (catalog_exercise_id is not null or name_override is not null)
);
create index if not exists workout_exercises_day_idx
  on public.workout_exercises (workout_day_id, order_index);

-- ------------------------------------------------------------
-- Logowanie treningów
-- ------------------------------------------------------------
create table if not exists public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  workout_day_id  uuid references public.workout_days (id) on delete set null,
  day_label       text,                    -- snapshot nazwy dnia
  date            date not null default current_date,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_min    integer check (duration_min between 0 and 1440),
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, date desc);

create table if not exists public.workout_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  session_id          uuid references public.workout_sessions (id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises (id) on delete set null,
  catalog_exercise_id uuid references public.exercise_catalog (id) on delete set null,
  exercise_name       text not null,       -- snapshot: log przeżyje usunięcie ćwiczenia z planu

  date                date not null default current_date,
  set_number          integer not null check (set_number between 1 and 50),
  weight_kg           numeric(6, 2) check (weight_kg >= 0 and weight_kg <= 1000),
  reps                integer check (reps between 0 and 1000),
  duration_seconds    integer check (duration_seconds between 0 and 86400),
  distance_m          numeric(8, 2) check (distance_m >= 0),
  rpe                 numeric(3, 1) check (rpe between 1 and 10),
  is_warmup           boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, date desc);
create index if not exists workout_logs_exercise_idx
  on public.workout_logs (user_id, catalog_exercise_id, date desc);
create index if not exists workout_logs_session_idx on public.workout_logs (session_id);

-- ------------------------------------------------------------
-- Tracker bólu kolana
-- ------------------------------------------------------------
create table if not exists public.knee_pain_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete set null,
  date       date not null default current_date,
  level      smallint not null check (level between 0 and 10),
  side       text not null default 'both' check (side in ('left', 'right', 'both')),
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, date, side)
);
create index if not exists knee_pain_logs_user_date_idx on public.knee_pain_logs (user_id, date desc);

-- ------------------------------------------------------------
-- Waga ciała
-- ------------------------------------------------------------
create table if not exists public.body_weight_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null default current_date,
  weight_kg    numeric(5, 2) not null check (weight_kg between 20 and 500),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 1 and 70),
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists body_weight_logs_user_date_idx on public.body_weight_logs (user_id, date desc);

-- ============================================================
-- MODUŁ 2 — DIETA
-- ============================================================

-- foods: cache produktów z Open Food Facts (user_id NULL = współdzielony cache)
-- oraz produkty własne użytkownika (user_id = uid, source = 'custom')
create table if not exists public.foods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  source         text not null default 'custom' check (source in ('off', 'custom')),
  off_id         text,                     -- kod kreskowy / _id z Open Food Facts

  name           text not null,
  brand          text,
  image_url      text,

  kcal_100g      numeric(7, 2) not null check (kcal_100g >= 0),
  protein_100g   numeric(6, 2) not null default 0 check (protein_100g >= 0),
  carbs_100g     numeric(6, 2) not null default 0 check (carbs_100g >= 0),
  fat_100g       numeric(6, 2) not null default 0 check (fat_100g >= 0),
  fiber_100g     numeric(6, 2) check (fiber_100g >= 0),
  sugar_100g     numeric(6, 2) check (sugar_100g >= 0),
  salt_100g      numeric(6, 2) check (salt_100g >= 0),

  serving_size_g numeric(7, 2) check (serving_size_g > 0),
  serving_label  text,                     -- 'plaster', 'łyżka', 'sztuka'

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists foods_off_uidx on public.foods (off_id) where source = 'off';
create index if not exists foods_user_idx on public.foods (user_id);
create index if not exists foods_name_idx on public.foods (lower(name));

drop trigger if exists foods_set_updated_at on public.foods;
create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null default current_date,
  meal_type  text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, date, meal_type)
);
create index if not exists meals_user_date_idx on public.meals (user_id, date desc);

create table if not exists public.meal_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  meal_id      uuid not null references public.meals (id) on delete cascade,
  food_id      uuid references public.foods (id) on delete set null,

  -- snapshot w momencie dodania: produkt w bazie może się później zmienić
  food_name    text not null,
  grams        numeric(7, 2) not null check (grams > 0 and grams <= 20000),
  kcal_100g    numeric(7, 2) not null check (kcal_100g >= 0),
  protein_100g numeric(6, 2) not null default 0,
  carbs_100g   numeric(6, 2) not null default 0,
  fat_100g     numeric(6, 2) not null default 0,

  created_at   timestamptz not null default now(),

  -- kolumny wyliczane: gotowe sumy bez liczenia po stronie klienta
  kcal    numeric(9, 2) generated always as (round(kcal_100g    * grams / 100, 2)) stored,
  protein numeric(8, 2) generated always as (round(protein_100g * grams / 100, 2)) stored,
  carbs   numeric(8, 2) generated always as (round(carbs_100g   * grams / 100, 2)) stored,
  fat     numeric(8, 2) generated always as (round(fat_100g     * grams / 100, 2)) stored
);
create index if not exists meal_entries_meal_idx on public.meal_entries (meal_id);
create index if not exists meal_entries_user_idx on public.meal_entries (user_id);

-- ============================================================
-- MODUŁ 3 — INNE AKTYWNOŚCI
-- ============================================================
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  type         text not null check (type in
                 ('running', 'cycling', 'swimming', 'mma_sparring', 'mma_training',
                  'walking', 'rowing', 'hiking', 'climbing', 'other')),
  custom_type  text,                       -- gdy type = 'other'
  date         date not null default current_date,
  started_at   timestamptz,
  duration_min integer check (duration_min between 0 and 1440),
  distance_km  numeric(7, 2) check (distance_km >= 0),
  kcal         integer check (kcal between 0 and 20000),
  avg_hr       integer check (avg_hr between 20 and 250),
  notes        text,

  -- przygotowane pod przyszły import ze Stravy (v1: tylko 'manual')
  source       text not null default 'manual' check (source in ('manual', 'strava')),
  external_id  text,
  raw          jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists activities_external_uidx
  on public.activities (user_id, source, external_id) where external_id is not null;
create index if not exists activities_user_date_idx on public.activities (user_id, date desc);

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ============================================================
-- AI — historia generowanych planów (debug + możliwość powrotu)
-- ============================================================
create table if not exists public.ai_plan_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  input      jsonb not null,
  output     jsonb,
  plan_id    uuid references public.plans (id) on delete set null,
  model      text,
  status     text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  error      text,
  created_at timestamptz not null default now()
);
create index if not exists ai_plan_requests_user_idx on public.ai_plan_requests (user_id, created_at desc);
