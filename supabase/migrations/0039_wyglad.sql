-- ============================================================
-- Grind — Migracja 0039: moduł „Wygląd"
--
-- Skan twarzy → ocena → plan pielęgnacji, protokoły (mewing, postawa),
-- pomiary obwodów i śledzenie zmiany w czasie.
--
-- Trzy rzeczy są tu zrobione inaczej, niż mówi brief. Powody przy każdej
-- z tabel, w skrócie:
--   * skan i zdjęcia to dwie tabele, nie jedna — jeden skan ma do trzech ujęć,
--     a raport modelu jest jeden,
--   * `wyglad_pomiary` nie ma kolumny na wagę — waga już ma swoją tabelę,
--   * zgoda 16+ jest warunkiem zapisu na poziomie bazy, nie tylko ekranem.
--
-- To pierwszy moduł w projekcie trzymający PLIKI, nie tylko wiersze. Zdjęcie
-- twarzy jest daleko wrażliwsze niż cokolwiek, co Grind zapisywał do tej pory,
-- więc kubełek jest prywatny, a dostęp idzie wyłącznie przez podpisany link
-- ważny kilka minut.
-- ============================================================

-- ------------------------------------------------------------
-- Kubełek na zdjęcia
--
-- `public = false` znaczy: nie istnieje adres, pod którym plik da się otworzyć
-- bez podpisu. Kubełek publiczny wystarczyłoby raz pomylić, żeby czyjeś zdjęcia
-- twarzy dały się zgadnąć adresem — a tego nie da się cofnąć.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wyglad', 'wyglad', false)
on conflict (id) do nothing;

/*
 * Ścieżka pliku to `<uuid właściciela>/<id skanu>/<ujęcie>.jpg`, a polityki
 * porównują PIERWSZY człon tej ścieżki z tożsamością pytającego. Dzięki temu
 * reguła jest jedna dla całego kubełka i nie trzeba jej ruszać przy każdym
 * nowym rodzaju pliku.
 */
do $$
declare p text;
begin
  foreach p in array array['wyglad_wlasne_select', 'wyglad_wlasne_insert',
                           'wyglad_wlasne_update', 'wyglad_wlasne_delete']
  loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end;
$$;

