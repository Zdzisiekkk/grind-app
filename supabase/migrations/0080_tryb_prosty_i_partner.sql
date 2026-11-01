-- ============================================================
-- Grind - Migracja 0080: tryb uproszczony i tryb dla partnerów
--
-- Dwie rzeczy, które idą razem:
--
--   1. `profiles.tryb` - 'pelny' (cała aplikacja) albo 'prosty' (tylko
--      kalorie, treningi, skin care i nawyki). Konto NIE przestawia sobie
--      trybu samo: zmienia go administrator. Pilnuje tego polityka na
--      profiles (jak przy `role`), a zmiana idzie przez admin_ustaw_tryb.
--
--   2. Para ("lock-in we dwoje"): dwa konta łączone kodem zaproszenia,
--      podgląd dnia partnera, wspólne nawyki, szturchnięcia i reakcje oraz
--      alert wieczorny, gdy partner ma zaległości.
--
-- Podgląd partnera NIE jest polityką RLS na tabelach źródłowych, tylko jedną
-- funkcją (partner_dzien), która oddaje wąski wycinek: posiłki, woda,
-- treningi, nawyki i skin care danego dnia. Polityka na meal_entries czy
-- habits otworzyłaby partnerowi całe tabele - łącznie z notatkami i zdjęciami,
-- o których nikt nie zdecydował, że mają być wspólne.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tryb konta
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists tryb text not null default 'pelny'
    check (tryb in ('pelny', 'prosty'));

/* Czy partner dostaje wieczorny alert, gdy druga osoba ma zaległości. */
alter table public.profiles
  add column if not exists partner_alerty boolean not null default true;

create or replace function public.my_tryb()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.tryb from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.my_tryb() from public, anon;
grant execute on function public.my_tryb() to authenticated;

/* Jak przy roli: nowa wartość musi równać się zapisanej, więc samemu się nie przestawisz. */
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.my_role())
    and tryb = (select public.my_tryb())
  );

comment on policy profiles_update_own on public.profiles is
  'Własny profil, ale bez zmiany roli i trybu - jedno i drugie nadaje administrator.';

