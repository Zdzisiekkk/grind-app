-- ============================================================
-- Grind — Migracja 0063: zakwasy i inne dolegliwości obok kontuzji
--
-- Moduł znał dotąd jedno pojęcie: kontuzję. Zakwasy po pierwszym ciężkim
-- przysiadzie, naciągnięta łydka czy otarcie od pasa nie mieściły się w nim
-- ani trochę - a to są rzeczy, które realnie zmieniają najbliższy trening.
-- Ludzie albo tego nie zapisywali, albo zapisywali jako "kontuzję", która
-- potem zostawała na liście na zawsze i straszyła obok urazu barku.
--
-- Stąd dwa pojęcia zamiast jednego:
--   - URAZ (naciągnięcie, skręcenie, stłuczenie, przeciążenie, uraz ogólny) -
--     zachowuje się jak dotąd: trwa, dopóki go nie zamkniesz,
--   - DOLEGLIWOŚĆ PRZEJŚCIOWA (zakwasy, sztywność, otarcie) - schodzi sama.
--     Ma `wygasa_po_dniach` i po tym czasie znika z listy aktywnych bez
--     niczyjego udziału. Zakwasy, które trzeba ręcznie zamykać, to zadanie
--     domowe, a nie funkcja.
--
-- Wygasanie liczy widok, a nie zadanie w tle: nie ma co budzić crona po to,
-- żeby raz dziennie przestawiać flagę, którą da się policzyć przy odczycie.
-- ============================================================

alter table public.injuries
  add column if not exists rodzaj text not null default 'uraz';

alter table public.injuries
  drop constraint if exists injuries_rodzaj_check;
alter table public.injuries
  add constraint injuries_rodzaj_check check (rodzaj in (
    'zakwasy', 'sztywnosc', 'otarcie',
    'naciagniecie', 'przeciazenie', 'stluczenie', 'skrecenie',
    'bol', 'uraz', 'inne'
  ));

-- null = trwa, dopóki ktoś jej nie zamknie (tak działa każdy uraz).
alter table public.injuries
  add column if not exists wygasa_po_dniach integer;

alter table public.injuries
  drop constraint if exists injuries_wygasa_check;
alter table public.injuries
  add constraint injuries_wygasa_check check (
    wygasa_po_dniach is null or wygasa_po_dniach between 1 and 90
  );

comment on column public.injuries.rodzaj is
  'Rodzaj dolegliwości (0063). Domyślnie uraz - tak zachowywały się wszystkie wpisy dotąd.';
comment on column public.injuries.wygasa_po_dniach is
  'Po tylu dniach dolegliwość schodzi sama z listy aktywnych. null = trwa do zamknięcia.';

-- ------------------------------------------------------------
-- Widok z policzonym wygaśnięciem
--
-- Ekrany czytają stąd, żeby reguła "zakwasy schodzą po czterech dniach"
-- istniała w jednym miejscu, a nie w każdym komponencie osobno.
-- ------------------------------------------------------------
create or replace view public.v_dolegliwosci
with (security_invoker = on) as
  select
    i.*,
    -- Data, po której przejściowa dolegliwość przestaje się liczyć.
    case
      when i.wygasa_po_dniach is null then null
      else coalesce(i.started_at, i.created_at::date) + i.wygasa_po_dniach
    end as wygasa_dnia,
    -- Czy wpis ma dziś być traktowany jako aktywny. Zamknięty ręcznie
    -- (healed) nie wraca do życia przez to, że data jeszcze nie minęła.
    (
      i.status <> 'healed'
      and (
        i.wygasa_po_dniach is null
        or coalesce(i.started_at, i.created_at::date) + i.wygasa_po_dniach >= current_date
      )
    ) as aktywna,
    -- Przejściowe pokazujemy osobno od urazów - to jest cała różnica
    -- między "zakwasy po nogach" a "bark po zwichnięciu".
    (i.wygasa_po_dniach is not null) as przejsciowa
  from public.injuries i;

grant select on public.v_dolegliwosci to authenticated;

-- ------------------------------------------------------------
-- Ocena bólu tylko dla tego, co faktycznie boli dzisiaj
--
-- `track_pain` zostaje bez zmian, ale pytanie po treningu nie ma sensu
-- dla zakwasów sprzed tygodnia. Ekran filtruje po `aktywna` z widoku.
-- ------------------------------------------------------------

do $$
declare
  v_user uuid;
  v_id   uuid;
  v_akt  boolean;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'injuries' and column_name = 'rodzaj'
  ) then
    raise exception 'Migracja 0063: brak kolumny rodzaj';
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0063@grind.local')
    returning id into v_user;

  -- Wpisy sprzed migracji mają zostać urazami i nie zacząć znikać.
  insert into public.injuries (user_id, name, body_part)
       values (v_user, 'Bark po zwichnięciu', 'shoulder') returning id into v_id;
  if (select rodzaj from public.injuries where id = v_id) <> 'uraz' then
    raise exception 'Migracja 0063: istniejące wpisy miały zostać urazami';
  end if;
  select aktywna into v_akt from public.v_dolegliwosci where id = v_id;
  if not v_akt then
    raise exception 'Migracja 0063: uraz bez daty wygaśnięcia przestał być aktywny';
  end if;

  -- Świeże zakwasy są aktywne...
  insert into public.injuries (user_id, name, body_part, rodzaj, wygasa_po_dniach, started_at)
       values (v_user, 'Zakwasy nogi', 'hamstring', 'zakwasy', 4, current_date)
    returning id into v_id;
  select aktywna into v_akt from public.v_dolegliwosci where id = v_id;
  if not v_akt then
    raise exception 'Migracja 0063: świeże zakwasy powinny być aktywne';
  end if;

  -- ...a sprzed tygodnia schodzą same, bez zamykania ręką.
  update public.injuries set started_at = current_date - 7 where id = v_id;
  select aktywna into v_akt from public.v_dolegliwosci where id = v_id;
  if v_akt then
    raise exception 'Migracja 0063: stare zakwasy nadal są aktywne';
  end if;

  -- Zostają jednak w historii - to nie jest kasowanie.
  if not exists (select 1 from public.v_dolegliwosci where id = v_id) then
    raise exception 'Migracja 0063: wygasła dolegliwość zniknęła z historii';
  end if;

  -- Zamknięte ręcznie nie wraca, choćby data jeszcze nie minęła.
  update public.injuries
     set started_at = current_date, status = 'healed' where id = v_id;
  select aktywna into v_akt from public.v_dolegliwosci where id = v_id;
  if v_akt then
    raise exception 'Migracja 0063: ręcznie zamknięta dolegliwość ożyła';
  end if;

  -- Nieznany rodzaj ma odpaść.
  begin
    insert into public.injuries (user_id, name, rodzaj)
         values (v_user, 'Coś', 'wymyslony_rodzaj');
    raise exception 'Migracja 0063: nieznany rodzaj przeszedł';
  exception when check_violation then null;
  end;

  delete from auth.users where id = v_user;
end;
$$;
