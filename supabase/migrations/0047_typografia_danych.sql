-- ============================================================
-- 0047: typografia w danych wsianych przez migracje
--
-- Migracje 0004-0035 wsiały do bazy teksty z pauzą, półpauzą i polskimi
-- cudzysłowami: nazwy dni planu, opisy techniki, wskazówki i błędy przy
-- ćwiczeniach. Kod i dokumenty przeszły już na znaki ASCII, więc bez tej
-- migracji aplikacja pokazywałaby obok siebie dwa różne myślniki.
--
-- Starych plików nie ruszamy - zasada mówi, że migracje się dopisuje.
-- Dlatego podmiana idzie osobnym numerem, na danych, które już są w bazie.
--
-- ZAKRES: wyłącznie wiersze z user_id is null, czyli katalog ćwiczeń,
-- szablony planów i plan administratora (tak właśnie RLS rozpoznaje treści
-- należące do aplikacji, a nie do konta). Notatki, nazwy nawyków i cokolwiek
-- innego wpisanego przez zarejestrowane osoby zostaje nietknięte - to ich
-- tekst, nie nasz, i nikt nas nie prosił o poprawianie im pisowni.
--
-- translate() podmienia znaki jeden do jednego, więc mieści całą pauzę,
-- półpauzę i trzy odmiany cudzysłowu w jednym wywołaniu. Wielokropek idzie
-- osobno przez replace(), bo rozwija się do trzech kropek.
-- ============================================================

-- ------------------------------------------------------------
-- Katalog ćwiczeń: opisy, wskazówki i typowe błędy
-- ------------------------------------------------------------

update public.exercise_catalog set
  name        = replace(translate(name,        '—–„”“', '--"""'), '…', '...'),
  description = replace(translate(description, '—–„”“', '--"""'), '…', '...'),
  category    = replace(translate(category,    '—–„”“', '--"""'), '…', '...'),
  cues = (
    select array(select replace(translate(c, '—–„”“', '--"""'), '…', '...') from unnest(cues) as c)
  ),
  mistakes = (
    select array(select replace(translate(m, '—–„”“', '--"""'), '…', '...') from unnest(mistakes) as m)
  )
where user_id is null
  and (
    name || coalesce(description, '') || coalesce(category, '')
      || array_to_string(cues, ' ') || array_to_string(mistakes, ' ')
  ) ~ '[—–„”“…]';

-- ------------------------------------------------------------
-- Plany, fazy, dni i ćwiczenia w dniach
-- ------------------------------------------------------------

update public.plans set
  name        = replace(translate(name,        '—–„”“', '--"""'), '…', '...'),
  description = replace(translate(description, '—–„”“', '--"""'), '…', '...'),
  goal        = replace(translate(goal,        '—–„”“', '--"""'), '…', '...')
where user_id is null
  and (name || coalesce(description, '') || coalesce(goal, '')) ~ '[—–„”“…]';

update public.phases p set
  name        = replace(translate(p.name,        '—–„”“', '--"""'), '…', '...'),
  description = replace(translate(p.description, '—–„”“', '--"""'), '…', '...'),
  frequency   = replace(translate(p.frequency,   '—–„”“', '--"""'), '…', '...')
from public.plans pl
where pl.id = p.plan_id
  and pl.user_id is null
  and (p.name || coalesce(p.description, '') || coalesce(p.frequency, '')) ~ '[—–„”“…]';

update public.workout_days d set
  name        = replace(translate(d.name,        '—–„”“', '--"""'), '…', '...'),
  short_label = replace(translate(d.short_label, '—–„”“', '--"""'), '…', '...'),
  description = replace(translate(d.description, '—–„”“', '--"""'), '…', '...')
from public.phases p
join public.plans pl on pl.id = p.plan_id
where p.id = d.phase_id
  and pl.user_id is null
  and (d.name || coalesce(d.short_label, '') || coalesce(d.description, '')) ~ '[—–„”“…]';

update public.workout_exercises we set
  name_override   = replace(translate(we.name_override,   '—–„”“', '--"""'), '…', '...'),
  muscle_group    = replace(translate(we.muscle_group,    '—–„”“', '--"""'), '…', '...'),
  target_reps     = replace(translate(we.target_reps,     '—–„”“', '--"""'), '…', '...'),
  target_note     = replace(translate(we.target_note,     '—–„”“', '--"""'), '…', '...'),
  technique_notes = replace(translate(we.technique_notes, '—–„”“', '--"""'), '…', '...')
from public.workout_days d
join public.phases p on p.id = d.phase_id
join public.plans pl on pl.id = p.plan_id
where d.id = we.workout_day_id
  and pl.user_id is null
  and (
    coalesce(we.name_override, '') || coalesce(we.muscle_group, '')
      || coalesce(we.target_reps, '') || coalesce(we.target_note, '')
      || coalesce(we.technique_notes, '')
  ) ~ '[—–„”“…]';

-- ------------------------------------------------------------
-- Sprawdzenie: czy migracja zrobiła to, co obiecuje
-- ------------------------------------------------------------

do $$
declare
  v_katalog integer;
  v_plany   integer;
  v_dni     integer;
begin
  select count(*) into v_katalog
  from public.exercise_catalog
  where user_id is null
    and (
      name || coalesce(description, '') || coalesce(category, '')
        || array_to_string(cues, ' ') || array_to_string(mistakes, ' ')
    ) ~ '[—–„”“…]';

  select count(*) into v_plany
  from public.plans
  where user_id is null
    and (name || coalesce(description, '') || coalesce(goal, '')) ~ '[—–„”“…]';

  select count(*) into v_dni
  from public.workout_days d
  join public.phases p on p.id = d.phase_id
  join public.plans pl on pl.id = p.plan_id
  where pl.user_id is null
    and (d.name || coalesce(d.short_label, '') || coalesce(d.description, '')) ~ '[—–„”“…]';

  if v_katalog > 0 or v_plany > 0 or v_dni > 0 then
    raise exception
      'Migracja 0047: typografia została w danych (katalog: %, plany: %, dni: %)',
      v_katalog, v_plany, v_dni;
  end if;
end $$;
