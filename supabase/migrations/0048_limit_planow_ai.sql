-- ============================================================
-- 0048: jeden plan treningowy od AI na 45 dni
--
-- Plan to najdłuższe i najdroższe wywołanie w całej aplikacji: Opus 5
-- z myśleniem adaptacyjnym, zmierzone 101 sekund na jeden plan. Do tego
-- wchodzi do miesięcznego budżetu 8 zł.
--
-- Ale prawdziwy powód dla tego limitu nie jest kosztowy, tylko treningowy:
-- plan zmieniany co tydzień przestaje być planem. Progresja siłowa wymaga
-- powtarzania tych samych ruchów przez kilka tygodni - kto co siedem dni
-- układa nowy zestaw ćwiczeń, mierzy wyłącznie swoją niecierpliwość.
-- Półtora miesiąca to mniej więcej długość sensownego bloku treningowego.
--
-- Liczone z samej tabeli zgłoszeń, bez osobnego licznika - licznik obok
-- danych zawsze kiedyś się z nimi rozjeżdża. Pod uwagę biorą się WYŁĄCZNIE
-- zgłoszenia zakończone powodzeniem (status = 'ok'): nieudane wywołanie
-- modelu nie może blokować na półtora miesiąca czegoś, czego się nie dostało.
--
-- Wartość siedzi w app_settings, więc zmiana progu nie wymaga wdrożenia:
--   update public.app_settings
--      set value = jsonb_build_object('odstep_dni', 30)
--    where key = 'plan_ai';
-- ============================================================

insert into public.app_settings (key, value)
values ('plan_ai', jsonb_build_object('odstep_dni', 45))
on conflict (key) do nothing;

/**
 * Stan limitu dla ekranu: kiedy wolno ułożyć następny plan.
 *
 * Ekran ma napisać "następny plan za 12 dni" ZANIM ktoś wypełni formularz.
 * Odmowa po wypełnieniu byłaby marnowaniem czyjegoś czasu.
 */
create or replace function public.plan_ai_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce((value ->> 'odstep_dni')::int, 45) as odstep
      from public.app_settings where key = 'plan_ai'
  ),
  s as (
    select max(created_at) as ostatni
      from public.ai_plan_requests
     where user_id = auth.uid()
       and status = 'ok'
  )
  select jsonb_build_object(
    'odstep_dni',  p.odstep,
    'ostatni_plan', s.ostatni,
    'nastepny_od', case when s.ostatni is null then now()
                        else s.ostatni + make_interval(days => p.odstep) end,
    'mozna',       s.ostatni is null
                     or s.ostatni + make_interval(days => p.odstep) <= now(),
    'powod',       case
                     when s.ostatni is not null
                          and s.ostatni + make_interval(days => p.odstep) > now()
                       then 'odstep'
                     else null
                   end
  )
  from p cross join s;
$$;

/*
 * Ten sam warunek jako reguła zapisu.
 *
 * Sprawdzenie w trasie API jest po to, żeby ładnie odmówić. Sprawdzenie tutaj
 * jest po to, żeby odmowy nie dało się ominąć - ekran to tylko jedna z dróg
 * do bazy, a limit, który da się obejść, nie jest limitem.
 *
 * SECURITY DEFINER omija RLS, więc funkcja czytająca ai_plan_requests
 * z wnętrza polityki NA ai_plan_requests się nie zapętla (pułapka 42P17
 * z migracji 0037).
 */
create or replace function public.plan_ai_moze_generowac()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.plan_ai_limit() ->> 'mozna')::boolean, false);
$$;

drop policy if exists ai_plan_requests_limit on public.ai_plan_requests;
create policy ai_plan_requests_limit on public.ai_plan_requests
  as restrictive for insert to authenticated
  with check ((select public.plan_ai_moze_generowac()));

revoke all on function public.plan_ai_limit(), public.plan_ai_moze_generowac()
  from public, anon;
grant execute on function public.plan_ai_limit(), public.plan_ai_moze_generowac()
  to authenticated;

comment on function public.plan_ai_limit is
  'Kiedy wolno ułożyć następny plan od AI. Odstęp z app_settings.plan_ai, '
  'liczony od ostatniego zgłoszenia ze statusem ok.';

-- ------------------------------------------------------------
-- Sprawdzenie: czy migracja zrobiła to, co obiecuje
-- ------------------------------------------------------------

do $$
declare
  v_odstep   int;
  v_polityka int;
  v_anon     int;
begin
  select (value ->> 'odstep_dni')::int into v_odstep
    from public.app_settings where key = 'plan_ai';

  if coalesce(v_odstep, 0) <> 45 then
    raise exception 'Migracja 0048: brak ustawienia odstępu (jest: %)', v_odstep;
  end if;

  select count(*) into v_polityka
    from pg_policies
   where schemaname = 'public'
     and tablename = 'ai_plan_requests'
     and policyname = 'ai_plan_requests_limit';

  if v_polityka <> 1 then
    raise exception 'Migracja 0048: polityka limitu nie powstała';
  end if;

  -- Ta sama pułapka, co w 0045: nowa funkcja rodzi się z prawem wykonania
  -- dla PUBLIC, a w Supabase anon należy do PUBLIC.
  select count(*) into v_anon
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('plan_ai_limit', 'plan_ai_moze_generowac')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('public', p.oid, 'execute'));

  if v_anon > 0 then
    raise exception 'Migracja 0048: % funkcji nadal odpowiada niezalogowanym', v_anon;
  end if;
end $$;
