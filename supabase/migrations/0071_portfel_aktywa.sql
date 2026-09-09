-- ============================================================
-- Grind — Migracja 0071: portfel z rozpisaniem na aktywa
--
-- "Inwestycje: 15 000 zł" nie odpowiada na żadne pytanie, które człowiek
-- naprawdę sobie zadaje. Zadaje sobie te: ile mam w jednej spółce, ile
-- w ETF-ach, czy jestem na plusie i od czego to zależy.
--
-- Aktywa wiszą pod POZYCJĄ MAJĄTKU, a nie obok niej: rachunek maklerski
-- jest jednym miejscem, w którym leży dziesięć rzeczy. Wartość pozycji
-- przestaje być wtedy wpisywana ręcznie - liczy ją suma aktywów, przez
-- trigger, żeby migawka i rozbicie nie mogły się rozjechać.
--
-- Cena i kurs waluty stoją osobno od ilości, bo zmieniają się z innego
-- powodu i - patrząc dalej - z innego źródła: ilość zmienia człowiek
-- kupując, cenę może kiedyś aktualizować notowanie. Stąd `cena_zrodlo`
-- i `cena_aktualizacja` już teraz, choć na razie zawsze wpisuje je ręka.
-- ============================================================

create table if not exists public.finanse_aktywa (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  pozycja_id uuid not null references public.finanse_pozycje (id) on delete cascade,

  /** Ticker, jeśli istnieje: CDR, VWCE, BTC. Bez niego też można. */
  symbol     text,
  nazwa      text not null check (btrim(nazwa) <> ''),
  typ        text not null default 'akcje' check (typ in (
    'akcje', 'etf', 'obligacje', 'krypto', 'metale', 'fundusz', 'inne'
  )),

  ilosc      numeric(20, 8) not null default 0 check (ilosc >= 0),
  /** Cena za jedną sztukę, w walucie notowania. */
  cena       numeric(20, 8) not null default 0 check (cena >= 0),
  waluta     text not null default 'PLN' check (char_length(waluta) = 3),
  /** Przelicznik waluty na złote; 1 dla PLN. */
  kurs       numeric(14, 6) not null default 1 check (kurs > 0),

  /** Ile realnie włożone - bez tego nie da się powiedzieć, czy to zysk. */
  koszt_zakupu numeric(14, 2) check (koszt_zakupu is null or koszt_zakupu >= 0),

  cena_zrodlo text not null default 'reczna'
    check (cena_zrodlo in ('reczna', 'import', 'notowania')),
  cena_aktualizacja timestamptz,

  note       text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  wartosc numeric(20, 2) generated always as (round(ilosc * cena * kurs, 2)) stored,

  -- Dwa razy ta sama pozycja w tym samym rachunku to zawsze pomyłka.
  unique (pozycja_id, nazwa)
);

create index if not exists finanse_aktywa_user_idx
  on public.finanse_aktywa (user_id, pozycja_id, order_index);

drop trigger if exists finanse_aktywa_set_updated_at on public.finanse_aktywa;
create trigger finanse_aktywa_set_updated_at
  before update on public.finanse_aktywa
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Aktywa tylko pod inwestycjami
-- ------------------------------------------------------------
create or replace function public.finanse_aktywo_sprawdz()
returns trigger
language plpgsql
as $$
declare
  v_kat text;
  v_wlasciciel uuid;
begin
  select kategoria, user_id into v_kat, v_wlasciciel
    from public.finanse_pozycje where id = new.pozycja_id;

  if v_kat is null then
    raise exception 'Nie ma takiej pozycji majątku';
  end if;
  if v_kat <> 'inwestycje' then
    raise exception 'Aktywa można rozpisać tylko pod pozycją inwestycyjną, a ta jest w koszyku %', v_kat;
  end if;
  -- Pozycja i aktywo muszą należeć do tej samej osoby, niezależnie od RLS.
  if v_wlasciciel is distinct from new.user_id then
    raise exception 'Aktywo i pozycja majątku należą do różnych osób';
  end if;

  return new;
end;
$$;

drop trigger if exists finanse_aktywa_sprawdz on public.finanse_aktywa;
create trigger finanse_aktywa_sprawdz
  before insert or update on public.finanse_aktywa
  for each row execute function public.finanse_aktywo_sprawdz();

-- ------------------------------------------------------------
-- Wartość pozycji liczona z aktywów
--
-- Gdy rachunek jest rozpisany, ręczna kwota przestaje mieć znaczenie -
-- i lepiej, żeby przestała naprawdę, niż żeby po cichu kłóciła się z sumą.
-- ------------------------------------------------------------
create or replace function public.finanse_aktywa_przelicz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pozycja uuid := coalesce(new.pozycja_id, old.pozycja_id);
begin
  update public.finanse_pozycje p
     set kwota = coalesce((
           select sum(a.wartosc) from public.finanse_aktywa a where a.pozycja_id = p.id
         ), 0)
   where p.id = v_pozycja;

  -- Przeniesienie aktywa między rachunkami musi odświeżyć oba.
  if tg_op = 'UPDATE' and old.pozycja_id is distinct from new.pozycja_id then
    update public.finanse_pozycje p
       set kwota = coalesce((
             select sum(a.wartosc) from public.finanse_aktywa a where a.pozycja_id = p.id
           ), 0)
     where p.id = old.pozycja_id;
  end if;

  return null;
