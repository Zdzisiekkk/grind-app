-- ============================================================
-- Grind — Migracja 0028: ISBN i okładka przy książce
--
-- ISBN zapisujemy, żeby dało się później dociągnąć brakujące dane i żeby
-- ta sama książka nie wjechała na półkę dwa razy pod dwoma zapisami tytułu.
-- Okładka to sam adres, nie plik: obrazek stoi u Open Library, a my nie
-- bierzemy na siebie hostowania cudzych skanów.
-- ============================================================

alter table public.books add column if not exists isbn text;
alter table public.books add column if not exists cover_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_isbn_format'
  ) then
    alter table public.books
      add constraint books_isbn_format
      check (isbn is null or isbn ~ '^97[89][0-9]{10}$');
  end if;
end
$$;

/**
 * Jedna książka na półce raz.
 *
 * Indeks częściowy, bo książki wpisane ręcznie nie mają ISBN-u, a NULL-e
 * nigdy się ze sobą nie zderzają — więc ograniczenie dotyczy wyłącznie tych
 * dodanych skanem.
 */
create unique index if not exists books_user_isbn_uidx
  on public.books (user_id, isbn) where isbn is not null;
