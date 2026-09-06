-- ============================================================
-- Grind — Migracja 0060: przypomnienie o elektrolitach
--
-- Aplikacja przez cały dzień popycha do picia wody i liczy każdą szklankę.
-- Im lepiej ktoś to realizuje, tym więcej sodu, potasu i magnezu wypłukuje -
-- a o tym nie mówi jej nic. To jest luka, którą sama stworzyła.
--
-- Dlatego przypomnienie NIE jest kolejnym alarmem o stałej godzinie, tylko
-- reakcją na powód: odzywa się dopiero, gdy dzienne picie przekroczy próg.
-- Kto wypił półtora litra, nie zobaczy go nigdy; kto wypił cztery - raz.
--
-- Domyślnie włączone dla wszystkich (`default true`), bo w ustawienia zagląda
-- garstka, a rzecz dotyczy każdego, kto realizuje cel nawodnienia. Wyłącza się
-- jednym przełącznikiem w profilu.
-- ============================================================

alter table public.profiles
  add column if not exists elektrolity_przypomnienie boolean not null default true;

-- Próg w mililitrach. `null` znaczy "użyj domyślnego z aplikacji" - tak samo
-- jak przy celu nawodnienia, żeby zmiana domyślnej wartości nie wymagała
-- przechodzenia po wszystkich wierszach w bazie.
alter table public.profiles
  add column if not exists elektrolity_prog_ml integer;

alter table public.profiles
  drop constraint if exists profiles_elektrolity_prog_check;
alter table public.profiles
  add constraint profiles_elektrolity_prog_check check (
    elektrolity_prog_ml is null
    or (elektrolity_prog_ml between 1000 and 10000)
  );

comment on column public.profiles.elektrolity_przypomnienie is
  'Czy przypominać o elektrolitach po przekroczeniu progu wypitej wody (0060).';
comment on column public.profiles.elektrolity_prog_ml is
  'Próg dziennego picia, po którym przychodzi przypomnienie. null = domyślny.';

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'elektrolity_przypomnienie'
  ) then
    raise exception 'Migracja 0060: brak kolumny elektrolity_przypomnienie';
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0060@grind.local')
    returning id into v_user;

  -- Każde konto, także już istniejące, startuje z włączonym przypomnieniem.
  if not (select elektrolity_przypomnienie from public.profiles where id = v_user) then
    raise exception 'Migracja 0060: przypomnienie miało być domyślnie włączone';
  end if;
  if (select elektrolity_prog_ml from public.profiles where id = v_user) is not null then
    raise exception 'Migracja 0060: próg miał startować pusty (domyślny z aplikacji)';
  end if;

  -- Sensowny próg przechodzi, bezsensowny nie.
  update public.profiles set elektrolity_prog_ml = 2500 where id = v_user;

  begin
    update public.profiles set elektrolity_prog_ml = 50 where id = v_user;
    raise exception 'Migracja 0060: próg 50 ml przeszedł, a nie powinien';
  exception when check_violation then null;
  end;

  begin
    update public.profiles set elektrolity_prog_ml = 99999 where id = v_user;
    raise exception 'Migracja 0060: próg 99999 ml przeszedł, a nie powinien';
  exception when check_violation then null;
  end;

  delete from auth.users where id = v_user;
end;
$$;
