-- ============================================================
-- 0053: reguły przepisów bez przeliczania tożsamości co wiersz
--
-- Migracja 0049 wpisała w polityki gołe auth.uid(). Postgres traktuje je jako
-- funkcję zmienną i woła ją OSOBNO DLA KAŻDEGO WIERSZA, zamiast raz na
-- zapytanie. Przy dziewięciuset składnikach katalogu to dziewięćset wywołań
-- na jedno otwarcie przepisu.
--
-- Lekarstwo jest to samo, co w migracji 0034: (select auth.uid()) planer
-- rozpoznaje jako podzapytanie bez zależności od wiersza i liczy raz.
-- Zasady dostępu ani o włos to nie zmienia - to wyłącznie sposób zapisu.
--
-- Znalazł to test na żywo (`test:live`), który sprawdza wszystkie polityki
-- w bazie. Sam blok sprawdzający migracji 0049 tego nie łapał, bo pilnował
-- tylko tego, czy polityki powstały.
-- ============================================================

drop policy if exists recipe_items_recipe_owner_read on public.recipe_items;
create policy recipe_items_recipe_owner_read on public.recipe_items
  as restrictive for select to authenticated
  using (
    public.recipe_owner(recipe_id) = (select auth.uid())
    or public.recipe_owner(recipe_id) is null
  );

drop policy if exists recipe_items_recipe_owner_insert on public.recipe_items;
create policy recipe_items_recipe_owner_insert on public.recipe_items
  as restrictive for insert to authenticated
  with check (public.recipe_owner(recipe_id) = (select auth.uid()));

drop policy if exists recipe_items_recipe_owner_update on public.recipe_items;
create policy recipe_items_recipe_owner_update on public.recipe_items
  as restrictive for update to authenticated
  using (public.recipe_owner(recipe_id) = (select auth.uid()))
  with check (public.recipe_owner(recipe_id) = (select auth.uid()));

drop policy if exists recipe_items_recipe_owner_delete on public.recipe_items;
create policy recipe_items_recipe_owner_delete on public.recipe_items
  as restrictive for delete to authenticated
  using (public.recipe_owner(recipe_id) = (select auth.uid()));

drop policy if exists recipe_steps_owner_all on public.recipe_steps;
create policy recipe_steps_owner_all on public.recipe_steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------

do $$
declare v_zle text[];
begin
  /*
   * Korzystamy z gotowego strażnika z migracji 0034 zamiast pisać własne
   * wyszukiwanie. Test na żywo pyta dokładnie tę funkcję, więc migracja
   * sprawdza się tą samą miarą, którą potem zostanie zmierzona.
   */
  select array(
    select x from unnest(public.policies_rechecking_uid()) as x
     where x like 'recipe_%'
  ) into v_zle;

  if array_length(v_zle, 1) > 0 then
    raise exception 'Migracja 0053: nadal przeliczają tożsamość co wiersz: %', v_zle;
  end if;

  -- Katalog ma dalej dawać się czytać - poprawka wydajności nie może
  -- przy okazji zamknąć dostępu.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'recipe_items'
       and policyname = 'recipe_items_recipe_owner_read'
       -- Postgres wypisuje warunki wielkimi literami, stąd ilike.
       and qual ilike '%is null%'
  ) then
    raise exception 'Migracja 0053: odczyt katalogu przestał być dozwolony';
  end if;
end $$;
