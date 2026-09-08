-- ============================================================
-- Grind — Migracja 0064: moduł finansowy
--
-- Grind śledzi ciało, sen, nawyki i naukę, a milczał o rzeczy, która
-- decyduje o spokoju głowy tak samo mocno: o pieniądzach.
--
-- Zasada jest ta sama co w reszcie aplikacji: DZIENNIK I SYGNAŁ, nie
-- księgowość. Aplikacje każące kategoryzować każdą kawę porzuca się po
-- dwóch tygodniach, bo koszt wpisywania przewyższa to, czego się z nich
-- dowiadujesz. Dlatego:
--
--   * MAJĄTEK to migawka (jedna liczba raz na jakiś czas), a nie suma
--     wszystkich transakcji. Odpowiednik wagi ciała: liczy się trend,
--     nie dokładność co do złotówki.
--   * WYDATKI zapisujemy tylko UZNANIOWE. Czynsz i prąd są stałe i nie ma
--     nad czym myśleć; decyzje zapadają przy jedzeniu na mieście i zakupach.
--   * PODUSZKA liczona jest w MIESIĄCACH przeżycia, nie w złotówkach.
--     "Masz 2,3 z 6 miesięcy" znaczy coś od razu; "masz 14 000 zł" nie.
--
-- Pieniądze trzymamy w `numeric`, nigdy w liczbach zmiennoprzecinkowych -
-- 0,1 + 0,2 w double precision nie daje 0,3, a to są czyjeś oszczędności.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ustawienia w profilu
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists koszty_miesieczne numeric(12, 2)
    check (koszty_miesieczne is null or koszty_miesieczne >= 0);

alter table public.profiles
  add column if not exists poduszka_cel_miesiecy integer not null default 6
    check (poduszka_cel_miesiecy between 1 and 36);

alter table public.profiles
  add column if not exists budzet_uznaniowy numeric(12, 2)
    check (budzet_uznaniowy is null or budzet_uznaniowy >= 0);

comment on column public.profiles.koszty_miesieczne is
  'Stałe koszty życia na miesiąc - mianownik poduszki finansowej (0064).';
comment on column public.profiles.poduszka_cel_miesiecy is
  'Ile miesięcy przeżycia ma pokrywać poduszka. Domyślnie 6.';
comment on column public.profiles.budzet_uznaniowy is
  'Miesięczny limit wydatków uznaniowych. null = bez limitu.';

-- ------------------------------------------------------------
-- 2. Migawki majątku
--
-- Osobne kwoty zamiast jednej sumy, bo "mam 40 tysięcy" i "mam 40 tysięcy,
-- z czego 30 to kredyt" to dwie różne sytuacje. Płynne trzymamy osobno od
-- inwestycji, bo tylko one liczą się do poduszki - akcji nie sprzedaje się
-- w dniu, w którym psuje się pralka.
-- ------------------------------------------------------------
create table if not exists public.finanse_stan (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       date not null default current_date,

  /** Konto, gotówka, lokaty - to, co da się wydać dziś. */
  plynne     numeric(12, 2) not null default 0 check (plynne >= 0),
  /** Akcje, ETF-y, obligacje, krypto - wartość na dzień migawki. */
  inwestycje numeric(12, 2) not null default 0 check (inwestycje >= 0),
  /** Mieszkanie, samochód, sprzęt - rzeczy, których nie sprzedajesz co miesiąc. */
  inne       numeric(12, 2) not null default 0 check (inne >= 0),
  /** Kredyty, pożyczki, karty - wartość dodatnia, odejmuje się w `netto`. */
  dlugi      numeric(12, 2) not null default 0 check (dlugi >= 0),

  note       text,
  created_at timestamptz not null default now(),

  netto numeric(12, 2) generated always as (plynne + inwestycje + inne - dlugi) stored,

  -- Jedna migawka na dzień: druga tego samego dnia to poprawka, nie nowy stan.
  unique (user_id, data)
);

create index if not exists finanse_stan_user_idx
  on public.finanse_stan (user_id, data desc);

-- ------------------------------------------------------------
-- 3. Wydatki uznaniowe
-- ------------------------------------------------------------
create table if not exists public.finanse_wydatki (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       date not null default current_date,

  kwota      numeric(10, 2) not null check (kwota > 0),
  kategoria  text not null default 'inne' check (kategoria in (
    'jedzenie', 'zakupy', 'rozrywka', 'transport',
    'zdrowie', 'prezenty', 'subskrypcje', 'inne'
  )),
  opis       text,
  created_at timestamptz not null default now()
);

create index if not exists finanse_wydatki_user_idx
  on public.finanse_wydatki (user_id, data desc);

