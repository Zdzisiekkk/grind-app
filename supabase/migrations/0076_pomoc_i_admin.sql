-- ============================================================
-- Grind — Migracja 0076: samouczek, zgłoszenia i panel administratora
--
-- Trzy rzeczy, które łączy jedno: dotąd nie było gdzie ich postawić.
--
--   * SAMOUCZEK - stan przechowywany w profilu, nie w przeglądarce.
--     localStorage znika przy zmianie telefonu i przy trybie prywatnym,
--     więc samouczek wracałby ludziom, którzy go przeszli.
--
--   * ZGŁOSZENIA - z kontekstem technicznym zbieranym automatycznie.
--     Zgłoszenie "nie działa" bez wersji aplikacji i nazwy ekranu jest
--     nie do odtworzenia, a dopytywanie o to kończy się brakiem odpowiedzi.
--
--   * STATYSTYKI - wyłącznie przez funkcje z twardą bramką administratora.
--     Widok, do którego "tylko admin ma link", to nie jest zabezpieczenie.
--
-- Świadoma granica w panelu: administrator widzi METADANE kont - kiedy
-- założone, jaki plan, kiedy ostatnia aktywność, ile wpisów. NIE widzi
-- treści: wagi, posiłków, snu, kontuzji ani finansów. Do prowadzenia
-- aplikacji potrzebne są liczby o użyciu, a nie cudzy dziennik zdrowia,
-- i lepiej, żeby ta granica była w bazie niż w dobrych intencjach.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Stan samouczka
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists samouczek_stan text not null default 'nowy'
    check (samouczek_stan in ('nowy', 'pominiety', 'ukonczony'));

comment on column public.profiles.samouczek_stan is
  'nowy = pokazać przy wejściu; pominiety/ukonczony = tylko na życzenie (0076).';

-- Kto już używa aplikacji, nie jest nowym użytkownikiem. Samouczek zostaje
-- dla niego dostępny w Pomocy, ale nie zastawia drogi przy najbliższym wejściu.
update public.profiles set samouczek_stan = 'ukonczony' where onboarded_at is not null;

