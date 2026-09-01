-- ============================================================
-- 0052: naprawa po odtworzeniu migracji na żywej bazie
--
-- CO SIĘ STAŁO. Uruchomienie wszystkich migracji od 0001 na bazie, która
-- miała je już wykonane, cofnęło część obiektów do wersji z pierwszego dnia
-- projektu. Migracje 0001-0009 definiują funkcje i polityki przez
-- "create or replace" oraz "drop policy / create policy", więc powtórka
-- nadpisała je starszą treścią - a późniejsze migracje, które to utwardzały,
-- już się nie wykonały, bo skrypt zatrzymał się na 0010.
--
-- 0010 nie daje się powtórzyć, bo tworzy widok snu z kolumną nap_min, którą
-- migracja 0040 przeniosła do osobnej tabeli. To nie usterka: migracja opisuje
-- stan świata z dnia, w którym powstała.
--
-- Większość szkody naprawiło ponowne wykonanie migracji 0011-0035 i 0042-0051.
-- Ten plik domyka dwie rzeczy, których nie dało się w ten sposób odzyskać.
-- Na czystej bazie jest bezczynny: polityk poniżej tam nie ma, a funkcja
-- jest identyczna z tą z 0010.
--
-- WNIOSEK NA PRZYSZŁOŚĆ. Na bazie z wykonanymi migracjami uruchamiamy tylko
-- nowe pliki: OD=00XX npm run db:push. Skrypt run-migrations.mjs mówi o tym
-- w komentarzu.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Polityki wskrzeszone przez powtórzone 0002 i 0015
-- ------------------------------------------------------------
/*
 * Migracja 0036 rozbiła szerokie polityki "FOR ALL" na osobne reguły dla
 * odczytu i zapisu i te zbiorcze skasowała. Powtórzone 0002 i 0015 wstawiły
 * je z powrotem, a 0036 nie dała się odtworzyć (jej "create policy" trafia
 * na polityki, które już istnieją).
 *
 * Zostawione działałyby obok nowych - polityki permisywne sumują się przez OR,
 * więc szersza reguła po cichu unieważnia węższą.
 */
drop policy if exists phases_write on public.phases;
drop policy if exists workout_days_write on public.workout_days;
drop policy if exists workout_exercises_write on public.workout_exercises;
drop policy if exists app_settings_admin_write on public.app_settings;

-- ------------------------------------------------------------
-- 2. Podsumowanie okresu w wersji z migracji 0010
-- ------------------------------------------------------------
/*
 * Powtórzone 0003 cofnęło period_summary do wersji sprzed snu i nawyków.
 * Health Score liczy się właśnie z tych pól, więc na pulpicie zniknęła ocena
 * formy, a test na żywo pokazał "nocy=undefined".
 *
 * Treść skopiowana bez zmian z migracji 0010 - to nadal jest ta sama funkcja,
 * tyle że wpisana ponownie.
 */
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

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------

do $$
declare
  v_nadmiar int;
  v_sen     int;
begin
  select count(*) into v_nadmiar from pg_policies
   where schemaname = 'public'
     and policyname in ('phases_write', 'workout_days_write',
                        'workout_exercises_write', 'app_settings_admin_write');
  if v_nadmiar > 0 then
    raise exception 'Migracja 0052: % szerokich polityk nadal istnieje', v_nadmiar;
  end if;

  -- Funkcja ma znowu znać sen i mianownik nawyków - bez tego Health Score
  -- nie ma z czego się policzyć.
  select count(*) into v_sen
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'period_summary'
     and pg_get_functiondef(p.oid) like '%habit_days_due%'
     and pg_get_functiondef(p.oid) like '%nights_logged%';
  if v_sen <> 1 then
    raise exception 'Migracja 0052: period_summary nadal nie zna snu i nawyków';
  end if;
end $$;
