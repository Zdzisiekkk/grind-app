-- ============================================================
-- Grind — Migracja 0008: nawyki i nawodnienie
--
-- Nawyk to rzecz, którą chcesz robić regularnie (suplementy, rozciąganie,
-- 8 h snu). Odhaczasz go per dzień; niektóre mają cel większy niż raz
-- dziennie. Woda jest osobno, bo dopisujesz ją wielokrotnie w ciągu dnia
-- i chcesz widzieć sumę względem celu.
-- ============================================================

-- ------------------------------------------------------------
-- Nawyki
-- ------------------------------------------------------------
create table if not exists public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  name         text not null,
  icon         text not null default '✅',
  note         text,

  -- Ile razy dziennie ma być odhaczony (1 = zwykły ptaszek).
  target_per_day integer not null default 1 check (target_per_day between 1 and 50),
  unit         text,                          -- 'szklanki', 'kapsułki', 'minuty'…

  -- Dni tygodnia wg ISO: 1 = poniedziałek … 7 = niedziela.
  -- Pusta tablica = codziennie.
  days_of_week smallint[] not null default '{}',

  -- Godzina przypomnienia. Trzymamy ją niezależnie od tego, czy
  -- powiadomienia systemowe są włączone — to ustawienie użytkownika,
  -- nie szczegół implementacji.
  reminder_at  time,

  is_archived  boolean not null default false,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint habits_days_valid
    check (days_of_week <@ array[1,2,3,4,5,6,7]::smallint[])
);

create index if not exists habits_user_idx
  on public.habits (user_id, is_archived, order_index);

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Odhaczenia — jeden wiersz na nawyk i dzień, z licznikiem
-- ------------------------------------------------------------
create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,

  date       date not null default current_date,
  count      integer not null default 1 check (count >= 0),
  note       text,
  created_at timestamptz not null default now(),

  unique (user_id, habit_id, date)
);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, date desc);
create index if not exists habit_logs_habit_date_idx
  on public.habit_logs (habit_id, date);

-- ------------------------------------------------------------
-- Woda — osobne wpisy, żeby dało się cofnąć jeden łyk
-- ------------------------------------------------------------
create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null default current_date,
  ml         integer not null check (ml between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx
  on public.water_logs (user_id, date desc);

-- ------------------------------------------------------------
-- Ustawienia nawodnienia w profilu
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists daily_water_ml integer default 2500
    check (daily_water_ml is null or daily_water_ml between 250 and 10000);

alter table public.profiles
  add column if not exists water_portion_ml integer not null default 250
    check (water_portion_ml between 50 and 2000);

alter table public.profiles
  add column if not exists water_reminder_from time;
alter table public.profiles
  add column if not exists water_reminder_to time;
alter table public.profiles
  add column if not exists water_reminder_every_min integer
    check (water_reminder_every_min is null or water_reminder_every_min between 15 and 480);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;
alter table public.water_logs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['habits', 'habit_logs', 'water_logs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

-- Odhaczenie musi wskazywać na własny nawyk.
create or replace function public.habit_owner(p_habit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.habits where id = p_habit_id;
$$;

drop policy if exists habit_logs_habit_owner on public.habit_logs;
create policy habit_logs_habit_owner on public.habit_logs
  as restrictive for all to authenticated
  using (public.habit_owner(habit_id) = auth.uid())
  with check (public.habit_owner(habit_id) = auth.uid());

-- ------------------------------------------------------------
-- Widok: dzienne nawodnienie
-- ------------------------------------------------------------
create or replace view public.v_daily_water
with (security_invoker = on) as
  select user_id, date, sum(ml)::integer as ml, count(*)::integer as wpisy
    from public.water_logs
   group by user_id, date;

grant select, insert, update, delete
  on public.habits, public.habit_logs, public.water_logs to authenticated;
grant select on public.v_daily_water to authenticated;
grant execute on function public.habit_owner(uuid) to authenticated;

-- ------------------------------------------------------------
-- period_summary: dokładamy nawyki i wodę
-- ------------------------------------------------------------
create or replace function public.period_summary(p_from date, p_to date)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'from', p_from,
    'to', p_to,
    'workouts', (
      select count(*) from public.workout_sessions s
      where s.user_id = auth.uid() and s.date between p_from and p_to
    ),
    'sets', (
      select coalesce(sum(v.sets), 0) from public.v_daily_volume v
      where v.user_id = auth.uid() and v.date between p_from and p_to
    ),
    'volume_kg', (
      select coalesce(sum(v.volume_kg), 0) from public.v_daily_volume v
      where v.user_id = auth.uid() and v.date between p_from and p_to
    ),
    'avg_kcal', (
      select coalesce(round(avg(n.kcal)), 0) from public.v_daily_nutrition n
      where n.user_id = auth.uid() and n.date between p_from and p_to
    ),
    'days_logged_food', (
      select count(*) from public.v_daily_nutrition n
      where n.user_id = auth.uid() and n.date between p_from and p_to
    ),
    'activities', (
      select count(*) from public.activities a
      where a.user_id = auth.uid() and a.date between p_from and p_to
    ),
    'activity_minutes', (
      select coalesce(sum(a.duration_min), 0) from public.activities a
      where a.user_id = auth.uid() and a.date between p_from and p_to
    ),
    'avg_pain', (
      select round(avg(p.level), 1) from public.pain_logs p
      where p.user_id = auth.uid() and p.date between p_from and p_to
    ),
    'pain_by_injury', (
      select coalesce(json_agg(x order by x.name), '[]'::json) from (
        select i.id, i.name, i.body_part,
               round(avg(p.level), 1) as avg_level,
               max(p.level)           as max_level,
               count(*)               as entries
        from public.pain_logs p
        join public.injuries i on i.id = p.injury_id
        where p.user_id = auth.uid() and p.date between p_from and p_to
        group by i.id, i.name, i.body_part
      ) x
    ),
    'avg_water_ml', (
      select round(avg(w.ml)) from public.v_daily_water w
      where w.user_id = auth.uid() and w.date between p_from and p_to
    ),
    'habit_days_done', (
      select count(*) from public.habit_logs h
      join public.habits hb on hb.id = h.habit_id
      where h.user_id = auth.uid() and h.date between p_from and p_to
        and h.count >= hb.target_per_day
    ),
    'weight_start', (
      select b.weight_kg from public.body_weight_logs b
      where b.user_id = auth.uid() and b.date between p_from and p_to
      order by b.date asc limit 1
    ),
    'weight_end', (
      select b.weight_kg from public.body_weight_logs b
      where b.user_id = auth.uid() and b.date between p_from and p_to
      order by b.date desc limit 1
    )
  );
$$;

grant execute on function public.period_summary(date, date) to authenticated;