create policy wyglad_wlasne_select on storage.objects
  for select to authenticated
  using (bucket_id = 'wyglad' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wyglad_wlasne_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wyglad' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wyglad_wlasne_update on storage.objects
  for update to authenticated
  using (bucket_id = 'wyglad' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'wyglad' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy wyglad_wlasne_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'wyglad' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------
-- Zgoda — osobna tabela, nie kolumna w profilu
--
-- Wiek i akceptacja zastrzeżenia dotyczą TEGO modułu, nie całego konta.
-- Osobny wiersz mówi wprost, kiedy człowiek się na to zgodził, i da się go
-- odczytać w eksporcie jako oddzielny fakt.
-- ------------------------------------------------------------
create table if not exists public.wyglad_zgoda (
  user_id           uuid primary key references auth.users (id) on delete cascade,

  /** Moduł ocenia zdjęcia twarzy — poniżej 16 lat nie wchodzi w grę. */
  wiek_potwierdzony boolean not null default false,

  /** Że to nie jest porada medyczna ani diagnoza dermatologiczna. */
  zaakceptowano_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Skany
--
-- Brief miał jedną tabelę na skan i zdjęcie naraz. Nie da się tego pogodzić:
-- jeden skan to do trzech ujęć (przód, profil, sylwetka), a raport modelu
-- powstaje JEDEN, z całości. Przy jednej tabeli ten sam raport leżałby
-- w trzech kopiach albo dwa wiersze miałyby puste oceny — i każde liczenie
-- średniej czy delty trzeba by pisać z wyjątkami.
--
-- Sama ścieżka z briefu (`<user>/<skanId>/<ujecie>.jpg`) już zakłada, że skan
-- jest nadrzędny wobec zdjęcia. Tabele idą za tym.
-- ------------------------------------------------------------
create table if not exists public.wyglad_skany (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  utworzono      timestamptz not null default now(),

  /** 0–100, wyliczone przez model z podocen. */
  ocena_ogolna   smallint check (ocena_ogolna between 0 and 100),

  /** { skora, symetria, definicja_zuchwy, oczy, wlosy, postawa, zeby } */
  oceny          jsonb,

  /** Pełna odpowiedź modelu (WygladAnalysisSchema) — źródło dla raportu. */
  raport         jsonb,

  /*
   * Wyjęte z raportu, żeby dało się nim filtrować w SQL. Skan z przepalonego
   * zdjęcia nie może ciągnąć wykresu w dół tak samo jak realne pogorszenie —
   * na wykresie postępu takie punkty pokazujemy inaczej.
   */
  jakosc_ok      boolean,

  model          text,
  wersja_promptu smallint not null default 1
);

create index if not exists wyglad_skany_user_idx
  on public.wyglad_skany (user_id, utworzono desc);

/*
 * Zdjęcia. Wiersz trzyma wyłącznie ŚCIEŻKĘ — bajty leżą w kubełku.
 *
 * `unique (skan_id, ujecie)` bo drugie zdjęcie profilu w tym samym skanie
 * znaczyłoby, że nie wiadomo, które nakładać na suwaku przed/po.
 */
create table if not exists public.wyglad_zdjecia (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  skan_id      uuid not null references public.wyglad_skany (id) on delete cascade,

  ujecie       text not null check (ujecie in ('front', 'profil', 'sylwetka')),
  storage_path text not null,
  utworzono    timestamptz not null default now(),

  unique (skan_id, ujecie)
);

create index if not exists wyglad_zdjecia_user_ujecie_idx
  on public.wyglad_zdjecia (user_id, ujecie, utworzono desc);

-- ------------------------------------------------------------
-- Pomiary
--
-- Bez kolumny na wagę — mimo że brief ją wymieniał. Waga ma w Grindzie własną
-- tabelę (`body_weight_logs`) od migracji 0001, wpisuje się ją z pulpitu
-- i rysuje na wykresie postępu. Druga kolumna z wagą znaczyłaby dwie różne
-- odpowiedzi na to samo pytanie, zależnie od tego, który ekran się otworzyło.
-- Korelacje z §8 briefu czytają wagę stamtąd.
-- ------------------------------------------------------------
create table if not exists public.wyglad_pomiary (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  data     date not null default current_date,

  /* Obwody w centymetrach. Górne granice odsiewają literówkę „175" w polu talii. */
  talia    numeric(5, 1) check (talia   is null or talia   between 30 and 250),
  klatka   numeric(5, 1) check (klatka  is null or klatka  between 40 and 250),
  ramie    numeric(5, 1) check (ramie   is null or ramie   between 15 and 100),
  szyja    numeric(5, 1) check (szyja   is null or szyja   between 20 and 100),
  biodra   numeric(5, 1) check (biodra  is null or biodra  between 40 and 250),

  /** Szacunek % tkanki tłuszczowej — liczony z obwodów, nie mierzony. */
  bf_szac  numeric(4, 1) check (bf_szac is null or bf_szac between 1 and 70),

  unique (user_id, data)
);

create index if not exists wyglad_pomiary_user_idx
  on public.wyglad_pomiary (user_id, data desc);

-- ------------------------------------------------------------
-- Rutyny i ich odhaczanie
-- ------------------------------------------------------------
create table if not exists public.wyglad_rutyny (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  /*
   * Klucz, nie sama nazwa. Model po kolejnym skanie AKTUALIZUJE rutynę
   * o tym samym kluczu zamiast dokładać drugą prawie taką samą — inaczej po
   * pół roku lista wieczorna miałaby dwadzieścia pozycji i nikt by jej nie robił.
   */
  klucz      text not null,
  nazwa      text not null,
  pora       text not null check (pora in ('rano', 'wieczor', 'dowolnie')),

  /** Lista kroków do wykonania, w kolejności. */
  kroki      jsonb not null default '[]'::jsonb,

  aktywna    boolean not null default true,
  zrodlo     text not null default 'ai' check (zrodlo in ('ai', 'wlasna', 'biblioteka')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, klucz),
  constraint wyglad_rutyny_nazwa_not_empty check (length(btrim(nazwa)) > 0)
);

drop trigger if exists wyglad_rutyny_set_updated_at on public.wyglad_rutyny;
create trigger wyglad_rutyny_set_updated_at
  before update on public.wyglad_rutyny
  for each row execute function public.set_updated_at();

/*
 * Log odhaczeń. Wiersz istnieje = tego dnia zrobione; `wykonano = false`
 * zostaje po to, żeby dało się odznaczyć omyłkowe kliknięcie i odróżnić to
 * od dnia, którego w ogóle nie dotknięto — bo z tego liczy się adherencja.
 */
create table if not exists public.wyglad_rutyna_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  rutyna_id uuid not null references public.wyglad_rutyny (id) on delete cascade,

  data      date not null default current_date,
  wykonano  boolean not null default true,

  unique (rutyna_id, data)
);

create index if not exists wyglad_rutyna_log_user_idx
  on public.wyglad_rutyna_log (user_id, data desc);
create index if not exists wyglad_rutyna_log_rutyna_idx
  on public.wyglad_rutyna_log (rutyna_id, data desc);

-- ------------------------------------------------------------
-- Protokoły — mewing, ćwiczenia twarzy, postawa, SPF, nić
--
-- Treść protokołów jest w kodzie (`src/lib/looks/protokoly.ts`), bo się nie
-- zmienia i nie należy do konkretnego człowieka. W bazie zostaje sam fakt:
-- który włączyłem i od kiedy — z tego liczy się passa.
-- ------------------------------------------------------------
create table if not exists public.wyglad_protokoly (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  klucz      text not null,
  aktywny    boolean not null default true,
  rozpoczeto date not null default current_date,

  unique (user_id, klucz)
);

create index if not exists wyglad_protokoly_user_idx
  on public.wyglad_protokoly (user_id, aktywny);

-- ------------------------------------------------------------
-- Produkty pielęgnacyjne
--
-- `skladniki_aktywne` to tablica, a nie opis, bo ostrzeżenia o konfliktach
-- (retinoid + kwasy tego samego wieczoru, retinoid bez SPF) liczy kod
-- w `src/lib/looks.ts`. Model tego nie liczy — to jest reguła, nie opinia.
-- ------------------------------------------------------------
create table if not exists public.wyglad_produkty (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  nazwa             text not null,
  skladniki_aktywne text[] not null default '{}',
  pora              text not null default 'dowolnie' check (pora in ('rano', 'wieczor', 'dowolnie')),

  /** Kosmetyk po otwarciu ma swoją datę ważności, zwykle krótszą niż na pudełku. */
  otwarty_od        date,
  wazny_do          date,

  created_at        timestamptz not null default now(),

  constraint wyglad_produkty_nazwa_not_empty check (length(btrim(nazwa)) > 0)
);

create index if not exists wyglad_produkty_user_idx
  on public.wyglad_produkty (user_id, pora);

-- ============================================================
-- RLS
--
-- Supabase daje roli `authenticated` pełne prawa na każdej nowej tabeli
-- w `public`, więc dopóki nie ma polityki, każdy zalogowany widzi wszystko.
-- To nie jest druga warstwa — to jedyna.
--
-- `(select auth.uid())` zamiast `auth.uid()` zgodnie z 0034: w tej formie
-- Postgres liczy tożsamość raz na zapytanie, a nie raz na wiersz.
-- ============================================================
alter table public.wyglad_zgoda      enable row level security;
alter table public.wyglad_skany      enable row level security;
alter table public.wyglad_zdjecia    enable row level security;
alter table public.wyglad_pomiary    enable row level security;
alter table public.wyglad_rutyny     enable row level security;
alter table public.wyglad_rutyna_log enable row level security;
alter table public.wyglad_protokoly  enable row level security;
alter table public.wyglad_produkty   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['wyglad_zgoda', 'wyglad_skany', 'wyglad_zdjecia',
                           'wyglad_pomiary', 'wyglad_rutyny', 'wyglad_rutyna_log',
                           'wyglad_protokoly', 'wyglad_produkty']
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
 * Zdjęcie musi wskazywać na WŁASNY skan, a odhaczenie na własną rutynę.
 * Bez tego `user_id` zgadzałby się, a obce `skan_id` przeszłoby — czyli dałoby
 * się dopisać sobie zdjęcie do cudzego raportu.
 *
 * SECURITY DEFINER, bo polityka pytająca o tabelę chronioną tą samą polityką
 * potrafi się zapętlić (42P17) — nauczka z 0037.
 */
create or replace function public.wyglad_skan_wlasciciel(p_skan_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.wyglad_skany where id = p_skan_id;
$$;

create or replace function public.wyglad_rutyna_wlasciciel(p_rutyna_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.wyglad_rutyny where id = p_rutyna_id;
$$;

drop policy if exists wyglad_zdjecia_skan_wlasny on public.wyglad_zdjecia;
create policy wyglad_zdjecia_skan_wlasny on public.wyglad_zdjecia
  as restrictive for all to authenticated
  using (public.wyglad_skan_wlasciciel(skan_id) = (select auth.uid()))
  with check (public.wyglad_skan_wlasciciel(skan_id) = (select auth.uid()));

drop policy if exists wyglad_rutyna_log_rutyna_wlasna on public.wyglad_rutyna_log;
create policy wyglad_rutyna_log_rutyna_wlasna on public.wyglad_rutyna_log
  as restrictive for all to authenticated
  using (public.wyglad_rutyna_wlasciciel(rutyna_id) = (select auth.uid()))
  with check (public.wyglad_rutyna_wlasciciel(rutyna_id) = (select auth.uid()));

-- ------------------------------------------------------------
-- Zgoda jako warunek zapisu, nie jako ekran
--
-- Ekran zgody da się ominąć — wystarczy wysłać żądanie z pominięciem interfejsu.
-- Skoro moduł przetwarza zdjęcia twarzy i ma granicę wieku, to warunek musi
-- stać tam, gdzie nie da się go obejść: przy samym zapisie.
--
-- Reguła dotyczy WYŁĄCZNIE dopisywania. Cofnięcie zgody nie może zabrać
-- człowiekowi dostępu do własnych, już zrobionych skanów — od kasowania jest
-- osobny przycisk.
-- ------------------------------------------------------------
create or replace function public.ma_zgode_wyglad()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.wyglad_zgoda
     where user_id = auth.uid() and wiek_potwierdzony
  );
$$;

drop policy if exists wyglad_skany_za_zgoda on public.wyglad_skany;
create policy wyglad_skany_za_zgoda on public.wyglad_skany
  as restrictive for insert to authenticated
  with check ((select public.ma_zgode_wyglad()));

drop policy if exists wyglad_zdjecia_za_zgoda on public.wyglad_zdjecia;
create policy wyglad_zdjecia_za_zgoda on public.wyglad_zdjecia
  as restrictive for insert to authenticated
  with check ((select public.ma_zgode_wyglad()));

/*
 * Postgres domyślnie daje PRAWO WYKONANIA każdej nowej funkcji roli PUBLIC,
 * czyli u nas także niezalogowanemu `anon`. Przy funkcji SECURITY DEFINER
 * znaczy to tyle, że obcy człowiek może przez /rest/v1/rpc zapytać, czyj jest
 * skan o danym identyfikatorze. Dlatego najpierw odbieramy, potem nadajemy.
 */
revoke all on function public.ma_zgode_wyglad(),
                       public.wyglad_skan_wlasciciel(uuid),
                       public.wyglad_rutyna_wlasciciel(uuid)
  from public, anon;

grant execute on function public.ma_zgode_wyglad(),
                         public.wyglad_skan_wlasciciel(uuid),
                         public.wyglad_rutyna_wlasciciel(uuid)
  to authenticated;

grant select, insert, update, delete on
  public.wyglad_zgoda, public.wyglad_skany, public.wyglad_zdjecia,
  public.wyglad_pomiary, public.wyglad_rutyny, public.wyglad_rutyna_log,
  public.wyglad_protokoly, public.wyglad_produkty
  to authenticated;

-- ------------------------------------------------------------
-- Ile skanów wolno zrobić
--
-- Dwa ograniczenia, z dwóch różnych powodów:
--
--   * odstęp 7 dni — bo skan wykonany codziennie mierzy zmianę oświetlenia
--     i pory dnia, nie zmianę twarzy. Wykres z dziennych skanów pokazuje szum
--     i nic z niego nie wynika. Przy okazji chroni przed ocenianiem się
--     codziennie, co jest tą wersją tego modułu, która robi krzywdę.
--
--   * 5 skanów w miesiącu — bo analiza obrazu kosztuje realne pieniądze
--     i jedna osoba nie może wygenerować rachunku całej aplikacji.
--
-- Oba liczone są z samej tabeli skanów, bez osobnego licznika. Licznik
-- obok danych zawsze kiedyś się z nimi rozjeżdża — po skasowaniu skanu,
-- po nieudanym zapisie, po przywróceniu kopii.
--
-- Wartości siedzą w app_settings, żeby zmiana progu nie wymagała wdrożenia.
-- ------------------------------------------------------------
insert into public.app_settings (key, value)
values ('wyglad', jsonb_build_object('odstep_dni', 7, 'limit_miesiaca', 5))
on conflict (key) do nothing;

/**
 * Stan limitów dla ekranu: kiedy wolno następny raz i ile zostało w miesiącu.
 *
 * Ekran musi umieć napisać „następny skan za 3 dni" ZANIM ktoś kliknie —
 * odmowa dopiero po zrobieniu trzech zdjęć byłaby zwyczajnie chamska.
 */
create or replace function public.wyglad_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce((value ->> 'odstep_dni')::int, 7)     as odstep,
           coalesce((value ->> 'limit_miesiaca')::int, 5) as limit_mies
      from public.app_settings where key = 'wyglad'
  ),
  s as (
    select max(utworzono) as ostatni,
           count(*) filter (where utworzono >= date_trunc('month', now())) as w_miesiacu
      from public.wyglad_skany
     where user_id = auth.uid()
  )
  select jsonb_build_object(
    'odstep_dni',     p.odstep,
    'limit_miesiaca', p.limit_mies,
    'w_miesiacu',     coalesce(s.w_miesiacu, 0),
    'ostatni_skan',   s.ostatni,
    'nastepny_od',    case when s.ostatni is null then now()
                           else s.ostatni + make_interval(days => p.odstep) end,
    'mozna',          coalesce(s.w_miesiacu, 0) < p.limit_mies
                        and (s.ostatni is null
                             or s.ostatni + make_interval(days => p.odstep) <= now()),
    'powod',          case
                        when coalesce(s.w_miesiacu, 0) >= p.limit_mies then 'limit_miesiaca'
                        when s.ostatni is not null
                             and s.ostatni + make_interval(days => p.odstep) > now() then 'odstep'
                        else null
                      end
  )
  from p cross join s;
$$;

/*
 * Ten sam warunek jako reguła zapisu.
 *
 * Sprawdzenie w trasie API jest po to, żeby ładnie odmówić. Sprawdzenie tutaj
 * jest po to, żeby odmowy nie dało się ominąć — bo ekran to tylko jedna
 * z dróg do bazy, a limit kosztowy, który da się obejść, nie jest limitem.
 *
 * SECURITY DEFINER omija RLS, więc funkcja czytająca wyglad_skany z wnętrza
 * polityki NA wyglad_skany się nie zapętla. Zwykłe podzapytanie owinięte
 * w (select ...) skończyłoby się błędem 42P17 — jak w 0037.
 */
create or replace function public.wyglad_moze_skanowac()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.wyglad_limit() ->> 'mozna')::boolean, false);
$$;

