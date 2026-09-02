-- ============================================================
-- Grind — Migracja 0054: dzienny limit na proxy do zewnętrznych API
--
-- Audyt bezpieczeństwa (2026-09-02) zauważył, że trzy trasy wymagające
-- tylko zalogowania - `/api/food/search`, `/api/food/kod`,
-- `/api/ksiazki/isbn` - nie mają żadnego licznika dziennego. Jedno
-- zautomatyzowane konto mogłoby wyczerpać wspólny klucz Google Books,
-- obciążyć Open Food Facts/Open Library ryzykiem zbanowania domeny albo
-- wygenerować zbędny koszt funkcji Vercela. To nie są funkcje AI i nie mają
-- nic wspólnego z budżetem 8 zł - dlatego osobna tabela, nie `ai_licznik`
-- z migracji 0046: nazwa `ai_licznik` mówiłaby nieprawdę o tym, co liczy.
--
-- Wzorzec skopiowany 1:1 z `ai_licznik_zuzyj` (0046): licznik rośnie zawsze,
-- także administratorowi, zwolniona jest sama bramka - inaczej rachunek nie
-- zgadzałby się z rzeczywistością (patrz §8 PRZEKAZANIE.md).
-- ============================================================

create table if not exists public.zewn_licznik (
  user_id   uuid not null references auth.users (id) on delete cascade,
  data      date not null default current_date,
  kategoria text not null,
  wywolan   integer not null default 0,
  primary key (user_id, data, kategoria)
);

alter table public.zewn_licznik enable row level security;
revoke all on table public.zewn_licznik from anon, authenticated, public;

/**
 * Zużycie jednego wywołania w kategorii. Zwraca false, gdy limit wyczerpany.
 * Kategorie: 'food_search', 'food_kod', 'isbn'.
 */
create or replace function public.zewn_licznik_zuzyj(p_kategoria text, p_limit integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n    integer;
begin
  if v_user is null then return false; end if;

  insert into public.zewn_licznik (user_id, data, kategoria, wywolan)
  values (v_user, current_date, p_kategoria, 1)
  on conflict (user_id, data, kategoria) do update
    set wywolan = public.zewn_licznik.wywolan + 1
  returning wywolan into v_n;

  return public.is_admin() or v_n <= greatest(p_limit, 0);
end;
$$;

revoke all on function public.zewn_licznik_zuzyj(text, integer) from public, anon;
grant execute on function public.zewn_licznik_zuzyj(text, integer) to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
begin
  if has_table_privilege('authenticated', 'public.zewn_licznik', 'SELECT')
     or has_table_privilege('authenticated', 'public.zewn_licznik', 'UPDATE')
     or has_table_privilege('authenticated', 'public.zewn_licznik', 'DELETE')
     or has_table_privilege('anon', 'public.zewn_licznik', 'SELECT') then
    raise exception 'Migracja 0054: zewn_licznik nie może mieć uprawnień dla użytkownika';
  end if;

  if has_function_privilege('anon', 'public.zewn_licznik_zuzyj(text, integer)', 'EXECUTE') then
    raise exception 'Migracja 0054: licznik proxy jest wywoływalny bez logowania';
  end if;

  -- Wywołanie poza kontekstem żądania (bez auth.uid()) ma zwrócić false,
  -- a nie wywalić wyjątek - dokładnie tak samo jak ai_licznik_zuzyj w 0046.
  if public.zewn_licznik_zuzyj('test_0054', 10) is distinct from false then
    raise exception 'Migracja 0054: zuzyj bez zalogowania powinno zwrócić false';
  end if;
end $$;