create or replace function public.admin_ustaw_tryb(p_konto uuid, p_tryb text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Zmiana trybu wymaga uprawnień administratora';
  end if;
  if p_tryb not in ('pelny', 'prosty') then
    raise exception 'Nieznany tryb: %', p_tryb;
  end if;
  update public.profiles set tryb = p_tryb where id = p_konto;
end;
$$;

/* Lista kont do przełączania: metadane, tak jak admin_uzytkownicy. */
create or replace function public.admin_tryby()
returns table (id uuid, email text, display_name text, tryb text, w_parze boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Zmiana trybu wymaga uprawnień administratora';
  end if;
  return query
  select p.id, p.email, p.display_name, p.tryb,
         exists (select 1 from public.partner_pary pp where pp.user_id = p.id)
    from public.profiles p
   order by p.created_at desc
   limit 200;
end;
$$;

-- ------------------------------------------------------------
-- 2. Para
--
-- Dwa lustrzane wiersze na parę: `user_id` jest kluczem głównym, więc osoba
-- ma najwyżej jednego partnera, a odczyt "kto jest moim partnerem" to
-- zwykłe wyszukanie po kluczu.
-- ------------------------------------------------------------
create table if not exists public.partner_pary (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  partner_id uuid not null references auth.users (id) on delete cascade,
  para_id    uuid not null,
  created_at timestamptz not null default now(),
  constraint partner_pary_nie_ze_soba check (user_id <> partner_id)
);

create index if not exists partner_pary_para_idx on public.partner_pary (para_id);

create table if not exists public.partner_zaproszenia (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kod     text not null unique,
  wygasa  timestamptz not null
);

alter table public.partner_pary enable row level security;
alter table public.partner_zaproszenia enable row level security;

drop policy if exists partner_pary_wlasne on public.partner_pary;
create policy partner_pary_wlasne on public.partner_pary
  for select to authenticated
  using (user_id = (select auth.uid()));

/* Zaproszeń nie czyta nikt bezpośrednio - kod odbiera się funkcją. */
revoke all on table public.partner_zaproszenia from public, anon, authenticated;
revoke all on table public.partner_pary from public, anon, authenticated;
grant select on table public.partner_pary to authenticated;

create or replace function public.partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pp.partner_id from public.partner_pary pp where pp.user_id = auth.uid();
$$;

create or replace function public.partner_para_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pp.para_id from public.partner_pary pp where pp.user_id = auth.uid();
$$;

/* Stan na ekran "Partner": z kim jestem w parze albo jaki mam aktywny kod. */
create or replace function public.partner_stan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_para record;
  v_kod  record;
begin
  select pp.partner_id, pr.display_name, pr.email
    into v_para
    from public.partner_pary pp
    join public.profiles pr on pr.id = pp.partner_id
   where pp.user_id = auth.uid();

  if found then
    return jsonb_build_object(
      'w_parze', true,
      'imie', coalesce(nullif(btrim(v_para.display_name), ''), split_part(v_para.email, '@', 1)),
      'alerty', (select p.partner_alerty from public.profiles p where p.id = auth.uid())
    );
  end if;

  select z.kod, z.wygasa into v_kod
    from public.partner_zaproszenia z
   where z.user_id = auth.uid() and z.wygasa > now();

  return jsonb_build_object(
    'w_parze', false,
    'kod', v_kod.kod,
    'wygasa', v_kod.wygasa
  );
end;
$$;

create or replace function public.partner_kod()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Bez znaków łatwych do pomylenia (0/O, 1/I): kod się przepisuje z telefonu.
  v_alfabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_kod     text;
  v_proba   integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Wymagane logowanie';
  end if;
  if exists (select 1 from public.partner_pary where user_id = auth.uid()) then
    raise exception 'Jesteś już w parze';
  end if;

  delete from public.partner_zaproszenia where user_id = auth.uid();

  loop
    v_kod := '';
    for i in 1..8 loop
      v_kod := v_kod || substr(v_alfabet, 1 + floor(random() * length(v_alfabet))::int, 1);
    end loop;
    begin
      insert into public.partner_zaproszenia (user_id, kod, wygasa)
           values (auth.uid(), v_kod, now() + interval '48 hours');
      return v_kod;
    exception when unique_violation then
      v_proba := v_proba + 1;
      if v_proba > 10 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.partner_dolacz(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zapros public.partner_zaproszenia;
  v_para   uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Wymagane logowanie';
  end if;
  if exists (select 1 from public.partner_pary where user_id = auth.uid()) then
    raise exception 'Jesteś już w parze';
  end if;

  select * into v_zapros
    from public.partner_zaproszenia z
   where z.kod = upper(regexp_replace(coalesce(p_kod, ''), '[^A-Za-z0-9]', '', 'g'))
     and z.wygasa > now();

  if not found then
    raise exception 'Kod nie pasuje albo wygasł';
  end if;
  if v_zapros.user_id = auth.uid() then
    raise exception 'To Twój własny kod - wyślij go drugiej osobie';
  end if;
  if exists (select 1 from public.partner_pary where user_id = v_zapros.user_id) then
    raise exception 'Ta osoba jest już w parze';
  end if;

  insert into public.partner_pary (user_id, partner_id, para_id)
       values (auth.uid(), v_zapros.user_id, v_para),
              (v_zapros.user_id, auth.uid(), v_para);

  delete from public.partner_zaproszenia where user_id in (auth.uid(), v_zapros.user_id);

  return public.partner_stan();
end;
$$;

create or replace function public.partner_rozlacz()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para uuid;
begin
  select pp.para_id into v_para from public.partner_pary pp where pp.user_id = auth.uid();
  if v_para is null then return; end if;
  -- Wspólne nawyki i wiadomości należą do pary - razem z nią znikają.
  delete from public.partner_wspolne where para_id = v_para;
  delete from public.partner_wiadomosci where para_id = v_para;
  delete from public.partner_pary where para_id = v_para;
end;
$$;

create or replace function public.partner_ustaw_alerty(p_wlaczone boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set partner_alerty = p_wlaczone where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 3. Wspólne nawyki
-- ------------------------------------------------------------
create table if not exists public.partner_wspolne (
  id         uuid primary key default gen_random_uuid(),
  para_id    uuid not null,
  nazwa      text not null check (length(btrim(nazwa)) between 1 and 60),
  ikona      text not null default '🔥' check (length(ikona) <= 8),
  autor_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists partner_wspolne_para_idx on public.partner_wspolne (para_id);

create table if not exists public.partner_wspolne_log (
  wspolne_id uuid not null references public.partner_wspolne (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       date not null default current_date,
  primary key (wspolne_id, user_id, data)
);

alter table public.partner_wspolne enable row level security;
alter table public.partner_wspolne_log enable row level security;

/* Para wspólnego nawyku - funkcją, żeby polityka na logu nie pytała o tabelę z własną polityką. */
create or replace function public.partner_wspolne_para(p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.para_id from public.partner_wspolne w where w.id = p_id;
$$;

drop policy if exists partner_wspolne_para_all on public.partner_wspolne;
create policy partner_wspolne_para_all on public.partner_wspolne
  for all to authenticated
  using (para_id = (select public.partner_para_id()))
  with check (para_id = (select public.partner_para_id()) and autor_id = (select auth.uid()));

drop policy if exists partner_wspolne_log_widok on public.partner_wspolne_log;
create policy partner_wspolne_log_widok on public.partner_wspolne_log
  for select to authenticated
  using (public.partner_wspolne_para(wspolne_id) = (select public.partner_para_id()));

/* Odhaczać można tylko za siebie, ale tylko we wspólnym nawyku swojej pary. */
drop policy if exists partner_wspolne_log_zapis on public.partner_wspolne_log;
create policy partner_wspolne_log_zapis on public.partner_wspolne_log
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.partner_wspolne_para(wspolne_id) = (select public.partner_para_id())
  );

drop policy if exists partner_wspolne_log_cofniecie on public.partner_wspolne_log;
create policy partner_wspolne_log_cofniecie on public.partner_wspolne_log
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 4. Szturchnięcia, reakcje, wiadomości
--
-- Zapis wyłącznie przez partner_wyslij: nadawca i odbiorca wynikają z pary,
-- nie z tego, co przyśle klient. Bez tego dałoby się pisać do cudzej pary.
-- ------------------------------------------------------------
create table if not exists public.partner_wiadomosci (
  id         uuid primary key default gen_random_uuid(),
  para_id    uuid not null,
  od_id      uuid not null references auth.users (id) on delete cascade,
  do_id      uuid not null references auth.users (id) on delete cascade,
  rodzaj     text not null check (rodzaj in ('szturch', 'reakcja', 'wiadomosc')),
  kontekst   text not null default 'ogolne'
             check (kontekst in ('ogolne', 'trening', 'posilek', 'nawyk', 'skincare', 'woda')),
  tresc      text check (tresc is null or length(tresc) <= 200),
  emoji      text check (emoji is null or length(emoji) <= 8),
  data       date not null default current_date,
  odczytano  timestamptz,
  created_at timestamptz not null default now(),
  constraint partner_wiadomosci_nie_pusta
    check (rodzaj = 'szturch' or tresc is not null or emoji is not null)
);

create index if not exists partner_wiadomosci_para_idx
  on public.partner_wiadomosci (para_id, created_at desc);
create index if not exists partner_wiadomosci_odbiorca_idx
  on public.partner_wiadomosci (do_id, created_at desc);

alter table public.partner_wiadomosci enable row level security;

drop policy if exists partner_wiadomosci_widok on public.partner_wiadomosci;
create policy partner_wiadomosci_widok on public.partner_wiadomosci
  for select to authenticated
  using (od_id = (select auth.uid()) or do_id = (select auth.uid()));

revoke all on table public.partner_wiadomosci from public, anon, authenticated;
grant select on table public.partner_wiadomosci to authenticated;

create or replace function public.partner_wyslij(
  p_rodzaj   text,
  p_kontekst text default 'ogolne',
  p_tresc    text default null,
  p_emoji    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para  record;
  v_id    uuid;
begin
  select pp.para_id, pp.partner_id into v_para
    from public.partner_pary pp where pp.user_id = auth.uid();
  if not found then
    raise exception 'Nie jesteś w parze';
  end if;

  -- Bezpiecznik przed zalewaniem partnera powiadomieniami (też przez pomyłkę
  -- w pętli): dwadzieścia wiadomości na godzinę wystarczy każdej parze.
  if (select count(*) from public.partner_wiadomosci m
       where m.od_id = auth.uid() and m.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Za dużo wiadomości naraz - odczekaj chwilę';
  end if;

  insert into public.partner_wiadomosci (para_id, od_id, do_id, rodzaj, kontekst, tresc, emoji)
       values (v_para.para_id, auth.uid(), v_para.partner_id, p_rodzaj,
               coalesce(p_kontekst, 'ogolne'),
               nullif(btrim(p_tresc), ''), nullif(btrim(p_emoji), ''))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.partner_odczytane()
returns void
language sql
security definer
set search_path = public
as $$
  update public.partner_wiadomosci
     set odczytano = now()
   where do_id = auth.uid() and odczytano is null;
$$;

/*
 * Subskrypcje push partnera - wyłącznie dla jego pary. Klucze same niczego
 * nie pozwalają wysłać: powiadomienie podpisuje VAPID, a klucz prywatny
 * trzyma tylko serwer aplikacji.
 */
create or replace function public.partner_subskrypcje()
returns table (endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
   where s.user_id = (select pp.partner_id from public.partner_pary pp where pp.user_id = auth.uid())
     and s.failures < 5;
$$;

-- ------------------------------------------------------------
-- 5. Dzień partnera
-- ------------------------------------------------------------
create or replace function public.partner_dzien(p_data date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p    uuid := (select pp.partner_id from public.partner_pary pp where pp.user_id = auth.uid());
  v_prof public.profiles;
  v_data date := least(greatest(p_data, current_date - 30), current_date + 1);
begin
  if v_p is null then
    return null;
  end if;

  select * into v_prof from public.profiles where id = v_p;

  return jsonb_build_object(
    'imie', coalesce(nullif(btrim(v_prof.display_name), ''), split_part(v_prof.email, '@', 1)),
    'data', v_data,
    'cel_kcal', v_prof.daily_kcal,
    'cel_wody_ml', coalesce(v_prof.daily_water_ml, 2500),

    'kcal', coalesce((
      select round(sum(e.kcal)) from public.meals m
        join public.meal_entries e on e.meal_id = m.id
       where m.user_id = v_p and m.date = v_data), 0),
    'bialko', coalesce((
      select round(sum(e.protein)) from public.meals m
        join public.meal_entries e on e.meal_id = m.id
       where m.user_id = v_p and m.date = v_data), 0),

    'posilki', coalesce((
      select jsonb_agg(jsonb_build_object(
               'typ', m.meal_type, 'nazwa', e.food_name,
               'gramy', e.grams, 'kcal', round(e.kcal))
             order by e.created_at)
        from public.meals m
        join public.meal_entries e on e.meal_id = m.id
       where m.user_id = v_p and m.date = v_data), '[]'::jsonb),

    'woda_ml', coalesce((
      select sum(w.ml) from public.water_logs w
       where w.user_id = v_p and w.date = v_data), 0),

    'treningi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nazwa', coalesce(s.day_label, 'Trening'),
               'zakonczony', s.finished_at is not null,
               'minuty', s.duration_min,
               'serie', (select count(*) from public.workout_logs l
                          where l.session_id = s.id and not l.is_warmup))
             order by s.started_at)
        from public.workout_sessions s
       where s.user_id = v_p and s.date = v_data), '[]'::jsonb),

    'nawyki', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nazwa', h.name, 'ikona', h.icon, 'cel', h.target_per_day,
               'zrobione', coalesce((select l.count from public.habit_logs l
                                      where l.habit_id = h.id and l.date = v_data), 0))
             order by h.order_index)
        from public.habits h
       where h.user_id = v_p and not h.is_archived
         and (cardinality(h.days_of_week) = 0
              or extract(isodow from v_data)::smallint = any(h.days_of_week))), '[]'::jsonb),

    'skincare', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nazwa', r.nazwa, 'pora', r.pora,
               'zrobione', exists (select 1 from public.wyglad_rutyna_log l
                                    where l.rutyna_id = r.id and l.data = v_data and l.wykonano))
             order by r.pora, r.nazwa)
        from public.wyglad_rutyny r
       where r.user_id = v_p and r.aktywna), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 6. Wieczorny alert: partner ma zaległości