drop policy if exists wyglad_skany_limit on public.wyglad_skany;
create policy wyglad_skany_limit on public.wyglad_skany
  as restrictive for insert to authenticated
  with check ((select public.wyglad_moze_skanowac()));

revoke all on function public.wyglad_limit(), public.wyglad_moze_skanowac()
  from public, anon;
grant execute on function public.wyglad_limit(), public.wyglad_moze_skanowac()
  to authenticated;

-- ------------------------------------------------------------
-- Usunięcie konta a zdjęcia — dlaczego NIE ma tu wyzwalacza
--
-- `delete_my_account()` z 0024 kasuje wiersz z `auth.users`, a kaskady
-- sprzątają tabele. Kubełek nie jest tabelą, więc pliki zostałyby po koncie,
-- którego już nie ma.
--
-- Napisałem najpierw wyzwalacz kasujący wiersze ze `storage.objects` i była to
-- pomyłka: Supabase pilnuje tej tabeli własnym wyzwalaczem i odrzuca każde
-- bezpośrednie DELETE („Direct deletion from storage tables is not allowed").
-- Efekt był taki, że usunięcie KAŻDEGO konta kończyło się błędem — także
-- konta, które nigdy nie zrobiło żadnego skanu. Kasowanie wierszy i tak nie
-- usuwałoby bajtów, więc pomysł był zły w dwie strony naraz.
--
-- Pliki kasuje `deleteAccount()` w `src/app/(app)/profil/actions.ts`, przez
-- API magazynu, PRZED skasowaniem konta — bo potem nie ma już sesji, która
-- miałaby do nich prawo.
--
-- `drop if exists` zostaje dla baz, na które trafiła pierwsza wersja.
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_deleted_wyglad on auth.users;
drop function if exists public.wyglad_sprzatnij_pliki();

-- ------------------------------------------------------------
-- Sprawdzenie na miejscu
--
-- Migracja, która „poszła", a zostawiła tabelę bez RLS, jest gorsza niż taka,
-- która się wywaliła — bo o pierwszej nikt się nie dowie.
-- ------------------------------------------------------------
do $$
declare
  v_bez_rls  text[];
  v_przelicz text[];
  v_bez_sp   text[];
begin
  select coalesce(array_agg(c.relname order by c.relname), '{}') into v_bez_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname like 'wyglad%' and not c.relrowsecurity;
  if array_length(v_bez_rls, 1) > 0 then
    raise exception 'Tabela modułu Wygląd bez RLS: %', v_bez_rls;
  end if;

  v_przelicz := public.policies_rechecking_uid();
  if array_length(v_przelicz, 1) > 0 then
    raise exception 'Polityka przeliczająca tożsamość co wiersz: %', v_przelicz;
  end if;

  select coalesce(array_agg(p.proname order by p.proname), '{}') into v_bez_sp
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'wyglad%' or p.proname = 'ma_zgode_wyglad')
     and p.proconfig is null;
  if array_length(v_bez_sp, 1) > 0 then
    raise exception 'Funkcja bez przypiętej ścieżki: %', v_bez_sp;
  end if;
end;
$$;
