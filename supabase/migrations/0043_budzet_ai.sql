-- ============================================================
-- Grind — Migracja 0043: miesięczny budżet na AI
--
-- Dzienny limit z 0016 liczy WYWOŁANIA, a nie pieniądze. To dwie różne rzeczy:
-- pytanie do trenera kosztuje około 3 groszy, ułożenie planu bywa trzydzieści
-- razy droższe. Dziesięć wywołań dziennie znaczy więc „od 1 zł do 30 zł
-- miesięcznie, zależnie od tego, w co ktoś klika" — a to nie jest limit
-- kosztowy, tylko widełki.
--
-- Tutaj liczony jest realny koszt: rezerwacja przed wywołaniem, rozliczenie
-- po nim. Rezerwacja jest pesymistyczna, więc konto nie może zacząć wywołania,
-- które przekroczyłoby próg; rozliczenie wpisuje kwotę policzoną z `usage`
-- zwróconego przez model, czyli z faktycznie zużytych tokenów.
--
-- Dwa kroki, a nie jeden, bo koszt jest znany DOPIERO PO wywołaniu. Sprawdzenie
-- limitu po fakcie przepuszczałoby dowolnie drogie zapytanie — pilnowałoby
-- rachunku dopiero od następnego.
--
-- Administrator jest zwolniony, tą samą funkcją `is_admin()`, co w 0042.
-- Liczniki nadal pokazują prawdę, zmienia się tylko odpowiedź na „czy wolno".
-- ============================================================

-- ------------------------------------------------------------
-- Rejestr kosztów
-- ------------------------------------------------------------
/*
 * Wiersz na wywołanie, nie licznik miesięczny.
 *
 * Licznik zbiorczy nie umiałby odpowiedzieć na pytanie „co właściwie zjadło
 * te osiem złotych", a to jest pierwsze pytanie, jakie się zadaje, gdy limit
 * się kończy. Przy dziesięciu wywołaniach dziennie to najwyżej ~310 wierszy
 * na osobę na miesiąc — tanio jak na możliwość zobaczenia rozbicia.
 */
create table if not exists public.ai_wydatki (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  kategoria    text not null check (kategoria in ('trener', 'plan', 'wyglad')),
  model        text not null default '',

  /** Pesymistyczny koszt pobrany PRZED wywołaniem. Zawsze wypełniony. */
  szacunek_usd numeric(12, 6) not null check (szacunek_usd >= 0),
  /** Rzeczywisty koszt z `usage`. NULL = wywołanie jeszcze trwa albo się urwało. */
  koszt_usd    numeric(12, 6) check (koszt_usd >= 0),
  /** Surowe liczby tokenów — żeby dało się sprawdzić, skąd wzięła się kwota. */
  tokeny       jsonb not null default '{}'::jsonb,

  utworzono    timestamptz not null default now(),
  rozliczono   timestamptz
);

create index if not exists ai_wydatki_user_idx
  on public.ai_wydatki (user_id, utworzono desc);

alter table public.ai_wydatki enable row level security;

/*
 * Supabase nadaje domyślne uprawnienia na każdą nową tabelę w `public`
 * (`alter default privileges ... grant all on tables to anon, authenticated`).
 * Samo pominięcie GRANT-a nic więc nie daje — trzeba odebrać jawnie.
 */
revoke all on table public.ai_wydatki from anon, authenticated, public;

/*
 * Świadomie ZERO polityk i zero uprawnień dla `authenticated`.
 *
 * Rejestr kosztów jest jedyną rzeczą, której użytkownik nie może dotknąć:
 * prawo zapisu to podrabianie kwot, prawo kasowania to zerowanie limitu,
 * a prawo odczytu daje identyfikatory trwających rezerwacji — czyli
 * możliwość rozliczenia cudzego (własnego, ale prawdziwego) wywołania na zero.
 *
 * Ekran dostaje to, co mu potrzebne, z `ai_budzet_stan()`. Ta sama zasada
 * co przy `ai_usage` w 0016, tylko konsekwentniej.
 */