--
-- Kształt wyniku identyczny jak private.push_due, żeby trasa wysyłki mogła
-- połączyć obie listy. Ten sam sekret, to samo zaklepanie w push_sent -
-- powtórzone wywołanie crona nie wyśle tego samego dwa razy.
-- ------------------------------------------------------------
create or replace function private.partner_push_due(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
  v_out    jsonb := '[]'::jsonb;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    return '[]'::jsonb;
  end if;

  with odbiorcy as (
    select s.user_id, s.endpoint, s.p256dh, s.auth, pp.partner_id,
           coalesce(nullif(btrim(pr.display_name), ''), split_part(pr.email, '@', 1)) as imie,
           (now() at time zone coalesce(nullif(me.timezone, ''), 'Europe/Warsaw'))::date as dzien,
           extract(hour from now() at time zone coalesce(nullif(me.timezone, ''), 'Europe/Warsaw'))::int * 60
             + extract(minute from now() at time zone coalesce(nullif(me.timezone, ''), 'Europe/Warsaw'))::int as minuta
      from public.push_subscriptions s
      join public.profiles me on me.id = s.user_id and me.partner_alerty
      join public.partner_pary pp on pp.user_id = s.user_id
      join public.profiles pr on pr.id = pp.partner_id
     where s.failures < 5
  ),
  zalegle as (
    select o.*,
      (select count(*) from public.habits h
        where h.user_id = o.partner_id and not h.is_archived
          and (cardinality(h.days_of_week) = 0
               or extract(isodow from o.dzien)::smallint = any(h.days_of_week))
          and coalesce((select l.count from public.habit_logs l
                         where l.habit_id = h.id and l.date = o.dzien), 0) < h.target_per_day) as nawyki,
      (select count(*) from public.wyglad_rutyny r
        where r.user_id = o.partner_id and r.aktywna
          and not exists (select 1 from public.wyglad_rutyna_log l
                           where l.rutyna_id = r.id and l.data = o.dzien and l.wykonano)) as skincare
      from odbiorcy o
     -- 20:30, okno kwadransa jak w push_due.
     where o.minuta between 20 * 60 + 30 - 14 and 20 * 60 + 30
  ),
  do_wyslania as (
    select * from zalegle where nawyki + skincare > 0
  ),
  zaklepane as (
    insert into public.push_sent (user_id, key, date)
    select distinct user_id, 'partner-alert', dzien from do_wyslania
    on conflict (user_id, key, date) do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',  d.user_id,
           'endpoint', d.endpoint,
           'p256dh',   d.p256dh,
           'auth',     d.auth,
           'key',      'partner-alert',
           'title',    'Grind - ' || d.imie,
           'body',     d.imie || ' ma jeszcze na dziś: '
                       || concat_ws(', ',
                            case when d.nawyki > 0 then d.nawyki || ' nawyk(i)' end,
                            case when d.skincare > 0 then d.skincare || ' skin care' end)
                       || '. Szturchnij.',
           'url',      '/partner'
         )), '[]'::jsonb)
    into v_out
    from do_wyslania d
    join zaklepane z on z.user_id = d.user_id;

  return v_out;
