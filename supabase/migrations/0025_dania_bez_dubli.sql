-- ============================================================
-- Grind — Migracja 0025: sprzątanie po zdublowanych daniach
--
-- Migracja 0023 kończyła wstawianie klauzulą „on conflict do nothing", która
-- nic nie robiła: w tabeli foods nie ma ograniczenia unikalności na nazwę,
-- więc konflikt nigdy nie zachodził. Każde kolejne uruchomienie migracji
-- dokładało komplet 52 dań od nowa.
--
-- Wyszło to dopiero w teście na produkcji, który policzył dania i zobaczył
-- 104 zamiast 52. Sam kod aplikacji nie miałby jak tego pokazać — lista
-- z duplikatami wygląda jak lista.
-- ============================================================

-- Zostaje najstarszy wiersz każdej nazwy; nowsze kopie znikają.
delete from public.foods f
 where f.source = 'curated'
   and f.kind = 'dish'
   and exists (
     select 1 from public.foods g
      where g.source = 'curated'
        and g.kind = 'dish'
        and lower(g.name) = lower(f.name)
        and (g.created_at, g.id) < (f.created_at, f.id)
   );

/*
 * Zapora na przyszłość. Indeks jest częściowy, bo dotyczy wyłącznie listy
 * kuratorowanej — produkty użytkowników mogą się nazywać tak samo i to jest
 * w porządku. Nie używamy go w ON CONFLICT (tam częściowy indeks nie działa),
 * tylko jako twardej blokady przed powtórnym wstawieniem.
 */
create unique index if not exists foods_curated_name_uidx
  on public.foods (lower(name))
  where source = 'curated';
