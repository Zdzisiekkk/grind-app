-- ============================================================
-- Grind — Migracja 0065: pozycje majątku
--
-- 0064 pozwalało wpisać cztery sumy: płynne, inwestycje, inne, długi.
-- To wystarcza do policzenia poduszki, ale nie do odpowiedzi na pytanie,
-- które pada zaraz potem: "co się na te 30 tysięcy składa?". Człowiek nie
-- pamięta sumy - pamięta, że ma konto w jednym banku, obligacje w drugim
-- i kredyt na samochód.
--
-- Dlatego majątek opisujemy POZYCJAMI: nazwanymi rzeczami, które trwają
-- między migawkami. Migawka przestaje być czterema polami do wypełnienia
-- od zera, a staje się przejściem po istniejącej liście i poprawieniem
-- kwot - a to jedyna forma, którą ktokolwiek powtórzy co miesiąc.
--
-- Historia zostaje agregatem w `finanse_stan`. Świadomie NIE trzymamy
-- wartości każdej pozycji na każdy dzień: do trendu majątku wystarczą
-- sumy, a pełna historia pozycji to już księgowość, od której ta apka
-- ucieka od pierwszego dnia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rodzaj pozycji -> jeden z czterech koszyków
--
-- Osobna funkcja, a nie CASE wklejony w trzy miejsca: koszyk decyduje
-- o poduszce (liczonej tylko z płynnych), więc pomyłka w mapowaniu jest
-- pomyłką w najważniejszej liczbie modułu. Ma być jedno miejsce prawdy,
-- które da się sprawdzić testem.
-- ------------------------------------------------------------
create or replace function public.finanse_kategoria_rodzaju(p_rodzaj text)
returns text
language sql
immutable
as $$
  select case p_rodzaj
    -- Płynne: da się z tego zapłacić w tym tygodniu.
    when 'konto'            then 'plynne'
    when 'oszczednosciowe'  then 'plynne'
    when 'gotowka'          then 'plynne'
    when 'lokata'           then 'plynne'
    when 'waluta'           then 'plynne'

    -- Inwestycje: wartość realna, ale wyjście z niej kosztuje czas albo stratę.
    when 'akcje'            then 'inwestycje'
    when 'etf'              then 'inwestycje'
    when 'obligacje'        then 'inwestycje'
    when 'ike'              then 'inwestycje'
    when 'ikze'             then 'inwestycje'
    when 'ppk'              then 'inwestycje'
    when 'fundusz'          then 'inwestycje'
    when 'krypto'           then 'inwestycje'
    when 'metale'           then 'inwestycje'
    when 'inwestycja_inna'  then 'inwestycje'

    -- Rzeczowe i należności: liczą się do majątku, nie do poduszki.
    when 'nieruchomosc'     then 'inne'
    when 'samochod'         then 'inne'
    when 'sprzet'           then 'inne'
    when 'kolekcja'         then 'inne'
    when 'naleznosc'        then 'inne'

    -- Długi: kwoty dodatnie, odejmowane w netto.
    when 'hipoteka'         then 'dlugi'
    when 'kredyt'           then 'dlugi'
    when 'karta'            then 'dlugi'
    when 'raty'             then 'dlugi'
    when 'pozyczka_prywatna' then 'dlugi'
    when 'debet'            then 'dlugi'
    when 'dlug_inny'        then 'dlugi'
  end;
$$;

revoke all on function public.finanse_kategoria_rodzaju(text) from public, anon;
grant execute on function public.finanse_kategoria_rodzaju(text) to authenticated;

-- ------------------------------------------------------------
-- 2. Pozycje
-- ------------------------------------------------------------
create table if not exists public.finanse_pozycje (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  nazwa      text not null check (btrim(nazwa) <> ''),
  rodzaj     text not null,

  /*
   * Zawsze dodatnia - także przy długach. "Wiszę 12 000" wpisuje się
   * łatwiej niż "-12 000", a znak i tak nadaje koszyk przy liczeniu netto.
   */
  kwota      numeric(12, 2) not null default 0 check (kwota >= 0),

  /** Koszyk liczony z rodzaju przez trigger - nie do ustawienia z zewnątrz. */
  kategoria  text not null default 'plynne'
    check (kategoria in ('plynne', 'inwestycje', 'inne', 'dlugi')),

  /*
   * Sprzedane akcje i spłacony kredyt znikają z migawki, ale nie z historii
   * decyzji - kasowanie wiersza zabrałoby wiedzę, że coś takiego było.
   */
  archiwalna  boolean not null default false,

  note       text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dwa razy to samo konto to zawsze pomyłka, a nie dwa konta.
  unique (user_id, nazwa)
);

