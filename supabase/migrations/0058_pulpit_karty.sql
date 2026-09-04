-- ============================================================
-- Grind — Migracja 0058: co pokazywać na pulpicie
--
-- Pulpit urósł do dwunastu kart na jednym ekranie. Każda z osobna ma sens,
-- ale razem tworzą ścianę, przez którą trzeba przewijać, żeby cokolwiek
-- znaleźć - a rzeczy wymagające działania toną między statystykami.
--
-- Zamiast decydować za wszystkich, kto czego potrzebuje, trzymamy wybór
-- w profilu. `null` (i tak startuje każde konto) znaczy "zestaw domyślny",
-- czyli krótki pulpit skupiony na dziś; kto chce więcej, włącza sobie resztę
-- i ta decyzja jedzie za nim na każde urządzenie.
--
-- Lista dozwolonych identyfikatorów świadomie NIE jest ograniczeniem w bazie:
-- karty przybywają i znikają razem z aplikacją, a migracja dopisywana przy
-- każdej nowej karcie byłaby kosztem bez korzyści. Nieznane wpisy aplikacja
-- po prostu mija.
-- ============================================================

alter table public.profiles
  add column if not exists pulpit_karty jsonb;

-- Tablica napisów albo nic. Bez tego jedno złe żądanie z konsoli
-- przeglądarki wsadza tam obiekt, a ekran wywala się przy renderowaniu.
--
-- Elementy sprawdzamy wyrażeniem jsonpath, a nie podzapytaniem po
-- jsonb_array_elements: w ograniczeniu CHECK podzapytania są zabronione
-- ("cannot use subquery in check constraint"). Rozmiar całości pilnujemy
-- długością tekstu - prościej niż mierzyć każdy napis z osobna, a chodzi
-- o to samo: żeby w kolumnie na listę nazw nie wylądowała powieść.
alter table public.profiles
  drop constraint if exists profiles_pulpit_karty_check;
alter table public.profiles
  add constraint profiles_pulpit_karty_check check (
    pulpit_karty is null
    or (
      jsonb_typeof(pulpit_karty) = 'array'
      and jsonb_array_length(pulpit_karty) <= 40
      and length(pulpit_karty::text) <= 2000
      and not jsonb_path_exists(pulpit_karty, '$[*] ? (@.type() != "string")')
    )
  );

comment on column public.profiles.pulpit_karty is
  'Identyfikatory kart widocznych na pulpicie. null = zestaw domyślny (0058).';

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'pulpit_karty'
  ) then
    raise exception 'Migracja 0058: brak kolumny profiles.pulpit_karty';
  end if;

  -- Testujemy ograniczenie na prawdziwym wierszu, bo profile powstają
  -- wyzwalaczem z auth.users i nie da się wstawić samego profilu.
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0058@grind.local')
    returning id into v_user;

  update public.profiles set pulpit_karty = '["trening", "dieta"]'::jsonb where id = v_user;
  if (select pulpit_karty from public.profiles where id = v_user) is null then
    raise exception 'Migracja 0058: poprawna lista kart nie zapisała się';
  end if;

  update public.profiles set pulpit_karty = null where id = v_user;

  begin
    update public.profiles set pulpit_karty = '{"a": 1}'::jsonb where id = v_user;
    raise exception 'Migracja 0058: obiekt zamiast tablicy przeszedł';
  exception when check_violation then null;
  end;

  begin
    update public.profiles set pulpit_karty = '[123]'::jsonb where id = v_user;
    raise exception 'Migracja 0058: liczba zamiast napisu przeszła';
  exception when check_violation then null;
  end;

  delete from auth.users where id = v_user;
end;
$$;
