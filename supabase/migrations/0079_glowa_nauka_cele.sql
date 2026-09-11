-- ============================================================
-- Grind — Migracja 0079: Głowa, Nauka i Cele
--
-- Trzy zakładki zatwierdzone razem z Finansami:
--   * Głowa - nastrój i stres raz dziennie, sesje wyciszenia, dziennik
--     z wdzięcznością. Jedyny filar zdrowia, którego dotąd nie było.
--   * Nauka - przedmioty z tygodniowym celem, sesje nauki, powtórki
--     rozłożone w czasie. Książki śledzą czytanie, to śledzi umiejętność.
--   * Cele - cele kwartalne i roczne, których postęp liczy się sam z danych
--     innych modułów (waga, majątek, treningi, książki, nauka, nawyk).
--
-- Postęp celów NIE jest liczony tutaj, tylko w src/lib/cele.ts - baza
-- trzyma definicję celu, a nie jego wynik. Wynik zapisany w kolumnie
-- rozjechałby się z dziennikiem przy pierwszej poprawce wagi.
--
-- XP: cztery nowe źródła. Świadomie BEZ punktów za "osiągnięty cel" -
-- status zmienia sam użytkownik, a poziomy dają dni planu Pro, więc byłby
-- to przycisk "daj mi Pro". Punkty idą za pracę, która do celu prowadzi.
-- ============================================================

-- ------------------------------------------------------------
-- Głowa
-- ------------------------------------------------------------

/*
 * Jeden wiersz na dzień. Wpis poprawia się, a nie dokłada drugi -
 * dwa nastroje z jednego dnia rozjechałyby każdą średnią.
 */
create table if not exists public.glowa_dzien (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       date not null default current_date,
  nastroj    smallint not null check (nastroj between 1 and 5),
  stres      smallint not null check (stres between 1 and 5),
  /* Zamknięta lista, ta sama co CZYNNIKI w src/lib/glowa.ts. */
  czynniki   text[] not null default '{}'
             check (czynniki <@ array['sen', 'praca', 'ludzie', 'trening', 'zdrowie',
                                      'pieniadze', 'jedzenie', 'ekran', 'pogoda']::text[]),
  notatka    text check (notatka is null or length(notatka) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data)
);

drop trigger if exists glowa_dzien_set_updated_at on public.glowa_dzien;
create trigger glowa_dzien_set_updated_at
  before update on public.glowa_dzien
  for each row execute function public.set_updated_at();

