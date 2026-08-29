-- Funkcje w schemacie public przestają być wywoływalne bez logowania.
--
-- Postgres nadaje EXECUTE roli PUBLIC każdej nowej funkcji, a w Supabase
-- rola `anon` należy do PUBLIC. Efekt: każda funkcja pisana przez ostatni rok
-- była wywoływalna kluczem anon, czyli przez kogokolwiek z internetu.
--
-- Przy SECURITY DEFINER to nie jest drobiazg — taka funkcja pomija RLS
-- z definicji. `has_pro(uuid)` odpowiadała o DOWOLNYM koncie,
-- `tables_without_rls()` wypisywała schemat, a `book_owner(uuid)` i reszta
-- pomocników zdradzały właściciela obiektu. Do wykorzystania trzeba było
-- znać cudzy UUID, więc to nie była dziura z płonącymi włosami — ale to
-- ten sam wzorzec, który migracja 0038 zamykała dla search_path.
--
-- SZEŚĆ funkcji MUSI zostać otwartych dla anona, bo serwer woła je kluczem
-- anon, uwierzytelniając się osobnym sekretem w argumencie:
--   apply_subscription  — webhook Stripe'a (src/app/api/stripe/webhook/route.ts)
--   push_*              — budzik powiadomień (src/app/api/push/send/route.ts)
-- Ślepy `revoke ... from anon` skasowałby zapisywanie opłaconych subskrypcji
-- i wysyłkę powiadomień, i to bez żadnego błędu w aplikacji — dlatego lista
-- jest tu wypisana z nazwy, a nie zgadywana.
--
-- Grant dla `authenticated` jest tu siatką, nie warunkiem: Supabase trzyma
-- dla tej roli własny wpis w pg_default_acl, więc revoke z PUBLIC i z anona
-- go nie dotyka. Sprawdziłem to testem negatywnym — po usunięciu tej linii
-- migracja nadal przechodzi. Zostaje mimo to, bo `can_read_plan` i pomocnicy
-- `*_owner` siedzą w regułach RLS: gdyby kiedyś powstały poza domyślną
-- ścieżką Supabase, ich utrata wygasiłaby czytanie planów w całej aplikacji.
-- Sprawdzenie na końcu pilnuje, że nadal je mają.

do $$
declare
  f record;
  -- Funkcje wołane kluczem anon + sekretem w argumencie. Nie ruszać.
  serwisowe text[] := array[
    'apply_subscription',
    'push_due', 'push_ok', 'push_ok_many', 'push_failed', 'push_failed_many'
  ];
begin
  for f in
    select p.oid,
           p.proname,
           p.prorettype = 'pg_catalog.trigger'::regtype as wyzwalacz,
           format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sygnatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
  loop
    -- Funkcji wyzwalacza nie da się wywołać z SQL-a, więc nikomu jej nie dajemy.
    if not f.wyzwalacz then
      execute format('grant execute on function %s to authenticated, service_role', f.sygnatura);
    end if;

    execute format('revoke all on function %s from public', f.sygnatura);
    execute format('revoke all on function %s from anon', f.sygnatura);

    if f.proname = any (serwisowe) then
      execute format('grant execute on function %s to anon', f.sygnatura);
    end if;
  end loop;
end $$;

