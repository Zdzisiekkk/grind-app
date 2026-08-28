-- ============================================================
-- Grind — Migracja 0029: wspólna baza produktów tylko do dopisywania
--
-- Problem znaleziony w przeglądzie kodu.
--
-- Polityka `foods_update` pozwalała każdemu zalogowanemu zmienić DOWOLNY
-- wiersz z Open Food Facts:
--
--     using (user_id = auth.uid() or (user_id is null and source = 'off'))
--
-- Cache OFF jest wspólny dla wszystkich, więc jedna osoba mogła wpisać mleku
-- 9000 kcal na 100 g i popsuć liczenie każdemu, kto potem ten produkt doda.
-- Aplikacja jest publiczna, więc nie jest to scenariusz hipotetyczny — a widać
-- go dopiero wtedy, gdy ktoś zgłosi dziwny wynik.
--
-- Rozwiązanie: wiersze wspólne stają się tylko-do-dopisywania. Zapisuje je
-- jedna wąska funkcja, która potrafi WSTAWIĆ brakujący produkt i nic poza tym.
-- Kto pierwszy zeskanuje kod, ten ustala wartości; nikt ich później nie zmieni
-- z poziomu aplikacji.
--
-- Odświeżanie danych z OFF (bo produkty naprawdę się zmieniają) należy zrobić
-- zadaniem po stronie serwera, które bierze wartości PROSTO z OFF, a nie od
-- przeglądarki. Do tego czasu nieaktualny wiersz da się obejść własnym
-- produktem, co jest wynikiem o klasę lepszym niż wiersz podmieniony złośliwie.
-- ============================================================

-- ------------------------------------------------------------
-- Zapis produktu z OFF — jedyna droga do wierszy wspólnych
-- ------------------------------------------------------------
create or replace function public.cache_off_product(
  p_off_id         text,
  p_name           text,
  p_brand          text default null,
  p_image_url      text default null,
  p_kcal_100g      numeric default 0,
  p_protein_100g   numeric default 0,
  p_carbs_100g     numeric default 0,
  p_fat_100g       numeric default 0,
  p_fiber_100g     numeric default null,
  p_sugar_100g     numeric default null,
  p_salt_100g      numeric default null,
  p_serving_size_g numeric default null,
  p_serving_label  text default null
)
returns public.foods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.foods;
begin
  if auth.uid() is null then
    raise exception 'Trzeba być zalogowanym.' using errcode = '42501';
  end if;

  if p_off_id is null or btrim(p_off_id) = '' or p_name is null or btrim(p_name) = '' then
    raise exception 'Produkt musi mieć kod i nazwę.' using errcode = '22023';
  end if;

  -- Jest już w cache'u? Oddajemy to, co jest. Świadomie NIE nadpisujemy:
  -- wartości przysłane przez przeglądarkę nie mają jak być wiarygodniejsze
  -- od tych, które ktoś zapisał wcześniej.
  select * into v_row from public.foods where off_id = p_off_id;
  if found then
    return v_row;
  end if;

  insert into public.foods (
    user_id, source, off_id, name, brand, image_url,
    kcal_100g, protein_100g, carbs_100g, fat_100g,
    fiber_100g, sugar_100g, salt_100g, serving_size_g, serving_label
  )
  values (
    null, 'off', p_off_id, left(btrim(p_name), 200), left(p_brand, 200), p_image_url,
    greatest(coalesce(p_kcal_100g, 0), 0),
    greatest(coalesce(p_protein_100g, 0), 0),
    greatest(coalesce(p_carbs_100g, 0), 0),
    greatest(coalesce(p_fat_100g, 0), 0),
    -- Wartości opcjonalne zostają NULL-em, gdy ich nie ma; ujemne odrzucamy,
    -- bo `greatest(null, 0)` w Postgresie daje 0 i zrobiłby z braku danych zero.
    case when p_fiber_100g >= 0 then p_fiber_100g end,
    case when p_sugar_100g >= 0 then p_sugar_100g end,
    case when p_salt_100g  >= 0 then p_salt_100g  end,
    case when p_serving_size_g > 0 then p_serving_size_g end,
    left(p_serving_label, 60)
  )
  -- Dwie osoby mogą zeskanować ten sam kod w tej samej sekundzie.
  on conflict (off_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.foods where off_id = p_off_id;
  end if;

  return v_row;
end;
$$;

comment on function public.cache_off_product is
  'Dopisuje produkt z Open Food Facts do wspólnego cache''u. Istniejącego wiersza '
  'NIE zmienia — wspólne dane są tylko do dopisywania, żeby jedna osoba nie mogła '
  'popsuć liczenia kalorii wszystkim pozostałym.';

grant execute on function public.cache_off_product(
  text, text, text, text, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text
) to authenticated;

-- ------------------------------------------------------------
-- Polityki: wiersze wspólne wypadają z zapisu bezpośredniego
-- ------------------------------------------------------------

-- Wstawiać wolno już tylko własne produkty. Wspólne wchodzą funkcją wyżej,
-- która działa z uprawnieniami właściciela i omija tę politykę.
drop policy if exists foods_insert on public.foods;
create policy foods_insert on public.foods
  for insert to authenticated
  with check (user_id = auth.uid() and source = 'custom');

-- Zmieniać wolno wyłącznie swoje. To jest sedno tej migracji.
drop policy if exists foods_update on public.foods;
create policy foods_update on public.foods
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and source = 'custom');

comment on policy foods_update on public.foods is
  'Tylko własne produkty. Wiersze wspólne (user_id IS NULL) są nietykalne — '
  'wcześniej mógł je nadpisać każdy zalogowany.';

-- Odczyt i kasowanie zostają bez zmian: każdy czyta wspólne, kasuje tylko swoje.
