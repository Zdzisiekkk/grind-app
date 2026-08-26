-- ============================================================
-- Grind — Migracja 0006: kontuzje zamiast samego bólu kolana
--
-- Zamiast jednej tabeli "ból kolana" mamy teraz listę kontuzji użytkownika
-- (kolano, bark, plecy, cokolwiek) i oceny bólu podpięte pod konkretną
-- kontuzję. Dotychczasowe wpisy o kolanie przenosimy do nowej struktury,
-- żeby nikt nie stracił historii.
-- ============================================================

-- ------------------------------------------------------------
-- Lista kontuzji użytkownika
-- ------------------------------------------------------------
create table if not exists public.injuries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  name        text not null,                    -- 'Lewe kolano', 'Bark po dyslokacji'
  body_part   text not null default 'other',    -- klucz z listy w aplikacji
  side        text not null default 'none'
              check (side in ('left', 'right', 'both', 'none')),

  status      text not null default 'active'
              check (status in ('active', 'monitoring', 'healed')),

  started_at  date,                             -- kiedy się zaczęła
  healed_at   date,                             -- kiedy zeszła
  note        text,

  -- Czy po treningu aplikacja ma sama pytać o ocenę bólu.
  track_pain  boolean not null default true,

  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists injuries_user_idx
  on public.injuries (user_id, status, order_index);

drop trigger if exists injuries_set_updated_at on public.injuries;
create trigger injuries_set_updated_at
  before update on public.injuries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Oceny bólu — jedna na kontuzję i dzień
-- ------------------------------------------------------------
create table if not exists public.pain_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  injury_id  uuid not null references public.injuries (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete set null,

  date       date not null default current_date,
  level      smallint not null check (level between 0 and 10),
  note       text,
  created_at timestamptz not null default now(),

  unique (user_id, injury_id, date)
);

create index if not exists pain_logs_user_date_idx
  on public.pain_logs (user_id, date desc);
create index if not exists pain_logs_injury_date_idx
  on public.pain_logs (injury_id, date);

-- ------------------------------------------------------------
-- Przeniesienie historii z knee_pain_logs
-- Każdy użytkownik, który cokolwiek ocenił, dostaje kontuzję "Kolano"
-- (osobną dla lewego, prawego i obu, jeśli tak zapisywał).
-- ------------------------------------------------------------
do $$
declare
  v_has_old boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'knee_pain_logs'
  ) into v_has_old;

  if not v_has_old then
    return;
  end if;

  insert into public.injuries (user_id, name, body_part, side, status, track_pain, note)
  select distinct
    k.user_id,
    case k.side
      when 'left'  then 'Lewe kolano'
      when 'right' then 'Prawe kolano'
      else 'Kolano'
    end,
    'knee',
    k.side,
    'active',
    true,
    'Przeniesione z wcześniejszych ocen bólu kolana.'
  from public.knee_pain_logs k
  where not exists (
    select 1 from public.injuries i
    where i.user_id = k.user_id and i.body_part = 'knee' and i.side = k.side
  );

  insert into public.pain_logs (user_id, injury_id, session_id, date, level, note, created_at)
  select k.user_id, i.id, k.session_id, k.date, k.level, k.note, k.created_at
  from public.knee_pain_logs k
  join public.injuries i
    on i.user_id = k.user_id and i.body_part = 'knee' and i.side = k.side
  on conflict (user_id, injury_id, date) do nothing;

  drop table public.knee_pain_logs;
end;
$$;

-- ------------------------------------------------------------
-- Dzień treningowy pyta o ból ogólnie, nie tylko o kolano
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_days'
      and column_name = 'tracks_knee_pain'
  ) then
    alter table public.workout_days rename column tracks_knee_pain to tracks_pain;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- RLS — obie tabele są czysto prywatne
-- ------------------------------------------------------------
alter table public.injuries  enable row level security;
alter table public.pain_logs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['injuries', 'pain_logs']
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

-- pain_logs dodatkowo: kontuzja musi należeć do tego samego użytkownika,
-- żeby nie dało się podpiąć oceny pod cudzą kontuzję.
create or replace function public.injury_owner(p_injury_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.injuries where id = p_injury_id;
$$;

drop policy if exists pain_logs_injury_owner on public.pain_logs;
create policy pain_logs_injury_owner on public.pain_logs
  as restrictive for all to authenticated
  using (public.injury_owner(injury_id) = auth.uid())
  with check (public.injury_owner(injury_id) = auth.uid());

grant select, insert, update, delete on public.injuries, public.pain_logs to authenticated;
grant execute on function public.injury_owner(uuid) to authenticated;

-- ------------------------------------------------------------
-- clone_plan — kolumna zmieniła nazwę, funkcja musi za tym nadążyć
-- ------------------------------------------------------------
create or replace function public.clone_plan(
  p_source_plan_id uuid,
  p_new_name       text default null,
  p_activate       boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_new_plan  uuid;
  v_phase     record;
  v_day       record;
  v_new_phase uuid;
  v_new_day   uuid;
begin
  if v_uid is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  if not public.can_read_plan(p_source_plan_id) then
    raise exception 'Brak dostępu do tego planu.';
  end if;

  insert into public.plans (user_id, name, description, goal, source, is_active)
  select v_uid,
         coalesce(p_new_name, pl.name),
         pl.description,
         pl.goal,
         case when pl.is_template then 'template' else pl.source end,
         false
  from public.plans pl
  where pl.id = p_source_plan_id
  returning id into v_new_plan;

  for v_phase in
    select * from public.phases where plan_id = p_source_plan_id order by order_index
  loop
    insert into public.phases (plan_id, name, description, frequency, order_index)
    values (v_new_plan, v_phase.name, v_phase.description, v_phase.frequency, v_phase.order_index)
    returning id into v_new_phase;

    for v_day in
      select * from public.workout_days where phase_id = v_phase.id order by order_index
    loop
      insert into public.workout_days
        (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
      values
        (v_new_phase, v_day.name, v_day.short_label, v_day.description,
         v_day.day_type, v_day.tracks_pain, v_day.order_index)
      returning id into v_new_day;

      insert into public.workout_exercises
        (workout_day_id, catalog_exercise_id, name_override, muscle_group,
         target_sets, target_reps, target_note, technique_notes, rest_seconds, order_index)
      select v_new_day, we.catalog_exercise_id, we.name_override, we.muscle_group,
             we.target_sets, we.target_reps, we.target_note, we.technique_notes,
             we.rest_seconds, we.order_index
      from public.workout_exercises we
      where we.workout_day_id = v_day.id;
    end loop;
  end loop;

  if p_activate then
    perform public.set_active_plan(v_new_plan);
  end if;

  return v_new_plan;
end;
$$;

-- ------------------------------------------------------------
-- period_summary — średni ból liczony ze wszystkich kontuzji,
-- plus rozbicie na poszczególne, żeby dashboard mógł pokazać szczegóły.
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

grant execute on function
  public.clone_plan(uuid, text, boolean),
  public.period_summary(date, date)
to authenticated;
