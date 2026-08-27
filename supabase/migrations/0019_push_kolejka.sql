-- ============================================================
-- Grind — Migracja 0019: co i komu wysłać
--
-- Godziny przypomnień („22:00") są czasem lokalnym człowieka, a serwer żyje
-- w UTC. Bez strefy czasowej przypomnienie o porze snu przychodziłoby
-- w Polsce o północy latem i o 23:00 zimą. Dlatego profil dostaje strefę,
-- ustawianą z przeglądarki przy pierwszym wejściu.
-- ============================================================

alter table public.profiles
  add column if not exists timezone text not null default 'Europe/Warsaw';

-- ------------------------------------------------------------
-- Co jest wymagalne w tej chwili
-- ------------------------------------------------------------
/**
 * Zwraca powiadomienia do wysłania i OD RAZU je zaklepuje w push_sent.
 *
 * Zaklepanie przed wysyłką, a nie po, jest świadomym wyborem: cron potrafi
 * odpalić się dwa razy albo serwer odpowiedzieć z opóźnieniem, a powiadomienie
 * wysłane dwa razy jest gorsze niż niewysłane. Przy błędzie wysyłki tracimy
 * jedno przypomnienie — przy podwójnej wysyłce tracimy zaufanie.
 *
 * Okno wymagalności to 15 minut, tyle samo co odstęp między uruchomieniami
 * budzika: nic nie wypadnie między jednym a drugim.
 */
create or replace function private.push_due(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
  v_out    jsonb := '[]'::jsonb;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    return '[]'::jsonb;
  end if;

  with subs as (
    select s.user_id, s.endpoint, s.p256dh, s.auth,
           p.timezone, p.daily_water_ml, p.water_portion_ml,
           p.water_reminder_from, p.water_reminder_to, p.water_reminder_every_min,
           p.sleep_reminder_at, p.sleep_goal_min,
           (now() at time zone coalesce(nullif(p.timezone, ''), 'Europe/Warsaw'))            as local_now,
           (now() at time zone coalesce(nullif(p.timezone, ''), 'Europe/Warsaw'))::date      as local_date,
           extract(hour from now() at time zone coalesce(nullif(p.timezone, ''), 'Europe/Warsaw'))::int * 60
             + extract(minute from now() at time zone coalesce(nullif(p.timezone, ''), 'Europe/Warsaw'))::int as local_min
      from public.push_subscriptions s
      join public.profiles p on p.id = s.user_id
     where s.failures < 5
  ),

  -- Nawyk: wypada dziś, ma godzinę, jeszcze nie odhaczony.
  habit_due as (
    select s.user_id, s.endpoint, s.p256dh, s.auth,
           'habit:' || h.id           as key,
           'Grind — nawyk'            as title,
           h.icon || ' ' || h.name    as body,
           '/nawyki'                  as url,
           s.local_date
      from subs s
      join public.habits h on h.user_id = s.user_id
     where not h.is_archived
       and h.reminder_at is not null
       and (cardinality(h.days_of_week) = 0
            or extract(isodow from s.local_date)::smallint = any(h.days_of_week))
       and (extract(hour from h.reminder_at)::int * 60 + extract(minute from h.reminder_at)::int)
             between s.local_min - 14 and s.local_min
       and coalesce(
             (select l.count from public.habit_logs l
               where l.habit_id = h.id and l.date = s.local_date), 0
           ) < h.target_per_day
  ),

  -- Woda: w oknie godzinowym, poniżej celu, jeden slot na interwał.
  water_due as (
    select s.user_id, s.endpoint, s.p256dh, s.auth,
           'water:' || floor(
             (s.local_min - (extract(hour from coalesce(s.water_reminder_from, '08:00'::time))::int * 60
                             + extract(minute from coalesce(s.water_reminder_from, '08:00'::time))::int))
             / s.water_reminder_every_min
           )::text                    as key,
           'Grind — nawodnienie'      as title,
           'Czas na wodę 💧'          as body,
           '/dieta'                   as url,
           s.local_date
      from subs s
     where s.water_reminder_every_min is not null
       and s.local_min >= extract(hour from coalesce(s.water_reminder_from, '08:00'::time))::int * 60
                        + extract(minute from coalesce(s.water_reminder_from, '08:00'::time))::int
       and s.local_min <= extract(hour from coalesce(s.water_reminder_to, '22:00'::time))::int * 60
                        + extract(minute from coalesce(s.water_reminder_to, '22:00'::time))::int
       and coalesce(
             (select sum(w.ml) from public.water_logs w
               where w.user_id = s.user_id and w.date = s.local_date), 0
           ) < coalesce(s.daily_water_ml, 2500)
  ),

  -- Pora spać: raz, w oknie kwadransa po ustawionej godzinie.
  sleep_due as (
    select s.user_id, s.endpoint, s.p256dh, s.auth,
           'sleep'                    as key,
           'Grind — pora spać'        as title,
           'Cel na dziś: ' || (coalesce(s.sleep_goal_min, 480) / 60) || ' h snu 😴' as body,
           '/sen'                     as url,
           s.local_date
      from subs s
     where s.sleep_reminder_at is not null
       and (extract(hour from s.sleep_reminder_at)::int * 60
            + extract(minute from s.sleep_reminder_at)::int)
             between s.local_min - 14 and s.local_min
  ),

  wszystkie as (
    select * from habit_due
    union all select * from water_due
    union all select * from sleep_due
  ),

  -- Zaklepanie: konflikt znaczy „już poszło", więc wypada z listy do wysyłki.
  zaklepane as (
    insert into public.push_sent (user_id, key, date)
    select distinct user_id, key, local_date from wszystkie
    on conflict (user_id, key, date) do nothing
    returning user_id, key
  )

  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'user_id',  w.user_id,
           'endpoint', w.endpoint,
           'p256dh',   w.p256dh,
           'auth',     w.auth,
           'key',      w.key,
           'title',    w.title,
           'body',     w.body,
           'url',      w.url
         )), '[]'::jsonb)
    into v_out
    from wszystkie w
    join zaklepane z on z.user_id = w.user_id and z.key = w.key;

  return v_out;
end;
$$;

/**
 * Zgłoszenie nieudanej wysyłki. Po pięciu z rzędu subskrypcja wypada
 * z obiegu — najczęściej znaczy to, że ktoś odinstalował aplikację.
 */
create or replace function private.push_failed(p_secret text, p_endpoint text, p_gone boolean)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then return; end if;

  if p_gone then
    -- 404/410 od dostawcy znaczy, że subskrypcja nie istnieje. Trzymanie jej
    -- to wysyłanie w próżnię przy każdym uruchomieniu.
    delete from public.push_subscriptions where endpoint = p_endpoint;
  else
    update public.push_subscriptions set failures = failures + 1 where endpoint = p_endpoint;
  end if;
end;
$$;

/** Udana wysyłka zeruje licznik porażek. */
create or replace function private.push_ok(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then return; end if;
  update public.push_subscriptions
     set failures = 0, last_ok_at = now()
   where endpoint = p_endpoint;
end;
$$;
