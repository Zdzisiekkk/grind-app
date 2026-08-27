-- ============================================================
-- Grind — Migracja 0017: strażnik RLS
--
-- W Supabase uprawnienia tabelowe są z definicji szerokie: role `anon`
-- i `authenticated` dostają SELECT/INSERT/UPDATE/DELETE na każdą nową tabelę
-- w schemacie public. Całą ochronę niesie Row Level Security.
--
-- Znaczy to, że tabela dodana kiedyś w pośpiechu BEZ `enable row level
-- security` jest otwarta dla każdego, kto zna adres projektu — łącznie
-- z niezalogowanymi. To najgroźniejszy pojedynczy błąd, jaki można tu
-- popełnić, i nie widać go po niczym w aplikacji.
--
-- Ta funkcja pozwala testowi na produkcji sprawdzić to przy każdym
-- uruchomieniu, zamiast polegać na tym, że ktoś pamiętał.
-- ============================================================

create or replace function public.tables_without_rls()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;
$$;

comment on function public.tables_without_rls() is
  'Nazwy tabel w public bez RLS. Pusta tablica to jedyny poprawny wynik — '
  'wszystko inne oznacza tabelę otwartą dla niezalogowanych.';

grant execute on function public.tables_without_rls() to authenticated;
