-- ============================================================
-- 0049: katalog przepisów - te same tabele, co własne dania
--
-- Kuratorowana lista 52 dań z migracji 0023 odpowiada na pytanie "co zjadłem".
-- Nie odpowiada na "co ugotować", bo nie ma w niej ani składników, ani kroków.
-- Katalog przepisów odpowiada właśnie na to drugie.
--
-- DLACZEGO TE SAME TABELE, A NIE NOWE. Przepis w Grindzie jest już produktem:
-- widok v_recipe_totals przelicza składniki na wartości na 100 g, więc dodanie
-- dania do posiłku idzie tą samą drogą co dodanie sera żółtego. Osobna tabela
-- na przepisy z katalogu znaczyłaby drugą ścieżkę zapisu, drugi zestaw błędów
-- i drugi kawałek kodu do utrzymania - a różnica między przepisem moim
-- a wspólnym to jedna kolumna. Wystarczy user_id = NULL, dokładnie jak
-- w exercise_catalog i w kuratorowanych produktach w foods.
--
-- MAKRA NIE SĄ WPISYWANE. Kalorii przepisu nikt tu nie podaje - podaje się
-- gramy składników, a widok sumuje. Dzięki temu do katalogu nie da się wstawić
-- dania z wziętymi z sufitu 9000 kcal, bo kalorii dania w ogóle nie ma
-- w danych wejściowych.
--
-- LICENCJA. Treść wchodzi z polskiej Książki kucharskiej na Wikibooks
-- (CC BY-SA 4.0), więc przy każdym wierszu zapisujemy licencję, autora
-- zbiorowego i odnośnik do źródła - tak samo jak przy ćwiczeniach z wger
-- w migracji 0001. Ekran przepisu pokazuje to pod krokami.
-- ============================================================

-- ------------------------------------------------------------
-- Przepis wspólny: user_id = NULL
-- ------------------------------------------------------------

alter table public.recipes alter column user_id drop not null;

alter table public.recipes
  add column if not exists source text not null default 'user',
  add column if not exists opis text,
  add column if not exists czas_min integer check (czas_min > 0),
  add column if not exists poziom text,
  add column if not exists tagi text[] not null default '{}',
  /**
   * Makra policzone z miar domowych ("2 łyżki oleju"), a nie z wagi.
   *
   * Ekran musi to powiedzieć wprost. Liczba bez ostrzeżenia sugeruje
   * precyzję, której w przepisie z książki kucharskiej po prostu nie ma.
   */
  add column if not exists makra_orientacyjne boolean not null default false,
  add column if not exists license text,
  add column if not exists license_author text,
  add column if not exists license_url text;

alter table public.recipes drop constraint if exists recipes_source_check;
alter table public.recipes
  add constraint recipes_source_check check (source in ('user', 'katalog'));

alter table public.recipes drop constraint if exists recipes_poziom_check;
alter table public.recipes
  add constraint recipes_poziom_check
  check (poziom is null or poziom in ('latwy', 'sredni', 'trudny'));

/*
 * Wiersz wspólny to dokładnie wiersz bez właściciela.
 *
 * Bez tego więzu dałoby się zrobić przepis z katalogu przypisany do jednej
 * osoby albo prywatny bez właściciela - dwa stany, których żaden ekran nie
 * umie pokazać, a które trzeba by potem sprzątać.
 */
alter table public.recipes drop constraint if exists recipes_katalog_bez_wlasciciela;
alter table public.recipes
  add constraint recipes_katalog_bez_wlasciciela
  check ((user_id is null) = (source = 'katalog'));

/*
 * Ta sama pułapka, co przy 52 daniach w migracji 0023.
 *
 * Więz unique (user_id, name) NIE działa dla katalogu, bo w SQL NULL nie
 * równa się NULL - dla wierszy wspólnych konflikt nigdy nie zachodzi
 * i ponowne uruchomienie importu po cichu dokłada duplikaty. Potrzebny jest
 * indeks częściowy po samej nazwie.
 */
