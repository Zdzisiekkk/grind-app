-- ============================================================
-- Grind — Migracja 0042: administrator bez limitu skanów
--
-- Limity z 0039 (odstęp 7 dni, 5 skanów miesięcznie) mają dwa zadania:
-- pilnować rachunku i chronić przed codziennym ocenianiem się. Oba dotyczą
-- ludzi korzystających z aplikacji, a nie osoby, która ją buduje i musi móc
-- sprawdzić zmianę w skanerze pięć razy pod rząd.
--
-- Zwolnienie idzie przez `is_admin()`, czyli tę samą funkcję, która decyduje
-- o reszcie uprawnień administratora — nie przez osobną listę adresów.
--
-- `wyglad_limit()` nadal zwraca prawdziwe liczby (ile skanów w tym miesiącu,
-- kiedy minie odstęp), tylko `mozna` jest zawsze prawdziwe. Dzięki temu ekran
-- może uczciwie napisać „bez limitu", zamiast udawać, że licznik nie istnieje.
-- ============================================================

create or replace function public.wyglad_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce((value ->> 'odstep_dni')::int, 7)     as odstep,
           coalesce((value ->> 'limit_miesiaca')::int, 5) as limit_mies
      from public.app_settings where key = 'wyglad'
  ),
  s as (
    select max(utworzono) as ostatni,
           count(*) filter (where utworzono >= date_trunc('month', now())) as w_miesiacu
      from public.wyglad_skany
     where user_id = auth.uid()
  ),
  a as (select public.is_admin() as admin)
  select jsonb_build_object(
    'odstep_dni',     p.odstep,
    'limit_miesiaca', p.limit_mies,
    'w_miesiacu',     coalesce(s.w_miesiacu, 0),
    'ostatni_skan',   s.ostatni,
    'bez_limitu',     a.admin,
    'nastepny_od',    case when a.admin or s.ostatni is null then now()
                           else s.ostatni + make_interval(days => p.odstep) end,
    'mozna',          a.admin
                        or (coalesce(s.w_miesiacu, 0) < p.limit_mies
                            and (s.ostatni is null
                                 or s.ostatni + make_interval(days => p.odstep) <= now())),
    'powod',          case
                        when a.admin then null
                        when coalesce(s.w_miesiacu, 0) >= p.limit_mies then 'limit_miesiaca'
                        when s.ostatni is not null
                             and s.ostatni + make_interval(days => p.odstep) > now() then 'odstep'
                        else null
                      end
  )
  from p cross join s cross join a;
$$;

revoke all on function public.wyglad_limit() from public, anon;
grant execute on function public.wyglad_limit() to authenticated;

-- `wyglad_moze_skanowac()` czyta z `wyglad_limit()`, więc reguła zapisu
-- (`wyglad_skany_limit`) przepuszcza administratora bez żadnej zmiany.

do $$
begin
  if (public.wyglad_limit() ->> 'mozna') is null then
    raise exception 'wyglad_limit() nie zwraca pola mozna';
  end if;
end;
$$;
