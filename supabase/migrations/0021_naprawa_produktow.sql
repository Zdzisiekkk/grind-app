-- ============================================================
-- Grind — Migracja 0021: zapis produktu z Open Food Facts
--
-- Błąd: „there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" przy dodawaniu produktu do posiłku.
--
-- Przyczyna: indeks na off_id był CZĘŚCIOWY (where source = 'off'). Postgres
-- potrafi go użyć przy ON CONFLICT tylko wtedy, gdy zapytanie powtórzy ten sam
-- warunek WHERE — a PostgREST nie ma jak takiego warunku wyrazić. Efekt:
-- każde dodanie produktu z OFF do posiłku kończyło się błędem.
--
-- Rozwiązanie: zwykły indeks unikalny na off_id. Semantyka zostaje ta sama,
-- bo produkty własne mają off_id NULL, a NULL-e w indeksie unikalnym nigdy nie
-- kolidują ze sobą — może ich być dowolnie wiele.
-- ============================================================

drop index if exists public.foods_off_uidx;

create unique index if not exists foods_off_uidx on public.foods (off_id);

comment on index public.foods_off_uidx is
  'Jeden wiersz na kod z Open Food Facts. Produkty własne mają off_id NULL, '
  'a NULL-e nie kolidują — dlatego indeks może być zwykły, nie częściowy, '
  'i dzięki temu ON CONFLICT (off_id) w ogóle działa.';
