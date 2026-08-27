-- ============================================================
-- Grind — Migracja 0022: czytanie
--
-- Czytanie jest nawykiem, ale nie takim, który da się odhaczyć ptaszkiem:
-- ma tytuł, postęp w stronach, cytaty i ocenę na koniec. Dlatego mieszka
-- w zakładce nawyków, ale ma własne tabele — wciskanie tego w habit_logs
-- kończyłoby się notatką w polu „count".
-- ============================================================

create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  title        text not null,
  author       text,

  -- 'want'      — chcę przeczytać
  -- 'reading'   — w trakcie
  -- 'read'      — przeczytana
  -- 'abandoned' — porzucona (uczciwy stan, nie porażka)
  status       text not null default 'reading'
               check (status in ('want', 'reading', 'read', 'abandoned')),

  pages        integer check (pages is null or pages between 1 and 10000),
  current_page integer not null default 0 check (current_page >= 0),

  rating       smallint check (rating is null or rating between 1 and 5),
  /** Wrażenia po lekturze — jedno pole, bo notatki w trakcie mają własną tabelę. */
  summary      text,

  started_at   date,
  finished_at  date,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint books_page_within_total
    check (pages is null or current_page <= pages)
);

create index if not exists books_user_idx
  on public.books (user_id, status, updated_at desc);

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

/**
 * Notatki i cytaty w trakcie czytania.
 *
 * Osobna tabela, a nie jedno wielkie pole tekstowe w książce: notatka ma
 * stronę, datę i da się jej szukać. Zlepek w jednym polu po roku jest
 * bezużyteczny.
 */
create table if not exists public.book_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,

  page       integer check (page is null or page >= 0),
  /** Cytat z książki — trzymany oddzielnie od własnego komentarza. */
  quote      text,
  note       text,

  created_at timestamptz not null default now(),

  constraint book_notes_not_empty
    check (coalesce(quote, '') <> '' or coalesce(note, '') <> '')
);

create index if not exists book_notes_book_idx
  on public.book_notes (book_id, page, created_at);

-- ------------------------------------------------------------
-- Sesje czytania — do passy i statystyk
-- ------------------------------------------------------------
/**
 * Jeden wiersz na dzień i książkę. Dzięki temu „czytałem 12 dni z rzędu"
 * liczy się tak samo jak passa nawyków, bez dublowania logiki.
 */
create table if not exists public.reading_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  book_id    uuid references public.books (id) on delete set null,

  date       date not null default current_date,
  minutes    integer check (minutes is null or minutes between 1 and 1440),
  pages_read integer not null default 0 check (pages_read >= 0),

  created_at timestamptz not null default now(),

  unique (user_id, book_id, date)
);

create index if not exists reading_logs_user_date_idx
  on public.reading_logs (user_id, date desc);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.books        enable row level security;
alter table public.book_notes   enable row level security;
alter table public.reading_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books', 'book_notes', 'reading_logs']
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

-- Notatka i sesja muszą wskazywać na własną książkę.
create or replace function public.book_owner(p_book_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.books where id = p_book_id;
$$;

drop policy if exists book_notes_book_owner on public.book_notes;
create policy book_notes_book_owner on public.book_notes
  as restrictive for all to authenticated
  using (public.book_owner(book_id) = auth.uid())
  with check (public.book_owner(book_id) = auth.uid());

drop policy if exists reading_logs_book_owner on public.reading_logs;
create policy reading_logs_book_owner on public.reading_logs
  as restrictive for all to authenticated
  using (book_id is null or public.book_owner(book_id) = auth.uid())
  with check (book_id is null or public.book_owner(book_id) = auth.uid());

grant select, insert, update, delete
  on public.books, public.book_notes, public.reading_logs to authenticated;
grant execute on function public.book_owner(uuid) to authenticated;
