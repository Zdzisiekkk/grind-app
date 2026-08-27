-- ============================================================
-- Grind — Migracja 0020: wejście dla wysyłacza powiadomień
--
-- Schemat `private` nie jest wystawiany przez PostgREST, więc trasa
-- /api/push/send nie ma jak zawołać tamtych funkcji. Wystawiamy cienkie
-- opakowania w `public`, chronione tym samym sekretem.
--
-- Bez sekretu funkcje zwracają pustkę i nic nie robią, więc nadanie prawa
-- wykonania każdemu jest bezpieczne. Gdyby sekret wyciekł, ktoś mógłby
-- wysyłać powiadomienia i zobaczyć adresy subskrypcji — nieprzyjemne, ale
-- wciąż nieporównywalnie mniej groźne niż klucz serwisowy, który dawałby
-- dostęp do dzienników zdrowia.
-- ============================================================

create or replace function public.push_due(p_secret text)
returns jsonb
language sql
security definer
set search_path = public, private
as $$ select private.push_due(p_secret); $$;

create or replace function public.push_ok(p_secret text, p_endpoint text)
returns void
language sql
security definer
set search_path = public, private
as $$ select private.push_ok(p_secret, p_endpoint); $$;

create or replace function public.push_failed(p_secret text, p_endpoint text, p_gone boolean)
returns void
language sql
security definer
set search_path = public, private
as $$ select private.push_failed(p_secret, p_endpoint, p_gone); $$;

grant execute on function public.push_due(text) to anon, authenticated;
grant execute on function public.push_ok(text, text) to anon, authenticated;
grant execute on function public.push_failed(text, text, boolean) to anon, authenticated;
