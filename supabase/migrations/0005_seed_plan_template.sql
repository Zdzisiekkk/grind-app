-- ============================================================
-- Grind — Migracja 0005: plan treningowy jako publiczny szablon
-- plans.user_id IS NULL + is_template + is_public
--   -> każdy może go podejrzeć i skopiować do siebie (public.clone_plan)
-- Ćwiczenia NIE są hardkodowane w UI — to zwykłe wiersze w bazie,
-- edytowalne z poziomu aplikacji po skopiowaniu planu na swoje konto.
-- ============================================================

create or replace function public.seed_add_exercise(
  p_day   uuid,
  p_slug  text,
  p_sets  integer,
  p_reps  text,
  p_order integer,
  p_note  text default null
)
returns void
language plpgsql
as $$
declare
  v_ex uuid;
  v_mg text;
begin
  select id, muscle_group into v_ex, v_mg
  from public.exercise_catalog
  where slug = p_slug and user_id is null;

  if v_ex is null then
    raise exception 'Brak ćwiczenia w katalogu globalnym: %', p_slug;
  end if;

  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, muscle_group, target_sets, target_reps, target_note, order_index)
  values
    (p_day, v_ex, v_mg, p_sets, p_reps, p_note, p_order);
end;
$$;

do $$
declare
  v_plan uuid;
  v_f1   uuid;
  v_f2   uuid;
  v_day  uuid;
