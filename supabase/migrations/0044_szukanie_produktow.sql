-- ============================================================
-- Grind — Migracja 0044: wyszukiwanie produktów po nazwie
--
-- Skaner kodów kreskowych zapisuje produkt w tabeli `foods`, więc szukanie
-- po słowach już działało — tyle że przez `name ilike '%fraza%'`, co na
-- polskich danych zawodzi w trzech miejscach naraz:
--
--   * ogonki:      „zurek" nie znajduje „Żurek",
--   * kolejność:   „serek wiejski" znajduje, „wiejski serek" już nie,
--   * marka:       nie była przeszukiwana w ogóle.
--
-- Wszystkie trzy sprawdzone na produkcji przed napisaniem tej migracji.
--
-- Tutaj fraza jest rozbijana na słowa i każde musi wystąpić — w nazwie albo
-- w marce, bez ogonków i bez znaczenia wielkości liter. Kolejność słów
-- przestaje mieć znaczenie, bo nikt nie pamięta, czy producent napisał
-- „Serek wiejski light" czy „Light serek wiejski".
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

/**
 * Tekst do porównywania: małe litery, bez polskich ogonków.
 *
 * Własna funkcja zamiast rozszerzenia `unaccent`, bo do obsłużenia jest
 * dziewięć liter, a `unaccent()` nie jest IMMUTABLE — czyli nie da się na nim
 * zbudować indeksu bez opakowywania go w kolejną funkcję. Mniej ruchomych
 * części w zamian za dokładnie tyle samo działania.
 */
create or replace function public.bez_ogonkow(t text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select translate(lower(t),
                   'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
                   'acelnoszzacelnoszz');
$$;

/*
 * Indeks trigramowy pod „%słowo%".
 *
 * Bez niego każde wpisanie litery to pełne przejście po tabeli. Dziś to 100
 * wierszy i nie robi różnicy, ale `foods` jest wspólnym cache'em Open Food
 * Facts dla wszystkich kont i rośnie z każdym zeskanowanym kodem.
 *
 * Wyrażenie musi być IDENTYCZNE z tym w zapytaniu, inaczej planista indeksu
 * nie użyje i zostanie po nim sam koszt utrzymania.
 */
create index if not exists foods_szukanie_idx
  on public.foods
  using gin (
    public.bez_ogonkow(coalesce(name, '') || ' ' || coalesce(brand, ''))
    extensions.gin_trgm_ops
  );

/**
 * Wyszukiwanie produktów po słowach.
 *
 * Świadomie SECURITY INVOKER: RLS na `foods` ma nadal obowiązywać, żeby
 * wyszukiwarka nie stała się drogą do cudzych produktów własnych. Widać
 * to samo, co przy zwykłym `select` — wspólny cache OFF plus swoje.
 *
 * Pusta fraza zwraca ostatnio używane, bo to jest sensowny stan startowy
 * ekranu „dodaj produkt", a nie pusta lista.
 */
create or replace function public.szukaj_produktow(
  p_fraza text default '',
  p_limit integer default 25
)
returns setof public.foods
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select public.bez_ogonkow(coalesce(p_fraza, '')) as fraza
  ),
  s as (
    select fraza,
           array(
             select '%' || w || '%'
               from unnest(string_to_array(
                      btrim(regexp_replace(fraza, '[^a-z0-9]+', ' ', 'g')), ' ')) w
              where w <> ''
           ) as wzorce
      from q
  )
  select f.*
    from public.foods f, s
   where cardinality(s.wzorce) = 0
      or public.bez_ogonkow(coalesce(f.name, '') || ' ' || coalesce(f.brand, ''))
           like all (s.wzorce)
   order by
     -- 1. Nazwa zaczynająca się od wpisanej frazy — to prawie zawsze to,
     --    czego człowiek szukał, więc idzie na górę niezależnie od reszty.
     (public.bez_ogonkow(coalesce(f.name, '')) like s.fraza || '%') desc,
     -- 2. Podobieństwo całej nazwy do frazy — odsiewa przypadkowe trafienia
     --    w długich nazwach z listą składników.
     similarity(public.bez_ogonkow(coalesce(f.name, '')), s.fraza) desc,
     -- 3. Przy remisie wygrywa to, czego używało się ostatnio.
     f.updated_at desc
   limit greatest(coalesce(p_limit, 25), 1);
$$;

revoke all on function public.bez_ogonkow(text)                from public, anon;
revoke all on function public.szukaj_produktow(text, integer)  from public, anon;
grant execute on function public.bez_ogonkow(text)               to authenticated;
grant execute on function public.szukaj_produktow(text, integer) to authenticated;

do $$
begin
  if public.bez_ogonkow('Żurek Śląski') <> 'zurek slaski' then
    raise exception 'bez_ogonkow() nie zdejmuje ogonków: %', public.bez_ogonkow('Żurek Śląski');
  end if;
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'foods_szukanie_idx') then
    raise exception 'brak indeksu wyszukiwania';
  end if;
end;
$$;
