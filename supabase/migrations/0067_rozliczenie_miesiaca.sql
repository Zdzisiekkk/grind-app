-- ============================================================
-- Grind — Migracja 0067: rozliczenie miesiąca i żywy majątek
--
-- Majątek wpisywany raz na jakiś czas jest martwy przez trzydzieści dni.
-- Majątek liczony wyłącznie z wpisów po pół roku pokazuje liczbę wziętą
-- z sufitu, bo nikt nie zapisuje wszystkiego. Ta migracja godzi jedno
-- z drugim:
--
--   * MIĘDZY MIGAWKAMI majątek jest SZACOWANY: ostatnia potwierdzona kwota
--     plus wszystko, co od niej wpłynęło i wyszło. Pokazywany obok
--     potwierdzonego, nigdy zamiast - żeby nie udawał sprawdzonego.
--
--   * RAZ W MIESIĄCU następuje ROZLICZENIE: bilans, konfrontacja z realnym
--     stanem konta i decyzja, co zrobić z nadwyżką.
--
-- Sercem jest krok środkowy. Bilans z wpisów prawie nigdy nie zgadza się
-- ze stanem konta - drobne, gotówka, zwroty, zapomniane przelewy. Różnicę
-- nazywamy NIEUCHWYCONYM i zapisujemy zamiast po cichu dosypywać do sumy.
-- Po kilku miesiącach daje to najbardziej użyteczną liczbę w module:
-- ile średnio wycieka poza rejestrem.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rozliczenia
-- ------------------------------------------------------------
create table if not exists public.finanse_rozliczenia (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  /** Pierwszy dzień rozliczanego miesiąca. */
  okres      date not null,

  -- Bilans zamrożony w chwili zamknięcia. Późniejsza korekta wpisu nie
  -- zmienia zamkniętego miesiąca - inaczej historia zmieniałaby się pod ręką.
  wplywy     numeric(12, 2) not null default 0,
  stale      numeric(12, 2) not null default 0,
  uznaniowe  numeric(12, 2) not null default 0,
  wynik      numeric(12, 2) generated always as (wplywy - stale - uznaniowe) stored,

  /** Ile płynnych powinno zostać: stan sprzed miesiąca plus wynik. */
  plynne_oczekiwane numeric(12, 2),
  /** Ile realnie jest - suma płynnych pozycji po korekcie przez człowieka. */
  plynne_realne     numeric(12, 2),
  /*
   * Dodatnie = wyparowało poza wpisami. Ujemne = znalazło się więcej,
   * niż wynikało z rejestru (zwrot, zapomniany wpływ).
   */
  nieuchwycone numeric(12, 2)
    generated always as (plynne_oczekiwane - plynne_realne) stored,

  note       text,
  zamkniete_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  unique (user_id, okres)
);

create index if not exists finanse_rozliczenia_user_idx
  on public.finanse_rozliczenia (user_id, okres desc);

alter table public.finanse_rozliczenia enable row level security;

drop policy if exists finanse_rozliczenia_owner_all on public.finanse_rozliczenia;
create policy finanse_rozliczenia_owner_all on public.finanse_rozliczenia
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.finanse_rozliczenia to authenticated;

-- ------------------------------------------------------------
-- 2. Podgląd rozliczenia - to samo, co potem zostanie zapisane
--
-- Ekran musi pokazać człowiekowi dokładnie te liczby, które za chwilę
-- trafią do bazy. Policzenie ich drugi raz w przeglądarce znaczyłoby, że
-- podgląd i zapis mogą się różnić - a to najgorszy możliwy błąd w miejscu,
-- w którym ktoś podejmuje decyzję o swoich pieniądzach.
-- ------------------------------------------------------------
create or replace function public.finanse_rozliczenie_podglad(p_okres date)
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
  b as (
    select public.finanse_bilans(p.od) as bilans from parametry p
  ),
  -- Punkt odniesienia: ostatnia migawka SPRZED rozliczanego miesiąca.
  poprzednia as (
    select s.plynne, s.netto, s.data
      from public.finanse_stan s, parametry p
     where s.user_id = auth.uid() and s.data < p.od
     order by s.data desc
     limit 1
  ),
  pozycje as (
    select coalesce(sum(kwota) filter (where kategoria = 'plynne'), 0) as plynne,
           count(*) as ile
      from public.finanse_pozycje
     where user_id = auth.uid() and not archiwalna
  )
  select jsonb_build_object(
    'okres',        p.od,
    'wplywy',       (b.bilans ->> 'wplywy_realne')::numeric,
    'stale',        (b.bilans ->> 'stale_potwierdzone')::numeric,
    'uznaniowe',    (b.bilans ->> 'uznaniowe')::numeric,
    'wynik',        (b.bilans ->> 'wynik')::numeric,
    'stale_oczekuje', (b.bilans ->> 'stale_oczekuje')::numeric,
    'plynne_start', poprzednia.plynne,
    'plynne_oczekiwane', case when poprzednia.plynne is null then null
                              else poprzednia.plynne + (b.bilans ->> 'wynik')::numeric end,
    'plynne_pozycje', pozycje.plynne,
    'ma_pozycje',     pozycje.ile > 0,
    'nieuchwycone', case when poprzednia.plynne is null then null
                        else poprzednia.plynne + (b.bilans ->> 'wynik')::numeric
                             - pozycje.plynne end,
    'juz_zamkniete', exists (
      select 1 from public.finanse_rozliczenia r, parametry q
       where r.user_id = auth.uid() and r.okres = q.od
    )
  )
  from parametry p, b, pozycje
  left join poprzednia on true;