create unique index if not exists recipes_katalog_name_uidx
  on public.recipes (lower(name)) where user_id is null;

create index if not exists recipes_katalog_idx
  on public.recipes (source, name) where user_id is null;

-- ------------------------------------------------------------
-- Kroki wykonania
-- ------------------------------------------------------------
/**
 * Krok przepisu.
 *
 * `minuty` wypełniamy tylko wtedy, gdy krok naprawdę polega na czekaniu
 * ("piecz 25 minut", "odstaw na godzinę") - wtedy tryb gotowania pokazuje
 * przy nim minutnik. Przy "posiekaj cebulę" minutnik byłby wyłącznie
 * ozdobą, która odlicza czas cudzej cebuli.
 */
create table if not exists public.recipe_steps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,

  order_index integer not null default 0,
  tekst       text not null check (btrim(tekst) <> ''),
  minuty      integer check (minuty > 0 and minuty <= 2880),

  created_at  timestamptz not null default now()
);

create index if not exists recipe_steps_recipe_idx
  on public.recipe_steps (recipe_id, order_index);
create index if not exists recipe_steps_user_fk_idx
  on public.recipe_steps (user_id);

-- Składniki przepisu z katalogu też nie mają właściciela.
alter table public.recipe_items alter column user_id drop not null;

-- ------------------------------------------------------------
-- Widok: przepis policzony jako produkt (teraz także wspólny)
-- ------------------------------------------------------------
/*
 * Widok przejmuje nowe kolumny opisowe, żeby lista katalogu dała się
 * narysować JEDNYM zapytaniem, bez dociągania recipes obok.
 */
create or replace view public.v_recipe_totals
with (security_invoker = on) as
  select
    r.id            as recipe_id,
    r.user_id,
    r.name,
    r.icon,
    r.servings,
    coalesce(sum(i.grams), 0)                                        as total_g,
    coalesce(sum(i.grams * i.kcal_100g    / 100), 0)                 as kcal,
    coalesce(sum(i.grams * i.protein_100g / 100), 0)                 as protein_g,
    coalesce(sum(i.grams * i.carbs_100g   / 100), 0)                 as carbs_g,
    coalesce(sum(i.grams * i.fat_100g     / 100), 0)                 as fat_g,
    count(i.id)                                                      as items,
    case when coalesce(sum(i.grams), 0) > 0
         then round(sum(i.grams * i.kcal_100g    / 100) / sum(i.grams) * 100, 2)
         else 0 end                                                  as kcal_100g,
    case when coalesce(sum(i.grams), 0) > 0
         then round(sum(i.grams * i.protein_100g / 100) / sum(i.grams) * 100, 2)
         else 0 end                                                  as protein_100g,
    case when coalesce(sum(i.grams), 0) > 0
         then round(sum(i.grams * i.carbs_100g   / 100) / sum(i.grams) * 100, 2)
         else 0 end                                                  as carbs_100g,
    case when coalesce(sum(i.grams), 0) > 0
         then round(sum(i.grams * i.fat_100g     / 100) / sum(i.grams) * 100, 2)
         else 0 end                                                  as fat_100g,
    -- Nowe kolumny idą na SAM KONIEC. "create or replace view" nie potrafi
    -- wstawić kolumny w środek ani zmienić nazwy istniejącej - próba kończy
    -- się błędem "cannot change name of view column". Kasowanie widoku
    -- odebrałoby przy okazji nadane uprawnienia.
    r.source,
    r.opis,
    r.czas_min,
    r.poziom,
    r.tagi,
    r.makra_orientacyjne,
    r.license,
    r.license_author,
    r.license_url,
    (select count(*) from public.recipe_steps s where s.recipe_id = r.id) as kroki
  from public.recipes r
  left join public.recipe_items i on i.recipe_id = r.id
  group by r.id, r.user_id, r.name, r.icon, r.servings, r.source, r.opis,
           r.czas_min, r.poziom, r.tagi, r.makra_orientacyjne,
           r.license, r.license_author, r.license_url;

