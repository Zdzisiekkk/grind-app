-- ============================================================
-- Grind — Migracja 0010: sen
--
-- Jeden wiersz = jedna noc, opisana datą PORANKA, którego się obudziłeś.
-- To jest ważna decyzja: noc z 3 na 4 maja zapisujemy pod 4 maja, bo tak
-- właśnie jej szukasz („jak spałem tej nocy?") i dzięki temu sen łączy się
-- z resztą dnia — treningiem, wagą, nawykami — bez przesunięcia o dobę.
--
-- Baza trzyma wyłącznie fakty: o której się położyłeś, o której wstałeś,
-- ile razy się obudziłeś, jak to oceniasz. Sleep score liczy aplikacja
-- (src/lib/sleep.ts), bo formuła będzie się jeszcze zmieniać, a strojenie
-- wag nie powinno wymagać migracji.
-- ============================================================

-- Czynniki, które mogły wpłynąć na noc. Lista zamknięta, bo służy do
-- porównywania nocy między sobą — wolny tekst by to uniemożliwił.
-- Kolejność i etykiety mieszkają w src/lib/constants.ts.
create or replace function public.sleep_factor_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'alkohol', 'kofeina', 'ekran', 'pozny_posilek', 'trening_wieczor',
    'stres', 'choroba', 'halas', 'upal', 'podroz', 'drzemka',
    'melatonina', 'magnez', 'ciemno', 'chlodno'
  ]::text[];
$$;

create table if not exists public.sleep_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  -- Data poranka — patrz komentarz na górze pliku.
  date       date not null default current_date,

  bedtime    time not null,      -- o której poszedłeś spać
  wake_time  time not null,      -- o której wstałeś

  -- Ile zajęło zaśnięcie i ile łącznie nie spałeś w środku nocy.
  -- Oba odejmujemy od czasu w łóżku, żeby dostać realny sen.
  fell_asleep_min integer not null default 15
    check (fell_asleep_min between 0 and 600),
  awakenings      smallint not null default 0
    check (awakenings between 0 and 30),
  awake_min       integer not null default 0
    check (awake_min between 0 and 600),

  -- Odczucia, 1–5. Rozdzielone celowo: można przespać 8 h i wstać rozbitym.
  quality        smallint not null check (quality between 1 and 5),
  morning_energy smallint check (morning_energy between 1 and 5),

  nap_min    integer not null default 0 check (nap_min between 0 and 600),

  factors    text[] not null default '{}',
  note       text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, date),
  constraint sleep_logs_factors_valid
    check (factors <@ public.sleep_factor_keys())
);

-- Czas w łóżku w minutach. Liczony przez północ: gdy godzina pobudki jest
-- „mniejsza" od godziny położenia się, doba domyka różnicę.
alter table public.sleep_logs
  add column if not exists time_in_bed_min integer
  generated always as (
    mod(
      (extract(epoch from wake_time)::integer - extract(epoch from bedtime)::integer + 86400),
      86400
    ) / 60
  ) stored;

create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs (user_id, date desc);

drop trigger if exists sleep_logs_set_updated_at on public.sleep_logs;
create trigger sleep_logs_set_updated_at
  before update on public.sleep_logs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Ustawienia snu w profilu
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists sleep_goal_min integer not null default 480
    check (sleep_goal_min between 240 and 720);

-- Godzina, o której chcesz gasić światło — służy do oceny regularności
-- i do wieczornego przypomnienia.
alter table public.profiles
  add column if not exists sleep_target_bedtime time;

alter table public.profiles
  add column if not exists sleep_reminder_at time;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.sleep_logs enable row level security;

drop policy if exists sleep_logs_owner_all on public.sleep_logs;
create policy sleep_logs_owner_all on public.sleep_logs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Widok: realny sen po odjęciu zasypiania i pobudek
-- ------------------------------------------------------------
create or replace view public.v_sleep
with (security_invoker = on) as
  select
    user_id,
    date,
    bedtime,
    wake_time,
    time_in_bed_min,
    greatest(0, time_in_bed_min - fell_asleep_min - awake_min) as sleep_min,
    fell_asleep_min,
    awakenings,
    awake_min,
    quality,
    morning_energy,
    nap_min,
    factors,
    note
  from public.sleep_logs;

grant select, insert, update, delete on public.sleep_logs to authenticated;
grant select on public.v_sleep to authenticated;
grant execute on function public.sleep_factor_keys() to authenticated;

-- ------------------------------------------------------------
-- period_summary: dokładamy sen i mianowniki potrzebne do Health Score
--
-- Health Score liczy aplikacja, ale surowe liczniki muszą przyjść z bazy
-- jednym zapytaniem — inaczej pulpit robiłby ich kilkanaście.
-- Nowe pola:
--   nights_logged / avg_sleep_min / avg_sleep_quality / avg_bedtime_min
--   habit_days_due  — ile odhaczeń „wypadało" w okresie (mianownik filaru)
--   days_water_logged, avg_protein_g, days_in_period
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
    'days_in_period', (p_to - p_from) + 1,
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
    'avg_protein_g', (
      select round(avg(n.protein_g)) from public.v_daily_nutrition n
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
    'days_water_logged', (
      select count(*) from public.v_daily_water w
      where w.user_id = auth.uid() and w.date between p_from and p_to
    ),
    'habit_days_done', (
      select count(*) from public.habit_logs h
      join public.habits hb on hb.id = h.habit_id
      where h.user_id = auth.uid() and h.date between p_from and p_to
        and h.count >= hb.target_per_day
    ),
    -- Ile odhaczeń w ogóle wypadało: nawyk × każdy jego dzień tygodnia
    -- w okresie. Pusta lista dni = codziennie.
    'habit_days_due', (
      select count(*)
        from public.habits hb
        cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
       where hb.user_id = auth.uid()
         and not hb.is_archived
         and (
           cardinality(hb.days_of_week) = 0
           or extract(isodow from d)::smallint = any(hb.days_of_week)
         )
    ),
    'nights_logged', (
      select count(*) from public.v_sleep s
      where s.user_id = auth.uid() and s.date between p_from and p_to
    ),
    'avg_sleep_min', (
      select round(avg(s.sleep_min)) from public.v_sleep s
      where s.user_id = auth.uid() and s.date between p_from and p_to
    ),
    'avg_sleep_quality', (
      select round(avg(s.quality), 1) from public.v_sleep s
      where s.user_id = auth.uid() and s.date between p_from and p_to
    ),
    -- Średnia godzina zaśnięcia jako minuty od 18:00 — dzięki temu 23:30
    -- i 00:30 leżą obok siebie, a nie na przeciwnych końcach doby.
    'avg_bedtime_min', (
      select round(avg(mod(extract(epoch from s.bedtime)::integer - 64800 + 86400, 86400) / 60))
        from public.v_sleep s
       where s.user_id = auth.uid() and s.date between p_from and p_to
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