-- ------------------------------------------------------------
-- Ustawienia
-- ------------------------------------------------------------
/*
 * Próg w złotówkach, bo w złotówkach myśli osoba, która go ustawia. Model
 * rozlicza się w dolarach, więc kurs siedzi obok — jawnie, żeby zmiana kursu
 * była decyzją, a nie cichym dryfem limitu.
 *
 * `szacunek_usd` to rezerwacje: górne widełki zmierzonych kosztów (plan
 * 3455 tokenów wyjścia na Opusie ≈ 0,10 USD bez rozumowania, do ~0,27 USD
 * z nim). Lepiej zarezerwować za dużo i oddać resztę przy rozliczeniu,
 * niż wpuścić wywołanie, które przekroczy próg.
 *
 * `liczone` mówi, co wchodzi do puli. Skan wyglądu ma własne, ostrzejsze
 * ograniczenia (odstęp 7 dni, 5 w miesiącu ≈ 1,40 zł), więc jest zapisywany
 * dla widoczności, ale nie zjada budżetu trenera.
 */
insert into public.app_settings (key, value)
values (
  'ai_budzet',
  jsonb_build_object(
    'limit_pln', 8,
    'kurs_usd_pln', 3.65,
    'liczone', jsonb_build_array('trener', 'plan'),
    'szacunek_usd', jsonb_build_object('trener', 0.06, 'plan', 0.30, 'wyglad', 0.08)
  )
)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Funkcje
-- ------------------------------------------------------------

/**
 * Początek bieżącego miesiąca w strefie użytkownika.
 *
 * `now()` na serwerze jest w UTC, a przez pierwsze dwie godziny pierwszego dnia
 * miesiąca UTC to w Polsce jeszcze poprzedni miesiąc. Bez tego budżet
 * odnawiałby się o 1:00 w nocy 1 dnia — i przez dwie godziny liczyłby razem
 * dwa miesiące.
 */
create or replace function public.poczatek_miesiaca()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('month', (now() at time zone 'Europe/Warsaw')) at time zone 'Europe/Warsaw';
$$;

/** Czy dana kategoria zjada wspólny budżet. */
create or replace function public.ai_budzet_liczone(p_kategoria text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Brak wiersza ustawień nie może znaczyć „limit wyłączony". Domyślnie
  -- liczą się trener i plan, czyli dokładnie to, co ustawia migracja.
  select case
    when not exists (select 1 from public.app_settings where key = 'ai_budzet')
      then p_kategoria in ('trener', 'plan')
    else exists (
      select 1
        from public.app_settings s,
             lateral jsonb_array_elements_text(s.value -> 'liczone') k
       where s.key = 'ai_budzet' and k = p_kategoria)
  end;
$$;

/**
 * Stan budżetu na ten miesiąc — dla ekranu i dla bramki w trasie.
 *
 * Ekran musi umieć napisać „zostało 2,10 zł" ZANIM ktoś kliknie. Odmowa
 * dopiero po napisaniu pytania byłaby tym samym chamstwem, co odmowa skanu
 * po zrobieniu trzech zdjęć.
 *
 * Nierozliczone rezerwacje liczą się po szacunku — wywołanie, które się urwało
 * i nikt go nie rozliczył, ma kosztować, dopóki nie wiadomo, że nie kosztowało.
 */
create or replace function public.ai_budzet_stan()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    -- Agregaty po pustym zbiorze dają jeden wiersz nulli, więc brak wiersza
    -- ustawień kończy się wartościami domyślnymi, a nie pustym wynikiem.
    select coalesce(max((value ->> 'limit_pln')::numeric), 8)       as limit_pln,
           coalesce(max((value ->> 'kurs_usd_pln')::numeric), 3.65) as kurs
      from public.app_settings where key = 'ai_budzet'
  ),
  w as (
    select coalesce(sum(coalesce(koszt_usd, szacunek_usd)), 0) as usd,
           count(*)                                            as wywolan
      from public.ai_wydatki
     where user_id = auth.uid()
       and utworzono >= public.poczatek_miesiaca()
       and public.ai_budzet_liczone(kategoria)
  ),
  a as (select public.is_admin() as admin)
  select jsonb_build_object(
    'limit_pln',   round(p.limit_pln, 2),
    'limit_usd',   round(p.limit_pln / nullif(p.kurs, 0), 6),
    'kurs',        p.kurs,
    'wydano_usd',  round(w.usd, 6),
    'wydano_pln',  round(w.usd * p.kurs, 2),
    'zostalo_pln', greatest(round(p.limit_pln - w.usd * p.kurs, 2), 0),
    'wywolan',     w.wywolan,
    'bez_limitu',  a.admin,
    'odnowa',      public.poczatek_miesiaca() + interval '1 month'
  )
  from p cross join w cross join a;
