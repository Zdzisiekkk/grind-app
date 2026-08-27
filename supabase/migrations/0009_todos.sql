-- ============================================================
-- Grind — Migracja 0009: listy zadań
--
-- Zadanie to rzecz do zrobienia raz („kupić opaskę na nadgarstek"),
-- w odróżnieniu od nawyku, który wraca każdego dnia. Listy służą do
-- grupowania: sprzęt, rehabilitacja, sprawy klubowe.
-- ============================================================

create table if not exists public.todo_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  name        text not null,
  icon        text not null default '📝',
  order_index integer not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists todo_lists_user_idx
  on public.todo_lists (user_id, is_archived, order_index);

drop trigger if exists todo_lists_set_updated_at on public.todo_lists;
create trigger todo_lists_set_updated_at
  before update on public.todo_lists
  for each row execute function public.set_updated_at();

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Bez listy = skrzynka „Bez listy”, żeby dało się dopisać coś w biegu.
  list_id     uuid references public.todo_lists (id) on delete set null,

  title       text not null,
  note        text,
  due_date    date,
  priority    smallint not null default 0 check (priority between 0 and 2),

  done_at     timestamptz,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists todos_user_idx
  on public.todos (user_id, done_at, order_index);
create index if not exists todos_list_idx
  on public.todos (list_id, done_at, order_index);
create index if not exists todos_due_idx
  on public.todos (user_id, due_date) where done_at is null;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.todo_lists enable row level security;
alter table public.todos      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['todo_lists', 'todos']
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

-- Zadanie musi trafić na własną listę.
create or replace function public.todo_list_owner(p_list_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.todo_lists where id = p_list_id;
$$;

drop policy if exists todos_list_owner on public.todos;
create policy todos_list_owner on public.todos
  as restrictive for all to authenticated
  using (list_id is null or public.todo_list_owner(list_id) = auth.uid())
  with check (list_id is null or public.todo_list_owner(list_id) = auth.uid());

grant select, insert, update, delete on public.todo_lists, public.todos to authenticated;
grant execute on function public.todo_list_owner(uuid) to authenticated;
