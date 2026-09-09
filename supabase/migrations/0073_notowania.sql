-- ============================================================
-- Grind — Migracja 0073: notowania aktywów
--
-- Ręczne wpisywanie ceny co tydzień kończy się tak samo jak każde ręczne
-- wpisywanie czegokolwiek: po miesiącu portfel pokazuje ceny sprzed miesiąca
-- i przestaje cokolwiek znaczyć.
--
-- Dwie decyzje warte zapisania:
--
--   * NOTOWANIA SĄ PER UŻYTKOWNIK, choć to dane publiczne. Wspólny cache
--     oszczędziłby kilka zapytań, ale zapis do niego musiałby być dostępny
--     dla zalogowanych - a wtedy jedna osoba mogłaby wpisać cenę, po której
--     wycenia się cudzy portfel. Kilka nadmiarowych pobrań to tania cena
--     za brak tej klasy błędów.
--
--   * RAZ DZIENNIE, nie na żywo. To jest licznik majątku, a nie terminal
--     giełdowy: kurs odświeżany co minutę zachęca do otwierania aplikacji
--     dziesięć razy dziennie, czyli do odwrotności tego, po co ona jest.
-- ============================================================

create table if not exists public.finanse_notowania (
  user_id  uuid not null references auth.users (id) on delete cascade,
  zrodlo   text not null check (zrodlo in ('stooq', 'coingecko', 'nbp')),
  /** Symbol w formacie źródła, małymi literami: 'cdr', 'bitcoin', 'usd'. */
  symbol   text not null,

  cena     numeric(20, 8) not null check (cena > 0),
  waluta   text not null default 'PLN' check (char_length(waluta) = 3),
  /** Dzień, z którego pochodzi notowanie - nie dzień pobrania. */
  data     date not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, zrodlo, symbol)
);

alter table public.finanse_notowania enable row level security;

drop policy if exists finanse_notowania_owner_all on public.finanse_notowania;
create policy finanse_notowania_owner_all on public.finanse_notowania
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.finanse_notowania to authenticated;

-- ------------------------------------------------------------
-- Powiązanie aktywa z notowaniem
--
-- Osobno od `symbol`, bo ticker widoczny w aplikacji maklerskiej i symbol
-- w serwisie z notowaniami to nie zawsze to samo napisane tak samo.
-- ------------------------------------------------------------
alter table public.finanse_aktywa
  add column if not exists notowanie_zrodlo text
    check (notowanie_zrodlo is null or notowanie_zrodlo in ('stooq', 'coingecko'));

alter table public.finanse_aktywa
  add column if not exists notowanie_symbol text;

comment on column public.finanse_aktywa.notowanie_symbol is
  'Symbol w serwisie z notowaniami; null = cena wpisywana ręcznie (0073).';

-- ------------------------------------------------------------
-- Przełożenie notowań na portfel
--
-- Aktywa BEZ powiązania zostają nietknięte. Cena wpisana ręcznie jest
-- świadomą deklaracją człowieka i nadpisywanie jej czymkolwiek byłoby
-- odbieraniem mu kontroli nad własnymi liczbami.
-- ------------------------------------------------------------
create or replace function public.finanse_zastosuj_notowania()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_ile  integer;
begin
  if v_user is null then return 0; end if;

  update public.finanse_aktywa a
     set cena = n.cena,
         -- Kurs waluty bierzemy z NBP tym samym mechanizmem. Bez niego
         -- ETF w euro wyceniałby się kursem sprzed pół roku.
         kurs = case
                  when a.waluta = 'PLN' then 1
                  else coalesce((
                    select k.cena from public.finanse_notowania k
                     where k.user_id = a.user_id
                       and k.zrodlo = 'nbp'
                       and k.symbol = lower(a.waluta)
                  ), a.kurs)
                end,
         cena_zrodlo = 'notowania',
         cena_aktualizacja = now()
    from public.finanse_notowania n
   where a.user_id = v_user
     and n.user_id = a.user_id
     and a.notowanie_zrodlo is not null
     and n.zrodlo = a.notowanie_zrodlo
     and n.symbol = a.notowanie_symbol
     -- Bez tego każde wejście na ekran przepisywałoby tę samą cenę
     -- i podbijało `updated_at` bez żadnej zmiany.
     and (a.cena is distinct from n.cena or a.cena_zrodlo <> 'notowania');

  get diagnostics v_ile = row_count;
  return v_ile;
end;
$$;

revoke all on function public.finanse_zastosuj_notowania() from public, anon;
grant execute on function public.finanse_zastosuj_notowania() to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_makler uuid;
  v_akt uuid;
  v_reczne uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0073@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.finanse_pozycje (user_id, nazwa, rodzaj, kwota)
       values (v_user, 'Makler', 'akcje', 0) returning id into v_makler;

  insert into public.finanse_aktywa
         (user_id, pozycja_id, symbol, nazwa, ilosc, cena, notowanie_zrodlo, notowanie_symbol)
       values (v_user, v_makler, 'CDR', 'CD Projekt', 10, 200, 'stooq', 'cdr')
    returning id into v_akt;

  insert into public.finanse_aktywa (user_id, pozycja_id, nazwa, ilosc, cena)
       values (v_user, v_makler, 'Coś bez notowania', 1, 50)
    returning id into v_reczne;

  insert into public.finanse_notowania (user_id, zrodlo, symbol, cena, data)
       values (v_user, 'stooq', 'cdr', 245.50, current_date);

  if public.finanse_zastosuj_notowania() <> 1 then
    raise exception 'Migracja 0073: notowanie nie trafiło do aktywa';
  end if;
  if (select cena from public.finanse_aktywa where id = v_akt) <> 245.50 then
    raise exception 'Migracja 0073: cena nie została zaktualizowana';
  end if;

  -- Wartość pozycji ma iść w ślad za ceną, bez ręcznego przeliczania.
  if (select kwota from public.finanse_pozycje where id = v_makler) <> 2505 then
    raise exception 'Migracja 0073: rachunek nie przeliczył się po zmianie ceny (jest %)',
      (select kwota from public.finanse_pozycje where id = v_makler);
  end if;

  -- Ręcznie wpisana cena zostaje nietknięta.
  if (select cena from public.finanse_aktywa where id = v_reczne) <> 50 then
    raise exception 'Migracja 0073: nadpisana została cena wpisana ręcznie';
  end if;

  -- Powtórzenie nic nie zmienia i niczego nie dotyka.
  if public.finanse_zastosuj_notowania() <> 0 then
    raise exception 'Migracja 0073: powtórne zastosowanie przepisało te same ceny';
  end if;

  -- Waluta obca przelicza się kursem NBP.
  update public.finanse_aktywa set waluta = 'USD', kurs = 1 where id = v_akt;
  insert into public.finanse_notowania (user_id, zrodlo, symbol, cena, data)
       values (v_user, 'nbp', 'usd', 4.05, current_date);
  update public.finanse_notowania set cena = 250 where user_id = v_user and symbol = 'cdr';
  perform public.finanse_zastosuj_notowania();
  if (select kurs from public.finanse_aktywa where id = v_akt) <> 4.05 then
    raise exception 'Migracja 0073: kurs waluty nie został pobrany z notowań';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  if public.finanse_zastosuj_notowania() <> 0 then
    raise exception 'Migracja 0073: funkcja działa bez auth.uid()';
  end if;

  delete from auth.users where id = v_user;
end;
$$;