create index if not exists finanse_pozycje_user_idx
  on public.finanse_pozycje (user_id, kategoria, order_index);

create or replace function public.finanse_pozycja_kategoria_tg()
returns trigger
language plpgsql
as $$
declare
  v_kat text;
begin
  v_kat := public.finanse_kategoria_rodzaju(new.rodzaj);
  if v_kat is null then
    raise exception 'Nieznany rodzaj pozycji majątku: %', new.rodzaj;
  end if;
  new.kategoria := v_kat;
  return new;
end;
$$;

drop trigger if exists finanse_pozycje_kategoria on public.finanse_pozycje;
create trigger finanse_pozycje_kategoria
  before insert or update on public.finanse_pozycje
  for each row execute function public.finanse_pozycja_kategoria_tg();

drop trigger if exists finanse_pozycje_set_updated_at on public.finanse_pozycje;
create trigger finanse_pozycje_set_updated_at
  before update on public.finanse_pozycje
  for each row execute function public.set_updated_at();

alter table public.finanse_pozycje enable row level security;

drop policy if exists finanse_pozycje_owner_all on public.finanse_pozycje;
create policy finanse_pozycje_owner_all on public.finanse_pozycje
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.finanse_pozycje to authenticated;

-- ------------------------------------------------------------
-- 3. Migawka liczona z pozycji
--
-- Sumowanie po stronie bazy, a nie przeglądarki: te same cztery liczby
-- karmią poduszkę i trend, a druga kopia wzoru w kliencie to prosta droga
-- do dwóch różnych odpowiedzi na pytanie, ile ktoś ma.
-- ------------------------------------------------------------
create or replace function public.finanse_zapisz_migawke(p_data date default current_date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_ile  integer;
  v_pl   numeric(12, 2);
  v_inw  numeric(12, 2);
  v_inne numeric(12, 2);
  v_dl   numeric(12, 2);
begin
  if v_user is null then
    raise exception 'Migawka wymaga zalogowania';
  end if;

  select count(*),
         coalesce(sum(kwota) filter (where kategoria = 'plynne'), 0),
         coalesce(sum(kwota) filter (where kategoria = 'inwestycje'), 0),
         coalesce(sum(kwota) filter (where kategoria = 'inne'), 0),
         coalesce(sum(kwota) filter (where kategoria = 'dlugi'), 0)
    into v_ile, v_pl, v_inw, v_inne, v_dl
    from public.finanse_pozycje
   where user_id = v_user
     and not archiwalna;

  if v_ile = 0 then
    raise exception 'Nie ma z czego zrobić migawki - najpierw dodaj pozycje majątku';
  end if;

  insert into public.finanse_stan (user_id, data, plynne, inwestycje, inne, dlugi)
       values (v_user, p_data, v_pl, v_inw, v_inne, v_dl)
  on conflict (user_id, data) do update
     set plynne     = excluded.plynne,
         inwestycje = excluded.inwestycje,
         inne       = excluded.inne,
         dlugi      = excluded.dlugi;

  return jsonb_build_object(
    'data',       p_data,
    'plynne',     v_pl,
    'inwestycje', v_inw,
    'inne',       v_inne,
    'dlugi',      v_dl,
    'netto',      v_pl + v_inw + v_inne - v_dl
  );
end;
$$;

revoke all on function public.finanse_zapisz_migawke(date) from public, anon;
grant execute on function public.finanse_zapisz_migawke(date) to authenticated;

-- ------------------------------------------------------------
-- 4. Podsumowanie dostaje brakujący koszyk
--
-- `inne` było liczone do netto, ale nie wracało do ekranu - przez co suma
-- nie zgadzała się z rozbiciem pod nią i wyglądało to na błąd rachunku.
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
    'inne',             s.inne,
    'dlugi',            s.dlugi,
    'data_migawki',     s.data,
    'zmiana_30d',       case when poprzedni.netto is null then null
                             else s.netto - poprzedni.netto end,
    'koszty_miesieczne', p.koszty_miesieczne,
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
-- 5. Przeniesienie tego, co ludzie już wpisali
--
-- Kto ma migawkę, a nie ma pozycji, dostaje cztery pozycje zbiorcze
-- z ostatniego stanu. Bez tego pierwsze otwarcie nowego arkusza pokazałoby
-- pustą listę komuś, kto swój majątek już opisał.
-- ------------------------------------------------------------
insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota, order_index)
select s.user_id, x.nazwa, x.rodzaj, x.kwota, x.idx
  from (
    select distinct on (user_id) user_id, plynne, inwestycje, inne, dlugi
      from public.finanse_stan
     order by user_id, data desc
  ) s
  cross join lateral (values
    ('Konto i gotówka',   'konto',           s.plynne,     0),
    ('Inwestycje',        'inwestycja_inna', s.inwestycje, 1),
    ('Majątek rzeczowy',  'sprzet',          s.inne,       2),
    ('Długi',             'dlug_inny',       s.dlugi,      3)
  ) as x(nazwa, rodzaj, kwota, idx)
 where x.kwota > 0
   and not exists (
     select 1 from public.finanse_pozycje p where p.user_id = s.user_id
   );

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_wynik jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0065@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Koszyk bierze się z rodzaju, nawet gdy ktoś podeśle własny.
  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota, kategoria)
       values (v_user, 'Konto ROR', 'konto', 9000, 'dlugi');
  if (select kategoria from public.finanse_pozycje
       where user_id = v_user and nazwa = 'Konto ROR') <> 'plynne' then
    raise exception 'Migracja 0065: podrzucony koszyk nie został nadpisany';
  end if;

  -- Nieznany rodzaj to pomyłka, nie cicha pozycja bez koszyka.
  begin
    insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
         values (v_user, 'Coś', 'skarbonka_pod_lozkiem', 100);
    raise exception 'Migracja 0065: nieznany rodzaj przeszedł';
  exception when others then
    if sqlerrm like 'Migracja 0065:%' then raise; end if;
  end;

  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota) values
    (v_user, 'Obligacje EDO', 'obligacje', 15000),
    (v_user, 'Samochód',      'samochod',  30000),
    (v_user, 'Kredyt na auto','kredyt',    20000),
    (v_user, 'Stara lokata',  'lokata',    5000);

  -- Archiwalna pozycja nie wchodzi do migawki.
  update public.finanse_pozycje set archiwalna = true
   where user_id = v_user and nazwa = 'Stara lokata';

  v_wynik := public.finanse_zapisz_migawke();

  if (v_wynik ->> 'plynne')::numeric <> 9000 then
    raise exception 'Migracja 0065: płynne wyszły % zamiast 9000', v_wynik ->> 'plynne';
  end if;
  if (v_wynik ->> 'netto')::numeric <> 34000 then
    raise exception 'Migracja 0065: netto wyszło % zamiast 34000', v_wynik ->> 'netto';
  end if;
  if (select netto from public.finanse_stan
       where user_id = v_user and data = current_date) <> 34000 then
    raise exception 'Migracja 0065: migawka nie zapisała się w finanse_stan';
  end if;

  -- Druga migawka tego samego dnia poprawia pierwszą, a nie dokłada wiersza.
  update public.finanse_pozycje set kwota = 11000
   where user_id = v_user and nazwa = 'Konto ROR';
  perform public.finanse_zapisz_migawke();
  if (select count(*) from public.finanse_stan where user_id = v_user) <> 1 then
    raise exception 'Migracja 0065: powstał drugi wiersz zamiast poprawki';
  end if;
  if (select plynne from public.finanse_stan where user_id = v_user) <> 11000 then
    raise exception 'Migracja 0065: poprawka nie nadpisała kwoty';
  end if;

  -- Podsumowanie ma zwracać koszyk `inne`, żeby suma zgadzała się z rozbiciem.
  if (public.finanse_podsumowanie() ->> 'inne')::numeric <> 30000 then
    raise exception 'Migracja 0065: podsumowanie nie zwraca koszyka inne';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  -- Bez zalogowania nikt nie zapisuje migawki "komuś".
  begin
    perform public.finanse_zapisz_migawke();
    raise exception 'Migracja 0065: migawka bez auth.uid() przeszła';
  exception when others then
    if sqlerrm like 'Migracja 0065:%' then raise; end if;
  end;

  delete from auth.users where id = v_user;
end;
$$;
