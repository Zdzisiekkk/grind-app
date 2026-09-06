-- ============================================================
-- Grind — Migracja 0061: aktywność liczy się jako trening
--
-- Kto biega pięć razy w tygodniu, widział dotąd w Health Score "0 z 4
-- zaplanowanych treningów" i nie dostawał ani jednego punktu doświadczenia.
-- Aktywności żyły w osobnej tabeli i osobnej rubryce podsumowania, więc
-- z punktu widzenia aplikacji taki człowiek nie trenował wcale.
--
-- Od teraz wystarczająco poważna aktywność zakłada wpis w historii treningów.
-- Wpis jest POWIĄZANY z aktywnością (kolumna `activity_id`), a nie kopiowany
-- na ślepo - dzięki temu edycja aktywności aktualizuje sesję, a usunięcie
-- jej ją kasuje. Bez tego powiązania każda poprawka czasu zostawiałaby
-- w historii osierocony trening, którego nie da się usunąć z żadnego ekranu.
--
-- Progi (patrz `private.aktywnosc_jest_treningiem`):
--   - spacer nigdy nie jest treningiem - dziesięć minut do sklepu to nie
--     jest to samo co interwały,
--   - reszta liczy się od 20 minut w górę.
--
-- Uwaga o podwójnym liczeniu: kto po siłowni zapisze też "trening MMA" jako
-- aktywność, dostanie dwa wpisy. To świadomie zostawiamy - aplikacja nie ma
-- jak zgadnąć, czy to była ta sama jednostka treningowa, czy dwie różne,
-- a zgadywanie kasowałoby ludziom prawdziwe treningi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Powiązanie sesji z aktywnością
-- ------------------------------------------------------------
alter table public.workout_sessions
  add column if not exists activity_id uuid
    references public.activities (id) on delete cascade;

-- Jedna aktywność to najwyżej jedna sesja. Unikalność zamiast wiary w to,
-- że wyzwalacz nigdy nie odpali się dwa razy.
create unique index if not exists workout_sessions_activity_uniq
  on public.workout_sessions (activity_id)
  where activity_id is not null;

comment on column public.workout_sessions.activity_id is
  'Sesja powstała z aktywności (0061). null = zwykły trening z planu.';

