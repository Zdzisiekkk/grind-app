-- ============================================================
-- Grind — Migracja 0068: analiza wydatków i XP za trzymanie się limitu
--
-- Dwie rzeczy domykające moduł:
--
--   * ANALIZA odpowiada na "gdzie znika kasa" przez porównanie, a nie przez
--     samą listę. Kwota bez punktu odniesienia nie jest informacją: dopiero
--     "o 240 więcej niż zwykle" mówi cokolwiek.
--
--   * XP ZA DZIEŃ W LIMICIE nagradza wynik, nie klikanie. Limit liczony
--     z tego, co realnie zostało, podzielone przez dni do końca miesiąca -
--     po przepalonym tygodniu poprzeczka rośnie.
--
-- Jedna pułapka, którą trzeba było ominąć: gdyby dzień BEZ WPISÓW liczył się
-- jako dzień w limicie, najskuteczniejszą strategią zdobywania punktów byłoby
-- nie wpisywać nic - czyli nagradzalibyśmy porzucenie modułu. Dlatego dzień
-- punktuje tylko wtedy, gdy jest w nim wydatek ALBO świadome "dziś nic nie
-- wydałem".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dzień bez wydatków - świadoma deklaracja, nie brak danych
-- ------------------------------------------------------------
create table if not exists public.finanse_dni_zero (
  user_id uuid not null references auth.users (id) on delete cascade,
  dzien   date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, dzien)
);

alter table public.finanse_dni_zero enable row level security;

drop policy if exists finanse_dni_zero_owner_all on public.finanse_dni_zero;
create policy finanse_dni_zero_owner_all on public.finanse_dni_zero
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, delete on public.finanse_dni_zero to authenticated;

