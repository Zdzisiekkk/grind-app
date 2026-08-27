-- ============================================================
-- Grind — Migracja 0016: trener AI
--
-- Trener nigdy nie zmienia niczego sam. Wypracowuje PROPOZYCJĘ, która czeka
-- na tapnięcie użytkownika — dlatego to osobna tabela ze stanem, a nie zapis
-- wprost do profilu czy planu. Odrzucone propozycje zostają w historii,
-- żeby dało się zobaczyć, co model radził i jak to się skończyło.
-- ============================================================

create table if not exists public.coach_proposals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  -- 'diet_kcal'    — zmiana dziennego celu kalorycznego
  -- 'training'     — rada dotycząca treningu, bez automatycznej zmiany
  -- 'note'         — sama obserwacja, nic do zatwierdzania
  kind       text not null check (kind in ('diet_kcal', 'training', 'note')),

  title      text not null,
  /** Dlaczego — pisane przez model na podstawie policzonych faktów. */
  rationale  text not null,
  /** Liczby, na których oparta jest propozycja. Pokazujemy je obok tekstu. */
  facts      jsonb not null default '{}'::jsonb,
  /** Co się stanie po akceptacji, np. {"daily_kcal": 2200}. Puste = nic. */
  action     jsonb not null default '{}'::jsonb,

  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coach_proposals_user_idx
  on public.coach_proposals (user_id, status, created_at desc);

create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_user_idx
  on public.coach_messages (user_id, created_at);

-- ------------------------------------------------------------
-- Licznik wywołań modelu
-- ------------------------------------------------------------
/*
 * Nawet za paywallem potrzebny jest twardy limit dzienny. Jedna osoba
 * klikająca „przeanalizuj" w kółko potrafi wygenerować rachunek za wszystkich
 * pozostałych — a subskrypcja jest stała, więc koszt nie ma się z czego pokryć.
 *
 * Licznik podbija funkcja SECURITY DEFINER, bo użytkownik nie może mieć prawa
 * zapisu ani kasowania własnych wierszy: skasowanie licznika to zerowanie limitu.
 */
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  date    date not null default current_date,
  calls   integer not null default 0,
  primary key (user_id, date)
);

alter table public.coach_proposals enable row level security;
alter table public.coach_messages  enable row level security;
alter table public.ai_usage        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['coach_proposals', 'coach_messages']
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

-- Licznik: wolno zobaczyć swój, nie wolno go tknąć.
drop policy if exists ai_usage_owner_read on public.ai_usage;
create policy ai_usage_owner_read on public.ai_usage
  for select to authenticated using (user_id = auth.uid());

/**
 * Podbija licznik i mówi, czy wolno wykonać kolejne wywołanie.
 * Zwraca false, gdy limit na dziś jest wyczerpany — wtedy nic nie podbija.
 */
create or replace function public.consume_ai_call(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_calls integer;
begin
  if v_user is null then return false; end if;

  insert into public.ai_usage (user_id, date, calls)
  values (v_user, current_date, 1)
  on conflict (user_id, date) do update
    set calls = public.ai_usage.calls + 1
    where public.ai_usage.calls < p_limit
  returning calls into v_calls;

  -- Brak zwróconego wiersza znaczy, że warunek w DO UPDATE odciął zapis,
  -- czyli limit został osiągnięty.
  return v_calls is not null;
end;
$$;

grant select, insert, update, delete on public.coach_proposals, public.coach_messages to authenticated;
grant select on public.ai_usage to authenticated;
grant execute on function public.consume_ai_call(integer) to authenticated;