$$;

revoke all on function public.finanse_rozliczenie_podglad(date) from public, anon;
grant execute on function public.finanse_rozliczenie_podglad(date) to authenticated;

-- ------------------------------------------------------------
-- 3. Zamknięcie miesiąca
--
-- Zamyka na podstawie AKTUALNEGO stanu pozycji - człowiek poprawia je
-- w kroku "ile faktycznie masz", a funkcja bierze to, co zostało po korekcie.
-- Dzięki temu nie ma trzeciego miejsca, w którym te same kwoty mogłyby się
-- rozjechać.
-- ------------------------------------------------------------
create or replace function public.finanse_zamknij_miesiac(p_okres date, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user  uuid := (select auth.uid());
  v_okres date := date_trunc('month', p_okres)::date;
  v_koniec date := (date_trunc('month', p_okres) + interval '1 month - 1 day')::date;
  v_p     jsonb;
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'Zamknięcie miesiąca wymaga zalogowania';
  end if;

  if v_okres > date_trunc('month', current_date)::date then
    raise exception 'Nie da się zamknąć miesiąca, który się nie zaczął';
  end if;

  v_p := public.finanse_rozliczenie_podglad(v_okres);

  if not (v_p ->> 'ma_pozycje')::boolean then
    raise exception 'Najpierw opisz majątek pozycjami - bez nich nie ma czego rozliczyć';
  end if;

  -- Migawka na ostatni dzień miesiąca, z pozycji po korekcie.
  perform public.finanse_zapisz_migawke(v_koniec);

  insert into public.finanse_rozliczenia (
    user_id, okres, wplywy, stale, uznaniowe,
    plynne_oczekiwane, plynne_realne, note
  )
  values (
    v_user, v_okres,
    (v_p ->> 'wplywy')::numeric,
    (v_p ->> 'stale')::numeric,
    (v_p ->> 'uznaniowe')::numeric,
    (v_p ->> 'plynne_oczekiwane')::numeric,
    (v_p ->> 'plynne_pozycje')::numeric,
    p_note
  )
  on conflict (user_id, okres) do update
     set wplywy = excluded.wplywy,
         stale = excluded.stale,
         uznaniowe = excluded.uznaniowe,
         plynne_oczekiwane = excluded.plynne_oczekiwane,
         plynne_realne = excluded.plynne_realne,
         note = excluded.note,
         zamkniete_at = now()
  returning id into v_id;

  return (select to_jsonb(r) from public.finanse_rozliczenia r where r.id = v_id);
end;
$$;

revoke all on function public.finanse_zamknij_miesiac(date, text) from public, anon;
grant execute on function public.finanse_zamknij_miesiac(date, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Podsumowanie: szacunek, zaległe rozliczenie, średni wyciek
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
  ),
  -- Ruch OD ostatniej migawki: to on ożywia majątek między rozliczeniami.
  od_migawki as (
    select
      coalesce((select sum(kwota) from public.finanse_wplywy
                 where user_id = auth.uid() and data > coalesce(s.data, '1900-01-01'::date)), 0)
      - coalesce((select sum(kwota) from public.finanse_wydatki
                   where user_id = auth.uid() and data > coalesce(s.data, '1900-01-01'::date)), 0)
      - coalesce((select sum(kwota) from public.finanse_naliczenia
                   where user_id = auth.uid() and status = 'potwierdzone'
                     and termin > coalesce(s.data, '1900-01-01'::date)), 0)
      as ruch
      from s
  ),
  -- Miesiąc do rozliczenia: poprzedni, jeszcze niezamknięty, i był w nim ruch.
  zalegle as (
    select (date_trunc('month', current_date) - interval '1 month')::date as okres
     where not exists (
       select 1 from public.finanse_rozliczenia r
        where r.user_id = auth.uid()
          and r.okres = (date_trunc('month', current_date) - interval '1 month')::date
     )
     and (
       exists (select 1 from public.finanse_wplywy v where v.user_id = auth.uid()
                and v.data >= (date_trunc('month', current_date) - interval '1 month')::date
                and v.data < date_trunc('month', current_date)::date)
       or exists (select 1 from public.finanse_wydatki v where v.user_id = auth.uid()
                and v.data >= (date_trunc('month', current_date) - interval '1 month')::date
                and v.data < date_trunc('month', current_date)::date)
     )
  ),
  wyciek as (
    select round(avg(nieuchwycone), 2) as srednia, count(*) as ile
      from public.finanse_rozliczenia
     where user_id = auth.uid() and nieuchwycone is not null
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
    -- Szacunek pokazujemy tylko wtedy, gdy naprawdę coś się od migawki ruszyło.
    'netto_szacowany',  case when s.netto is null or coalesce(od_migawki.ruch, 0) = 0
                             then null else s.netto + od_migawki.ruch end,
    'ruch_od_migawki',  od_migawki.ruch,
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
                             else p.budzet_uznaniowy - w.wydane end,
    'rozliczenie_okres', (select okres from zalegle),
    'wyciek_sredni',    (select srednia from wyciek),
    'wyciek_miesiecy',  (select ile from wyciek)
  )
  from p
  left join s on true
  left join poprzedni on true
  left join od_migawki on true
  cross join w;
$$;

revoke all on function public.finanse_podsumowanie() from public, anon;
grant execute on function public.finanse_podsumowanie() to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user  uuid;
  v_okres date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_koniec date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_p     jsonb;
  v_r     jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0067@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Stan wyjściowy: 5000 na koncie na koniec przedostatniego miesiąca.
  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
       values (v_user, 'Konto', 'konto', 5000);
  insert into public.finanse_stan (user_id, data, plynne)
       values (v_user, (v_okres - interval '1 day')::date, 5000);

  -- Miesiąc: wpłynęło 4000, czynsz 1500 potwierdzony, uznaniowe 700.
  insert into public.finanse_wplywy (user_id, kwota, data) values (v_user, 4000, v_okres);
  insert into public.finanse_stale (user_id, nazwa, kwota, dzien_miesiaca)
       values (v_user, 'Czynsz', 1500, 5);
  perform public.finanse_nalicz_stale(v_okres);
  update public.finanse_naliczenia set status = 'potwierdzone' where user_id = v_user;
  insert into public.finanse_wydatki (user_id, kwota, data) values (v_user, 700, v_okres + 3);

  v_p := public.finanse_rozliczenie_podglad(v_okres);
  if (v_p ->> 'wynik')::numeric <> 1800 then
    raise exception 'Migracja 0067: wynik miesiąca to % zamiast 1800', v_p ->> 'wynik';
  end if;
  if (v_p ->> 'plynne_oczekiwane')::numeric <> 6800 then
    raise exception 'Migracja 0067: oczekiwane płynne to % zamiast 6800', v_p ->> 'plynne_oczekiwane';
  end if;

  -- Krok "ile faktycznie masz": na koncie jest 6500, czyli 300 wyparowało.
  update public.finanse_pozycje set kwota = 6500 where user_id = v_user and nazwa = 'Konto';

  v_p := public.finanse_rozliczenie_podglad(v_okres);
  if (v_p ->> 'nieuchwycone')::numeric <> 300 then
    raise exception 'Migracja 0067: nieuchwycone to % zamiast 300', v_p ->> 'nieuchwycone';
  end if;

  v_r := public.finanse_zamknij_miesiac(v_okres);
  if (v_r ->> 'nieuchwycone')::numeric <> 300 then
    raise exception 'Migracja 0067: zapisane nieuchwycone to % zamiast 300', v_r ->> 'nieuchwycone';
  end if;
  if (v_r ->> 'wynik')::numeric <> 1800 then
    raise exception 'Migracja 0067: zapisany wynik to % zamiast 1800', v_r ->> 'wynik';
  end if;

  -- Zamknięcie zostawia migawkę na ostatni dzień rozliczanego miesiąca.
  if not exists (select 1 from public.finanse_stan
                  where user_id = v_user and data = v_koniec and plynne = 6500) then
    raise exception 'Migracja 0067: zamknięcie nie zapisało migawki na koniec miesiąca';
  end if;

  -- Powtórne zamknięcie poprawia rozliczenie, a nie dokłada drugiego.
  perform public.finanse_zamknij_miesiac(v_okres);
  if (select count(*) from public.finanse_rozliczenia where user_id = v_user) <> 1 then
    raise exception 'Migracja 0067: powstało drugie rozliczenie tego samego miesiąca';
  end if;

  -- Zamknięty miesiąc znika z listy zaległych.
  if (public.finanse_podsumowanie() ->> 'rozliczenie_okres') is not null then
    raise exception 'Migracja 0067: zamknięty miesiąc dalej prosi o rozliczenie';
  end if;

  -- Majątek żyje: wydatek po migawce zbija szacunek poniżej potwierdzonego.
  insert into public.finanse_wydatki (user_id, kwota, data) values (v_user, 200, current_date);
  v_p := public.finanse_podsumowanie();
  if (v_p ->> 'netto_szacowany')::numeric <> (v_p ->> 'netto')::numeric - 200 then
    raise exception 'Migracja 0067: szacunek nie uwzględnił wydatku po migawce';
  end if;

  if (v_p ->> 'wyciek_sredni')::numeric <> 300 then
    raise exception 'Migracja 0067: średni wyciek to % zamiast 300', v_p ->> 'wyciek_sredni';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  begin
    perform public.finanse_zamknij_miesiac(v_okres);
    raise exception 'Migracja 0067: zamknięcie bez auth.uid() przeszło';
  exception when others then
    if sqlerrm like 'Migracja 0067:%' then raise; end if;
  end;

  delete from auth.users where id = v_user;
end;
$$;