-- Nowe funkcje mają startować bez anona, żeby ta migracja nie była
-- jednorazowym sprzątaniem, po którym problem wraca przy następnym `create`.
--
-- `from public` NIE WYSTARCZA: Supabase trzyma dla anona osobny, jawny wpis
-- w pg_default_acl (sprawdzone: defaclobjtype='f' zawiera `anon=X/postgres`).
-- Sam revoke z PUBLIC przechodziłby lokalnie i nie robił nic na produkcji.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- has_pro pytana o cudze konto ma milczeć.
--
-- Domyślny argument to auth.uid(), więc cała aplikacja woła ją bez parametru
-- i nic się dla niej nie zmienia. Zmiana dotyczy wyłącznie sytuacji, w której
-- ktoś podstawi UUID innej osoby — dotąd dostawał odpowiedź o cudzej
-- subskrypcji. Żadna reguła RLS z niej nie korzysta (sprawdzone), więc
-- zawężenie nie ma jak niczego zablokować.
-- ---------------------------------------------------------------------------
create or replace function public.has_pro(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    -- O cudze konto może pytać wyłącznie administrator.
    when p_user <> auth.uid() and not public.is_admin() then false
    else
      coalesce((select p.role = 'admin' from public.profiles p where p.id = p_user), false)
      or coalesce(
        (select s.status in ('active', 'trialing')
            and (s.current_period_end is null or s.current_period_end > now())
           from public.subscriptions s
          where s.user_id = p_user),
        false)
  end;
$$;

revoke all on function public.has_pro(uuid) from public, anon;
grant execute on function public.has_pro(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Kubeł na zdjęcia dostaje granice.
--
-- Reguły dostępu pilnowały dotąd TYLKO tego, do czyjego katalogu leci plik.
-- Rozmiar i typ były nieograniczone, więc jedno zalogowane konto mogło wgrać
-- dowolnie duży plik dowolnego rodzaju — rachunek za storage bez sufitu.
-- Aplikacja wysyła kadry z aparatu (kilkaset kB), więc 5 MB to zapas,
-- a nie ograniczenie.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'wyglad';

-- ---------------------------------------------------------------------------
-- Sprawdzenie. Każdy z tych warunków już raz był prawdziwy w drugą stronę.
-- ---------------------------------------------------------------------------
do $$
declare
  otwarte text[];
begin
  -- 1. Nic wrażliwego nie zostało otwarte dla niezalogowanych.
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into otwarte
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname <> all (array['apply_subscription', 'push_due', 'push_ok',
                                 'push_ok_many', 'push_failed', 'push_failed_many']);
  if array_length(otwarte, 1) > 0 then
    raise exception 'anon nadal może wywołać: %', array_to_string(otwarte, ', ');
  end if;

  -- 2. Webhook Stripe'a i budzik powiadomień MUSZĄ dalej działać.
  --    Bez tego opłacona subskrypcja nie zapisze się i nikt tego nie zauważy.
  if not has_function_privilege('anon',
        'public.apply_subscription(text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, text, timestamptz)',
        'EXECUTE') then
    raise exception 'webhook Stripe stracił dostęp — subskrypcje przestałyby się zapisywać';
  end if;
  if not has_function_privilege('anon', 'public.push_due(text)', 'EXECUTE') then
    raise exception 'budzik powiadomień stracił dostęp';
  end if;

  -- 3. Reguły RLS opierają się na tych pomocnikach. Gdyby zalogowany stracił
  --    do nich prawo, aplikacja przestałaby czytać własne plany.
  --    Osobno wypisane sa te, ktore NIE maja jawnego grantu we wczesniejszych
  --    migracjach i dostep mialy wylacznie przez PUBLIC. To one padna pierwsze,
  --    jesli kolejnosc grant-przed-revoke kiedykolwiek sie odwroci.
  if not has_function_privilege('authenticated', 'public.can_read_plan(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.phase_plan_id(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.has_pro(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.szukaj_produktow(text, integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.bez_ogonkow(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.tables_without_rls()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.policies_rechecking_uid()', 'EXECUTE') then
    raise exception 'zalogowany stracil dostep do funkcji, na ktorych stoi RLS albo testy';
  end if;

  -- 4. Kubeł na zdjęcia ma sufit.
  if exists (select 1 from storage.buckets
              where id = 'wyglad' and (file_size_limit is null or allowed_mime_types is null)) then
    raise exception 'kubeł wyglad nadal bez limitu rozmiaru albo typu pliku';
  end if;
end $$;