-- ------------------------------------------------------------
-- 2. Zgłoszenia
-- ------------------------------------------------------------
create table if not exists public.zgloszenia (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  typ        text not null default 'blad' check (typ in (
    'blad', 'propozycja', 'pytanie', 'platnosc', 'inne'
  )),
  tytul      text not null check (btrim(tytul) <> '' and length(tytul) <= 120),
  tresc      text not null check (btrim(tresc) <> '' and length(tresc) <= 4000),

  status     text not null default 'nowe' check (status in (
    'nowe', 'w_toku', 'rozwiazane', 'odrzucone'
  )),

  /* Kontekst techniczny - zbierany automatycznie, nie wpisywany przez człowieka. */
  strona     text,
  wersja     text,
  przegladarka text,

  /** Ostatnia aktywność w wątku - po niej sortuje się skrzynka. */
  odpowiedziano_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zgloszenia_status_idx on public.zgloszenia (status, created_at desc);
create index if not exists zgloszenia_user_idx on public.zgloszenia (user_id, created_at desc);

drop trigger if exists zgloszenia_set_updated_at on public.zgloszenia;
create trigger zgloszenia_set_updated_at
  before update on public.zgloszenia
  for each row execute function public.set_updated_at();

create table if not exists public.zgloszenia_odpowiedzi (
  id           uuid primary key default gen_random_uuid(),
  zgloszenie_id uuid not null references public.zgloszenia (id) on delete cascade,
  autor_id     uuid not null references auth.users (id) on delete cascade,
  /** Ustawiane przez trigger, nie przez klienta - inaczej każdy mógłby
      podszyć się pod odpowiedź obsługi. */
  od_admina    boolean not null default false,
  tresc        text not null check (btrim(tresc) <> '' and length(tresc) <= 4000),
  created_at   timestamptz not null default now()
);

create index if not exists zgloszenia_odpowiedzi_idx
  on public.zgloszenia_odpowiedzi (zgloszenie_id, created_at);

-- ------------------------------------------------------------
-- 3. Dostęp
-- ------------------------------------------------------------
alter table public.zgloszenia enable row level security;
alter table public.zgloszenia_odpowiedzi enable row level security;

drop policy if exists zgloszenia_owner on public.zgloszenia;
create policy zgloszenia_owner on public.zgloszenia
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists zgloszenia_admin on public.zgloszenia;
create policy zgloszenia_admin on public.zgloszenia
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/*
 * Dostęp do wątku: właściciel albo administrator. Funkcja zamiast podzapytania
 * w polityce, bo polityka nie może odpytać tabeli chronionej własnym RLS.
 * Zwraca `boolean`, nie identyfikator - odpowiedź "tak/nie" niczego nie zdradza.
 */
create or replace function public.zgloszenie_dostepne(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.zgloszenia z
     where z.id = p_id
       and (z.user_id = (select auth.uid()) or public.is_admin())
  );
$$;

revoke all on function public.zgloszenie_dostepne(uuid) from public, anon;
grant execute on function public.zgloszenie_dostepne(uuid) to authenticated;

drop policy if exists zgloszenia_odpowiedzi_dostep on public.zgloszenia_odpowiedzi;
create policy zgloszenia_odpowiedzi_dostep on public.zgloszenia_odpowiedzi
  for all to authenticated
  using (public.zgloszenie_dostepne(zgloszenie_id))
  with check (
    public.zgloszenie_dostepne(zgloszenie_id)
    and autor_id = (select auth.uid())
  );

grant select, insert, update, delete on public.zgloszenia to authenticated;
grant select, insert on public.zgloszenia_odpowiedzi to authenticated;

/*
 * Znacznik "od obsługi" nadaje baza. Gdyby ustawiał go klient, każdy mógłby
 * dopisać do własnego wątku odpowiedź wyglądającą na oficjalną - a potem
 * pokazać ją jako obietnicę zwrotu pieniędzy.
 */
create or replace function public.zgloszenie_odpowiedz_tg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.od_admina := public.is_admin();

  update public.zgloszenia
     set odpowiedziano_at = now(),
         -- Odpowiedź obsługi na nowe zgłoszenie znaczy, że ktoś się nim zajął.
         status = case when public.is_admin() and status = 'nowe' then 'w_toku' else status end
   where id = new.zgloszenie_id;

  return new;
end;
$$;

drop trigger if exists zgloszenia_odpowiedzi_znacznik on public.zgloszenia_odpowiedzi;
create trigger zgloszenia_odpowiedzi_znacznik
  before insert on public.zgloszenia_odpowiedzi
  for each row execute function public.zgloszenie_odpowiedz_tg();

-- ------------------------------------------------------------
-- 4. Statystyki aplikacji
--
-- "Aktywny" liczymy z rzeczywistych zapisów, a nie z logowań: otwarcie
-- aplikacji i porzucenie jej po dwóch sekundach to nie jest użycie.
-- ------------------------------------------------------------
create or replace function public.admin_statystyki()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wynik jsonb;
begin
  if not public.is_admin() then
    raise exception 'Panel administratora wymaga uprawnień administratora';
  end if;

  with aktywnosc as (
    select user_id, dzien from public.xp_zdarzenia
    union all
    select user_id, date as dzien from public.meals
    union all
    select user_id, date as dzien from public.workout_sessions
    union all
    select user_id, data as dzien from public.finanse_wydatki
  )
  select jsonb_build_object(
    'kont',            (select count(*) from public.profiles),
    'nowe_7d',         (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'nowe_30d',        (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'aktywni_1d',      (select count(distinct user_id) from aktywnosc where dzien >= current_date),
    'aktywni_7d',      (select count(distinct user_id) from aktywnosc where dzien > current_date - 7),
    'aktywni_30d',     (select count(distinct user_id) from aktywnosc where dzien > current_date - 30),
    'ukonczyli_start', (select count(*) from public.profiles where onboarded_at is not null),
    'subskrypcje', jsonb_build_object(
      'aktywne', (select count(*) from public.subscriptions
                   where status in ('active', 'trialing')
                     and (current_period_end is null or current_period_end > now())),
      'starter', (select count(*) from public.subscriptions
                   where status in ('active', 'trialing') and plan = 'starter'
                     and (current_period_end is null or current_period_end > now())),
      'pro',     (select count(*) from public.subscriptions
                   where status in ('active', 'trialing') and plan = 'pro'
                     and (current_period_end is null or current_period_end > now())),
      'probne',  (select count(*) from public.subscriptions where status = 'trialing'),
      'anulowane_na_koniec', (select count(*) from public.subscriptions
                               where cancel_at_period_end and status = 'active')
    ),
    'bonusy_aktywne', (select count(*) from public.bonus_plan
                        where do_kiedy is null or do_kiedy > now()),
    'zgloszenia', jsonb_build_object(
      'nowe',   (select count(*) from public.zgloszenia where status = 'nowe'),
      'w_toku', (select count(*) from public.zgloszenia where status = 'w_toku'),
      'razem',  (select count(*) from public.zgloszenia)
    ),
    'ai', jsonb_build_object(
      -- Kolumna nazywa się `utworzono`, nie `created_at` - jedyna taka
      -- w schemacie i dlatego łatwo się na niej potknąć.
      'koszt_30d_usd', (select coalesce(round(sum(coalesce(koszt_usd, szacunek_usd)), 2), 0)
                          from public.ai_wydatki where utworzono > now() - interval '30 days'),
      'wywolan_30d',   (select count(*) from public.ai_wydatki
                         where utworzono > now() - interval '30 days')
    ),
    'wpisy_7d', jsonb_build_object(
      'treningi', (select count(*) from public.workout_sessions where date > current_date - 7),
      'posilki',  (select count(*) from public.meals where date > current_date - 7),
      'wydatki',  (select count(*) from public.finanse_wydatki where data > current_date - 7)
    )
  ) into v_wynik;

  return v_wynik;
end;
$$;

revoke all on function public.admin_statystyki() from public, anon;
grant execute on function public.admin_statystyki() to authenticated;

-- ------------------------------------------------------------
-- 5. Użycie dzień po dniu - do wykresu
-- ------------------------------------------------------------
create or replace function public.admin_uzycie(p_dni integer default 30)
returns table (dzien date, aktywni integer, rejestracje integer)
language plpgsql
stable
security definer
set search_path = public
as $$
/*
 * Nazwy kolumn wynikowych (dzien, aktywni) są w plpgsql jednocześnie nazwami
 * zmiennych, więc `d.dzien` w zapytaniu staje się dwuznaczne. Ta dyrektywa
 * mówi wprost: w zapytaniach wygrywa kolumna.
 */
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Panel administratora wymaga uprawnień administratora';
  end if;

  return query
  with dni as (
    select d::date as dzien
      from generate_series(current_date - (greatest(1, least(p_dni, 180)) - 1),
                           current_date, interval '1 day') d
  ),
  aktywnosc as (
    select user_id, dzien from public.xp_zdarzenia
    union all
    select user_id, date from public.meals
    union all
    select user_id, date from public.workout_sessions
    union all
    select user_id, data from public.finanse_wydatki
  )
  select d.dzien,
         (select count(distinct a.user_id)::integer from aktywnosc a where a.dzien = d.dzien),
         (select count(*)::integer from public.profiles p
           where p.created_at::date = d.dzien)
    from dni d
   order by d.dzien;
end;
$$;

revoke all on function public.admin_uzycie(integer) from public, anon;
grant execute on function public.admin_uzycie(integer) to authenticated;

-- ------------------------------------------------------------
-- 6. Lista kont - METADANE, nie treść
--
-- Świadomie nie ma tu ani jednej kolumny z dziennika: ani wagi, ani posiłku,
-- ani finansów. Do prowadzenia aplikacji potrzeba wiedzieć, kto jej używa
-- i za co płaci, a nie co je na śniadanie.
-- ------------------------------------------------------------
create or replace function public.admin_uzytkownicy(p_limit integer default 100)
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  onboarded boolean,
  samouczek_stan text,
  plan_poziom integer,
  subskrypcja_status text,
  ostatnia_aktywnosc date,
  dni_aktywnych integer,
  xp integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
-- Jak wyżej: `id`, `email` i reszta to także nazwy zmiennych wynikowych.
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Panel administratora wymaga uprawnień administratora';
  end if;

  return query
  with aktywnosc as (
    select user_id, dzien from public.xp_zdarzenia
    union all
    select user_id, date from public.meals
    union all
    select user_id, date from public.workout_sessions
  )
  select
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.created_at,
    p.onboarded_at is not null,
    p.samouczek_stan,
    coalesce((
      select case when s.plan = 'starter' then 1 else 2 end
        from public.subscriptions s
       where s.user_id = p.id
         and s.status in ('active', 'trialing')
         and (s.current_period_end is null or s.current_period_end > now())
       limit 1
    ), 0),
    (select s.status from public.subscriptions s where s.user_id = p.id limit 1),
    (select max(a.dzien) from aktywnosc a where a.user_id = p.id),
    (select count(distinct a.dzien)::integer from aktywnosc a where a.user_id = p.id),
    coalesce((select sum(x.xp)::integer from public.xp_zdarzenia x where x.user_id = p.id), 0)
  from public.profiles p
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
end;
$$;

revoke all on function public.admin_uzytkownicy(integer) from public, anon;
grant execute on function public.admin_uzytkownicy(integer) to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_admin uuid;
  v_user  uuid;
  v_zgl   uuid;
  v_odp   uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0076-admin@grind.local') returning id into v_admin;
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0076-user@grind.local') returning id into v_user;
  update public.profiles set role = 'admin' where id = v_admin;

  -- Nowe konto zaczyna od samouczka, a konto po kreatorze już nie.
  if (select samouczek_stan from public.profiles where id = v_user) <> 'nowy' then
    raise exception 'Migracja 0076: nowe konto nie dostało samouczka';
  end if;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.zgloszenia (user_id, typ, tytul, tresc, strona)
       values (v_user, 'blad', 'Nie zapisuje wagi', 'Klikam zapisz i nic.', '/profil')
    returning id into v_zgl;

  -- Zwykły użytkownik nie ma wstępu do panelu, choćby znał nazwę funkcji.
  begin
    perform public.admin_statystyki();
    raise exception 'Migracja 0076: statystyki otwarte dla zwykłego konta';
  exception when others then
    if sqlerrm like 'Migracja 0076:%' then raise; end if;
  end;

  begin
    perform public.admin_uzytkownicy();
    raise exception 'Migracja 0076: lista kont otwarta dla zwykłego konta';
  exception when others then
    if sqlerrm like 'Migracja 0076:%' then raise; end if;
  end;

  -- Odpowiedź użytkownika nie może udawać obsługi.
  insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, tresc)
       values (v_zgl, v_user, 'Dorzucam: dzieje się na telefonie.') returning id into v_odp;
  if (select od_admina from public.zgloszenia_odpowiedzi where id = v_odp) then
    raise exception 'Migracja 0076: zwykła odpowiedź oznaczona jako od obsługi';
  end if;

  -- Administrator widzi zgłoszenie i odpowiada.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  if (select count(*) from public.zgloszenia) < 1 then
    raise exception 'Migracja 0076: administrator nie widzi zgłoszeń';
  end if;

  insert into public.zgloszenia_odpowiedzi (zgloszenie_id, autor_id, tresc)
       values (v_zgl, v_admin, 'Już poprawione, zaktualizuj aplikację.') returning id into v_odp;
  if not (select od_admina from public.zgloszenia_odpowiedzi where id = v_odp) then
    raise exception 'Migracja 0076: odpowiedź administratora nieoznaczona';
  end if;
  if (select status from public.zgloszenia where id = v_zgl) <> 'w_toku' then
    raise exception 'Migracja 0076: odpowiedź obsługi nie ruszyła statusu';
  end if;

  if (public.admin_statystyki() -> 'zgloszenia' ->> 'razem')::integer < 1 then
    raise exception 'Migracja 0076: statystyki nie liczą zgłoszeń';
  end if;
  if (select count(*) from public.admin_uzytkownicy()) < 2 then
    raise exception 'Migracja 0076: lista kont nie zwraca kont';
  end if;
  if (select count(*) from public.admin_uzycie(7)) <> 7 then
    raise exception 'Migracja 0076: wykres użycia nie zwraca żądanej liczby dni';
  end if;

  /*
   * Sprawdzenia WIDOCZNOŚCI między kontami są w scripts/test-pomoc.mjs,
   * a nie tutaj. Ten blok wykonuje się jako właściciel bazy, a właściciela
   * RLS nie dotyczy - test izolacji napisany w tym miejscu przechodziłby
   * albo padał z powodu niemającego nic wspólnego z regułami dostępu.
   */

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id in (v_admin, v_user);
end;
$$;
