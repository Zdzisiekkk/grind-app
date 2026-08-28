-- ============================================================
-- Grind — Migracja 0038: trzy funkcje bez przypiętej ścieżki
--
-- Ostatnie trzy zgłoszenia audytora bezpieczeństwa Supabase.
--
-- Funkcja bez `set search_path` rozstrzyga nazwy tabel według ścieżki
-- WYWOŁUJĄCEGO. Ktoś, kto może założyć schemat i ustawić sobie search_path,
-- podstawia własną tabelę pod nazwę, której funkcja używa — i funkcja
-- wykonuje jego kod zamiast naszego. `set_updated_at` jest wyzwalaczem
-- działającym na każdej tabeli z updated_at, więc akurat ta pilnuje
-- najwięcej ruchu.
--
-- Reszta funkcji w projekcie miała to od początku; te trzy zostały pominięte.
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sleep_factor_keys()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'alkohol', 'kofeina', 'ekran', 'pozny_posilek', 'trening_wieczor',
    'stres', 'choroba', 'halas', 'upal', 'podroz', 'drzemka',
    'melatonina', 'magnez', 'ciemno', 'chlodno'
  ]::text[];
$$;

create or replace function private.set_config_value(p_key text, p_value text)
returns void
language sql
set search_path = private
as $$
  insert into private.config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
$$;

-- ------------------------------------------------------------
-- Sprawdzenie na miejscu
-- ------------------------------------------------------------
do $$
declare v_left text[];
begin
  select coalesce(array_agg(n.nspname || '.' || p.proname), '{}') into v_left
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and p.prokind = 'f'
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
     );

  if array_length(v_left, 1) > 0 then
    raise exception 'Funkcje bez przypiętej ścieżki: %', v_left;
  end if;
end;
$$;
