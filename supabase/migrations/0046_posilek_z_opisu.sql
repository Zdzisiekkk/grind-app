-- ============================================================
-- Grind — Migracja 0046: opisany posiłek jako czwarta kategoria kosztu
--
-- Nowa funkcja płatna: człowiek pisze „dwa jajka sadzone i kromka razowego",
-- a model szacuje gramaturę i wartości odżywcze. To najczęściej używana
-- rzecz z AI w całej aplikacji — kilka razy DZIENNIE, nie kilka razy
-- w tygodniu — więc dwie decyzje są tu ważniejsze niż sam kod.
--
-- 1. LICZY SIĘ DO 8 ZŁ. Skan wyglądu został poza pulą, bo ma własne twarde
--    ograniczenia (odstęp 7 dni, 5 miesięcznie), czyli jest ograniczony
--    niezależnie. Opis posiłku nie ma żadnego naturalnego sufitu — gdyby
--    został poza limitem, limit przestałby być limitem.
--
-- 2. WŁASNY LICZNIK DZIENNY, nie wspólny z trenerem. `ai_usage` z 0016 to
--    JEDEN licznik na konto: gdyby opisy posiłków go dzieliły, dziesięć
--    opisów zjadałoby wszystkie pytania do trenera na ten dzień. Kategorie
--    nie mogą się nawzajem zagładzać, bo to są osobne rzeczy, za które
--    człowiek zapłacił jedną subskrypcją.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kategoria kosztu
-- ------------------------------------------------------------
alter table public.ai_wydatki drop constraint if exists ai_wydatki_kategoria_check;
alter table public.ai_wydatki add constraint ai_wydatki_kategoria_check
  check (kategoria in ('trener', 'plan', 'wyglad', 'jedzenie'));

-- Szacunek 0.01 USD to pesymizm dla Sonneta przy długim opisie: około
-- 700 tokenów wejścia i 400 wyjścia to ~0.005 USD, więc rezerwacja ma
-- dwukrotny zapas. Zawyżenie jest tu bezpieczną stroną — rozliczenie
-- i tak wpisze kwotę prawdziwą, a zaniżenie przepuszczałoby wywołania
-- ponad próg.
update public.app_settings
   set value = jsonb_set(
         jsonb_set(value, '{szacunek_usd,jedzenie}', '0.01'::jsonb, true),
         '{liczone}',
         (select jsonb_agg(distinct k)
            from jsonb_array_elements_text(
                   (value -> 'liczone') || '["jedzenie"]'::jsonb) k),
         true)
 where key = 'ai_budzet';

/**
 * Czy dana kategoria zjada wspólny budżet.
 *
 * Zmiana wobec 0043 dotyczy WYŁĄCZNIE zapasowej gałęzi: gdy wiersza ustawień
 * nie ma, do puli liczy się teraz także jedzenie. Brak ustawień nie może
 * znaczyć „ta akurat funkcja jest darmowa".
 */
create or replace function public.ai_budzet_liczone(p_kategoria text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.app_settings where key = 'ai_budzet')
      then p_kategoria in ('trener', 'plan', 'jedzenie')
    else exists (
      select 1
        from public.app_settings s,
             lateral jsonb_array_elements_text(s.value -> 'liczone') k
       where s.key = 'ai_budzet' and k = p_kategoria)
  end;
$$;

/** Rezerwacja — jak w 0043, doszła tylko czwarta dozwolona kategoria. */
create or replace function public.ai_koszt_rezerwuj(p_kategoria text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_stan     jsonb;
  v_szacunek numeric;
  v_id       uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'powod', 'brak_logowania');
  end if;

  if p_kategoria not in ('trener', 'plan', 'wyglad', 'jedzenie') then
    raise exception 'nieznana kategoria kosztu: %', p_kategoria;
  end if;

  v_stan := public.ai_budzet_stan();

  v_szacunek := coalesce(
    (select (value -> 'szacunek_usd' ->> p_kategoria)::numeric
       from public.app_settings where key = 'ai_budzet'),
    0.10);

  if public.ai_budzet_liczone(p_kategoria)
     and not coalesce((v_stan ->> 'bez_limitu')::boolean, false)
     and (v_stan ->> 'wydano_usd')::numeric + v_szacunek > (v_stan ->> 'limit_usd')::numeric
  then
    return jsonb_build_object('ok', false, 'powod', 'limit_miesiaca', 'stan', v_stan);
  end if;

  insert into public.ai_wydatki (user_id, kategoria, szacunek_usd)
  values (v_user, p_kategoria, v_szacunek)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'szacunek_usd', v_szacunek, 'stan', v_stan);
end;
$$;

-- ------------------------------------------------------------
-- 2. Dzienny licznik osobny dla każdej kategorii
--
-- Miesięczny budżet pilnuje PIENIĘDZY, ten licznik pilnuje CZASU: bez niego
-- pętla w kliencie albo nerwowe klikanie potrafi zjeść cały miesiąc
-- w kwadrans. Szkoda jest wtedy ograniczona do 8 zł, ale spada na człowieka,
-- który nic złego nie zrobił.
--
-- Tabela bez żadnych uprawnień dla użytkownika — dokładnie jak rejestr
-- kosztów z 0043. Prawo zapisu znaczyłoby możliwość wyzerowania licznika,
-- czyli brak licznika.
-- ------------------------------------------------------------
create table if not exists public.ai_licznik (
  user_id   uuid not null references auth.users (id) on delete cascade,
  data      date not null default current_date,
  kategoria text not null,
  wywolan   integer not null default 0,
  primary key (user_id, data, kategoria)
);

