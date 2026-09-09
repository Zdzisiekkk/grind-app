-- ============================================================
-- Grind — Migracja 0066: wpływy i koszty stałe
--
-- Do tej pory Kasa widziała tylko jedną stronę: ile wychodzi. Bez drugiej
-- nie da się odpowiedzieć na pytanie, od którego wszystko się zaczyna -
-- czy w tym miesiącu zostało cokolwiek.
--
-- Dwie decyzje, które kształtują całą resztę:
--
--  1. WPŁYWY MAJĄ PLAN PER ŹRÓDŁO. Przy nieregularnych zleceniach sama
--     suma nic nie mówi: chudy miesiąc wygląda tak samo jak trwały spadek.
--     Dopiero "praca dowiozła, zlecenia nie" jest informacją.
--
--  2. KOSZTY STAŁE CZEKAJĄ NA POTWIERDZENIE. Automatycznie naliczony czynsz,
--     który w tym miesiącu był inny, zatruwa każdą liczbę pod sobą - a nikt
--     nie wraca sprawdzać, skąd wziął się bilans sprzed pół roku. Szablon
--     przygotowuje wpis, człowiek go akceptuje albo poprawia.
--
-- Koszty stałe świadomie NIE trafiają do `finanse_wydatki`: ta tabela ma
-- jedno zadanie - pilnować budżetu uznaniowego, czyli tego, o czym realnie
-- decydujesz. Czynsz wrzucony do tego samego worka zjadłby cały budżet
-- pierwszego dnia miesiąca i przycisk "+ Wydatek" straciłby sens.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Źródła przychodu
-- ------------------------------------------------------------
create table if not exists public.finanse_zrodla (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  nazwa      text not null check (btrim(nazwa) <> ''),
  ikona      text not null default '💰',

  /** Ile spodziewasz się z tego źródła w miesiącu; null = nie planuję. */
  plan_miesieczny numeric(12, 2) check (plan_miesieczny is null or plan_miesieczny >= 0),

  aktywne    boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, nazwa)
);

drop trigger if exists finanse_zrodla_set_updated_at on public.finanse_zrodla;
create trigger finanse_zrodla_set_updated_at
  before update on public.finanse_zrodla
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Wpływy
-- ------------------------------------------------------------
create table if not exists public.finanse_wplywy (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  /*
   * Bez źródła też wolno: jednorazowy zwrot podatku nie zasługuje na własną
   * pozycję w słowniku, a wymuszanie jej kończy się źródłami "inne 2", "inne 3".
   */
  zrodlo_id  uuid references public.finanse_zrodla (id) on delete set null,

  kwota      numeric(12, 2) not null check (kwota > 0),
  data       date not null default current_date,
  opis       text,
  created_at timestamptz not null default now()
);

create index if not exists finanse_wplywy_user_idx
  on public.finanse_wplywy (user_id, data desc);

-- ------------------------------------------------------------
-- 3. Szablon kosztów stałych
-- ------------------------------------------------------------
create table if not exists public.finanse_stale (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  nazwa      text not null check (btrim(nazwa) <> ''),
  kwota      numeric(12, 2) not null check (kwota >= 0),
  kategoria  text not null default 'inne' check (kategoria in (
    'mieszkanie', 'rachunki', 'subskrypcje', 'transport',
    'zdrowie', 'jedzenie', 'raty', 'inne'
  )),

  /*
   * 1-31, ale luty nie ma 31. Termin liczy funkcja generująca i przycina go
   * do ostatniego dnia miesiąca - inaczej rata z 31. znikałaby co drugi miesiąc.
   */
  dzien_miesiaca integer not null default 1 check (dzien_miesiaca between 1 and 31),

  aktywny    boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, nazwa)
);

drop trigger if exists finanse_stale_set_updated_at on public.finanse_stale;
create trigger finanse_stale_set_updated_at
  before update on public.finanse_stale
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Naliczenia - to, co szablon przygotował do potwierdzenia
-- ------------------------------------------------------------
create table if not exists public.finanse_naliczenia (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  stale_id   uuid not null references public.finanse_stale (id) on delete cascade,

  /** Pierwszy dzień miesiąca, którego dotyczy - klucz okresu. */
  okres      date not null,
  /** Dzień płatności w tym miesiącu, już przycięty do jego długości. */
  termin     date not null,

  /** Kopia z szablonu w chwili naliczenia; do poprawy przy potwierdzaniu. */
  kwota      numeric(12, 2) not null check (kwota >= 0),

  status     text not null default 'oczekuje'
             check (status in ('oczekuje', 'potwierdzone', 'pominiete')),
  potwierdzone_at timestamptz,
  created_at timestamptz not null default now(),

  -- Jedno naliczenie na pozycję na miesiąc. Powtórne generowanie ma być
  -- bezpieczne, bo wywołuje je zwykłe wejście na ekran.
  unique (stale_id, okres)
);

