-- ============================================================
-- Grind — Migracja 0062: noc, której nie było
--
-- Dziennik snu wymagał godziny zaśnięcia, godziny pobudki i oceny jakości.
-- Po nocy przespanej w całości - na dyżurze, przy dziecku, po prostu
-- bezsennej - nie było czego wpisać, więc taki dzień zostawał pusty.
-- A pusty dzień w statystykach znaczy "nie zapisałem", nie "nie spałem" -
-- czyli dokładnie odwrotność prawdy.
--
-- Flaga `bezsenna` zamyka tę lukę. Godziny i jakość zostają obowiązkowe
-- (formularz wysyła zera), ale zyskują znaczenie: to nie jest noc trwająca
-- zero minut przez pomyłkę, tylko świadomie odnotowany brak snu.
--
-- Decyzja właściciela: taka noc dostaje wynik 0 i liczy się do wszystkiego -
-- do średnich, do trendów, do regularności. Bez wyjątków i bez chowania.
-- ============================================================

alter table public.sleep_logs
  add column if not exists bezsenna boolean not null default false;

comment on column public.sleep_logs.bezsenna is
  'Noc bez snu - wynik 0, godziny nieistotne (0062).';

-- Widok musi przenieść flagę dalej, bo to z niego czytają ekrany i wynik snu.
--
-- Odtwarzamy go w postaci, jaką ma DZIŚ w bazie (drzemki wyjechały do
-- osobnej tabeli w 0041 i dochodzą tu złączeniem bocznym), a nie w tej
-- z migracji 0010. Przepisanie starej wersji skasowałoby drzemki z widoku
-- i wywaliło ekran snu - kolumna `nap_min` nie istnieje już w `sleep_logs`.
-- CREATE OR REPLACE VIEW nie pozwala zmieniać ani przestawiać istniejących
-- kolumn, więc `bezsenna` dochodzi na samym końcu.
create or replace view public.v_sleep
with (security_invoker = on) as
  select
    s.user_id,
    s.date,
    s.bedtime,
    s.wake_time,
    s.time_in_bed_min,
    -- Noc bezsenna to zero minut snu niezależnie od tego, co stoi
    -- w godzinach. Liczenie tego tutaj oszczędza każdemu ekranowi
    -- osobnego "jeśli bezsenna, to zero".
    case when s.bezsenna then 0
         else greatest(0, s.time_in_bed_min - s.fell_asleep_min - s.awake_min)
    end as sleep_min,
    s.fell_asleep_min,
    s.awakenings,
    s.awake_min,
    s.quality,
    s.morning_energy,
    coalesce(d.suma, 0::bigint)::integer as nap_min,
    s.factors,
    s.note,
    coalesce(d.ile, 0::bigint)::integer as nap_count,
    coalesce(d.lista, '[]'::jsonb) as naps,
    s.bezsenna
  from public.sleep_logs s
  left join lateral (
    select sum(n.minutes) as suma,
           count(*) as ile,
           jsonb_agg(
             jsonb_build_object('minutes', n.minutes, 'start_time', n.start_time)
             order by n.start_time, n.created_at
           ) as lista
      from public.sleep_naps n
     where n.user_id = s.user_id and n.date = s.date
  ) d on true;

grant select on public.v_sleep to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_sen  integer;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sleep_logs' and column_name = 'bezsenna'
  ) then
    raise exception 'Migracja 0062: brak kolumny sleep_logs.bezsenna';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'v_sleep' and column_name = 'bezsenna'
  ) then
    raise exception 'Migracja 0062: widok v_sleep nie przenosi flagi';
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0062@grind.local')
    returning id into v_user;

  -- Zwykła noc liczy się jak dotąd.
  insert into public.sleep_logs (user_id, date, bedtime, wake_time, quality)
       values (v_user, current_date - 1, '23:00', '07:00', 4);
  select sleep_min into v_sen from public.v_sleep
   where user_id = v_user and date = current_date - 1;
  if v_sen <> 465 then
    raise exception 'Migracja 0062: zwykła noc liczy % minut zamiast 465', v_sen;
  end if;

  -- Bezsenna daje zero, choćby godziny mówiły co innego.
  insert into public.sleep_logs (user_id, date, bedtime, wake_time, quality, bezsenna)
       values (v_user, current_date, '23:00', '07:00', 1, true);
  select sleep_min into v_sen from public.v_sleep
   where user_id = v_user and date = current_date;
  if v_sen <> 0 then
    raise exception 'Migracja 0062: noc bezsenna liczy % minut zamiast 0', v_sen;
  end if;

  -- I nie znika z historii - ma być widoczna jako fakt.
  if (select count(*) from public.v_sleep where user_id = v_user) <> 2 then
    raise exception 'Migracja 0062: bezsenna noc wypadła z historii';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