alter table public.ai_licznik enable row level security;
revoke all on table public.ai_licznik from anon, authenticated, public;

/**
 * Zużycie jednego wywołania w kategorii. Zwraca false, gdy limit wyczerpany.
 *
 * Licznik rośnie ZAWSZE, także administratorowi — zwolniona jest sama bramka,
 * nie rachunek. Ten sam układ co przy skanach wyglądu w 0042: liczby mają
 * mówić prawdę, żeby ekran mógł uczciwie napisać „bez limitu" zamiast udawać,
 * że licznik nie istnieje.
 */
create or replace function public.ai_licznik_zuzyj(p_kategoria text, p_limit integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n    integer;
begin
  if v_user is null then return false; end if;

  insert into public.ai_licznik (user_id, data, kategoria, wywolan)
  values (v_user, current_date, p_kategoria, 1)
  on conflict (user_id, data, kategoria) do update
    set wywolan = public.ai_licznik.wywolan + 1
  returning wywolan into v_n;

  return public.is_admin() or v_n <= greatest(p_limit, 0);
end;
$$;

/** Ile z dziennej puli zostało — dla ekranu, zanim ktokolwiek kliknie. */
create or replace function public.ai_licznik_stan(p_kategoria text, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'limit',      p_limit,
    'wywolan',    coalesce((select wywolan from public.ai_licznik
                             where user_id = auth.uid()
                               and data = current_date
                               and kategoria = p_kategoria), 0),
    'bez_limitu', public.is_admin());
$$;

revoke all on function public.ai_licznik_zuzyj(text, integer) from public, anon;
revoke all on function public.ai_licznik_stan(text, integer)  from public, anon;
grant execute on function public.ai_licznik_zuzyj(text, integer) to authenticated;
grant execute on function public.ai_licznik_stan(text, integer)  to authenticated;

-- ------------------------------------------------------------
-- 3. Straznik: zadna funkcja nie ma byc wywolywalna bez logowania
--
-- Migracja 0045 zamknela 26 funkcji i ustawila domyslne uprawnienia tak, zeby
-- nowe startowaly zamkniete. SPRAWDZILEM TO I OBIETNICA NIE JEST PEWNA:
-- domyslne uprawnienia sa przypisane do roli, ktora tworzy obiekt, a wpis
-- `supabase_admin` nadal daje anonowi prawo wywolania. Do tego Postgres
-- dokleja kazdej nowej funkcji wlasne EXECUTE dla PUBLIC.
--
-- Dlatego zamiast obietnicy w komentarzu jest funkcja, ktora policzy. Kazda
-- migracja nadal robi jawny `revoke`, a ten straznik lapie te, ktore o nim
-- zapomna — tak samo jak `tables_without_rls()` lapie tabele bez RLS.
--
-- Szesc funkcji serwisowych jest na liscie wyjatkow: webhook Stripe'a
-- i budzik powiadomien wolaja je kluczem anon, uwierzytelniajac sie sekretem
-- w argumencie.
-- ------------------------------------------------------------
create or replace function public.funkcje_dla_anona()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname <> all (array['apply_subscription', 'push_due', 'push_ok',
                                 'push_ok_many', 'push_failed', 'push_failed_many']);
$$;

revoke all on function public.funkcje_dla_anona() from public, anon;
grant execute on function public.funkcje_dla_anona() to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
begin
  if not public.ai_budzet_liczone('jedzenie') then
    raise exception 'opis posilku nie liczy sie do budzetu — limit przestalby byc limitem';
  end if;

  if (select (value -> 'szacunek_usd' ->> 'jedzenie')::numeric
        from public.app_settings where key = 'ai_budzet') is null then
    raise exception 'brak szacunku kosztu dla kategorii jedzenie';
  end if;

  -- Skan wygladu MUSI zostac poza pula: ma wlasne twarde limity, a wliczenie
  -- go odbieraloby pytania trenera komus, kto raz w tygodniu zrobil zdjecie.
  if public.ai_budzet_liczone('wyglad') then
    raise exception 'skan wygladu nie powinien wchodzic do wspolnej puli';
  end if;

  -- Licznika nie wolno dac uzytkownikowi do reki.
  if has_table_privilege('authenticated', 'public.ai_licznik', 'SELECT')
     or has_table_privilege('authenticated', 'public.ai_licznik', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_licznik', 'DELETE')
     or has_table_privilege('anon', 'public.ai_licznik', 'SELECT') then
    raise exception 'ai_licznik nie moze miec uprawnien dla uzytkownika';
  end if;

  -- Nowe funkcje nie moga byc wywolywalne bez logowania (patrz 0045).
  if has_function_privilege('anon', 'public.ai_licznik_zuzyj(text, integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.ai_licznik_stan(text, integer)', 'EXECUTE') then
    raise exception 'licznik AI jest wywolywalny bez logowania';
  end if;

  -- I to samo pytanie zadane o CALA baze, a nie o wypisane z nazwy funkcje.
  if array_length(public.funkcje_dla_anona(), 1) > 0 then
    raise exception 'bez logowania da sie wywolac: %',
      array_to_string(public.funkcje_dla_anona(), ', ');
  end if;
end $$;