-- ------------------------------------------------------------
-- 4. Cele oszczędnościowe
--
-- Zebraną kwotę liczymy z wpłat, a nie trzymamy w kolumnie - inaczej
-- pierwsza pomyłka rozjeżdża sumę z historią i nie wiadomo, której wierzyć.
-- ------------------------------------------------------------
create table if not exists public.finanse_cele (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  nazwa      text not null check (btrim(nazwa) <> ''),
  ikona      text not null default '🎯',
  kwota_cel  numeric(12, 2) not null check (kwota_cel > 0),
  termin     date,
  status     text not null default 'aktywny' check (status in ('aktywny', 'osiagniety', 'porzucony')),

  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists finanse_cele_set_updated_at on public.finanse_cele;
create trigger finanse_cele_set_updated_at
  before update on public.finanse_cele
  for each row execute function public.set_updated_at();

create table if not exists public.finanse_wplaty (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  cel_id     uuid not null references public.finanse_cele (id) on delete cascade,

  -- Ujemna kwota to wypłata z celu. Życie bywa takie, że trzeba sięgnąć
  -- do odłożonych pieniędzy, a udawanie, że się to nie zdarza, kończy się
  -- porzuceniem celu zamiast jego skorygowaniem.
  kwota      numeric(12, 2) not null check (kwota <> 0),
  data       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists finanse_wplaty_cel_idx
  on public.finanse_wplaty (cel_id, data desc);

-- ------------------------------------------------------------
-- 5. Dostęp - dokładnie ten sam wzorzec co w reszcie aplikacji
-- ------------------------------------------------------------
alter table public.finanse_stan    enable row level security;
alter table public.finanse_wydatki enable row level security;
alter table public.finanse_cele    enable row level security;
alter table public.finanse_wplaty  enable row level security;

drop policy if exists finanse_stan_owner_all on public.finanse_stan;
create policy finanse_stan_owner_all on public.finanse_stan
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finanse_wydatki_owner_all on public.finanse_wydatki;
create policy finanse_wydatki_owner_all on public.finanse_wydatki
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finanse_cele_owner_all on public.finanse_cele;
create policy finanse_cele_owner_all on public.finanse_cele
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/*
 * Wpłata musi trafiać do WŁASNEGO celu.
 *
 * Sam warunek `user_id = auth.uid()` tego nie pilnuje: wiersz z własnym
 * user_id, ale cudzym `cel_id`, przechodziłby przez politykę, a widok
 * sumuje wpłaty po `cel_id` - czyli obca osoba mogłaby dopisywać kwoty
 * do cudzego celu i fałszować jego postęp. Znalezione testem, nie w teorii.
 *
 * Ten sam wzorzec co `meal_owner` z 0002: funkcja SECURITY DEFINER czyta
 * właściciela, bo polityka nie może odpytać tabeli chronionej własnym RLS.
 */
create or replace function public.finanse_cel_wlasciciel(p_cel_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.user_id from public.finanse_cele c where c.id = p_cel_id;
$$;

revoke all on function public.finanse_cel_wlasciciel(uuid) from public, anon;
grant execute on function public.finanse_cel_wlasciciel(uuid) to authenticated;

drop policy if exists finanse_wplaty_owner_all on public.finanse_wplaty;
create policy finanse_wplaty_owner_all on public.finanse_wplaty
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and public.finanse_cel_wlasciciel(cel_id) = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
    and public.finanse_cel_wlasciciel(cel_id) = (select auth.uid())
  );

grant select, insert, update, delete
  on public.finanse_stan, public.finanse_wydatki,
     public.finanse_cele, public.finanse_wplaty
  to authenticated;

-- ------------------------------------------------------------
-- 6. Cele z policzonym postępem
-- ------------------------------------------------------------
create or replace view public.v_finanse_cele
with (security_invoker = on) as
  select
    c.*,
    coalesce(w.zebrane, 0) as zebrane,
    greatest(0, c.kwota_cel - coalesce(w.zebrane, 0)) as zostalo,
    least(100, round(100.0 * coalesce(w.zebrane, 0) / c.kwota_cel, 0))::integer as procent,
    w.ostatnia_wplata
  from public.finanse_cele c
  left join lateral (
    select sum(p.kwota) as zebrane, max(p.data) as ostatnia_wplata
      from public.finanse_wplaty p
     where p.cel_id = c.id
  ) w on true;

grant select on public.v_finanse_cele to authenticated;

-- ------------------------------------------------------------
-- 7. Podsumowanie miesiąca - jedno zapytanie zamiast pięciu
-- ------------------------------------------------------------
create or replace function public.finanse_podsumowanie()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select koszty_miesieczne, poduszka_cel_miesiecy, budzet_uznaniowy
      from public.profiles where id = auth.uid()
  ),
  s as (
    select plynne, inwestycje, inne, dlugi, netto, data
      from public.finanse_stan
     where user_id = auth.uid()
     order by data desc
     limit 1
  ),
  poprzedni as (
    select netto
      from public.finanse_stan
     where user_id = auth.uid()
       and data <= current_date - 30
     order by data desc
     limit 1
  ),
  w as (
    select coalesce(sum(kwota), 0) as wydane
      from public.finanse_wydatki
     where user_id = auth.uid()
       and data >= date_trunc('month', current_date)::date
  )
  select jsonb_build_object(
    'netto',            s.netto,
    'plynne',           s.plynne,
    'inwestycje',       s.inwestycje,
    'dlugi',            s.dlugi,
    'data_migawki',     s.data,
    -- Zmiana wobec stanu sprzed miesiąca. null, gdy nie ma z czym porównać -
    -- pokazywanie "+100%" przy pierwszej migawce byłoby bez sensu.
    'zmiana_30d',       case when poprzedni.netto is null then null
                             else s.netto - poprzedni.netto end,
    'koszty_miesieczne', p.koszty_miesieczne,
    'poduszka_cel',     p.poduszka_cel_miesiecy,
    -- Poduszka liczy się TYLKO z płynnych. Inwestycji nie sprzedaje się
    -- w dniu, w którym psuje się pralka.
    'poduszka_miesiecy', case
                           when p.koszty_miesieczne is null or p.koszty_miesieczne <= 0 then null
                           else round(s.plynne / p.koszty_miesieczne, 1)
                         end,
    'budzet',           p.budzet_uznaniowy,
    'wydane_w_miesiacu', w.wydane,
    'budzet_zostalo',   case when p.budzet_uznaniowy is null then null
                             else p.budzet_uznaniowy - w.wydane end
  )
  from p
  left join s on true
  left join poprzedni on true
  cross join w;
$$;

revoke all on function public.finanse_podsumowanie() from public, anon;
grant execute on function public.finanse_podsumowanie() to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_cel  uuid;
  v_pod  jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0064@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Majątek netto odejmuje długi.
  insert into public.finanse_stan (user_id, data, plynne, inwestycje, dlugi)
       values (v_user, current_date, 10000, 5000, 3000);
  if (select netto from public.finanse_stan where user_id = v_user) <> 12000 then
    raise exception 'Migracja 0064: netto liczone źle';
  end if;

  -- Poduszka liczy się z płynnych, nie z całego majątku.
  update public.profiles set koszty_miesieczne = 4000 where id = v_user;
  v_pod := public.finanse_podsumowanie();
  if (v_pod ->> 'poduszka_miesiecy')::numeric <> 2.5 then
    raise exception 'Migracja 0064: poduszka wyszła % zamiast 2.5', v_pod ->> 'poduszka_miesiecy';
  end if;

  -- Bez podanych kosztów poduszki nie da się policzyć i ma być pusta,
  -- a nie zerowa - zero znaczyłoby "nie masz nic odłożone".
  update public.profiles set koszty_miesieczne = null where id = v_user;
  if (public.finanse_podsumowanie() ->> 'poduszka_miesiecy') is not null then
    raise exception 'Migracja 0064: poduszka bez kosztów miała być pusta';
  end if;
  update public.profiles set koszty_miesieczne = 4000 where id = v_user;

  -- Budżet uznaniowy odlicza wydatki z bieżącego miesiąca.
  update public.profiles set budzet_uznaniowy = 800 where id = v_user;
  insert into public.finanse_wydatki (user_id, kwota, kategoria)
       values (v_user, 120.50, 'jedzenie');
  v_pod := public.finanse_podsumowanie();
  if (v_pod ->> 'budzet_zostalo')::numeric <> 679.50 then
    raise exception 'Migracja 0064: z budżetu zostało % zamiast 679.50', v_pod ->> 'budzet_zostalo';
  end if;

  -- Cel liczy postęp z wpłat.
  insert into public.finanse_cele (user_id, nazwa, kwota_cel)
       values (v_user, 'Wyjazd', 8000) returning id into v_cel;
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_user, v_cel, 2000);
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_user, v_cel, 400);
  if (select procent from public.v_finanse_cele where id = v_cel) <> 30 then
    raise exception 'Migracja 0064: postęp celu policzony źle';
  end if;

  -- Wypłata z celu cofa postęp, zamiast być odrzucana.
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_user, v_cel, -400);
  if (select zebrane from public.v_finanse_cele where id = v_cel) <> 2000 then
    raise exception 'Migracja 0064: wypłata z celu nie odjęła się';
  end if;

  -- Kwota zerowa to pomyłka, nie zdarzenie.
  begin
    insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_user, v_cel, 0);
    raise exception 'Migracja 0064: wpłata zerowa przeszła';
  exception when check_violation then null;
  end;

  perform set_config('request.jwt.claim.sub', '', true);

  -- Bez zalogowania podsumowanie nie może zwracać cudzych liczb.
  if (public.finanse_podsumowanie() ->> 'netto') is not null then
    raise exception 'Migracja 0064: podsumowanie działa bez auth.uid()';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
