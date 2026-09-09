-- ============================================================
-- Grind — Migracja 0072: sport w wydatkach i wpływy w dzienniku
--
-- Dwie drobne rzeczy, obie wynikające z użytkowania:
--
--   * Kategoria SPORT. Wchodziła dotąd w "zdrowie" albo "inne", przez co
--     najbardziej grindowa część wydatków była niewidoczna w rozbiciu -
--     a to akurat ta, o której człowiek chce wiedzieć, ile go kosztuje.
--
--   * WPŁYWY W DZIENNIKU RUCHÓW. Żeby dało się poprawić literówkę w kwocie
--     wypłaty, trzeba ją najpierw zobaczyć. Dziennik pokazywał wydatki
--     i wpłaty na cele, a wpływy nie miały gdzie się pokazać.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Sport i aktywność fizyczna
-- ------------------------------------------------------------
alter table public.finanse_wydatki
  drop constraint if exists finanse_wydatki_kategoria_check;

alter table public.finanse_wydatki
  add constraint finanse_wydatki_kategoria_check check (kategoria in (
    'jedzenie', 'zakupy', 'rozrywka', 'transport',
    'zdrowie', 'sport', 'prezenty', 'subskrypcje', 'inne'
  ));

-- ------------------------------------------------------------
-- 2. Dziennik obejmuje też wpływy
--
-- Kwoty zostają dodatnie we wszystkich trzech gałęziach, a kierunek niesie
-- kolumna `typ`. Zapisywanie wpływów ze znakiem minus wyglądałoby sprytnie
-- i mściło się przy pierwszym sumowaniu, w którym ktoś zapomni o znaku.
-- ------------------------------------------------------------
create or replace view public.v_finanse_ruchy
with (security_invoker = on) as
  select
    w.id,
    w.user_id,
    w.data,
    'wydatek'::text as typ,
    w.kwota,
    w.kategoria,
    w.opis,
    null::uuid as cel_id,
    null::text  as cel_nazwa,
    null::text  as zrodlo,
    w.created_at
  from public.finanse_wydatki w
  union all
  select
    p.id,
    p.user_id,
    p.data,
    'cel'::text,
    p.kwota,
    'cel'::text,
    p.note,
    p.cel_id,
    c.nazwa,
    p.zrodlo,
    p.created_at
  from public.finanse_wplaty p
  join public.finanse_cele c on c.id = p.cel_id
  union all
  select
    v.id,
    v.user_id,
    v.data,
    'wplyw'::text,
    v.kwota,
    'wplyw'::text,
    v.opis,
    v.zrodlo_id,
    z.nazwa,
    null::text,
    v.created_at
  from public.finanse_wplywy v
  left join public.finanse_zrodla z on z.id = v.zrodlo_id;

grant select on public.v_finanse_ruchy to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0072@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.finanse_wydatki (user_id, kwota, kategoria)
       values (v_user, 120, 'sport');
  if not exists (select 1 from public.finanse_wydatki
                  where user_id = v_user and kategoria = 'sport') then
    raise exception 'Migracja 0072: kategoria sport nie przeszła';
  end if;

  -- Wymyślona kategoria dalej ma odpadać.
  begin
    insert into public.finanse_wydatki (user_id, kwota, kategoria)
         values (v_user, 10, 'cokolwiek');
    raise exception 'Migracja 0072: dowolna kategoria przeszła';
  exception when check_violation then null;
  end;

  insert into public.finanse_wplywy (user_id, kwota) values (v_user, 3000);
  if (select count(*) from public.v_finanse_ruchy
       where user_id = v_user and typ = 'wplyw') <> 1 then
    raise exception 'Migracja 0072: wpływ nie pojawił się w dzienniku ruchów';
  end if;

  -- Wpływ bez źródła też ma się pokazać - to zwykły przypadek, nie błąd.
  if (select kwota from public.v_finanse_ruchy
       where user_id = v_user and typ = 'wplyw') <> 3000 then
    raise exception 'Migracja 0072: kwota wpływu w dzienniku jest zła';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