-- ------------------------------------------------------------
-- RLS: katalog do czytania dla zalogowanych, do pisania dla nikogo
-- ------------------------------------------------------------
/*
 * Polityki właściciela z migracji 0026 zostają nietknięte - one nadal rządzą
 * wierszami prywatnymi. Dokładamy obok drugą politykę PERMISSIVE tylko na
 * SELECT, bo polityki permisywne sumują się przez OR: "moje ALBO wspólne".
 *
 * Zapisu nie dokładamy nigdzie. Katalog wchodzi kluczem service_role, tak samo
 * jak ćwiczenia z wger - to jedyna droga, i dzięki temu nikt nie poprawi
 * przepisu wszystkim naraz (dokładnie ten atak, który migracja 0029 zamknęła
 * na wspólnych produktach).
 */
alter table public.recipe_steps enable row level security;

drop policy if exists recipes_katalog_read on public.recipes;
create policy recipes_katalog_read on public.recipes
  for select to authenticated
  using (user_id is null);

drop policy if exists recipe_items_katalog_read on public.recipe_items;
create policy recipe_items_katalog_read on public.recipe_items
  for select to authenticated
  using (user_id is null);

drop policy if exists recipe_steps_owner_all on public.recipe_steps;
create policy recipe_steps_owner_all on public.recipe_steps
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recipe_steps_katalog_read on public.recipe_steps;
create policy recipe_steps_katalog_read on public.recipe_steps
  for select to authenticated
  using (user_id is null);

/*
 * Więz „składnik należy do tego samego przepisu, co ty" z migracji 0026 był
 * RESTRICTIVE dla WSZYSTKICH poleceń, a recipe_owner() dla katalogu zwraca
 * NULL - czyli po dodaniu katalogu blokowałby jego CZYTANIE.
 *
 * Rozdzielamy więc na dwie polityki: odczyt wpuszcza wiersze bez właściciela,
 * zapis dalej wymaga, żeby przepis był twój. Jedna polityka „for all" nie da
 * się tak rozstrzelić, bo ten sam warunek wpuściłby zapis do cudzego przepisu.
 */
drop policy if exists recipe_items_recipe_owner on public.recipe_items;

drop policy if exists recipe_items_recipe_owner_read on public.recipe_items;
create policy recipe_items_recipe_owner_read on public.recipe_items
  as restrictive for select to authenticated
  using (
    public.recipe_owner(recipe_id) = auth.uid()
    or public.recipe_owner(recipe_id) is null
  );

do $$
declare c text;
begin
  foreach c in array array['insert', 'update', 'delete']
  loop
    execute format('drop policy if exists recipe_items_recipe_owner_%s on public.recipe_items', c);
    if c = 'insert' then
      execute 'create policy recipe_items_recipe_owner_insert on public.recipe_items
                 as restrictive for insert to authenticated
                 with check (public.recipe_owner(recipe_id) = auth.uid())';
    elsif c = 'update' then
      execute 'create policy recipe_items_recipe_owner_update on public.recipe_items
                 as restrictive for update to authenticated
                 using (public.recipe_owner(recipe_id) = auth.uid())
                 with check (public.recipe_owner(recipe_id) = auth.uid())';
    else
      execute 'create policy recipe_items_recipe_owner_delete on public.recipe_items
                 as restrictive for delete to authenticated
                 using (public.recipe_owner(recipe_id) = auth.uid())';
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.recipe_steps to authenticated;

-- ------------------------------------------------------------
-- Skopiuj przepis z katalogu do moich dań
-- ------------------------------------------------------------
/**
 * Kopia, a nie odnośnik.
 *
 * Przepis z katalogu jest tylko do czytania, a gotuje się zawsze po swojemu:
 * mniej masła, inny makaron, podwójna porcja. Kopiowanie daje wiersze, które
 * wolno zmieniać, i zamraża je w chwili skopiowania - późniejsza poprawka
 * katalogu nie ruszy twojego dania ani historii posiłków, w których było
 * użyte. Ta sama zasada, co przy kopiowaniu makr do wpisu posiłku.
 */