$$;

/**
 * Rezerwacja przed wywołaniem modelu.
 *
 * Zwraca `ok=false`, gdy próg zostałby przekroczony — i wtedy NIC nie zapisuje,
 * więc odmowa nie zjada budżetu. Przy `ok=true` w bazie jest już wiersz
 * z pesymistyczną kwotą; rozliczenie zamieni ją na prawdziwą.
 *
 * Identyfikator wraca wyłącznie tutaj i nigdy nie trafia do przeglądarki —
 * dlatego tabela nie ma uprawnienia SELECT dla `authenticated`.
 */
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

  if p_kategoria not in ('trener', 'plan', 'wyglad') then
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

/**
 * Rozliczenie po wywołaniu: szacunek ustępuje miejsca prawdziwej kwocie.
 *
 * Kwotą 0 zwalnia się rezerwację po nieudanym wywołaniu — model, który zwrócił
 * błąd, nie zwrócił też `usage`, a rachunek za nieotrzymaną odpowiedź byłby
 * karą za naszą awarię. Tam, gdzie odpowiedź przyszła i dopiero my jej nie
 * przyjęliśmy (odmowa modelu, zły format), `usage` już mamy i wpisujemy je
 * uczciwie.
 *
 * NULL zamiast kwoty znaczy „nie wiem, ile to kosztowało" — wtedy zostaje
 * pesymistyczna rezerwacja. Zdarza się przy modelu spoza cennika: lepiej
 * policzyć za dużo niż nie policzyć wcale.
 *
 * Rozliczyć można tylko raz i tylko własny, nierozliczony wiersz.
 */
create or replace function public.ai_koszt_rozlicz(
  p_id        uuid,
  p_model     text,
  p_koszt_usd numeric,
  p_tokeny    jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_ile integer;
begin
  if auth.uid() is null then return false; end if;

  update public.ai_wydatki
     set koszt_usd  = greatest(coalesce(p_koszt_usd, szacunek_usd), 0),
         model      = coalesce(nullif(p_model, ''), model),
         tokeny     = coalesce(p_tokeny, '{}'::jsonb),
         rozliczono = now()
   where id = p_id
     and user_id = auth.uid()
     and rozliczono is null;

  get diagnostics v_ile = row_count;
  return v_ile = 1;
end;
$$;

-- ------------------------------------------------------------
-- Uprawnienia
-- ------------------------------------------------------------
-- Postgres domyślnie daje EXECUTE każdemu, łącznie z `anon` — stąd revoke
-- przed grantem (nauka z 0038).
revoke all on function public.poczatek_miesiaca()                          from public, anon;
revoke all on function public.ai_budzet_liczone(text)                      from public, anon;
revoke all on function public.ai_budzet_stan()                             from public, anon;
revoke all on function public.ai_koszt_rezerwuj(text)                      from public, anon;
revoke all on function public.ai_koszt_rozlicz(uuid, text, numeric, jsonb) from public, anon;

grant execute on function public.ai_budzet_stan()                             to authenticated;
grant execute on function public.ai_koszt_rezerwuj(text)                      to authenticated;
grant execute on function public.ai_koszt_rozlicz(uuid, text, numeric, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare v jsonb;
begin
  v := public.ai_budzet_stan();
  if v is null or (v ->> 'limit_pln') is null then
    raise exception 'ai_budzet_stan() nie zwraca limitu';
  end if;
  if not public.ai_budzet_liczone('trener') then
    raise exception 'trener nie wchodzi do budżetu';
  end if;
  if public.ai_budzet_liczone('wyglad') then
    raise exception 'skan wyglądu nie powinien zjadać budżetu trenera';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
     where table_name = 'ai_wydatki' and grantee in ('authenticated', 'anon', 'public')
  ) then
    raise exception 'ai_wydatki nie może mieć uprawnień dla użytkownika';
  end if;
end;
$$;
