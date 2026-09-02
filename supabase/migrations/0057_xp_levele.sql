-- ============================================================
-- Grind — Migracja 0057: punkty doświadczenia i levele
--
-- XP przyznaje BAZA, wyzwalaczami na tabelach dziennika - nie klient.
-- Klient, który mógłby przyznawać sobie punkty, przyznawałby ich milion.
-- Użytkownik ma do swojego XP wyłącznie prawo odczytu.
--
-- Zasady:
--  - każde źródło ma stawkę i dzienny sufit (nie da się farmić 50 szklanek
--    wody ani wpisywać treningu dziesięć razy),
--  - krzywa leveli: poziom = floor((xp/100)^(2/3)) - pierwsze levele wpadają
--    szybko, późniejsze coraz wolniej; dokładnie ta sama formuła siedzi
--    w src/lib/xp.ts i test porównuje obie,
--  - co 5. level daje 3 dni planu Starter gratis, co 10. - 3 dni Pro
--    (tabela bonus_plan z 0056); nagroda za dany level przysługuje raz,
--  - błąd w naliczaniu XP NIGDY nie może zablokować zapisu treningu czy
--    posiłku - wyzwalacze łykają własne wyjątki.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela zdarzeń XP - jeden wiersz na (osoba, dzień, źródło)
-- ------------------------------------------------------------
create table if not exists public.xp_zdarzenia (
  user_id    uuid not null references auth.users (id) on delete cascade,
  dzien      date not null,
  zrodlo     text not null,
  xp         integer not null default 0 check (xp >= 0),
  /** Ile razy źródło wystąpiło - do egzekwowania dziennego sufitu. */
  wystapien  integer not null default 1,
  primary key (user_id, dzien, zrodlo)
);

alter table public.xp_zdarzenia enable row level security;

drop policy if exists xp_owner_read on public.xp_zdarzenia;
create policy xp_owner_read on public.xp_zdarzenia
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.xp_zdarzenia from public, anon, authenticated;
grant select on public.xp_zdarzenia to authenticated;

-- Nagroda za konkretny level przysługuje raz - także wtedy, gdy ktoś
-- spadłby i wszedł na ten sam level drugi raz (dziś się nie da, ale
-- unikalność w danych jest tańsza niż wiara w kod).
create unique index if not exists bonus_plan_xp_raz
  on public.bonus_plan (user_id, zrodlo)
  where zrodlo like 'xp_level_%';

-- ------------------------------------------------------------
-- 2. Krzywa leveli - jedna formuła dla bazy i aplikacji
-- ------------------------------------------------------------
create or replace function public.xp_poziom(p_xp integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_xp, 0) < 100 then 0
    else floor(power(p_xp / 100.0, 2.0 / 3.0) + 1e-9)::integer
  end;
$$;

revoke all on function public.xp_poziom(integer) from public, anon;
grant execute on function public.xp_poziom(integer) to authenticated;

-- ------------------------------------------------------------
-- 3. Przyznawanie XP (tylko z wyzwalaczy)
-- ------------------------------------------------------------
create or replace function private.xp_przyznaj(p_user uuid, p_zrodlo text, p_dzien date)
returns void
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_stawka integer;
  v_cap    integer;
  v_przed  integer;
  v_po     integer;
  v_l      integer;
begin
  select stawka, cap into v_stawka, v_cap
    from (values
      ('trening', 25, 2),
      ('nawyk',    5, 10),
      ('dieta',    5, 4),
      ('woda',    10, 1),
      ('sen',     10, 1),
      ('ksiazka', 50, 2),
      ('skan',    30, 1)
    ) as stawki (zrodlo, stawka, cap)
   where zrodlo = p_zrodlo;

  -- Nieznane źródło to błąd wołającego, nie okazja do punktów.
  if v_stawka is null or p_user is null then return; end if;

  select coalesce(sum(xp), 0) into v_przed
    from public.xp_zdarzenia where user_id = p_user;

  insert into public.xp_zdarzenia as x (user_id, dzien, zrodlo, xp, wystapien)
  values (p_user, coalesce(p_dzien, current_date), p_zrodlo, v_stawka, 1)
  on conflict (user_id, dzien, zrodlo) do update
    set wystapien = x.wystapien + 1,
        xp = x.xp + case when x.wystapien < v_cap then v_stawka else 0 end;

  select coalesce(sum(xp), 0) into v_po
    from public.xp_zdarzenia where user_id = p_user;

  -- Nagrody za przekroczone levele. Pętla, bo jedno zdarzenie może
  -- przeskoczyć kilka leveli naraz (książka +50 przy niskim XP).
  for v_l in public.xp_poziom(v_przed) + 1 .. public.xp_poziom(v_po) loop
    if v_l % 5 = 0 then
      insert into public.bonus_plan (user_id, plan, do_kiedy, zrodlo)
      values (
        p_user,
        case when v_l % 10 = 0 then 'pro' else 'starter' end,
        now() + interval '3 days',
        'xp_level_' || v_l
      )
      on conflict (user_id, zrodlo) where zrodlo like 'xp_level_%' do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function private.xp_przyznaj(uuid, text, date) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Wyzwalacze na tabelach dziennika