end;
$$;

create or replace function public.partner_push_due(p_secret text)
returns jsonb
language sql
security definer
set search_path = public, private
as $$ select private.partner_push_due(p_secret); $$;

-- ------------------------------------------------------------
-- 7. Uprawnienia funkcji
--
-- Każda nowa funkcja domyślnie dostaje EXECUTE dla anona. Zabieramy to jawnie,
-- a oddajemy tylko tym, którzy mają jej używać. Wyjątek: partner_push_due,
-- wołany kluczem anon z sekretem budzika (jak push_due).
-- ------------------------------------------------------------
revoke all on function public.admin_ustaw_tryb(uuid, text) from public, anon;
revoke all on function public.admin_tryby() from public, anon;
revoke all on function public.partner_id() from public, anon;
revoke all on function public.partner_para_id() from public, anon;
revoke all on function public.partner_stan() from public, anon;
revoke all on function public.partner_kod() from public, anon;
revoke all on function public.partner_dolacz(text) from public, anon;
revoke all on function public.partner_rozlacz() from public, anon;
revoke all on function public.partner_ustaw_alerty(boolean) from public, anon;
revoke all on function public.partner_wspolne_para(uuid) from public, anon;
revoke all on function public.partner_wyslij(text, text, text, text) from public, anon;
revoke all on function public.partner_odczytane() from public, anon;
revoke all on function public.partner_subskrypcje() from public, anon;
revoke all on function public.partner_dzien(date) from public, anon;
revoke all on function private.partner_push_due(text) from public;
revoke all on function public.partner_push_due(text) from public;

