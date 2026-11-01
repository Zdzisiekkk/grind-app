-- ============================================================
-- Grind - Migracja 0081: partner_tydzien
--
-- 14 dni wstecz dla mnie i dla partnera, po jednym wierszu na osobę i dzień.
-- Z tego ekran Partner liczy serię "razem", tydzień na kropkach i
-- tygodniowy pojedynek.
--
-- Oddajemy tylko to, co i tak widać w partner_dzien(): czy był posiłek,
-- trening, ile nawyków i skin care odhaczone. Bez nazw, kalorii i zdjęć.
-- Funkcja nie przyjmuje identyfikatora użytkownika: ja to auth.uid(),
-- partner to wiersz z partner_pary.
-- ============================================================

create or replace function public.partner_tydzien(p_do date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ja uuid := auth.uid();
  v_p  uuid := (select pp.partner_id from public.partner_pary pp where pp.user_id = auth.uid());
  v_do date := least(greatest(p_do, current_date - 30), current_date + 1);
begin
  if v_ja is null or v_p is null then
    return null;
  end if;

  return (
    with dni as (
      select (v_do - n)::date as d from generate_series(0, 13) n
    ),
    osoby as (
      select v_ja as u, 'ja'::text as kto
      union all
      select v_p, 'on'
    ),
    wynik as (
      select
        o.kto,
        dni.d,
        exists (
          select 1 from public.meals m
            join public.meal_entries e on e.meal_id = m.id
           where m.user_id = o.u and m.date = dni.d
        ) as jedzenie,
        exists (
          select 1 from public.workout_sessions s
           where s.user_id = o.u and s.date = dni.d
             and (s.finished_at is not null
                  or exists (select 1 from public.workout_logs l
                              where l.session_id = s.id and not l.is_warmup))
        ) as trening,
        (select count(*) from public.habits h
          where h.user_id = o.u and not h.is_archived
            and (cardinality(h.days_of_week) = 0
                 or extract(isodow from dni.d)::smallint = any(h.days_of_week))) as nawyki_n,
        (select count(*) from public.habits h
          where h.user_id = o.u and not h.is_archived
            and (cardinality(h.days_of_week) = 0
                 or extract(isodow from dni.d)::smallint = any(h.days_of_week))
            and coalesce((select l.count from public.habit_logs l
                           where l.habit_id = h.id and l.date = dni.d), 0) >= h.target_per_day) as nawyki_ok,
        (select count(*) from public.wyglad_rutyny r
          where r.user_id = o.u and r.aktywna) as skin_n,
        (select count(*) from public.wyglad_rutyny r
          where r.user_id = o.u and r.aktywna
            and exists (select 1 from public.wyglad_rutyna_log l
                         where l.rutyna_id = r.id and l.data = dni.d and l.wykonano)) as skin_ok
      from osoby o
      cross join dni
    )
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'kto', w.kto, 'data', w.d,
               'jedzenie', w.jedzenie, 'trening', w.trening,
               'nawyki_n', w.nawyki_n, 'nawyki_ok', w.nawyki_ok,
               'skin_n', w.skin_n, 'skin_ok', w.skin_ok)
             order by w.d, w.kto), '[]'::jsonb)
      from wynik w
  );
end;
$$;

revoke all on function public.partner_tydzien(date) from public, anon;
grant execute on function public.partner_tydzien(date) to authenticated;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'partner_tydzien') then
    raise exception 'Migracja 0081: brak partner_tydzien';
  end if;
  if has_function_privilege('anon', 'public.partner_tydzien(date)', 'EXECUTE') then
    raise exception 'Migracja 0081: anon nie może wołać partner_tydzien';
  end if;
  if not has_function_privilege('authenticated', 'public.partner_tydzien(date)', 'EXECUTE') then
    raise exception 'Migracja 0081: authenticated musi móc wołać partner_tydzien';
  end if;
end $$;
