-- ============================================================
-- Grind — Migracja 0077: porządki po doradcy bezpieczeństwa
--
-- Doradca Supabase wskazał dwie rzeczy w funkcjach dopisanych w 0065-0076.
-- Obie są drobne i żadna nie była wykorzystywalna, ale obie łamią zasady,
-- które ten projekt spisał sobie wcześniej - a zasada łamana "bo akurat
-- tutaj nic się nie stanie" przestaje być zasadą.
--
--   1. SEARCH_PATH. Funkcja bez przypiętej ścieżki szuka tabel i funkcji
--      w schematach ustawionych przez tego, kto ją woła. To klasyczna droga
--      podmiany: ktoś podsuwa własną funkcję o tej samej nazwie we
--      własnym schemacie. Tu dotyczy to trzech funkcji bez SECURITY DEFINER,
--      więc ryzyko jest znikome - ale przypięcie kosztuje jedną linię.
--
--   2. PRAWO WYKONANIA FUNKCJI WYZWALACZY. Dwie funkcje wyzwalaczy zostały
--      z domyślnym EXECUTE. Wywołane bezpośrednio i tak kończą się błędem
--      ("trigger functions can only be called as triggers"), ale projekt
--      ma regułę: każda nowa funkcja zaczyna od odebrania praw. Postgres
--      nie sprawdza EXECUTE przy odpalaniu wyzwalacza, więc odebranie
--      niczego nie psuje - pilnują tego test:finanse i test:pomoc, które
--      wstawiają wiersze jako `authenticated`.
--
-- Świadomie POZOSTAJĄ otwarte funkcje diagnostyczne (tables_without_rls,
-- policies_rechecking_uid, funkcje_dla_anona): test-live woła je na
-- produkcji jako strażników. Doradca liczy je jako znalezisko, a to jest
-- zamierzone.
-- ============================================================

alter function public.finanse_kategoria_rodzaju(text) set search_path = public;
alter function public.finanse_pozycja_kategoria_tg() set search_path = public;
alter function public.finanse_aktywo_sprawdz() set search_path = public;

revoke all on function public.finanse_aktywa_przelicz() from public, anon, authenticated;
revoke all on function public.zgloszenie_odpowiedz_tg() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_nazwa text;
begin
  foreach v_nazwa in array array[
    'public.finanse_kategoria_rodzaju(text)',
    'public.finanse_pozycja_kategoria_tg()',
    'public.finanse_aktywo_sprawdz()'
  ] loop
    if not exists (
      select 1 from pg_proc
       where oid = v_nazwa::regprocedure
         and proconfig is not null
         and exists (select 1 from unnest(proconfig) c where c like 'search_path=%')
    ) then
      raise exception 'Migracja 0077: % dalej nie ma przypiętego search_path', v_nazwa;
    end if;
  end loop;

  foreach v_nazwa in array array[
    'public.finanse_aktywa_przelicz()',
    'public.zgloszenie_odpowiedz_tg()'
  ] loop
    if has_function_privilege('anon', v_nazwa, 'EXECUTE')
       or has_function_privilege('authenticated', v_nazwa, 'EXECUTE') then
      raise exception 'Migracja 0077: % dalej jest wykonywalna z zewnątrz', v_nazwa;
    end if;
  end loop;

  -- Mapowanie koszyka musi działać dokładnie jak przed zmianą.
  if public.finanse_kategoria_rodzaju('obligacje') <> 'inwestycje'
     or public.finanse_kategoria_rodzaju('konto') <> 'plynne' then
    raise exception 'Migracja 0077: przypięcie ścieżki zmieniło mapowanie koszyków';
  end if;
end;
$$;