grant execute on function public.admin_ustaw_tryb(uuid, text) to authenticated;
grant execute on function public.admin_tryby() to authenticated;
grant execute on function public.partner_id() to authenticated;
grant execute on function public.partner_para_id() to authenticated;
grant execute on function public.partner_stan() to authenticated;
grant execute on function public.partner_kod() to authenticated;
grant execute on function public.partner_dolacz(text) to authenticated;
grant execute on function public.partner_rozlacz() to authenticated;
grant execute on function public.partner_ustaw_alerty(boolean) to authenticated;
grant execute on function public.partner_wspolne_para(uuid) to authenticated;
grant execute on function public.partner_wyslij(text, text, text, text) to authenticated;
grant execute on function public.partner_odczytane() to authenticated;
grant execute on function public.partner_subskrypcje() to authenticated;
grant execute on function public.partner_dzien(date) to authenticated;
grant execute on function public.partner_push_due(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_a    uuid;
  v_b    uuid;
  v_c    uuid;
  v_kod  text;
  v_h    uuid;
  v_w    uuid;
  v_dzien jsonb;
  v_bez  text[];
begin
  v_bez := public.policies_rechecking_uid();
  if array_length(v_bez, 1) > 0 then
    raise exception 'Migracja 0080: polityka przeliczająca tożsamość co wiersz: %', v_bez;
  end if;

  insert into auth.users (id, email) values (gen_random_uuid(), 'test-0080-a@grind.local') returning id into v_a;
  insert into auth.users (id, email) values (gen_random_uuid(), 'test-0080-b@grind.local') returning id into v_b;
  insert into auth.users (id, email) values (gen_random_uuid(), 'test-0080-c@grind.local') returning id into v_c;

  if (select tryb from public.profiles where id = v_a) <> 'pelny' then
    raise exception 'Migracja 0080: nowe konto nie startuje w trybie pełnym';
  end if;

  -- Konto nie przestawia sobie trybu samo.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  begin
    update public.profiles set tryb = 'prosty' where id = v_b;
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select tryb from public.profiles where id = v_b) <> 'pelny' then
    raise exception 'Migracja 0080: konto samo zmieniło sobie tryb';
  end if;

  -- Administrator zmienia tryb.
  update public.profiles set role = 'admin' where id = v_a;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.admin_ustaw_tryb(v_b, 'prosty');
  if (select tryb from public.profiles where id = v_b) <> 'prosty' then
    raise exception 'Migracja 0080: administrator nie zmienił trybu';
  end if;

  -- Zwykłe konto nie ma wstępu do zmiany trybu.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  begin
    perform public.admin_ustaw_tryb(v_b, 'pelny');
    raise exception 'Migracja 0080: zwykłe konto zmieniło tryb przez funkcję admina';
  exception when others then
    if sqlerrm like 'Migracja 0080:%' then raise; end if;
  end;

  -- Parowanie kodem.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_kod := public.partner_kod();
  if length(v_kod) <> 8 then
    raise exception 'Migracja 0080: kod zaproszenia ma długość %', length(v_kod);
  end if;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  begin
    perform public.partner_dolacz(v_kod);
    raise exception 'Migracja 0080: własny kod przyjęty';
  exception when others then
    if sqlerrm like 'Migracja 0080:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  begin
    perform public.partner_dolacz('ZLYKOD00');
    raise exception 'Migracja 0080: zły kod przyjęty';
  exception when others then
    if sqlerrm like 'Migracja 0080:%' then raise; end if;
  end;
  perform public.partner_dolacz(lower(substr(v_kod, 1, 4) || '-' || substr(v_kod, 5)));

  if public.partner_id() is distinct from v_a then
    raise exception 'Migracja 0080: partner B to nie A';
  end if;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  if public.partner_id() is distinct from v_b then
    raise exception 'Migracja 0080: partner A to nie B';
  end if;

  -- Trzecia osoba nie wejdzie do zajętej pary tym samym kodem (kod zużyty).
  perform set_config('request.jwt.claim.sub', v_c::text, true);
  begin
    perform public.partner_dolacz(v_kod);
    raise exception 'Migracja 0080: zużyty kod przyjęty';
  exception when others then
    if sqlerrm like 'Migracja 0080:%' then raise; end if;
  end;
  if public.partner_dzien(current_date) is not null then
    raise exception 'Migracja 0080: osoba bez pary dostała dzień cudzego partnera';
  end if;

  -- Dzień partnera: A widzi nawyk i posiłek B, C nie widzi nic.
  insert into public.habits (user_id, name) values (v_b, 'Kreatyna') returning id into v_h;
  insert into public.habit_logs (user_id, habit_id, count) values (v_b, v_h, 1);
  insert into public.meals (user_id, meal_type) values (v_b, 'lunch');
  insert into public.meal_entries (user_id, meal_id, food_name, grams, kcal_100g)
       select v_b, m.id, 'Ryż', 200, 130 from public.meals m where m.user_id = v_b;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  v_dzien := public.partner_dzien(current_date);
  if (v_dzien -> 'nawyki' -> 0 ->> 'nazwa') is distinct from 'Kreatyna'
     or (v_dzien ->> 'kcal')::int <> 260 then
    raise exception 'Migracja 0080: dzień partnera niepoprawny: %', v_dzien;
  end if;

  -- Wspólny nawyk: widoczny dla pary, odhaczany tylko za siebie.
  insert into public.partner_wspolne (para_id, nazwa, autor_id)
       values (public.partner_para_id(), 'Spacer 8k', v_a) returning id into v_w;

  set local role authenticated;
  insert into public.partner_wspolne_log (wspolne_id, user_id) values (v_w, v_a);
  begin
    insert into public.partner_wspolne_log (wspolne_id, user_id) values (v_w, v_b);
    reset role;
    raise exception 'Migracja 0080: odhaczono wspólny nawyk za partnera';
  exception when insufficient_privilege then reset role;
  end;
  reset role;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  set local role authenticated;
  if (select count(*) from public.partner_wspolne) <> 1
     or (select count(*) from public.partner_wspolne_log) <> 1 then
    reset role;
    raise exception 'Migracja 0080: partner nie widzi wspólnego nawyku';
  end if;
  reset role;

  perform set_config('request.jwt.claim.sub', v_c::text, true);
  set local role authenticated;
  if (select count(*) from public.partner_wspolne) <> 0 then
    reset role;
    raise exception 'Migracja 0080: obca osoba widzi cudze wspólne nawyki';
  end if;
  reset role;

  -- Wiadomości: szturchnięcie dochodzi tylko do partnera.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.partner_wyslij('szturch', 'nawyk', 'Kreatyna!');
  perform set_config('request.jwt.claim.sub', v_c::text, true);
  begin
    perform public.partner_wyslij('szturch');
    raise exception 'Migracja 0080: osoba bez pary wysłała szturchnięcie';
  exception when others then
    if sqlerrm like 'Migracja 0080:%' then raise; end if;
  end;
  set local role authenticated;
  if (select count(*) from public.partner_wiadomosci) <> 0 then
    reset role;
    raise exception 'Migracja 0080: obca osoba czyta cudze wiadomości';
  end if;
  reset role;

  -- Rozłączenie czyści wszystko, co wspólne.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.partner_rozlacz();
  if exists (select 1 from public.partner_pary where user_id in (v_a, v_b))
     or exists (select 1 from public.partner_wspolne)
     or exists (select 1 from public.partner_wiadomosci) then
    raise exception 'Migracja 0080: rozłączenie nie wyczyściło pary';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id in (v_a, v_b, v_c);
end;
$$;