create index if not exists finanse_naliczenia_user_idx
  on public.finanse_naliczenia (user_id, okres, status);

-- ------------------------------------------------------------
-- 5. Dostęp
-- ------------------------------------------------------------
alter table public.finanse_zrodla     enable row level security;
alter table public.finanse_wplywy     enable row level security;
alter table public.finanse_stale      enable row level security;
alter table public.finanse_naliczenia enable row level security;

drop policy if exists finanse_zrodla_owner_all on public.finanse_zrodla;
create policy finanse_zrodla_owner_all on public.finanse_zrodla
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists finanse_stale_owner_all on public.finanse_stale;
create policy finanse_stale_owner_all on public.finanse_stale
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/*
 * Ten sam wzorzec co przy wpłatach na cele z 0064: samo `user_id = auth.uid()`
 * przepuściłoby wiersz z własnym user_id, ale cudzym źródłem - a statystyki
 * sumują po `zrodlo_id`, więc obca osoba mogłaby dopisywać komuś przychody.
 */
create or replace function public.finanse_zrodlo_wlasciciel(p_zrodlo_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select z.user_id from public.finanse_zrodla z where z.id = p_zrodlo_id;
$$;

revoke all on function public.finanse_zrodlo_wlasciciel(uuid) from public, anon;
grant execute on function public.finanse_zrodlo_wlasciciel(uuid) to authenticated;

create or replace function public.finanse_stale_wlasciciel(p_stale_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.user_id from public.finanse_stale s where s.id = p_stale_id;
$$;

revoke all on function public.finanse_stale_wlasciciel(uuid) from public, anon;
grant execute on function public.finanse_stale_wlasciciel(uuid) to authenticated;

drop policy if exists finanse_wplywy_owner_all on public.finanse_wplywy;
create policy finanse_wplywy_owner_all on public.finanse_wplywy
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and (zrodlo_id is null
         or public.finanse_zrodlo_wlasciciel(zrodlo_id) = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and (zrodlo_id is null
         or public.finanse_zrodlo_wlasciciel(zrodlo_id) = (select auth.uid()))
  );

drop policy if exists finanse_naliczenia_owner_all on public.finanse_naliczenia;
create policy finanse_naliczenia_owner_all on public.finanse_naliczenia
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and public.finanse_stale_wlasciciel(stale_id) = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
    and public.finanse_stale_wlasciciel(stale_id) = (select auth.uid())
  );

grant select, insert, update, delete
  on public.finanse_zrodla, public.finanse_wplywy,
     public.finanse_stale, public.finanse_naliczenia
  to authenticated;

-- ------------------------------------------------------------
-- 6. Generowanie naliczeń na miesiąc
--
-- Wywoływane przy wejściu na ekran, więc musi być idempotentne i tanie.
-- Generujemy CAŁY miesiąc naprzód, nie tylko to, czego termin minął:
-- "za trzy dni schodzi 1200" jest równie ważną informacją co "zapłacone".
-- ------------------------------------------------------------
create or replace function public.finanse_nalicz_stale(p_okres date default date_trunc('month', current_date)::date)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_okres date := date_trunc('month', p_okres)::date;
  v_ile integer;
begin
  if v_user is null then
    raise exception 'Naliczanie wymaga zalogowania';
  end if;

  insert into public.finanse_naliczenia (user_id, stale_id, okres, termin, kwota)
  select s.user_id, s.id, v_okres,
         -- Rata z 31. w lutym schodzi ostatniego dnia lutego, a nie znika.
         v_okres + (least(
           s.dzien_miesiaca,
           extract(day from (v_okres + interval '1 month - 1 day'))::integer
         ) - 1) * interval '1 day',
         s.kwota
    from public.finanse_stale s
   where s.user_id = v_user
     and s.aktywny
  on conflict (stale_id, okres) do nothing;

  get diagnostics v_ile = row_count;
  return v_ile;
end;
$$;

revoke all on function public.finanse_nalicz_stale(date) from public, anon;
grant execute on function public.finanse_nalicz_stale(date) to authenticated;

-- ------------------------------------------------------------
-- 7. Koszty stałe jako mianownik poduszki
--
-- Ręczne pole w profilu zostaje wyłącznie jako awaryjne: dwie liczby
-- opisujące to samo zawsze się w końcu rozjeżdżają, a rozjazd akurat tutaj
-- znaczy poduszkę pokazującą zapas, którego nie ma.
-- ------------------------------------------------------------
create or replace function public.finanse_koszty_stale(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(kwota), 0)
    from public.finanse_stale
   where user_id = p_user and aktywny;
$$;

revoke all on function public.finanse_koszty_stale(uuid) from public, anon;
grant execute on function public.finanse_koszty_stale(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8. Bilans miesiąca
--
-- Jedna funkcja, bo te liczby mają sens wyłącznie razem: same wpływy nie
-- mówią nic, dopóki nie wiadomo, co z nich zostało.
-- ------------------------------------------------------------
create or replace function public.finanse_bilans(p_okres date default date_trunc('month', current_date)::date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with parametry as (
    select date_trunc('month', p_okres)::date as od,
           (date_trunc('month', p_okres) + interval '1 month - 1 day')::date as do_
  ),
  wpl as (
    select coalesce(sum(w.kwota), 0) as realne
      from public.finanse_wplywy w, parametry p
     where w.user_id = auth.uid() and w.data between p.od and p.do_
  ),
  plan as (
    select coalesce(sum(plan_miesieczny), 0) as planowane
      from public.finanse_zrodla
     where user_id = auth.uid() and aktywne
  ),
  st as (
    select coalesce(sum(kwota) filter (where status = 'potwierdzone'), 0) as potwierdzone,
           coalesce(sum(kwota) filter (where status = 'oczekuje'), 0)     as oczekuje,
           count(*) filter (where status = 'oczekuje' and termin <= current_date) as do_potwierdzenia
      from public.finanse_naliczenia n, parametry p
     where n.user_id = auth.uid() and n.okres = p.od
  ),
  uzn as (
    select coalesce(sum(kwota), 0) as wydane
      from public.finanse_wydatki w, parametry p
     where w.user_id = auth.uid() and w.data between p.od and p.do_
  )
  select jsonb_build_object(
    'okres',              p.od,
    'wplywy_plan',        plan.planowane,
    'wplywy_realne',      wpl.realne,
    'stale_potwierdzone', st.potwierdzone,
    'stale_oczekuje',     st.oczekuje,
    'stale_do_potwierdzenia', st.do_potwierdzenia,
    'uznaniowe',          uzn.wydane,
    -- Wynik liczymy z tego, co POTWIERDZONE. Oczekujące naliczenia pokazujemy
    -- osobno, żeby było widać, ile z tego bilansu jeszcze się nie wydarzyło.
    'wynik',              wpl.realne - st.potwierdzone - uzn.wydane,
    'wynik_po_stalych',   wpl.realne - st.potwierdzone - st.oczekuje - uzn.wydane
  )
  from parametry p, wpl, plan, st, uzn;
$$;

revoke all on function public.finanse_bilans(date) from public, anon;
grant execute on function public.finanse_bilans(date) to authenticated;

-- ------------------------------------------------------------
-- 9. Podsumowanie bierze koszty z szablonu
-- ------------------------------------------------------------
create or replace function public.finanse_podsumowanie()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select
      -- Szablon wygrywa z ręcznym polem; ręczne zostaje, dopóki szablon pusty.
      coalesce(
        nullif(public.finanse_koszty_stale(auth.uid()), 0),
        koszty_miesieczne
      ) as koszty_miesieczne,
      public.finanse_koszty_stale(auth.uid()) > 0 as koszty_z_szablonu,
      poduszka_cel_miesiecy,
      budzet_uznaniowy
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
    'inne',             s.inne,
    'dlugi',            s.dlugi,
    'data_migawki',     s.data,
    'zmiana_30d',       case when poprzedni.netto is null then null
                             else s.netto - poprzedni.netto end,
    'koszty_miesieczne', p.koszty_miesieczne,
    'koszty_z_szablonu', p.koszty_z_szablonu,
    'poduszka_cel',     p.poduszka_cel_miesiecy,
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
  v_user   uuid;
  v_zrodlo uuid;
  v_stale  uuid;
  v_okres  date := date_trunc('month', current_date)::date;
  v_b      jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0066@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.finanse_zrodla (user_id, nazwa, plan_miesieczny)
       values (v_user, 'Praca', 3000) returning id into v_zrodlo;
  insert into public.finanse_zrodla (user_id, nazwa, plan_miesieczny)
       values (v_user, 'Zlecenia', 800);

  insert into public.finanse_wplywy (user_id, zrodlo_id, kwota, data)
       values (v_user, v_zrodlo, 3000, v_okres);

  insert into public.finanse_stale (user_id, nazwa, kwota, kategoria, dzien_miesiaca)
       values (v_user, 'Czynsz', 1800, 'mieszkanie', 10) returning id into v_stale;
  insert into public.finanse_stale (user_id, nazwa, kwota, kategoria, dzien_miesiaca)
       values (v_user, 'Rata z końca miesiąca', 200, 'raty', 31);

  -- Naliczenie jest idempotentne: drugie wejście na ekran nic nie dubluje.
  if public.finanse_nalicz_stale() <> 2 then
    raise exception 'Migracja 0066: pierwsze naliczenie nie dało dwóch pozycji';
  end if;
  if public.finanse_nalicz_stale() <> 0 then
    raise exception 'Migracja 0066: powtórne naliczenie zdublowało pozycje';
  end if;

  -- Termin z 31. przycina się do długości miesiąca zamiast wypadać.
  if (select termin from public.finanse_naliczenia
       where user_id = v_user and kwota = 200)
     <> (v_okres + interval '1 month - 1 day')::date then
    raise exception 'Migracja 0066: termin z 31. nie został przycięty';
  end if;

  -- Dopóki nic nie potwierdzone, stałe nie zjadają bilansu.
  v_b := public.finanse_bilans();
  if (v_b ->> 'wynik')::numeric <> 3000 then
    raise exception 'Migracja 0066: wynik przed potwierdzeniem to % zamiast 3000', v_b ->> 'wynik';
  end if;
  if (v_b ->> 'wynik_po_stalych')::numeric <> 1000 then
    raise exception 'Migracja 0066: wynik po stałych to % zamiast 1000', v_b ->> 'wynik_po_stalych';
  end if;

  -- Potwierdzenie z poprawioną kwotą - czynsz wyszedł drożej.
  update public.finanse_naliczenia
     set status = 'potwierdzone', kwota = 1850, potwierdzone_at = now()
   where user_id = v_user and stale_id = v_stale;

  insert into public.finanse_wydatki (user_id, kwota, kategoria) values (v_user, 150, 'jedzenie');

  v_b := public.finanse_bilans();
  if (v_b ->> 'wynik')::numeric <> 1000 then
    raise exception 'Migracja 0066: wynik po potwierdzeniu to % zamiast 1000', v_b ->> 'wynik';
  end if;
  if (v_b ->> 'wplywy_plan')::numeric <> 3800 then
    raise exception 'Migracja 0066: plan wpływów to % zamiast 3800', v_b ->> 'wplywy_plan';
  end if;

  -- Poduszka liczy się z szablonu, a nie z ręcznego pola.
  update public.profiles set koszty_miesieczne = 9999 where id = v_user;
  insert into public.finanse_stan (user_id, data, plynne) values (v_user, current_date, 10000);
  if (public.finanse_podsumowanie() ->> 'koszty_miesieczne')::numeric <> 2000 then
    raise exception 'Migracja 0066: koszty wzięły się z ręcznego pola zamiast z szablonu';
  end if;

  -- Wyłączony szablon oddaje pole ręczne, zamiast zostawiać zero.
  update public.finanse_stale set aktywny = false where user_id = v_user;
  if (public.finanse_podsumowanie() ->> 'koszty_miesieczne')::numeric <> 9999 then
    raise exception 'Migracja 0066: po wyłączeniu szablonu nie wróciło pole ręczne';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  if (public.finanse_bilans() ->> 'wplywy_realne')::numeric <> 0 then
    raise exception 'Migracja 0066: bilans bez auth.uid() zwraca cudze liczby';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