begin
  -- Idempotencja: nie duplikuj szablonu przy ponownym uruchomieniu migracji
  if exists (
    select 1 from public.plans
    where user_id is null and is_template
      and name = 'Powrót po kontuzji kolana + MMA'
  ) then
    raise notice 'Szablon planu już istnieje — pomijam.';
    return;
  end if;

  insert into public.plans (user_id, name, description, goal, is_template, is_public, source)
  values (
    null,
    'Powrót po kontuzji kolana + MMA',
    'Dwufazowy plan: najpierw bezpieczna odbudowa wokół kolana, potem pełne obciążenie i akcenty pod MMA. Faza 2 dopiero po zgodzie fizjoterapeuty.',
    'Rehabilitacja kolana → siła → moc rotacyjna pod MMA',
    true, true, 'template'
  )
  returning id into v_plan;

  -- ============ FAZA 1 ============
  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (
    v_plan, 'Faza 1 — rehabilitacja kolana',
    'Trening całego ciała bez ćwiczeń drażniących staw kolanowy. Nogi tylko w zakresach bezbolesnych. Po każdym dniu z nogami zapisz poziom bólu kolana.',
    '3x/tydzień', 1
  )
  returning id into v_f1;

  -- --- Dzień A ---
  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f1, 'Dzień A — górna partia', 'A', 'Push + pull, kolano całkowicie odciążone.', 'gym', false, 1)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'wyciskanie-sztangi-lawka-plaska', 4, '6-8',       1);
  perform public.seed_add_exercise(v_day, 'podciaganie-sciaganie-drazka',    4, '8-10',      2);
  perform public.seed_add_exercise(v_day, 'wyciskanie-hantli-nad-glowa',     3, '8-10',      3);
  perform public.seed_add_exercise(v_day, 'wioslowanie-sztanga-w-opadzie',   3, '8-10',      4);
  perform public.seed_add_exercise(v_day, 'uginanie-ramion-sztanga',         3, '10-12',     5);
  perform public.seed_add_exercise(v_day, 'prostowanie-ramion-wyciag',       3, '10-12',     6);
  perform public.seed_add_exercise(v_day, 'plank',                           3, '40s',       7);
  perform public.seed_add_exercise(v_day, 'dead-bug',                        3, '10/stronę', 8);

  -- --- Dzień B ---
  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f1, 'Dzień B — dół ciała (bezpieczny dla kolana) + core', 'B',
          'Nacisk na łańcuch tylny i pośladki. Prostownik nóg i wszystko zgięciowe tylko w zakresie bez bólu.',
          'gym', true, 2)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'martwy-ciag-rumunski-hantle',        4, '8',          1);
  perform public.seed_add_exercise(v_day, 'prostownik-nog',                     3, '12-15',      2);
  perform public.seed_add_exercise(v_day, 'odwodziciele-przywodziciele-bioder', 3, '15',         3);
  perform public.seed_add_exercise(v_day, 'hip-thrust',                         3, '10-12',      4);
  perform public.seed_add_exercise(v_day, 'lydki-maszyna',                      3, '15',         5);
  perform public.seed_add_exercise(v_day, 'martwy-ciag-sztanga',                3, '6',          6, 'opcjonalnie');
  perform public.seed_add_exercise(v_day, 'rotacje-tulowia-wyciag',             3, '12/stronę',  7);

  -- --- Dzień C ---
  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f1, 'Dzień C — full body + mobilność', 'C',
          'Lżejszy dzień mieszany, dużo mobilności bioder.', 'gym', true, 3)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'wyciskanie-hantli-lawka-skosna', 4, '8-10',      1);
  perform public.seed_add_exercise(v_day, 'wioslowanie-hantla-jednoracz',   3, '10/stronę', 2);
  perform public.seed_add_exercise(v_day, 'wyciskanie-nog-suwnica',         3, '10-12',     3);
  perform public.seed_add_exercise(v_day, 'face-pull',                      3, '15',        4);
  perform public.seed_add_exercise(v_day, 'rotacje-bioder-mobilnosc',       2, '2 rundy',   5);
  perform public.seed_add_exercise(v_day, 'deska-boczna',                   3, '30-40s',    6);

  -- --- Kondycja ---
  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f1, 'Kondycja', 'K',
          'Sprzęt bez obciążeń udarowych — bezpieczny dla kolana.', 'conditioning', false, 4)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'interwaly-rower-ergometr', 1, '15-20 min', 1, '2x/tydzień');

  -- --- Rozciąganie ---
  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f1, 'Rozciąganie (codziennie)', 'R',
          'Wg zaleceń fizjoterapeuty: czworogłowy, dwugłowy, pośladki. Codziennie, także w dni nietreningowe.',
          'mobility', false, 5)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'stretch-czworoglowy-stojacy',   2, '30s',        1);
  perform public.seed_add_exercise(v_day, 'stretch-czworoglowy-klek',      2, '30s/stronę', 2);
  perform public.seed_add_exercise(v_day, 'stretch-czworoglowy-lezacy',    2, '30s/stronę', 3);
  perform public.seed_add_exercise(v_day, 'stretch-dwuglowy-siad-prosty',  2, '30s',        4);
  perform public.seed_add_exercise(v_day, 'stretch-dwuglowy-pasek',        2, '30s/stronę', 5);
  perform public.seed_add_exercise(v_day, 'stretch-standing-forward-fold', 2, '30s',        6);
  perform public.seed_add_exercise(v_day, 'stretch-figure-four',           2, '30s/stronę', 7);
  perform public.seed_add_exercise(v_day, 'stretch-pigeon',                2, '30s/stronę', 8);
  perform public.seed_add_exercise(v_day, 'stretch-knee-to-chest',         2, '30s/stronę', 9);

  -- ============ FAZA 2 ============
  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (
    v_plan, 'Faza 2 — pełne obciążenie + MMA',
    'Wchodzi dopiero po zgodzie fizjoterapeuty. Dni A i C z Fazy 1 zostają bez zmian, dochodzą poniższe dwa dni.',
    '4-5x/tydzień', 2
  )
  returning id into v_f2;

  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f2, 'Faza 2 — dół ciała', 'D2',
          'Przysiady i plyometria. Przy jakimkolwiek bólu kolana cofnij się do Dnia B.',
          'gym', true, 1)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'goblet-squat',       3, '8-10',   1);
  perform public.seed_add_exercise(v_day, 'przysiad-ze-sztanga', 4, '5-6',   2);
  perform public.seed_add_exercise(v_day, 'wypady',              3, '8/nogę', 3);
  perform public.seed_add_exercise(v_day, 'box-jump',            3, '5',     4);

  insert into public.workout_days (phase_id, name, short_label, description, day_type, tracks_knee_pain, order_index)
  values (v_f2, 'Faza 2 — MMA-specific', 'MMA',
          'Moc rotacyjna, chwyt i mobilność pod walkę w parterze.', 'mma', false, 2)
  returning id into v_day;

  perform public.seed_add_exercise(v_day, 'rzuty-pilka-lekarska-rotacyjne', 3, '8/stronę',   1);
  perform public.seed_add_exercise(v_day, 'rotacje-kettlebell',             3, '10/stronę',  2);
  perform public.seed_add_exercise(v_day, 'spacer-farmera',                 3, '30-40m',     3);
  perform public.seed_add_exercise(v_day, 'wisy-na-drazku',                 3, '20-30s',     4);
  perform public.seed_add_exercise(v_day, 'deep-squat-hold',                2, '30-40s',     5);
  perform public.seed_add_exercise(v_day, 'stretch-90-90',                  2, '30s/stronę', 6);

  raise notice 'Szablon planu utworzony: %', v_plan;
end;
$$;

drop function if exists public.seed_add_exercise(uuid, text, integer, text, integer, text);
