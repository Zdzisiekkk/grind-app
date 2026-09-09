-- ============================================================
-- Grind — Migracja 0070: skąd idzie wpłata na cel
--
-- Wpłata na cel NIE JEST wydatkiem. Pieniądze nie znikają - zmieniają
-- etykietę: leżą dalej na tym samym koncie, tylko są już na coś umówione.
-- Ta różnica decyduje o poprawności trzech innych liczb, więc opisuję ją
-- tu dokładnie:
--
--   * MAJĄTEK się nie zmienia. Gdyby wpłata zmniejszała pozycję i osobno
--     dokładała się jako "Cele", ta sama złotówka byłaby policzona dwa razy.
--     Dlatego pozycje trzymają RZECZYWISTOŚĆ (tyle, ile realnie jest na
--     koncie), a rezerwacja jest SOCZEWKĄ nałożoną przy wyświetlaniu.
--
--   * BILANS MIESIĄCA też nie. Przelew z konta na cel to transfer, nie
--     wypływ - inaczej rozliczenie miesiąca zgłaszałoby, że pieniądze
--     wyparowały, choć leżą tam, gdzie leżały.
--
--   * BUDŻET UZNANIOWY - owszem, ale tylko przy wpłacie "z budżetu".
--     To świadoma decyzja: "te 500 zł idzie na cel zamiast na jedzenie
--     na mieście". Wpłata z odłożonych oszczędności budżetu nie rusza.
--
--   * PODUSZKA maleje zawsze. Pieniądze umówione na wakacje nie są zapasem
--     na wypadek utraty pracy, choćby leżały na tym samym koncie.
-- ============================================================

alter table public.finanse_wplaty
  add column if not exists zrodlo text not null default 'oszczednosci'
    check (zrodlo in ('budzet', 'oszczednosci', 'zewnetrzne'));

/*
 * Z której pozycji majątku ta kwota jest zarezerwowana. Dzięki temu
 * konto oszczędnościowe pokazuje kwotę POMNIEJSZONĄ o to, co już umówione,
 * a nie sumę, która wygląda na wolne środki.
 */
alter table public.finanse_wplaty
  add column if not exists pozycja_id uuid references public.finanse_pozycje (id) on delete set null;

comment on column public.finanse_wplaty.zrodlo is
  'budzet = zjada budżet uznaniowy; oszczednosci = z odłożonych; zewnetrzne = pieniądze z zewnątrz (0070).';
comment on column public.finanse_wplaty.pozycja_id is
  'Pozycja majątku, na której te pieniądze fizycznie leżą (0070).';

create index if not exists finanse_wplaty_pozycja_idx
  on public.finanse_wplaty (pozycja_id) where pozycja_id is not null;

