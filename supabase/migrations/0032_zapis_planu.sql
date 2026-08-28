-- ============================================================
-- Grind — Migracja 0032: zapis planu z AI jako jedna operacja
--
-- Problem znaleziony w przeglądzie kodu.
--
-- Plan zapisywał się pętlą po stronie aplikacji: osobne zapytanie na plan,
-- osobne na każdą fazę, na każdy dzień i na ćwiczenia w dniu. Dla planu
-- 3 fazy × 5 dni to ponad trzydzieści zapytań jedno po drugim, bez transakcji,
-- a błąd w środku był mijany przez `continue`. W najgorszym razie plan
-- z brakującymi dniami stawał się aktywnym planem i nic o tym nie mówiło.
--
-- Tutaj robi to jedna funkcja. Postgres daje transakcję za darmo: albo zapisze
-- się wszystko, albo nic. Przy okazji trzydzieści obiegów sieci schodzi do
-- jednego.
--
-- SECURITY INVOKER świadomie: funkcja ma widzieć dokładnie tyle, co wołający,
-- więc RLS nadal pilnuje, że nikt nie zapisze planu na cudze konto.
-- ============================================================

create or replace function public.save_ai_plan(p_request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_output   jsonb;
  v_plan_id  uuid;
  v_user_id  uuid := auth.uid();
  v_phase    jsonb;
  v_phase_i  int;
  v_phase_id uuid;
  v_day      jsonb;
  v_day_i    int;
  v_day_id   uuid;
begin
  if v_user_id is null then
    raise exception 'Trzeba być zalogowanym.' using errcode = '42501';
  end if;

  -- RLS ogranicza widok do własnych zgłoszeń, więc nie trzeba filtrować po user_id.
  select output, plan_id into v_output, v_plan_id
    from public.ai_plan_requests
   where id = p_request_id;

  if not found or v_output is null then
    raise exception 'Nie znaleziono wygenerowanego planu.' using errcode = 'P0002';
  end if;

  -- Zapisany już wcześniej: oddajemy ten sam plan zamiast robić duplikat.
  if v_plan_id is not null then
    return v_plan_id;
  end if;

  if jsonb_typeof(v_output -> 'phases') <> 'array'
     or jsonb_array_length(v_output -> 'phases') = 0 then
    raise exception 'Wygenerowany plan nie ma faz.' using errcode = '22023';
  end if;

  insert into public.plans (user_id, name, description, goal, source)
  values (
    v_user_id,
    left(coalesce(v_output ->> 'name', 'Plan od trenera AI'), 120),
    nullif(
      btrim(concat_ws(E'\n\n', v_output ->> 'description', v_output ->> 'coach_notes')),
      ''
    ),
    v_output ->> 'goal',
    'ai'
  )
  returning id into v_plan_id;

  v_phase_i := 0;
  for v_phase in select * from jsonb_array_elements(v_output -> 'phases')
  loop
    v_phase_i := v_phase_i + 1;

    insert into public.phases (plan_id, name, description, frequency, order_index)
    values (
      v_plan_id,
      left(coalesce(v_phase ->> 'name', 'Faza ' || v_phase_i), 120),
      nullif(v_phase ->> 'description', ''),
      nullif(v_phase ->> 'frequency', ''),
      v_phase_i
    )
    returning id into v_phase_id;

    v_day_i := 0;
    for v_day in select * from jsonb_array_elements(coalesce(v_phase -> 'days', '[]'::jsonb))
    loop
      v_day_i := v_day_i + 1;

      insert into public.workout_days
        (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
      values (
        v_phase_id,
        left(coalesce(v_day ->> 'name', 'Dzień ' || v_day_i), 120),
        left(nullif(v_day ->> 'short_label', ''), 4),
        nullif(v_day ->> 'description', ''),
        coalesce(nullif(v_day ->> 'day_type', ''), 'gym'),
        coalesce((v_day ->> 'tracks_pain')::boolean, false),
        v_day_i
      )
      returning id into v_day_id;

      -- Ćwiczenia jednym wstawieniem na dzień. Slug dopasowujemy do katalogu;
      -- gdy go tam nie ma, zostaje sama nazwa od modelu.
      insert into public.workout_exercises (
        workout_day_id, catalog_exercise_id, name_override, muscle_group,
        target_sets, target_reps, target_note, technique_notes, rest_seconds, order_index
      )
      select
        v_day_id,
        c.id,
        case when c.id is null then left(e.value ->> 'name', 120) end,
        c.muscle_group,
        greatest(1, least(12, coalesce((e.value ->> 'target_sets')::int, 3))),
        nullif(e.value ->> 'target_reps', ''),
        nullif(e.value ->> 'target_note', ''),
        nullif(e.value ->> 'technique_notes', ''),
        greatest(0, least(600, coalesce((e.value ->> 'rest_seconds')::int, 90))),
        e.ordinality
      from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb))
             with ordinality as e(value, ordinality)
      left join public.exercise_catalog c
             on c.slug = nullif(e.value ->> 'slug', '')
            and c.user_id is null;
    end loop;
  end loop;

  update public.ai_plan_requests set plan_id = v_plan_id where id = p_request_id;

  perform public.set_active_plan(v_plan_id);

  return v_plan_id;
end;
$$;

comment on function public.save_ai_plan is
  'Zapisuje wygenerowany plan w całości albo wcale. Wcześniej robiła to pętla '
  'w aplikacji: ponad trzydzieści zapytań bez transakcji, z błędami mijanymi '
  'przez continue.';

grant execute on function public.save_ai_plan(uuid) to authenticated;
