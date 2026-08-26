-- ============================================================
-- Grind — Migracja 0003: funkcje aplikacyjne, widoki, podsumowania
-- ============================================================

-- ------------------------------------------------------------
-- clone_plan — skopiuj szablon (lub własny plan) na swoje konto
-- razem z fazami, dniami i ćwiczeniami.
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
  v_uid      uuid := auth.uid();
  v_new_plan uuid;
  v_phase    record;
  v_day      record;
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
        (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
      values
        (v_new_phase, v_day.name, v_day.short_label, v_day.description,
         v_day.day_type, v_day.tracks_knee_pain, v_day.order_index)
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
-- set_active_plan — dokładnie jeden aktywny plan na użytkownika
-- ------------------------------------------------------------
create or replace function public.set_active_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id and user_id = v_uid) then
    raise exception 'To nie jest Twój plan.';
  end if;

  update public.plans set is_active = false where user_id = v_uid and is_active;
  update public.plans set is_active = true  where id = p_plan_id;
end;
$$;

-- ------------------------------------------------------------
-- last_exercise_sets — co podnosiłem ostatnio w tym ćwiczeniu
-- (używane w widoku "dzisiejszy trening", obok każdego ćwiczenia)
-- ------------------------------------------------------------
create or replace function public.last_exercise_sets(
  p_catalog_exercise_id uuid,
  p_exercise_name       text default null,
  p_before_date         date default current_date
)
returns table (
  date       date,
  set_number integer,
  weight_kg  numeric,
  reps       integer,
  rpe        numeric,
  duration_seconds integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with last_day as (
    select l.date
    from public.workout_logs l
    where l.user_id = auth.uid()
      and l.is_warmup = false
      and l.date < p_before_date
      and (
        (p_catalog_exercise_id is not null and l.catalog_exercise_id = p_catalog_exercise_id)
        or (p_catalog_exercise_id is null and p_exercise_name is not null
            and lower(l.exercise_name) = lower(p_exercise_name))
      )
    order by l.date desc
    limit 1
  )
  select l.date, l.set_number, l.weight_kg, l.reps, l.rpe, l.duration_seconds
  from public.workout_logs l, last_day
  where l.user_id = auth.uid()
    and l.date = last_day.date
    and l.is_warmup = false
    and (
      (p_catalog_exercise_id is not null and l.catalog_exercise_id = p_catalog_exercise_id)
      or (p_catalog_exercise_id is null and p_exercise_name is not null
          and lower(l.exercise_name) = lower(p_exercise_name))
    )
  order by l.set_number;
$$;

-- ------------------------------------------------------------
-- Widoki agregujące (security_invoker => RLS użytkownika obowiązuje)
-- ------------------------------------------------------------

-- Suma kalorii i makro na dzień
create or replace view public.v_daily_nutrition
with (security_invoker = on) as
select
  m.user_id,
  m.date,
  round(sum(e.kcal))::int      as kcal,
  round(sum(e.protein), 1)     as protein_g,
  round(sum(e.carbs), 1)       as carbs_g,
  round(sum(e.fat), 1)         as fat_g,
  count(e.id)::int             as entries
from public.meals m
join public.meal_entries e on e.meal_id = m.id
group by m.user_id, m.date;

-- Objętość treningowa na dzień (sets x reps x weight)
create or replace view public.v_daily_volume
with (security_invoker = on) as
select
  l.user_id,
  l.date,
  count(*)::int                                              as sets,
  sum(coalesce(l.reps, 0))::int                              as reps,
  round(sum(coalesce(l.weight_kg, 0) * coalesce(l.reps, 0)))::int as volume_kg,
  count(distinct coalesce(l.catalog_exercise_id::text, l.exercise_name))::int as exercises
from public.workout_logs l
where l.is_warmup = false
group by l.user_id, l.date;

-- Rekordy życiowe per ćwiczenie
create or replace view public.v_exercise_prs
with (security_invoker = on) as
select
  l.user_id,
  coalesce(l.catalog_exercise_id::text, lower(l.exercise_name)) as exercise_key,
  l.catalog_exercise_id,
  max(l.exercise_name)                                          as exercise_name,
  max(l.weight_kg)                                              as best_weight_kg,
  max(coalesce(l.weight_kg, 0) * (1 + coalesce(l.reps, 0) / 30.0)) as best_e1rm_kg,
  max(l.date)                                                   as last_done,
  count(*)::int                                                 as total_sets
from public.workout_logs l
where l.is_warmup = false
group by 1, 2, 3;

-- ------------------------------------------------------------
-- weekly_summary — podsumowanie okresu na Dashboard
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
    'avg_knee_pain', (
      select round(avg(k.level), 1) from public.knee_pain_logs k
      where k.user_id = auth.uid() and k.date between p_from and p_to
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
  public.set_active_plan(uuid),
  public.last_exercise_sets(uuid, text, date),
  public.period_summary(date, date)
to authenticated;

grant select on public.v_daily_nutrition, public.v_daily_volume, public.v_exercise_prs to authenticated;