-- ------------------------------------------------------------
-- Dostęp: wskazana pozycja też musi być własna
-- ------------------------------------------------------------
create or replace function public.finanse_pozycja_wlasciciel(p_pozycja_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.user_id from public.finanse_pozycje p where p.id = p_pozycja_id;
$$;

revoke all on function public.finanse_pozycja_wlasciciel(uuid) from public, anon;
grant execute on function public.finanse_pozycja_wlasciciel(uuid) to authenticated;

drop policy if exists finanse_wplaty_owner_all on public.finanse_wplaty;
create policy finanse_wplaty_owner_all on public.finanse_wplaty
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and public.finanse_cel_wlasciciel(cel_id) = (select auth.uid())
    and (pozycja_id is null
         or public.finanse_pozycja_wlasciciel(pozycja_id) = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and public.finanse_cel_wlasciciel(cel_id) = (select auth.uid())
    and (pozycja_id is null
         or public.finanse_pozycja_wlasciciel(pozycja_id) = (select auth.uid()))
  );

-- ------------------------------------------------------------
-- Rezerwacje: ile z majątku jest już na coś umówione
--
-- Liczą się tylko cele AKTYWNE. Cel osiągnięty znaczy, że pieniądze poszły
-- na to, na co miały pójść - dalsze trzymanie rezerwy pokazywałoby zapas,
-- którego już nie ma.
-- ------------------------------------------------------------
create or replace function public.finanse_zarezerwowane(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(w.kwota), 0)
    from public.finanse_wplaty w
    join public.finanse_cele c on c.id = w.cel_id
   where w.user_id = p_user and c.status = 'aktywny';
$$;

revoke all on function public.finanse_zarezerwowane(uuid) from public, anon;
grant execute on function public.finanse_zarezerwowane(uuid) to authenticated;

-- Pozycje z policzoną rezerwacją i kwotą naprawdę wolną.
create or replace view public.v_finanse_pozycje
with (security_invoker = on) as
  select
    p.*,
    coalesce(r.zarezerwowane, 0) as zarezerwowane,
    p.kwota - coalesce(r.zarezerwowane, 0) as dostepne
  from public.finanse_pozycje p
  left join lateral (
    select sum(w.kwota) as zarezerwowane
      from public.finanse_wplaty w
      join public.finanse_cele c on c.id = w.cel_id
     where w.pozycja_id = p.id and c.status = 'aktywny'
  ) r on true;

grant select on public.v_finanse_pozycje to authenticated;

-- ------------------------------------------------------------
-- Ruchy: jeden chronologiczny dziennik
--
-- Wpłat na cel nie kopiujemy do `finanse_wydatki`. Dwie tabele opisujące
-- to samo zdarzenie rozjeżdżają się przy pierwszej korekcie i nie wiadomo
-- wtedy, której wierzyć. Widok pokazuje jedno i drugie obok siebie,
-- a każde zdarzenie ma dokładnie jedno miejsce zapisu.
-- ------------------------------------------------------------
create or replace view public.v_finanse_ruchy
with (security_invoker = on) as
  select
    w.id,
    w.user_id,
    w.data,
    'wydatek'::text as typ,
    w.kwota,
    w.kategoria,
    w.opis,
    null::uuid as cel_id,
    null::text  as cel_nazwa,
    null::text  as zrodlo,
    w.created_at
  from public.finanse_wydatki w
  union all
  select
    p.id,
    p.user_id,
    p.data,
    'cel'::text,
    p.kwota,
    'cel'::text,
    p.note,
    p.cel_id,
    c.nazwa,
    p.zrodlo,
    p.created_at
  from public.finanse_wplaty p
  join public.finanse_cele c on c.id = p.cel_id;

grant select on public.v_finanse_ruchy to authenticated;

-- ------------------------------------------------------------
-- Podsumowanie: budżet zjadany przez wpłaty "z budżetu",
-- poduszka pomniejszona o rezerwacje
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
  -- Wpłaty na cel deklarowane jako "z budżetu": nie są wypływem, ale
  -- zjadają tegomiesięczną pulę na decyzje.
  wc as (
    select coalesce(sum(kwota), 0) as z_budzetu
      from public.finanse_wplaty
     where user_id = auth.uid()
       and zrodlo = 'budzet'
       and data >= date_trunc('month', current_date)::date
  ),
  rez as (
    select public.finanse_zarezerwowane(auth.uid()) as kwota
  ),
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
    'netto_szacowany',  case when s.netto is null or coalesce(od_migawki.ruch, 0) = 0
                             then null else s.netto + od_migawki.ruch end,
    'ruch_od_migawki',  od_migawki.ruch,
    'koszty_miesieczne', p.koszty_miesieczne,
    'koszty_z_szablonu', p.koszty_z_szablonu,
    'poduszka_cel',     p.poduszka_cel_miesiecy,
    -- Pieniądze umówione na cel nie są poduszką, choćby leżały na tym
    -- samym koncie. Zapas ma odpowiadać na pytanie "ile wytrzymam bez
    -- przychodu", a nie "ile mam na rachunku".
    'zarezerwowane',    rez.kwota,
    'plynne_wolne',     case when s.plynne is null then null
                             else greatest(0, s.plynne - rez.kwota) end,
    'poduszka_miesiecy', case
                           when p.koszty_miesieczne is null or p.koszty_miesieczne <= 0
                             or s.plynne is null then null
                           else round(greatest(0, s.plynne - rez.kwota) / p.koszty_miesieczne, 1)
                         end,
    'budzet',           p.budzet_uznaniowy,
    'wydane_w_miesiacu', w.wydane + wc.z_budzetu,
    'na_cele_z_budzetu', wc.z_budzetu,
    'budzet_zostalo',   case when p.budzet_uznaniowy is null then null
                             else p.budzet_uznaniowy - w.wydane - wc.z_budzetu end,
    'rozliczenie_okres', (select okres from zalegle),
    'wyciek_sredni',    (select srednia from wyciek),
    'wyciek_miesiecy',  (select ile from wyciek)
  )
  from p
  left join s on true
  left join poprzedni on true
  left join od_migawki on true
  cross join w
  cross join wc
  cross join rez;
