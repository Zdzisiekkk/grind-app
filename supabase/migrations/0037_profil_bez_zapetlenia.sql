-- ============================================================
-- Grind — Migracja 0037: naprawa zapętlenia polityki na profiles
--
-- Regresja wprowadzona przez migrację 0034 i złapana przez testy na produkcji.
--
-- CO SIĘ STAŁO
-- Polityka `profiles_update_own` pilnuje, żeby nikt nie awansował się sam na
-- admina, porównując zapisywaną rolę z rolą zapisaną w bazie:
--
--     with check (id = auth.uid()
--                 and role = (select p.role from public.profiles p
--                              where p.id = auth.uid()))
--
-- Podzapytanie czyta `profiles` z wnętrza polityki NA `profiles`. Dopóki całość
-- była zwykłym wyrażeniem, Postgres radził sobie z tym bez problemu. Po
-- przepisaniu na `(select auth.uid())` planista zaczął traktować to jako
-- InitPlan i wpadał w rekurencję:
--
--     42P17: infinite recursion detected in policy for relation "profiles"
--
-- Skutek był dotkliwy i cichy: każdy zapis do profilu kończył się błędem 500,
-- więc NOWE KONTO nie mogło domknąć kreatora i wpadało w pętlę na /start.
-- Reszta aplikacji działała normalnie, więc po samych ekranach nie było tego
-- widać — zobaczyły to dopiero testy na produkcji.
--
-- ROZWIĄZANIE
-- Rola czytana jest funkcją SECURITY DEFINER, która omija RLS. Polityka na
-- `profiles` przestaje pytać o `profiles`, więc nie ma czego zapętlać —
-- a przy okazji zostaje InitPlanem, czyli liczy się raz na zapytanie.
--
-- Zabezpieczenie przed samodzielnym awansem na admina działa dokładnie tak
-- samo jak wcześniej.
-- ============================================================

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

comment on function public.my_role is
  'Rola zalogowanego użytkownika, czytana z pominięciem RLS. Istnieje po to, '
  'żeby polityka na profiles nie musiała pytać o profiles.';

grant execute on function public.my_role() to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select public.my_role()));

comment on policy profiles_update_own on public.profiles is
  'Własny profil, ale bez zmiany roli — nikt nie awansuje się sam na admina.';
