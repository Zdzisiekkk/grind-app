-- ============================================================
-- Grind — Migracja 0036: ostatnie dwie rzeczy z audytora Supabase
--
-- Po przepisaniu polityk (0034) audytor przestał zgłaszać `auth_rls_initplan`.
-- Zostały dwie pozycje, obie tej samej natury — praca wykonywana bez potrzeby
-- przy każdym zapytaniu.
--
-- 1. KLUCZE OBCE BEZ INDEKSU (11 sztuk)
--    Postgres nie zakłada indeksu na klucz obcy sam z siebie. Bez niego każde
--    kasowanie wiersza nadrzędnego skanuje całą tabelę podrzędną, żeby
--    sprawdzić, czy coś na niego wskazuje. Najdotkliwsze przy usuwaniu konta,
--    które kasuje kaskadowo wszystko naraz.
--
-- 2. DWIE POLITYKI NA JEDEN ODCZYT
--    `phases`, `workout_days`, `workout_exercises` i `app_settings` mają
--    politykę SELECT oraz politykę FOR ALL. Postgres wykonuje przy odczycie
--    OBIE — a ta druga woła can_write_plan(), czyli osobne zapytanie do bazy
--    dla każdego wiersza. Rozbijamy FOR ALL na INSERT/UPDATE/DELETE, żeby
--    odczyt sprawdzał dokładnie jedną regułę. Uprawnienia zostają bez zmian.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Indeksy pod klucze obce
-- ------------------------------------------------------------
create index if not exists ai_plan_requests_plan_idx
  on public.ai_plan_requests (plan_id);
create index if not exists book_notes_user_idx
  on public.book_notes (user_id);
create index if not exists meal_entries_food_idx
  on public.meal_entries (food_id);
create index if not exists pain_logs_session_idx
  on public.pain_logs (session_id);
create index if not exists reading_logs_book_idx
  on public.reading_logs (book_id);
create index if not exists recipe_items_food_idx
  on public.recipe_items (food_id);
create index if not exists recipe_items_user_fk_idx
  on public.recipe_items (user_id);
create index if not exists workout_exercises_catalog_idx
  on public.workout_exercises (catalog_exercise_id);
create index if not exists workout_logs_catalog_fk_idx
  on public.workout_logs (catalog_exercise_id);
create index if not exists workout_logs_workout_exercise_idx
  on public.workout_logs (workout_exercise_id);
create index if not exists workout_sessions_day_idx
  on public.workout_sessions (workout_day_id);

-- ------------------------------------------------------------
-- 2. Rozbicie polityk FOR ALL, żeby odczyt sprawdzał jedną regułę
-- ------------------------------------------------------------

-- phases
drop policy if exists phases_write on public.phases;
create policy phases_insert on public.phases
  for insert to authenticated with check (public.can_write_plan(plan_id));
create policy phases_update on public.phases
  for update to authenticated
  using (public.can_write_plan(plan_id)) with check (public.can_write_plan(plan_id));
create policy phases_delete on public.phases
  for delete to authenticated using (public.can_write_plan(plan_id));

-- workout_days
drop policy if exists workout_days_write on public.workout_days;
create policy workout_days_insert on public.workout_days
  for insert to authenticated
  with check (public.can_write_plan(public.phase_plan_id(phase_id)));
create policy workout_days_update on public.workout_days
  for update to authenticated
  using (public.can_write_plan(public.phase_plan_id(phase_id)))
  with check (public.can_write_plan(public.phase_plan_id(phase_id)));
create policy workout_days_delete on public.workout_days
  for delete to authenticated
  using (public.can_write_plan(public.phase_plan_id(phase_id)));

-- workout_exercises
drop policy if exists workout_exercises_write on public.workout_exercises;
create policy workout_exercises_insert on public.workout_exercises
  for insert to authenticated
  with check (public.can_write_plan(public.day_plan_id(workout_day_id)));
create policy workout_exercises_update on public.workout_exercises
  for update to authenticated
  using (public.can_write_plan(public.day_plan_id(workout_day_id)))
  with check (public.can_write_plan(public.day_plan_id(workout_day_id)));
create policy workout_exercises_delete on public.workout_exercises
  for delete to authenticated
  using (public.can_write_plan(public.day_plan_id(workout_day_id)));

-- app_settings — cennik czyta każdy, zmienia wyłącznie admin
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_insert on public.app_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy app_settings_admin_delete on public.app_settings
  for delete to authenticated using ((select public.is_admin()));

-- ------------------------------------------------------------
-- Sprawdzenie na miejscu: żaden odczyt nie może mieć dwóch reguł
-- ------------------------------------------------------------
do $$
declare v_left text[];
begin
  select coalesce(array_agg(tablename), '{}') into v_left
    from (
      select tablename
        from pg_policies
       where schemaname = 'public'
         and permissive = 'PERMISSIVE'
         and cmd in ('SELECT', 'ALL')
       group by tablename, roles
      having count(*) > 1
    ) t;

  if array_length(v_left, 1) > 0 then
    raise exception 'Nadal dwie polityki na jeden odczyt: %', v_left;
  end if;
end;
$$;