end;
$$;

drop trigger if exists finanse_aktywa_przelicz on public.finanse_aktywa;
create trigger finanse_aktywa_przelicz
  after insert or update or delete on public.finanse_aktywa
  for each row execute function public.finanse_aktywa_przelicz();

-- ------------------------------------------------------------
-- Dostęp
-- ------------------------------------------------------------
alter table public.finanse_aktywa enable row level security;

drop policy if exists finanse_aktywa_owner_all on public.finanse_aktywa;
create policy finanse_aktywa_owner_all on public.finanse_aktywa
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and public.finanse_pozycja_wlasciciel(pozycja_id) = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
    and public.finanse_pozycja_wlasciciel(pozycja_id) = (select auth.uid())
  );

grant select, insert, update, delete on public.finanse_aktywa to authenticated;

-- ------------------------------------------------------------
-- Portfel z udziałami i wynikiem
-- ------------------------------------------------------------
create or replace view public.v_finanse_aktywa
with (security_invoker = on) as
  select
    a.*,
    case when a.koszt_zakupu is null then null else a.wartosc - a.koszt_zakupu end as zysk,
    case when coalesce(a.koszt_zakupu, 0) = 0 then null
         else round(100.0 * (a.wartosc - a.koszt_zakupu) / a.koszt_zakupu, 1) end as zysk_procent,
    case when s.suma is null or s.suma = 0 then 0
         else round(100.0 * a.wartosc / s.suma, 1) end as udzial
  from public.finanse_aktywa a
  left join lateral (
    select sum(b.wartosc) as suma
      from public.finanse_aktywa b
     where b.user_id = a.user_id
  ) s on true;

grant select on public.v_finanse_aktywa to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_makler uuid;
  v_konto  uuid;
  v_akt    uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0071@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
       values (v_user, 'Rachunek maklerski', 'akcje', 999) returning id into v_makler;
  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
       values (v_user, 'Konto', 'konto', 5000) returning id into v_konto;

  -- Wartość aktywa to ilość razy cena razy kurs.
  insert into public.finanse_aktywa (user_id, pozycja_id, symbol, nazwa, typ, ilosc, cena, koszt_zakupu)
       values (v_user, v_makler, 'CDR', 'CD Projekt', 'akcje', 10, 220, 1800)
    returning id into v_akt;
  if (select wartosc from public.finanse_aktywa where id = v_akt) <> 2200 then
    raise exception 'Migracja 0071: wartość aktywa policzona źle';
  end if;

  -- Ręczna kwota rachunku ustępuje sumie aktywów.
  if (select kwota from public.finanse_pozycje where id = v_makler) <> 2200 then
    raise exception 'Migracja 0071: pozycja nie przeliczyła się z aktywów';
  end if;

  -- Waluta obca przelicza się kursem.
  insert into public.finanse_aktywa (user_id, pozycja_id, symbol, nazwa, typ, ilosc, cena, waluta, kurs)
       values (v_user, v_makler, 'VWCE', 'Vanguard All-World', 'etf', 5, 100, 'EUR', 4.30);
  if (select kwota from public.finanse_pozycje where id = v_makler) <> 4350 then
    raise exception 'Migracja 0071: kurs waluty nie wszedł do sumy (jest %)',
      (select kwota from public.finanse_pozycje where id = v_makler);
  end if;

  -- Zysk liczy się od włożonego kosztu.
  if (select zysk from public.v_finanse_aktywa where id = v_akt) <> 400 then
    raise exception 'Migracja 0071: zysk policzony źle';
  end if;
  if (select udzial from public.v_finanse_aktywa where id = v_akt) <> 50.6 then
    raise exception 'Migracja 0071: udział w portfelu to % zamiast 50.6',
      (select udzial from public.v_finanse_aktywa where id = v_akt);
  end if;

  -- Skasowane aktywo znika z sumy rachunku.
  delete from public.finanse_aktywa where id = v_akt;
  if (select kwota from public.finanse_pozycje where id = v_makler) <> 2150 then
    raise exception 'Migracja 0071: usunięcie aktywa nie przeliczyło pozycji';
  end if;

  -- Akcji nie da się doczepić do konta osobistego.
  begin
    insert into public.finanse_aktywa (user_id, pozycja_id, nazwa, ilosc, cena)
         values (v_user, v_konto, 'Coś', 1, 1);
    raise exception 'Migracja 0071: aktywo weszło pod pozycję nieinwestycyjną';
  exception when others then
    if sqlerrm like 'Migracja 0071:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