-- ------------------------------------------------------------
-- 2. Które aktywności są treningiem
-- ------------------------------------------------------------
create or replace function private.aktywnosc_jest_treningiem(
  p_type text,
  p_duration_min integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_type is distinct from 'walking'
     and coalesce(p_duration_min, 0) >= 20;
$$;

revoke all on function private.aktywnosc_jest_treningiem(text, integer)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Wyzwalacz utrzymujący sesję w zgodzie z aktywnością
-- ------------------------------------------------------------
create or replace function private.aktywnosc_do_treningu()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_nazwa text;
begin
  -- Aktywność przestała się kwalifikować (ktoś skrócił czas albo zmienił typ
  -- na spacer): sesja ma zniknąć razem z powodem swojego istnienia.
  if not private.aktywnosc_jest_treningiem(new.type, new.duration_min) then
    delete from public.workout_sessions where activity_id = new.id;
    return new;
  end if;

  v_nazwa := case
    when new.type = 'other' then coalesce(nullif(btrim(new.custom_type), ''), 'Aktywność')
    when new.type = 'running' then 'Bieganie'
    when new.type = 'cycling' then 'Rower'
    when new.type = 'swimming' then 'Pływanie'
    when new.type = 'mma_sparring' then 'Sparing'
    when new.type = 'mma_training' then 'Trening MMA'
    when new.type = 'rowing' then 'Wioślarstwo'
    when new.type = 'hiking' then 'Wędrówka'
    when new.type = 'climbing' then 'Wspinaczka'
    else 'Aktywność'
  end;

  insert into public.workout_sessions
    (user_id, activity_id, day_label, date, started_at, finished_at, duration_min, notes)
  values (
    new.user_id,
    new.id,
    v_nazwa,
    new.date,
    coalesce(new.started_at, new.date::timestamptz),
    -- Koniec MUSI być ustawiony. Pulpit rozpoznaje trwający trening po
    -- pustym `finished_at` i bez tego każde bieganie wyglądałoby jak sesja,
    -- której ktoś zapomniał zamknąć.
    coalesce(new.started_at, new.date::timestamptz) + make_interval(mins => new.duration_min),
    new.duration_min,
    new.notes
  )
  on conflict (activity_id) where activity_id is not null do update set
    day_label    = excluded.day_label,
    date         = excluded.date,
    started_at   = excluded.started_at,
    finished_at  = excluded.finished_at,
    duration_min = excluded.duration_min,
    notes        = excluded.notes;

  return new;
end;
$$;

revoke all on function private.aktywnosc_do_treningu() from public, anon, authenticated;

drop trigger if exists activities_do_treningu on public.activities;
create trigger activities_do_treningu
  after insert or update of type, custom_type, date, started_at, duration_min, notes
  on public.activities
  for each row execute function private.aktywnosc_do_treningu();

-- ------------------------------------------------------------
-- 4. Aktywności zapisane wcześniej
--
-- Bez tego kroku zmiana działałaby tylko na przyszłość, a historia dalej
-- twierdziłaby, że człowiek nie trenował - czyli dokładnie ten problem,
-- który migracja ma rozwiązać.
-- ------------------------------------------------------------
insert into public.workout_sessions
  (user_id, activity_id, day_label, date, started_at, finished_at, duration_min, notes)
select
  a.user_id,
  a.id,
  case
    when a.type = 'other' then coalesce(nullif(btrim(a.custom_type), ''), 'Aktywność')
    when a.type = 'running' then 'Bieganie'
    when a.type = 'cycling' then 'Rower'
    when a.type = 'swimming' then 'Pływanie'
    when a.type = 'mma_sparring' then 'Sparing'
    when a.type = 'mma_training' then 'Trening MMA'
    when a.type = 'rowing' then 'Wioślarstwo'
    when a.type = 'hiking' then 'Wędrówka'
    when a.type = 'climbing' then 'Wspinaczka'
    else 'Aktywność'
  end,
  a.date,
  coalesce(a.started_at, a.date::timestamptz),
  coalesce(a.started_at, a.date::timestamptz) + make_interval(mins => a.duration_min),
  a.duration_min,
  a.notes
from public.activities a
where private.aktywnosc_jest_treningiem(a.type, a.duration_min)
on conflict (activity_id) where activity_id is not null do nothing;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_akt  uuid;
  v_ile  integer;
  v_koniec timestamptz;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0061@grind.local')
    returning id into v_user;

  -- Spacer nie jest treningiem, choćby trwał trzy godziny.
  insert into public.activities (user_id, type, duration_min)
       values (v_user, 'walking', 180) returning id into v_akt;
  select count(*) into v_ile from public.workout_sessions where activity_id = v_akt;
  if v_ile <> 0 then
    raise exception 'Migracja 0061: spacer utworzył trening';
  end if;

  -- Krótkie bieganie też nie.
  insert into public.activities (user_id, type, duration_min)
       values (v_user, 'running', 10) returning id into v_akt;
  select count(*) into v_ile from public.workout_sessions where activity_id = v_akt;
  if v_ile <> 0 then
    raise exception 'Migracja 0061: 10 minut biegania utworzyło trening';
  end if;

  -- Wydłużenie tej samej aktywności ponad próg ma dołożyć sesję.
  update public.activities set duration_min = 45 where id = v_akt;
  select count(*), max(finished_at) into v_ile, v_koniec
    from public.workout_sessions where activity_id = v_akt;
  if v_ile <> 1 then
    raise exception 'Migracja 0061: wydłużone bieganie nie utworzyło treningu';
  end if;
  if v_koniec is null then
    raise exception 'Migracja 0061: sesja bez finished_at wygląda jak trwający trening';
  end if;
  if (select day_label from public.workout_sessions where activity_id = v_akt) <> 'Bieganie' then
    raise exception 'Migracja 0061: sesja nie dostała nazwy aktywności';
  end if;

  -- Skrócenie poniżej progu ma ją zabrać.
  update public.activities set duration_min = 5 where id = v_akt;
  select count(*) into v_ile from public.workout_sessions where activity_id = v_akt;
  if v_ile <> 0 then
    raise exception 'Migracja 0061: skrócona aktywność zostawiła trening';
  end if;

  -- Usunięcie aktywności kasuje sesję (kaskada po kluczu obcym).
  update public.activities set duration_min = 60 where id = v_akt;
  delete from public.activities where id = v_akt;
  select count(*) into v_ile from public.workout_sessions where activity_id = v_akt;
  if v_ile <> 0 then
    raise exception 'Migracja 0061: usunięta aktywność zostawiła osierocony trening';
  end if;

  -- Zwykły trening z planu dalej działa i nie ma powiązania z aktywnością.
  insert into public.workout_sessions (user_id, day_label) values (v_user, 'Push A');
  if (select activity_id from public.workout_sessions
       where user_id = v_user and day_label = 'Push A') is not null then
    raise exception 'Migracja 0061: zwykły trening dostał activity_id';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
