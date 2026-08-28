-- ============================================================
-- Grind — Migracja 0034: RLS przestaje przeliczać tożsamość co wiersz
--
-- Problem znaleziony w przeglądzie kodu.
--
-- Wszystkie polityki pytały `auth.uid()` wprost. Różnica wobec
-- `(select auth.uid())` jest zasadnicza: w pierwszym wariancie Postgres woła
-- funkcję dla KAŻDEGO sprawdzanego wiersza, w drugim raz na całe zapytanie
-- (jako InitPlan).
--
-- Nie widać tego przy stu wierszach. Widać przy zapytaniu trenera, które czyta
-- do 2000 serii treningowych, i przy eksporcie danych, który czyta wszystko
-- naraz. To ta sama rzecz, którą audytor Supabase zgłasza jako
-- `auth_rls_initplan`.
--
-- Zamiast przepisywać dziewięćdziesiąt polityk ręcznie — i przy okazji
-- przeoczyć trzy — przepisujemy je z katalogu systemowego. Dzięki temu
-- migracja obejmuje też polityki, które ktoś doda później, byle uruchomił ją
-- ponownie.
--
-- UWAGA dla przyszłych migracji: nowe polityki pisz od razu jako
-- `(select auth.uid())`.
-- ============================================================

do $$
declare
  r        record;
  v_qual   text;
  v_check  text;
  v_sql    text;
  v_fixed  int := 0;
begin
  for r in
    select policyname, schemaname, tablename, qual, with_check
      from pg_policies
     where schemaname = 'public'
     order by tablename, policyname
  loop
    v_qual  := r.qual;
    v_check := r.with_check;

    -- Najpierw rozwijamy to, co już jest owinięte, potem owijamy wszystko raz.
    -- Dzięki temu ponowne uruchomienie migracji nie zagnieżdża selectów.
    if v_qual is not null then
      v_qual := replace(v_qual, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      v_qual := replace(v_qual, '( SELECT is_admin() AS is_admin)', 'is_admin()');
      v_qual := replace(v_qual, 'auth.uid()', '(select auth.uid())');
      v_qual := replace(v_qual, 'is_admin()', '(select public.is_admin())');
    end if;

    if v_check is not null then
      v_check := replace(v_check, '( SELECT auth.uid() AS uid)', 'auth.uid()');
      v_check := replace(v_check, '( SELECT is_admin() AS is_admin)', 'is_admin()');
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
      v_check := replace(v_check, 'is_admin()', '(select public.is_admin())');
    end if;

    if v_qual is not distinct from r.qual and v_check is not distinct from r.with_check then
      continue;
    end if;

    -- Polityka INSERT ma wyłącznie WITH CHECK, SELECT wyłącznie USING —
    -- dopisanie brakującej części kończy się błędem, więc budujemy zdanie
    -- z tego, co dana polityka faktycznie ma.
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'RLS: przepisano % polityk na (select auth.uid())', v_fixed;
end;
$$;

-- ------------------------------------------------------------
-- Sprawdzenie na miejscu
-- ------------------------------------------------------------
-- Migracja, która „chyba zadziałała”, jest gorsza niż jej brak: dalej wierzysz,
-- że problem zniknął. Jeśli po przebiegu zostanie polityka z gołym auth.uid(),
-- migracja się wywraca i widać to od razu.
do $$
declare
  v_left text[];
begin
  select coalesce(array_agg(tablename || '.' || policyname), '{}')
    into v_left
    from pg_policies
   where schemaname = 'public'
     and (
       (qual is not null       and qual       like '%auth.uid()%'
                               and qual       not like '%SELECT auth.uid()%')
       or
       (with_check is not null and with_check like '%auth.uid()%'
                               and with_check not like '%SELECT auth.uid()%')
     );

  if array_length(v_left, 1) > 0 then
    raise exception 'Zostały polityki z przeliczaniem co wiersz: %', v_left;
  end if;
end;
$$;

/**
 * Lista polityk, które nadal przeliczają tożsamość dla każdego wiersza.
 *
 * Pusta tablica to jedyny poprawny wynik. Test na produkcji sprawdza to przy
 * każdym uruchomieniu, żeby nowa migracja nie wprowadziła tego z powrotem
 * tylnymi drzwiami.
 */
create or replace function public.policies_rechecking_uid()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(tablename || '.' || policyname order by tablename, policyname), '{}')
    from pg_policies
   where schemaname = 'public'
     and (
       (qual is not null       and qual       like '%auth.uid()%'
                               and qual       not like '%SELECT auth.uid()%')
       or
       (with_check is not null and with_check like '%auth.uid()%'
                               and with_check not like '%SELECT auth.uid()%')
     );
$$;

grant execute on function public.policies_rechecking_uid() to authenticated;
