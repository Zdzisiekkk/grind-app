-- ============================================================
-- Grind — Migracja 0030: zbiorcze potwierdzanie wysyłki
--
-- Dotąd każde powiadomienie ciągnęło za sobą osobne zapytanie do bazy
-- (`push_ok` albo `push_failed`), czyli drugie tyle ruchu, co sama wysyłka.
-- Przy garstce ludzi to nic. Przy tysiącu subskrypcji o pełnej godzinie to
-- dwa tysiące zapytań w funkcji, która ma na wszystko 60 sekund — i wtedy
-- nie dochodzi ŻADNE powiadomienie, a nie tylko te nadmiarowe.
--
-- Wersje mnogie przyjmują całą listę naraz. Pojedyncze zostają, bo nic nie
-- kosztują i przydają się przy testowej wysyłce do jednego urządzenia.
-- ============================================================

create or replace function private.push_ok_many(p_secret text, p_endpoints text[])
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
  v_count  integer;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then return 0; end if;

  update public.push_subscriptions
     set failures = 0, last_ok_at = now()
   where endpoint = any(p_endpoints);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.push_failed_many(
  p_secret text, p_endpoints text[], p_gone boolean
)
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_secret text;
  v_count  integer;
begin
  select value into v_secret from private.config where key = 'push_cron_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then return 0; end if;

  if p_gone then
    -- 404/410 od dostawcy znaczy, że subskrypcja nie istnieje. Trzymanie jej
    -- to wysyłanie w próżnię przy każdym uruchomieniu.
    delete from public.push_subscriptions where endpoint = any(p_endpoints);
  else
    update public.push_subscriptions
       set failures = failures + 1
     where endpoint = any(p_endpoints);
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Elewacja do schematu public (PostgREST widzi tylko public)
-- ------------------------------------------------------------
create or replace function public.push_ok_many(p_secret text, p_endpoints text[])
returns integer
language sql
security definer
set search_path = public, private
as $$ select private.push_ok_many(p_secret, p_endpoints); $$;

create or replace function public.push_failed_many(
  p_secret text, p_endpoints text[], p_gone boolean
)
returns integer
language sql
security definer
set search_path = public, private
as $$ select private.push_failed_many(p_secret, p_endpoints, p_gone); $$;

-- Bez sekretu funkcje i tak nic nie robią, więc grant nie jest tu ochroną.
grant execute on function public.push_ok_many(text, text[]) to anon, authenticated;
grant execute on function public.push_failed_many(text, text[], boolean) to anon, authenticated;