create or replace function public.skopiuj_przepis(p_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_nowy  uuid;
  v_nazwa text;
  v_lp    int;
begin
  if v_uid is null then
    raise exception 'Trzeba być zalogowanym.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.recipes where id = p_recipe_id and user_id is null) then
    raise exception 'Nie ma takiego przepisu w katalogu.' using errcode = '22023';
  end if;

  select name into v_nazwa from public.recipes where id = p_recipe_id;

  /*
   * Nazwa musi być unikalna w obrębie moich dań (więz z migracji 0026).
   * Druga kopia dostaje więc "(2)", trzecia "(3)" - zamiast błędu 23505
   * wprost na twarz użytkownika.
   */
  v_lp := 1;
  while exists (select 1 from public.recipes where user_id = v_uid and name = v_nazwa) loop
    v_lp := v_lp + 1;
    v_nazwa := (select name from public.recipes where id = p_recipe_id) || ' (' || v_lp || ')';
    if v_lp > 50 then
      raise exception 'Masz już bardzo dużo kopii tego przepisu.' using errcode = '22023';
    end if;
  end loop;

  insert into public.recipes
    (user_id, source, name, icon, note, servings, opis, czas_min, poziom, tagi,
     makra_orientacyjne, license, license_author, license_url)
  select v_uid, 'user', v_nazwa, icon, note, servings, opis, czas_min, poziom, tagi,
         makra_orientacyjne, license, license_author, license_url
    from public.recipes where id = p_recipe_id
  returning id into v_nowy;

  insert into public.recipe_items
    (user_id, recipe_id, food_id, name, grams,
     kcal_100g, protein_100g, carbs_100g, fat_100g, order_index)
  select v_uid, v_nowy, food_id, name, grams,
         kcal_100g, protein_100g, carbs_100g, fat_100g, order_index
    from public.recipe_items where recipe_id = p_recipe_id;

  insert into public.recipe_steps (user_id, recipe_id, order_index, tekst, minuty)
  select v_uid, v_nowy, order_index, tekst, minuty
    from public.recipe_steps where recipe_id = p_recipe_id;

  return v_nowy;
end $$;

-- ------------------------------------------------------------
-- Przepis dnia
-- ------------------------------------------------------------
/**
 * Jeden przepis na dobę, dobrany do dziennego celu kalorycznego.
 *
 * DWIE DECYZJE, KTÓRE WIDAĆ W KODZIE:
 *
 * 1. Liczymy z CELU, a nie z tego, ile kalorii zostało ci dzisiaj. Widżet wisi
 *    na stronie głównej cały dzień - gdyby liczył resztę dnia, podmieniałby
 *    przepis po każdym wpisanym posiłku i nigdy nie dałoby się do niego wrócić.
 *
 * 2. Losowanie jest deterministyczne: md5 z identyfikatora przepisu, daty
 *    i użytkownika. Ten sam przepis przez całą dobę, inny u każdego, zmiana
 *    o północy - i bez tabeli pamiętającej, co komu wypadło. random() dawałby
 *    inny wynik przy serwerze i przy odświeżeniu, czyli migotanie.
 *
 * Widełki 15-45 % dziennego celu to zakres jednego sensownego posiłku:
 * poniżej jest przekąska, powyżej - cały dzień na jednym talerzu.
 *
 * Zwraca CAŁY wiersz widoku, a nie samo id. Strona główna to najczęściej
 * otwierany ekran w całej aplikacji; zwracanie identyfikatora znaczyłoby
 * drugą podróż do bazy po nazwę i kalorie, tylko po to, żeby narysować
 * jeden kafelek.
 */
create or replace function public.przepis_dnia()
returns setof public.v_recipe_totals
language sql
stable
security definer
set search_path = public
as $$
  with cel as (
    select daily_kcal from public.profiles where id = auth.uid()
  ),
  kandydaci as (
    select v.recipe_id,
           v.kcal / greatest(v.servings, 1) as kcal_porcji
      from public.v_recipe_totals v
     where v.user_id is null
       and v.items > 0
       and v.kroki > 0
  ),
  pasujace as (
    select k.recipe_id
      from kandydaci k, cel c
     where c.daily_kcal is null
        or k.kcal_porcji between c.daily_kcal * 0.15 and c.daily_kcal * 0.45
  ),
  -- Przy bardzo niskim celu widełki potrafią nie złapać niczego. Lepiej
  -- pokazać jakikolwiek przepis niż pusty kafelek.
  pula as (
    select recipe_id from pasujace
    union all
    select recipe_id from kandydaci
     where not exists (select 1 from pasujace)
  ),
  wybrany as (
    select recipe_id from pula
     order by md5(recipe_id::text || current_date::text || coalesce(auth.uid()::text, ''))
     limit 1
  )
  select v.* from public.v_recipe_totals v
    join wybrany w on w.recipe_id = v.recipe_id;
$$;

revoke all on function public.skopiuj_przepis(uuid), public.przepis_dnia()
  from public, anon;
grant execute on function public.skopiuj_przepis(uuid), public.przepis_dnia()
  to authenticated;

comment on function public.przepis_dnia is
  'Przepis dnia dobrany do dziennego celu kalorycznego. Stały przez dobę, '
  'inny u każdego, bez tabeli historii.';
comment on function public.skopiuj_przepis is
  'Kopiuje przepis z katalogu do własnych dań razem ze składnikami i krokami.';

-- ------------------------------------------------------------
-- Sprawdzenie: czy migracja zrobiła to, co obiecuje
-- ------------------------------------------------------------

do $$
declare
  v_kolumny  int;
  v_polityki int;
  v_anon     int;
  v_widok    int;
begin
  select count(*) into v_kolumny
    from information_schema.columns
   where table_schema = 'public' and table_name = 'recipes'
     and column_name in ('source', 'tagi', 'makra_orientacyjne', 'license', 'czas_min');
  if v_kolumny <> 5 then
    raise exception 'Migracja 0049: brakuje kolumn opisowych w recipes (jest %)', v_kolumny;
  end if;

  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'recipes'
         and column_name = 'user_id') <> 'YES' then
    raise exception 'Migracja 0049: recipes.user_id nadal wymagane, katalog się nie zmieści';
  end if;

  -- Odczyt katalogu musi być możliwy, zapis do niego - nie.
  select count(*) into v_polityki
    from pg_policies
   where schemaname = 'public'
     and policyname in ('recipes_katalog_read', 'recipe_items_katalog_read',
                        'recipe_steps_katalog_read', 'recipe_items_recipe_owner_read');
  if v_polityki <> 4 then
    raise exception 'Migracja 0049: polityki odczytu katalogu nie powstały (jest %)', v_polityki;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'recipes'
       and cmd in ('INSERT', 'ALL') and policyname = 'recipes_katalog_read'
  ) then
    raise exception 'Migracja 0049: polityka katalogu wpuszcza zapis';
  end if;

  select count(*) into v_widok
    from information_schema.columns
   where table_schema = 'public' and table_name = 'v_recipe_totals'
     and column_name in ('source', 'kroki', 'makra_orientacyjne');
  if v_widok <> 3 then
    raise exception 'Migracja 0049: widok nie zna nowych kolumn (jest %)', v_widok;
  end if;

  -- Pułapka z migracji 0045: nowa funkcja rodzi się z prawem wykonania dla
  -- PUBLIC, a w Supabase anon należy do PUBLIC.
  select count(*) into v_anon
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('skopiuj_przepis', 'przepis_dnia')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('public', p.oid, 'execute'));
  if v_anon > 0 then
    raise exception 'Migracja 0049: % funkcji nadal odpowiada niezalogowanym', v_anon;
  end if;
end $$;
