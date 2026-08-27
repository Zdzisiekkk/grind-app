-- ============================================================
-- Grind — Migracja 0027: nałogi (walka ze złymi nawykami)
--
-- Nałóg to odwrócony nawyk: sukcesem jest dzień, w którym NIC nie zrobiłeś.
-- Dlatego nie da się go wcisnąć w habits/habit_logs — tam brak wiersza
-- znaczy „nie odhaczyłem", a tutaj brak wiersza znaczy „udało się".
-- Ta sama tabela dla obu rzeczy dawałaby passy liczone w drugą stronę
-- i wykresy, na których pusto = źle i pusto = dobrze naraz.
--
-- Zapisujemy dwa rodzaje zdarzeń:
--   'lapse' — wpadka, zeruje licznik czystych dni,
--   'urge'  — chęć, która minęła; licznika nie rusza.
-- Drugie jest ważniejsze, niż wygląda: bez niego historia nałogu to sama
-- lista porażek, a odmowa jest tym, co faktycznie się ćwiczy.
-- ============================================================

create table if not exists public.vices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  name          text not null,
  icon          text not null default '🚭',

  /** Moment rzucenia — punkt zero licznika, dopóki nie ma żadnej wpadki. */
  started_at    timestamptz not null default now(),

  /** Ile ten nałóg kosztował dziennie — z tego liczą się oszczędności. */
  daily_cost    numeric(8, 2) check (daily_cost is null or daily_cost >= 0),
  /** Ile minut dziennie zabierał — z tego liczy się odzyskany czas. */
  daily_minutes integer check (daily_minutes is null or daily_minutes between 0 and 1440),

  /** Po co rzucam — czytane w momencie, w którym najbardziej się chce. */
  motivation    text,

  is_archived   boolean not null default false,
  order_index   integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint vices_name_not_empty check (length(btrim(name)) > 0)
);

create index if not exists vices_user_idx
  on public.vices (user_id, is_archived, order_index);

drop trigger if exists vices_set_updated_at on public.vices;
create trigger vices_set_updated_at
  before update on public.vices
  for each row execute function public.set_updated_at();

/**
 * Zdarzenia: wpadki i pokonane chęci.
 *
 * occurred_at jest osobno od created_at, bo wpadkę dopisuje się zwykle
 * później niż się wydarzyła — a licznik ma iść od zdarzenia, nie od
 * momentu, w którym starczyło odwagi to zapisać.
 */
create table if not exists public.vice_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  vice_id     uuid not null references public.vices (id) on delete cascade,

  kind        text not null check (kind in ('lapse', 'urge')),
  occurred_at timestamptz not null default now(),

  /** Co to wywołało — stres, alkohol, nuda. Powtarzalny wzorzec widać dopiero w kilku. */
  trigger     text,
  note        text,

  created_at  timestamptz not null default now()
);

create index if not exists vice_events_vice_idx
  on public.vice_events (vice_id, occurred_at desc);
create index if not exists vice_events_user_idx
  on public.vice_events (user_id, occurred_at desc);

-- ------------------------------------------------------------
-- RLS
--
-- Supabase nadaje anon/authenticated pełne prawa na każdej nowej tabeli
-- w public, więc RLS jest tu jedyną zaporą — nie „drugą warstwą".
-- ------------------------------------------------------------
alter table public.vices       enable row level security;
alter table public.vice_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vices', 'vice_events']
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

/** Zdarzenie musi wskazywać na własny nałóg — inaczej dałoby się zerować cudzy licznik. */
create or replace function public.vice_owner(p_vice_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.vices where id = p_vice_id;
$$;

drop policy if exists vice_events_vice_owner on public.vice_events;
create policy vice_events_vice_owner on public.vice_events
  as restrictive for all to authenticated
  using (public.vice_owner(vice_id) = auth.uid())
  with check (public.vice_owner(vice_id) = auth.uid());

grant select, insert, update, delete on public.vices, public.vice_events to authenticated;
grant execute on function public.vice_owner(uuid) to authenticated;
