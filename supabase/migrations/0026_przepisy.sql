-- ============================================================
-- Grind — Migracja 0026: własne dania ze składników
--
-- Kuratorowana lista 52 dań pokrywa to, co jada się na mieście. Nie pokrywa
-- tego, co gotujesz u siebie — a to właśnie wraca codziennie. Owsianka
-- z konkretnych płatków, konkretnego mleka i łyżki masła orzechowego to
-- cztery wpisy do dziennika, powtarzane co rano.
--
-- JEDEN MECHANIZM, DWA WEJŚCIA. Przepis można ułożyć ze składników albo
-- zapisać z posiłku, który już masz wpisany („zapisz jako moje danie").
-- Szablon posiłku to po prostu przepis powstały tą drugą drogą — dwie osobne
-- konstrukcje robiłyby to samo i trzeba by je tłumaczyć osobno.
-- ============================================================

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  name        text not null,
  icon        text not null default '🍲',
  note        text,

  /** Na ile porcji wychodzi cała ilość — dzięki temu „1 porcja" ma sens. */
  servings    numeric(5, 2) not null default 1 check (servings > 0),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, name)
);

create index if not exists recipes_user_idx on public.recipes (user_id, updated_at desc);

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

/**
 * Składnik przepisu.
 *
 * Makra są KOPIOWANE w chwili dodania, tak samo jak we wpisach posiłku.
 * Gdyby przepis odwoływał się tylko do produktu, poprawienie wartości tego
 * produktu po miesiącu po cichu zmieniłoby historię wszystkich posiłków,
 * w których przepis był użyty.
 */
create table if not exists public.recipe_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  recipe_id    uuid not null references public.recipes (id) on delete cascade,

  /** Dla porządku i podpowiedzi; przepis działa też bez tego powiązania. */
  food_id      uuid references public.foods (id) on delete set null,
  name         text not null,
  grams        numeric(7, 2) not null check (grams > 0),

  kcal_100g    numeric(7, 2) not null check (kcal_100g >= 0),
  protein_100g numeric(6, 2) not null default 0 check (protein_100g >= 0),
  carbs_100g   numeric(6, 2) not null default 0 check (carbs_100g >= 0),
  fat_100g     numeric(6, 2) not null default 0 check (fat_100g >= 0),

  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists recipe_items_recipe_idx
  on public.recipe_items (recipe_id, order_index);

-- ------------------------------------------------------------
-- Sumy przepisu
-- ------------------------------------------------------------
/**
 * Przepis jako produkt.
 *
 * Liczymy wartości NA 100 G całości, żeby dodanie przepisu do posiłku szło tą
 * samą drogą co każdy inny produkt — bez osobnej ścieżki zapisu i osobnych
 * błędów do wyłapania. Dziennik pokazuje wtedy jedną pozycję „Owsianka moja
 * 350 g", a nie cztery linijki składników.
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
    -- Na 100 g całości; przy pustym przepisie zero, a nie dzielenie przez zero.
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
         else 0 end                                                  as fat_100g
  from public.recipes r
  left join public.recipe_items i on i.recipe_id = r.id
  group by r.id, r.user_id, r.name, r.icon, r.servings;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.recipes      enable row level security;
alter table public.recipe_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_items']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

create or replace function public.recipe_owner(p_recipe_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.recipes where id = p_recipe_id;
$$;

drop policy if exists recipe_items_recipe_owner on public.recipe_items;
create policy recipe_items_recipe_owner on public.recipe_items
  as restrictive for all to authenticated
  using (public.recipe_owner(recipe_id) = auth.uid())
  with check (public.recipe_owner(recipe_id) = auth.uid());

grant select, insert, update, delete on public.recipes, public.recipe_items to authenticated;
grant select on public.v_recipe_totals to authenticated;
grant execute on function public.recipe_owner(uuid) to authenticated;
