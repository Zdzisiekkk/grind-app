-- ============================================================
-- Grind — Migracja 0074: portfel jako własna kategoria kosztu AI
--
-- Odczyt portfela ze zrzutu ekranu liczył się dotąd jako "jedzenie", bo
-- tylko cztery kategorie były dozwolone. Działałoby, i to jest właśnie
-- problem: rejestr kosztów pokazywałby wydatki na odczyt portfela wśród
-- opisów posiłków, a pierwsza próba odpowiedzi na pytanie "co tak naprawdę
-- kosztuje" trafiałaby w ścianę.
--
-- Szacunek 0.02 USD to pesymizm dla Sonneta z obrazem: zrzut ekranu
-- w rozdzielczości 1600 px to około 1500 tokenów wejścia plus kilkaset
-- wyjścia, czyli ~0.008 USD. Dwukrotny zapas, jak przy posiłku - zawyżenie
-- jest tu bezpieczną stroną, bo rozliczenie i tak wpisze kwotę prawdziwą,
-- a zaniżenie przepuszczałoby wywołania ponad próg.
-- ============================================================

alter table public.ai_wydatki drop constraint if exists ai_wydatki_kategoria_check;
alter table public.ai_wydatki add constraint ai_wydatki_kategoria_check
  check (kategoria in ('trener', 'plan', 'wyglad', 'jedzenie', 'portfel'));

update public.app_settings
   set value = jsonb_set(
         jsonb_set(value, '{szacunek_usd,portfel}', '0.02'::jsonb, true),
         '{liczone}',
         (select jsonb_agg(distinct k)
            from jsonb_array_elements_text(
                   (value -> 'liczone') || '["portfel"]'::jsonb) k),
         true)
 where key = 'ai_budzet';

create or replace function public.ai_budzet_liczone(p_kategoria text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.app_settings where key = 'ai_budzet')
      then p_kategoria in ('trener', 'plan', 'jedzenie', 'portfel')
    else exists (
      select 1
        from public.app_settings s,
             lateral jsonb_array_elements_text(s.value -> 'liczone') k
       where s.key = 'ai_budzet' and k = p_kategoria)
  end;
$$;

revoke all on function public.ai_budzet_liczone(text) from public, anon;
grant execute on function public.ai_budzet_liczone(text) to authenticated;

/*
 * Rezerwacja: dopisana piąta kategoria, reszta ciała PRZEPISANA Z 0046
 * co do znaku. `create or replace` nie umie zmienić jednej linijki, a każde
 * odtwarzanie takiej funkcji z pamięci kończy się cichym cofnięciem
 * późniejszych poprawek - tutaj byłyby to `bez_limitu` i `wydano_usd`,
 * czyli dokładnie te dwie rzeczy, które decydują o działaniu limitu.
 */
create or replace function public.ai_koszt_rezerwuj(p_kategoria text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_stan     jsonb;
  v_szacunek numeric;
  v_id       uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'powod', 'brak_logowania');
  end if;

  if p_kategoria not in ('trener', 'plan', 'wyglad', 'jedzenie', 'portfel') then
    raise exception 'nieznana kategoria kosztu: %', p_kategoria;
  end if;

  v_stan := public.ai_budzet_stan();

  v_szacunek := coalesce(
    (select (value -> 'szacunek_usd' ->> p_kategoria)::numeric
       from public.app_settings where key = 'ai_budzet'),
    0.10);

  if public.ai_budzet_liczone(p_kategoria)
     and not coalesce((v_stan ->> 'bez_limitu')::boolean, false)
     and (v_stan ->> 'wydano_usd')::numeric + v_szacunek > (v_stan ->> 'limit_usd')::numeric
  then
    return jsonb_build_object('ok', false, 'powod', 'limit_miesiaca', 'stan', v_stan);
  end if;

  insert into public.ai_wydatki (user_id, kategoria, szacunek_usd)
  values (v_user, p_kategoria, v_szacunek)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'szacunek_usd', v_szacunek, 'stan', v_stan);
end;
$$;

revoke all on function public.ai_koszt_rezerwuj(text) from public, anon;
grant execute on function public.ai_koszt_rezerwuj(text) to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_rez  jsonb;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0074@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  v_rez := public.ai_koszt_rezerwuj('portfel');
  if not (v_rez ->> 'ok')::boolean then
    raise exception 'Migracja 0074: rezerwacja dla portfela odrzucona: %', v_rez ->> 'powod';
  end if;

  -- Odpowiedź musi nieść szacunek i stan budżetu - ekran je pokazuje,
  -- a ich brak to dokładnie ten rodzaj regresu, który przechodzi niezauważony.
  if (v_rez ->> 'szacunek_usd')::numeric <> 0.02 then
    raise exception 'Migracja 0074: szacunek dla portfela to % zamiast 0.02',
      v_rez ->> 'szacunek_usd';
  end if;
  if v_rez -> 'stan' is null then
    raise exception 'Migracja 0074: rezerwacja nie zwraca stanu budżetu';
  end if;

  if (select kategoria from public.ai_wydatki where id = (v_rez ->> 'id')::uuid) <> 'portfel' then
    raise exception 'Migracja 0074: koszt zapisał się pod inną kategorią';
  end if;

  -- Wymyślona kategoria dalej ma wybuchać, a nie po cichu przechodzić.
  begin
    perform public.ai_koszt_rezerwuj('cokolwiek');
    raise exception 'Migracja 0074: nieznana kategoria przeszła';
  exception when others then
    if sqlerrm like 'Migracja 0074:%' then raise; end if;
  end;

  if not public.ai_budzet_liczone('portfel') then
    raise exception 'Migracja 0074: portfel nie zjada wspólnego budżetu';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