-- ------------------------------------------------------------
-- 2. Nowe źródło punktów
--
-- Cała tabela stawek żyje w tej funkcji, więc dołożenie źródła znaczy
-- podmianę całości. Stawka 10 i cap 1: tyle samo co za wodę i sen, bo to
-- ta sama kategoria zdarzenia - jedna decyzja utrzymana przez cały dzień.
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
      ('skan',    30, 1),
      ('budzet',  10, 1)
    ) as stawki (zrodlo, stawka, cap)
   where zrodlo = p_zrodlo;

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
-- 3. Rozliczenie punktów za miniony dzień
--
-- Nie trigger, bo "dzień w limicie" da się ocenić dopiero, gdy dzień się
-- skończy - a trigger na wydatku strzelałby w środku dnia, kiedy jeszcze
-- nic nie wiadomo. Wywołuje to wejście na ekran; idempotencji pilnuje
-- klucz (user_id, dzien, zrodlo) w xp_zdarzenia.
-- ------------------------------------------------------------
create or replace function public.finanse_dzienny_limit(p_user uuid, p_dzien date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pr.budzet_uznaniowy is null then null
    else round(
      (pr.budzet_uznaniowy - coalesce((
        select sum(w.kwota) from public.finanse_wydatki w
         where w.user_id = p_user
           and w.data >= date_trunc('month', p_dzien)::date
           and w.data < p_dzien
      ), 0))
      / greatest(1,
          extract(day from (date_trunc('month', p_dzien) + interval '1 month - 1 day'))::integer
          - extract(day from p_dzien)::integer + 1
        ),
      2)
  end
  from public.profiles pr
  where pr.id = p_user;
$$;

revoke all on function public.finanse_dzienny_limit(uuid, date) from public, anon;
grant execute on function public.finanse_dzienny_limit(uuid, date) to authenticated;

create or replace function public.finanse_xp_rozlicz()
returns integer
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_user uuid := (select auth.uid());
  v_d    date;
  v_limit numeric;
  v_wydane numeric;
  v_ile  integer := 0;
begin
  if v_user is null then return 0; end if;

  -- Tylko dni zamknięte i tylko dwa tygodnie wstecz: starsze i tak nie zmienią
  -- wyniku, a przeglądanie pół roku przy każdym wejściu to koszt bez pokrycia.
  for v_d in
    select d::date
      from generate_series(current_date - 14, current_date - 1, interval '1 day') d
  loop
    -- Dzień musi mieć sygnał: wydatek albo świadome zero.
    select coalesce(sum(kwota), 0) into v_wydane
      from public.finanse_wydatki
     where user_id = v_user and data = v_d;

    if v_wydane = 0 and not exists (
      select 1 from public.finanse_dni_zero where user_id = v_user and dzien = v_d
    ) then
      continue;
    end if;

    v_limit := public.finanse_dzienny_limit(v_user, v_d);
    if v_limit is null or v_limit <= 0 then continue; end if;

    if v_wydane <= v_limit and not exists (
      select 1 from public.xp_zdarzenia
       where user_id = v_user and dzien = v_d and zrodlo = 'budzet'
    ) then
      perform private.xp_przyznaj(v_user, 'budzet', v_d);
      v_ile := v_ile + 1;
    end if;
  end loop;

  return v_ile;
end;
$$;

revoke all on function public.finanse_xp_rozlicz() from public, anon;
grant execute on function public.finanse_xp_rozlicz() to authenticated;

-- ------------------------------------------------------------
-- 4. Analiza wydatków
--
-- Średnia z poprzednich miesięcy dzielona przez liczbę miesięcy, W KTÓRYCH
-- COKOLWIEK BYŁO - nie przez trzy. Nowe konto miałoby inaczej sztucznie
-- zaniżoną średnią i każdy miesiąc wyglądałby na katastrofę.
-- ------------------------------------------------------------
create or replace function public.finanse_analiza(p_miesiecy integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with okno as (
    select date_trunc('month', current_date)::date as biezacy,
           (date_trunc('month', current_date) - (p_miesiecy || ' months')::interval)::date as od
  ),
  biezace as (
    select w.kategoria, sum(w.kwota) as kwota
      from public.finanse_wydatki w, okno o
     where w.user_id = auth.uid() and w.data >= o.biezacy
     group by w.kategoria
  ),
  historia as (
    select w.kategoria,
           sum(w.kwota) as suma,
           count(distinct date_trunc('month', w.data)) as miesiecy
      from public.finanse_wydatki w, okno o
     where w.user_id = auth.uid()
       and w.data >= o.od and w.data < o.biezacy
     group by w.kategoria
  ),
  suma as (
    select coalesce(sum(kwota), 0) as razem from biezace
  ),
  kategorie as (
    select jsonb_agg(jsonb_build_object(
             'kategoria', k.kategoria,
             'kwota',     k.kwota,
             'procent',   case when s.razem > 0
                               then round(100.0 * k.kwota / s.razem)::integer else 0 end,
             'srednio',   case when h.miesiecy > 0
                               then round(h.suma / h.miesiecy, 2) else null end,
             'roznica',   case when h.miesiecy > 0
                               then round(k.kwota - h.suma / h.miesiecy, 2) else null end
           ) order by k.kwota desc) as lista
      from biezace k
      left join historia h on h.kategoria = k.kategoria
      cross join suma s
  ),
  stale_kat as (
    select jsonb_agg(jsonb_build_object('kategoria', s.kategoria, 'kwota', n.kwota)
                     order by n.kwota desc) as lista
      from public.finanse_naliczenia n
      join public.finanse_stale s on s.id = n.stale_id, okno o
     where n.user_id = auth.uid() and n.okres = o.biezacy and n.status = 'potwierdzone'
  ),
  poprzednio as (
    select round(sum(suma) / greatest(1, max(miesiecy)), 2) as srednia from historia
  )
  select jsonb_build_object(
    'okres',       o.biezacy,
    'suma',        s.razem,
    'srednia_poprzednich', (select srednia from poprzednio),
    'kategorie',   coalesce((select lista from kategorie), '[]'::jsonb),
    'stale',       coalesce((select lista from stale_kat), '[]'::jsonb)
  )
  from okno o, suma s;
$$;

revoke all on function public.finanse_analiza(integer) from public, anon;
grant execute on function public.finanse_analiza(integer) to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_wczoraj date := current_date - 1;
  v_a jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0068@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  update public.profiles set budzet_uznaniowy = 900 where id = v_user;

  -- Dzień bez żadnego sygnału nie dostaje punktów, choćby był "w limicie".
  if public.finanse_xp_rozlicz() <> 0 then
    raise exception 'Migracja 0068: punkty za dzień bez wpisów';
  end if;

  -- Dzień z drobnym wydatkiem mieści się w limicie i punktuje.
  insert into public.finanse_wydatki (user_id, kwota, data) values (v_user, 20, v_wczoraj);
  if public.finanse_xp_rozlicz() < 1 then
    raise exception 'Migracja 0068: dzień w limicie nie dostał punktów';
  end if;
  if (select xp from public.xp_zdarzenia
       where user_id = v_user and dzien = v_wczoraj and zrodlo = 'budzet') <> 10 then
    raise exception 'Migracja 0068: zła stawka za budżet';
  end if;

  -- Powtórne wywołanie nie dosypuje punktów.
  perform public.finanse_xp_rozlicz();
  if (select xp from public.xp_zdarzenia
       where user_id = v_user and dzien = v_wczoraj and zrodlo = 'budzet') <> 10 then
    raise exception 'Migracja 0068: punkty naliczyły się drugi raz';
  end if;

  -- Dzień z przepałem nie dostaje nic.
  insert into public.finanse_wydatki (user_id, kwota, data) values (v_user, 5000, current_date - 2);
  perform public.finanse_xp_rozlicz();
  if exists (select 1 from public.xp_zdarzenia
              where user_id = v_user and dzien = current_date - 2 and zrodlo = 'budzet') then
    raise exception 'Migracja 0068: przepalony dzień dostał punkty';
  end if;

  -- Świadome zero to sygnał tak samo dobry jak wydatek.
  insert into public.finanse_dni_zero (user_id, dzien) values (v_user, current_date - 3);
  perform public.finanse_xp_rozlicz();
  if not exists (select 1 from public.xp_zdarzenia
                  where user_id = v_user and dzien = current_date - 3 and zrodlo = 'budzet') then
    raise exception 'Migracja 0068: dzień bez wydatków nie dostał punktów';
  end if;

  -- Analiza dzieli bieżący miesiąc na kategorie.
  insert into public.finanse_wydatki (user_id, kwota, kategoria, data)
       values (v_user, 300, 'jedzenie', date_trunc('month', current_date)::date);
  v_a := public.finanse_analiza();
  if (v_a ->> 'suma')::numeric < 300 then
    raise exception 'Migracja 0068: analiza nie widzi wydatków miesiąca';
  end if;
  if jsonb_array_length(v_a -> 'kategorie') = 0 then
    raise exception 'Migracja 0068: analiza nie zwróciła kategorii';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  if public.finanse_xp_rozlicz() <> 0 then
    raise exception 'Migracja 0068: rozliczenie XP działa bez auth.uid()';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