create table if not exists public.glowa_sesje (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       date not null default current_date,
  rodzaj     text not null check (rodzaj in ('medytacja', 'oddech', 'cisza')),
  minuty     smallint not null check (minuty between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists glowa_sesje_user_idx on public.glowa_sesje (user_id, data desc);

create table if not exists public.glowa_wpisy (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  data        date not null default current_date,
  tresc       text not null default '' check (length(tresc) <= 4000),
  wdziecznosc text[] not null default '{}'
              check (cardinality(wdziecznosc) <= 3
                     and length(array_to_string(wdziecznosc, '')) <= 600),
  created_at  timestamptz not null default now(),
  constraint glowa_wpisy_niepusty
    check (length(btrim(tresc)) > 0 or cardinality(wdziecznosc) > 0)
);

create index if not exists glowa_wpisy_user_idx on public.glowa_wpisy (user_id, data desc, created_at desc);

-- ------------------------------------------------------------
-- Nauka
-- ------------------------------------------------------------
create table if not exists public.nauka_tematy (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  nazwa              text not null check (length(btrim(nazwa)) between 1 and 80),
  ikona              text not null default '📘' check (length(ikona) <= 8),
  rodzaj             text not null default 'inne'
                     check (rodzaj in ('jezyk', 'studia', 'kurs', 'umiejetnosc', 'inne')),
  cel_min_tydz       smallint check (cel_min_tydz is null or cel_min_tydz between 1 and 3000),
  jednostka          text check (jednostka is null or length(jednostka) <= 20),
  jednostek_razem    integer check (jednostek_razem is null or jednostek_razem between 1 and 10000),
  jednostek_zrobione integer not null default 0 check (jednostek_zrobione >= 0),
  archiwalny         boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (user_id, nazwa),
  constraint nauka_tematy_postep_w_zakresie
    check (jednostek_razem is null or jednostek_zrobione <= jednostek_razem)
);

create table if not exists public.nauka_sesje (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  temat_id   uuid not null references public.nauka_tematy (id) on delete cascade,
  data       date not null default current_date,
  minuty     smallint not null check (minuty between 1 and 600),
  notatka    text check (notatka is null or length(notatka) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists nauka_sesje_user_idx on public.nauka_sesje (user_id, data desc);
create index if not exists nauka_sesje_temat_idx on public.nauka_sesje (temat_id);

/*
 * Powtórki rozłożone w czasie. Etapy 0-5 są w obiegu, 6 = opanowana
 * (INTERWALY_DNI w src/lib/nauka.ts). Opanowana nie ma daty następnej
 * powtórki, a każda w obiegu musi ją mieć - inaczej wypadłaby z listy
 * "na dziś" i nikt by się nie dowiedział, że zaginęła.
 */
create table if not exists public.nauka_powtorki (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  temat_id   uuid not null references public.nauka_tematy (id) on delete cascade,
  tresc      text not null check (length(btrim(tresc)) between 1 and 200),
  etap       smallint not null default 0 check (etap between 0 and 6),
  nastepna   date default (current_date + 1),
  ostatnio   date,
  created_at timestamptz not null default now(),
  constraint nauka_powtorki_data_zgodna_z_etapem
    check ((etap < 6 and nastepna is not null) or (etap = 6 and nastepna is null))
);

create index if not exists nauka_powtorki_user_idx on public.nauka_powtorki (user_id, nastepna);
create index if not exists nauka_powtorki_temat_idx on public.nauka_powtorki (temat_id);

-- ------------------------------------------------------------
-- Cele
-- ------------------------------------------------------------

/*
 * `wartosc_start` zapisywana przy tworzeniu celu: waga albo majątek
 * w dniu, w którym cel powstał. Bez niej "schudnij do 78 kg" nie ma
 * od czego liczyć procentu drogi.
 *
 * habit_id bez warunku "wymagany przy metryce nawyk": nawyk da się
 * skasować, a klucz obcy ustawia wtedy NULL - warunek zablokowałby samo
 * kasowanie nawyku. Cel bez nawyku pokazuje po prostu "brak danych".
 */
create table if not exists public.cele (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  tytul          text not null check (length(btrim(tytul)) between 1 and 100),
  opis           text check (opis is null or length(opis) <= 500),
  horyzont       text not null default 'kwartal' check (horyzont in ('kwartal', 'rok', 'wlasny')),
  metryka        text not null
                 check (metryka in ('waga', 'majatek', 'treningi', 'ksiazki',
                                    'nauka', 'nawyk', 'wlasna', 'kamienie')),
  od             date not null default current_date,
  termin         date not null,
  wartosc_cel    numeric(14, 2),
  wartosc_start  numeric(14, 2),
  wartosc_reczna numeric(14, 2),
  jednostka      text check (jednostka is null or length(jednostka) <= 20),
  habit_id       uuid references public.habits (id) on delete set null,
  temat_id       uuid references public.nauka_tematy (id) on delete set null,
  status         text not null default 'aktywny'
                 check (status in ('aktywny', 'osiagniety', 'porzucony')),
  osiagniety_at  timestamptz,
  created_at     timestamptz not null default now(),
  constraint cele_termin_po_starcie check (termin >= od),
  constraint cele_metryka_ma_cel check (metryka = 'kamienie' or wartosc_cel is not null),
  constraint cele_licznik_dodatni
    check (metryka not in ('treningi', 'ksiazki', 'nauka', 'nawyk') or wartosc_cel > 0)
);

create index if not exists cele_user_idx on public.cele (user_id, status, termin);

create table if not exists public.cele_kamienie (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  cel_id      uuid not null references public.cele (id) on delete cascade,
  tytul       text not null check (length(btrim(tytul)) between 1 and 120),
  zrobione_at timestamptz,
  kolejnosc   smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists cele_kamienie_cel_idx on public.cele_kamienie (cel_id, kolejnosc);

-- ============================================================
-- RLS - jedyna warstwa, nie druga
-- ============================================================
alter table public.glowa_dzien    enable row level security;
alter table public.glowa_sesje    enable row level security;
alter table public.glowa_wpisy    enable row level security;
alter table public.nauka_tematy   enable row level security;
alter table public.nauka_sesje    enable row level security;
alter table public.nauka_powtorki enable row level security;
alter table public.cele           enable row level security;
alter table public.cele_kamienie  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['glowa_dzien', 'glowa_sesje', 'glowa_wpisy',
                           'nauka_tematy', 'nauka_sesje', 'nauka_powtorki',
                           'cele', 'cele_kamienie']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

/*
 * Klucze obce muszą wskazywać WŁASNE wiersze.
 *
 * Sama reguła "user_id to ja" przepuściłaby sesję nauki z własnym user_id,
 * ale cudzym temat_id - i obca osoba dopisywałaby godziny do cudzego
 * przedmiotu. Ta sama dziura, którą test wyłapał przy wpłatach na cele
 * w Finansach (0064).
 *
 * Zwykłe podzapytanie wystarczy: tabele wskazywane mają własne RLS, które
 * i tak pokazuje tylko wiersze pytającego, a polityka nie pyta o tabelę,
 * na której sama stoi - więc nie ma zapętlenia z 0037.
 */
drop policy if exists nauka_sesje_temat_wlasny on public.nauka_sesje;
create policy nauka_sesje_temat_wlasny on public.nauka_sesje
  as restrictive for all to authenticated
  using (exists (select 1 from public.nauka_tematy t
                  where t.id = temat_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nauka_tematy t
                       where t.id = temat_id and t.user_id = (select auth.uid())));

drop policy if exists nauka_powtorki_temat_wlasny on public.nauka_powtorki;
create policy nauka_powtorki_temat_wlasny on public.nauka_powtorki
  as restrictive for all to authenticated
  using (exists (select 1 from public.nauka_tematy t
                  where t.id = temat_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nauka_tematy t
                       where t.id = temat_id and t.user_id = (select auth.uid())));

drop policy if exists cele_powiazania_wlasne on public.cele;
create policy cele_powiazania_wlasne on public.cele
  as restrictive for all to authenticated
  using (true)
  with check (
    (habit_id is null or exists (select 1 from public.habits h
                                  where h.id = habit_id and h.user_id = (select auth.uid())))
    and
    (temat_id is null or exists (select 1 from public.nauka_tematy t
                                  where t.id = temat_id and t.user_id = (select auth.uid())))
  );

drop policy if exists cele_kamienie_cel_wlasny on public.cele_kamienie;
create policy cele_kamienie_cel_wlasny on public.cele_kamienie
  as restrictive for all to authenticated
  using (exists (select 1 from public.cele c
                  where c.id = cel_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.cele c
                       where c.id = cel_id and c.user_id = (select auth.uid())));

grant select, insert, update, delete on
  public.glowa_dzien, public.glowa_sesje, public.glowa_wpisy,
  public.nauka_tematy, public.nauka_sesje, public.nauka_powtorki,
  public.cele, public.cele_kamienie
  to authenticated;

-- ============================================================
-- XP
--
-- Funkcja przepisana z 0068 bez zmian, z czterema nowymi źródłami:
--   glowa      5 XP, raz dziennie      - wpis nastroju
--   medytacja 10 XP, raz dziennie      - sesja od 3 minut
--   nauka     15 XP, dwa razy dziennie - sesja od 10 minut
--   powtorka   2 XP, do 10 dziennie    - pamiętana powtórka
-- ============================================================
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
      ('trening',   25, 2),
      ('nawyk',      5, 10),
      ('dieta',      5, 4),
      ('woda',      10, 1),
      ('sen',       10, 1),
      ('ksiazka',   50, 2),
      ('skan',      30, 1),
      ('budzet',    10, 1),
      ('glowa',      5, 1),
      ('medytacja', 10, 1),
      ('nauka',     15, 2),
      ('powtorka',   2, 10)
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

/*
 * Wyzwalacz z 0057 z trzema dopiskami:
 *   * nowe źródła punktują w dniu ZAPISU, a nie w dniu z wiersza. Wpis
 *     nastroju sprzed miesiąca jest w porządku, ale trzydzieści wpisów
 *     wstecz nie może dać trzydziestu dni punktów naraz,
 *   * sesja nauki krótsza niż 10 minut i medytacja krótsza niż 3 nie
 *     punktują - inaczej XP dawałoby się wyklikać minutowymi sesjami,
 *   * reszta bez zmian.
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

    if tg_argv[0] in ('glowa', 'medytacja', 'nauka', 'powtorka') then
      v_dzien := current_date;
    end if;

    if tg_argv[0] = 'nauka' and coalesce((to_jsonb(new) ->> 'minuty')::int, 0) < 10 then
      return new;
    end if;
    if tg_argv[0] = 'medytacja' and coalesce((to_jsonb(new) ->> 'minuty')::int, 0) < 3 then
      return new;
    end if;

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

drop trigger if exists xp_glowa on public.glowa_dzien;
create trigger xp_glowa after insert on public.glowa_dzien
  for each row execute function private.xp_tg('glowa');

drop trigger if exists xp_medytacja on public.glowa_sesje;
create trigger xp_medytacja after insert on public.glowa_sesje
  for each row execute function private.xp_tg('medytacja');

drop trigger if exists xp_nauka on public.nauka_sesje;
create trigger xp_nauka after insert on public.nauka_sesje
  for each row execute function private.xp_tg('nauka');

-- Tylko awans etapu, czyli "pamiętam". Cofnięcie na zero nie punktuje.
drop trigger if exists xp_powtorka on public.nauka_powtorki;
create trigger xp_powtorka after update of etap on public.nauka_powtorki
  for each row
  when (new.etap > old.etap)
  execute function private.xp_tg('powtorka');

-- ============================================================
-- Sprawdzenie
-- ============================================================
do $$
declare
  v_bez  text[];
  v_u    uuid;
  v_t    uuid;
  v_xp   integer;
begin
  select coalesce(array_agg(t order by t), '{}') into v_bez
    from unnest(array['glowa_dzien', 'glowa_sesje', 'glowa_wpisy', 'nauka_tematy',
                      'nauka_sesje', 'nauka_powtorki', 'cele', 'cele_kamienie']) t
   where not exists (
     select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r' and c.relrowsecurity
   );
  if array_length(v_bez, 1) > 0 then
    raise exception 'Migracja 0079: tabela nie istnieje albo nie ma RLS: %', v_bez;
  end if;

  v_bez := public.policies_rechecking_uid();
  if array_length(v_bez, 1) > 0 then
    raise exception 'Migracja 0079: polityka przeliczająca tożsamość co wiersz: %', v_bez;
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0079@grind.local')
    returning id into v_u;

  -- Wpis nastroju punktuje, drugi tego samego dnia już nie.
  insert into public.glowa_dzien (user_id, nastroj, stres) values (v_u, 4, 2);
  insert into public.glowa_dzien (user_id, data, nastroj, stres) values (v_u, current_date - 30, 3, 3);
  select xp into v_xp from public.xp_zdarzenia where user_id = v_u and zrodlo = 'glowa';
  if v_xp is distinct from 5 then
    raise exception 'Migracja 0079: nastrój dał % XP zamiast 5', v_xp;
  end if;
  if exists (select 1 from public.xp_zdarzenia
              where user_id = v_u and zrodlo = 'glowa' and dzien <> current_date) then
    raise exception 'Migracja 0079: wpis wstecz punktuje w przeszłości';
  end if;

  -- Nauka: pięć minut to za mało na punkty, pół godziny już nie.
  insert into public.nauka_tematy (user_id, nazwa) values (v_u, 'Angielski') returning id into v_t;
  insert into public.nauka_sesje (user_id, temat_id, minuty) values (v_u, v_t, 5);
  if exists (select 1 from public.xp_zdarzenia where user_id = v_u and zrodlo = 'nauka') then
    raise exception 'Migracja 0079: pięciominutowa sesja nauki dała XP';
  end if;
  insert into public.nauka_sesje (user_id, temat_id, minuty) values (v_u, v_t, 30);
  if not exists (select 1 from public.xp_zdarzenia where user_id = v_u and zrodlo = 'nauka') then
    raise exception 'Migracja 0079: półgodzinna sesja nauki nie dała XP';
  end if;

  -- Przepisanie funkcji nie może zgubić starych źródeł.
  perform private.xp_przyznaj(v_u, 'budzet', current_date);
  if not exists (select 1 from public.xp_zdarzenia where user_id = v_u and zrodlo = 'budzet') then
    raise exception 'Migracja 0079: xp_przyznaj zgubił źródło budzet';
  end if;

  begin
    insert into public.glowa_dzien (user_id, data, nastroj, stres, czynniki)
         values (v_u, current_date - 1, 3, 3, array['wymyslony']);
    raise exception 'Migracja 0079: czynnik spoza listy przeszedł';
  exception when check_violation then null;
  end;

  begin
    insert into public.nauka_powtorki (user_id, temat_id, tresc, etap, nastepna)
         values (v_u, v_t, 'x', 6, current_date);
    raise exception 'Migracja 0079: opanowana powtórka z datą następnej przeszła';
  exception when check_violation then null;
  end;

  delete from auth.users where id = v_u;
end;
$$;
