-- ============================================================
-- Grind — Migracja 0033: trener pamięta, co radził
--
-- Problem znaleziony w przeglądzie kodu.
--
-- Przy każdej nowej analizie aplikacja KASOWAŁA wcześniejsze propozycje ze
-- statusem 'pending'. Powód był sensowny — stara propozycja patrzy na starsze
-- dane i mylenie ich obok siebie nikomu nie pomaga. Skutkiem ubocznym było to,
-- że nie zostawał żaden ślad.
--
-- A to właśnie ślad jest tu najcenniejszy: „miesiąc temu trener kazał zejść
-- o 200 kcal, zrobiłeś to, waga ruszyła” to jedyna rzecz, której trener nie
-- umiał powiedzieć o samym sobie, choć ma na to wszystkie dane.
--
-- Zamiast kasować — oznaczamy jako nieaktualne.
-- ============================================================

alter table public.coach_proposals
  drop constraint if exists coach_proposals_status_check;

alter table public.coach_proposals
  add constraint coach_proposals_status_check
  check (status in ('pending', 'accepted', 'rejected', 'superseded'));

comment on column public.coach_proposals.status is
  'pending — czeka na decyzję; accepted / rejected — decyzja podjęta; '
  'superseded — zastąpiona nowszą analizą, zostaje w historii.';

alter table public.coach_proposals
  add column if not exists superseded_at timestamptz;

/**
 * Odłożenie starych propozycji przed zapisaniem nowych.
 *
 * Zwraca liczbę odłożonych, żeby aplikacja mogła powiedzieć wprost, ile rad
 * przestało być aktualnych.
 */
create or replace function public.supersede_coach_proposals()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.coach_proposals
     set status = 'superseded', superseded_at = now()
   where user_id = auth.uid()
     and status = 'pending';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.supersede_coach_proposals() to authenticated;

-- Historia czytana jest po dacie, niezależnie od statusu.
create index if not exists coach_proposals_history_idx
  on public.coach_proposals (user_id, created_at desc);
