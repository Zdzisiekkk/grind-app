-- ============================================================
-- Grind — Migracja 0002: Row Level Security
-- Zasada: każdy widzi TYLKO swoje dane.
-- Wyjątki (celowe, tylko do odczytu):
--   * exercise_catalog gdzie user_id IS NULL  -> globalny katalog ćwiczeń
--   * plans gdzie is_public AND is_template   -> publiczne szablony planów
--   * foods gdzie user_id IS NULL             -> współdzielony cache Open Food Facts
-- ============================================================

-- ------------------------------------------------------------
-- Funkcje pomocnicze (SECURITY DEFINER — omijają RLS tabel nadrzędnych,
-- dzięki czemu polityki na tabelach-dzieciach nie zapętlają się)
-- ------------------------------------------------------------

create or replace function public.can_read_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans pl
    where pl.id = p_plan_id
      and (pl.user_id = auth.uid() or (pl.is_public and pl.is_template))
  );
$$;

create or replace function public.can_write_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans pl
    where pl.id = p_plan_id
      and (pl.user_id = auth.uid() or (pl.user_id is null and public.is_admin()))
  );
$$;

create or replace function public.phase_plan_id(p_phase_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select ph.plan_id from public.phases ph where ph.id = p_phase_id;
$$;

create or replace function public.day_plan_id(p_day_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select ph.plan_id
  from public.workout_days d
  join public.phases ph on ph.id = d.phase_id
  where d.id = p_day_id;
$$;

create or replace function public.meal_owner(p_meal_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.user_id from public.meals m where m.id = p_meal_id;
$$;

grant execute on function public.is_admin(),
                         public.can_read_plan(uuid),
                         public.can_write_plan(uuid),
                         public.phase_plan_id(uuid),
                         public.day_plan_id(uuid),
                         public.meal_owner(uuid)
  to authenticated;

-- ------------------------------------------------------------
-- Włącz RLS wszędzie
-- ------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.exercise_catalog  enable row level security;
alter table public.plans             enable row level security;
alter table public.phases            enable row level security;
alter table public.workout_days      enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.workout_logs      enable row level security;
alter table public.knee_pain_logs    enable row level security;
alter table public.body_weight_logs  enable row level security;
alter table public.foods             enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_entries      enable row level security;
alter table public.activities        enable row level security;
alter table public.ai_plan_requests  enable row level security;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Uwaga: rola jest chroniona — user nie może sam awansować się na admina.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- ------------------------------------------------------------
-- exercise_catalog
-- ------------------------------------------------------------
drop policy if exists exercise_catalog_select on public.exercise_catalog;
create policy exercise_catalog_select on public.exercise_catalog
  for select to authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists exercise_catalog_insert on public.exercise_catalog;
create policy exercise_catalog_insert on public.exercise_catalog
  for insert to authenticated
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

drop policy if exists exercise_catalog_update on public.exercise_catalog;
create policy exercise_catalog_update on public.exercise_catalog
  for update to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()))
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

drop policy if exists exercise_catalog_delete on public.exercise_catalog;
create policy exercise_catalog_delete on public.exercise_catalog
  for delete to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()));

-- ------------------------------------------------------------
-- plans
-- ------------------------------------------------------------
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated
  using (user_id = auth.uid() or (is_public and is_template));

drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans
  for insert to authenticated
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()))
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

drop policy if exists plans_delete on public.plans;
create policy plans_delete on public.plans
  for delete to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()));

-- ------------------------------------------------------------
-- phases / workout_days / workout_exercises — dziedziczą prawa po planie
-- ------------------------------------------------------------
drop policy if exists phases_select on public.phases;
create policy phases_select on public.phases
  for select to authenticated using (public.can_read_plan(plan_id));

drop policy if exists phases_write on public.phases;
create policy phases_write on public.phases
  for all to authenticated
  using (public.can_write_plan(plan_id))
  with check (public.can_write_plan(plan_id));

drop policy if exists workout_days_select on public.workout_days;
create policy workout_days_select on public.workout_days
  for select to authenticated using (public.can_read_plan(public.phase_plan_id(phase_id)));

drop policy if exists workout_days_write on public.workout_days;
create policy workout_days_write on public.workout_days
  for all to authenticated
  using (public.can_write_plan(public.phase_plan_id(phase_id)))
  with check (public.can_write_plan(public.phase_plan_id(phase_id)));

drop policy if exists workout_exercises_select on public.workout_exercises;
create policy workout_exercises_select on public.workout_exercises
  for select to authenticated using (public.can_read_plan(public.day_plan_id(workout_day_id)));

drop policy if exists workout_exercises_write on public.workout_exercises;
create policy workout_exercises_write on public.workout_exercises
  for all to authenticated
  using (public.can_write_plan(public.day_plan_id(workout_day_id)))
  with check (public.can_write_plan(public.day_plan_id(workout_day_id)));

-- ------------------------------------------------------------
-- Tabele czysto prywatne: identyczny wzorzec user_id = auth.uid()
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'workout_sessions', 'workout_logs', 'knee_pain_logs', 'body_weight_logs',
    'meals', 'meal_entries', 'activities', 'ai_plan_requests'
  ]
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

-- meal_entries dodatkowo: posiłek musi należeć do tego samego użytkownika
drop policy if exists meal_entries_meal_owner on public.meal_entries;
create policy meal_entries_meal_owner on public.meal_entries
  as restrictive for all to authenticated
  using (public.meal_owner(meal_id) = auth.uid())
  with check (public.meal_owner(meal_id) = auth.uid());

-- ------------------------------------------------------------
-- foods — własne produkty + współdzielony cache Open Food Facts
-- Cache OFF jest zapisywany przez zalogowanych użytkowników przy dodawaniu
-- produktu do posiłku; to publiczne dane produktowe, nie dane osobowe.
-- ------------------------------------------------------------
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods
  for select to authenticated using (user_id is null or user_id = auth.uid());

drop policy if exists foods_insert on public.foods;
create policy foods_insert on public.foods
  for insert to authenticated
  with check (
    (user_id = auth.uid() and source = 'custom')
    or (user_id is null and source = 'off')
  );

drop policy if exists foods_update on public.foods;
create policy foods_update on public.foods
  for update to authenticated
  using (user_id = auth.uid() or (user_id is null and source = 'off'))
  with check (user_id = auth.uid() or (user_id is null and source = 'off'));

drop policy if exists foods_delete on public.foods;
create policy foods_delete on public.foods
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Uprawnienia obiektowe
-- Supabase zwykle nadaje je automatycznie (default privileges), ale
-- ustawiamy je jawnie, żeby migracje działały też na czystym Postgresie.
-- Właściwą kontrolę dostępu robi RLS powyżej, nie te granty.
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