$$;

revoke all on function public.finanse_podsumowanie() from public, anon;
grant execute on function public.finanse_podsumowanie() to authenticated;

-- ------------------------------------------------------------
-- Istniejące wpłaty dostają pozycję: największą płynną danej osoby
--
-- Zgadywanie, ale zgadywanie w jedyną sensowną stronę - odłożone pieniądze
-- leżą na koncie, a nie w samochodzie. Bez tego stare wpłaty nie
-- pomniejszałyby żadnej pozycji i rozbicie majątku nie sumowałoby się
-- do tego, co pokazuje kafelek.
-- ------------------------------------------------------------
update public.finanse_wplaty w
   set pozycja_id = naj.id
  from (
    select distinct on (user_id) user_id, id
      from public.finanse_pozycje
     where kategoria = 'plynne' and not archiwalna
     order by user_id, kwota desc
  ) naj
 where w.pozycja_id is null and naj.user_id = w.user_id;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_konto uuid;
  v_cel  uuid;
  v_p    jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0070@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
       values (v_user, 'Konto oszczędnościowe', 'oszczednosciowe', 10000)
    returning id into v_konto;
  perform public.finanse_zapisz_migawke();

  update public.profiles set budzet_uznaniowy = 800 where id = v_user;

  insert into public.finanse_cele (user_id, nazwa, kwota_cel)
       values (v_user, 'Wyjazd', 5000) returning id into v_cel;

  -- Wpłata z oszczędności: rezerwuje pieniądze, ale nie rusza budżetu.
  insert into public.finanse_wplaty (user_id, cel_id, kwota, zrodlo, pozycja_id)
       values (v_user, v_cel, 2000, 'oszczednosci', v_konto);

  v_p := public.finanse_podsumowanie();
  if (v_p ->> 'zarezerwowane')::numeric <> 2000 then
    raise exception 'Migracja 0070: zarezerwowane to % zamiast 2000', v_p ->> 'zarezerwowane';
  end if;
  if (v_p ->> 'budzet_zostalo')::numeric <> 800 then
    raise exception 'Migracja 0070: wpłata z oszczędności ruszyła budżet';
  end if;
  if (v_p ->> 'netto')::numeric <> 10000 then
    raise exception 'Migracja 0070: rezerwacja zmieniła majątek na %', v_p ->> 'netto';
  end if;
  if (select dostepne from public.v_finanse_pozycje where id = v_konto) <> 8000 then
    raise exception 'Migracja 0070: konto nie pokazuje kwoty pomniejszonej o rezerwację';
  end if;

  -- Wpłata z budżetu: zjada tegomiesięczną pulę.
  insert into public.finanse_wplaty (user_id, cel_id, kwota, zrodlo, pozycja_id)
       values (v_user, v_cel, 300, 'budzet', v_konto);
  v_p := public.finanse_podsumowanie();
  if (v_p ->> 'budzet_zostalo')::numeric <> 500 then
    raise exception 'Migracja 0070: budżet po wpłacie z budżetu to % zamiast 500', v_p ->> 'budzet_zostalo';
  end if;

  -- Bilans miesiąca ma zostać nietknięty: to transfer, nie wypływ.
  if (public.finanse_bilans() ->> 'uznaniowe')::numeric <> 0 then
    raise exception 'Migracja 0070: wpłata na cel weszła do bilansu jako wydatek';
  end if;

  -- Osiągnięty cel zwalnia rezerwację - pieniądze poszły na to, na co miały.
  update public.finanse_cele set status = 'osiagniety' where id = v_cel;
  if (public.finanse_podsumowanie() ->> 'zarezerwowane')::numeric <> 0 then
    raise exception 'Migracja 0070: zamknięty cel dalej rezerwuje pieniądze';
  end if;
  update public.finanse_cele set status = 'aktywny' where id = v_cel;

  -- Dziennik ruchów pokazuje wpłaty obok wydatków.
  insert into public.finanse_wydatki (user_id, kwota, kategoria) values (v_user, 50, 'zakupy');
  if (select count(*) from public.v_finanse_ruchy where user_id = v_user) <> 3 then
    raise exception 'Migracja 0070: dziennik ruchów nie łączy wydatków z wpłatami';
  end if;
  if (select cel_nazwa from public.v_finanse_ruchy
       where user_id = v_user and typ = 'cel' limit 1) is null then
    raise exception 'Migracja 0070: ruch typu cel nie zna nazwy celu';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