-- ------------------------------------------------------------
/**
 * Wspólny wyzwalacz: źródło w TG_ARGV, dzień z kolumny `date` wiersza
 * (przez to_jsonb, bo nie każda tabela ją ma - wtedy bieżąca data).
 * Wyjątek naliczania nie może wywrócić zapisu danych, stąd pusty handler.
 */
create or replace function private.xp_tg()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_dzien date;
begin
  begin
    v_dzien := coalesce((to_jsonb(new) ->> 'date')::date, current_date);

    -- Woda punktuje dopiero w chwili osiągnięcia dziennego celu.
    if tg_argv[0] = 'woda' then
      if (select coalesce(sum(ml), 0) from public.water_logs
           where user_id = new.user_id and date = v_dzien)
         < coalesce((select daily_water_ml from public.profiles where id = new.user_id), 2000)
      then
        return new;
      end if;
    end if;

    -- Książka punktuje wyłącznie za dojście do stanu "przeczytana".
    if tg_argv[0] = 'ksiazka' and (to_jsonb(new) ->> 'status') is distinct from 'read' then
      return new;
    end if;

    perform private.xp_przyznaj(new.user_id, tg_argv[0], v_dzien);
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function private.xp_tg() from public, anon, authenticated;

drop trigger if exists xp_trening on public.workout_sessions;
create trigger xp_trening after insert on public.workout_sessions
  for each row execute function private.xp_tg('trening');

drop trigger if exists xp_nawyk on public.habit_logs;
create trigger xp_nawyk after insert on public.habit_logs
  for each row execute function private.xp_tg('nawyk');

drop trigger if exists xp_dieta on public.meals;
create trigger xp_dieta after insert on public.meals
  for each row execute function private.xp_tg('dieta');

drop trigger if exists xp_woda on public.water_logs;
create trigger xp_woda after insert on public.water_logs
  for each row execute function private.xp_tg('woda');

drop trigger if exists xp_sen on public.sleep_logs;
create trigger xp_sen after insert on public.sleep_logs
  for each row execute function private.xp_tg('sen');

drop trigger if exists xp_skan on public.wyglad_skany;
create trigger xp_skan after insert on public.wyglad_skany
  for each row execute function private.xp_tg('skan');

-- Książka: i świeży wpis od razu "read", i późniejsze skończenie lektury.
drop trigger if exists xp_ksiazka_ins on public.books;
create trigger xp_ksiazka_ins after insert on public.books
  for each row execute function private.xp_tg('ksiazka');

drop trigger if exists xp_ksiazka_upd on public.books;
create trigger xp_ksiazka_upd after update of status on public.books
  for each row
  when (new.status = 'read' and old.status is distinct from 'read')
  execute function private.xp_tg('ksiazka');

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  -- Użytkownik może XP tylko czytać.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'xp_zdarzenia'
       and grantee in ('anon', 'authenticated')
       and privilege_type <> 'SELECT'
  ) then
    raise exception 'Migracja 0057: xp_zdarzenia ma nadmiarowe uprawnienia';
  end if;

  -- Wszystkie wyzwalacze stoją.
  select count(*) into v_n from pg_trigger
   where tgname in ('xp_trening', 'xp_nawyk', 'xp_dieta', 'xp_woda', 'xp_sen',
                    'xp_skan', 'xp_ksiazka_ins', 'xp_ksiazka_upd');
  if v_n <> 8 then
    raise exception 'Migracja 0057: jest % wyzwalaczy XP, ma być 8', v_n;
  end if;

  -- Krzywa: brzegi się zgadzają z src/lib/xp.ts.
  if public.xp_poziom(0) <> 0 or public.xp_poziom(99) <> 0
     or public.xp_poziom(100) <> 1 or public.xp_poziom(283) <> 2
     or public.xp_poziom(1118) <> 4 or public.xp_poziom(1119) <> 5
     or public.xp_poziom(3162) <> 9 or public.xp_poziom(3163) <> 10
  then
    raise exception 'Migracja 0057: krzywa leveli nie zgadza się z oczekiwaną';
  end if;

  -- Nagrody: unikalność na wypadek podwójnego naliczenia.
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'bonus_plan_xp_raz'
  ) then
    raise exception 'Migracja 0057: brak indeksu bonus_plan_xp_raz';
  end if;

  -- Przyznanie bez użytkownika lub z nieznanym źródłem nic nie robi
  -- (i przede wszystkim: nie rzuca - wyzwalacze na to liczą).
  perform private.xp_przyznaj(null, 'trening', current_date);
  perform private.xp_przyznaj(gen_random_uuid(), 'nie_ma_takiego', current_date);
end;
$$;
