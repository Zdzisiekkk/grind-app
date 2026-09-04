-- ============================================================
-- Grind — Migracja 0059: zwolnienie konta z limitów skanowania
--
-- Skan wyglądu ma dwa ograniczenia: odstęp 7 dni i pulę miesięczną
-- (1 na Starterze, 5 na Pro). Oba są kosztowe - każdy skan to wywołanie
-- modelu - i oba mają zostać. Brakowało trzeciej możliwości: konta, które
-- testuje aplikację i musi skanować częściej, niż wypada normalnemu
-- użytkownikowi.
--
-- Dotąd jedynym sposobem było zrobienie kogoś administratorem, czyli danie
-- mu przy okazji dostępu do wszystkiego innego. To nie jest cena, którą warto
-- płacić za "chcę zrobić drugi skan tego samego dnia".
--
-- UWAGA NA FURTKĘ: `profiles_update_own` z migracji 0002 pozwala każdemu
-- zmieniać własny wiersz w profilu. Sama kolumna z przełącznikiem byłaby więc
-- zaproszeniem: jedno żądanie z konsoli przeglądarki i konto ma darmowe skany
-- bez limitu, na nasz rachunek u Anthropica. Dlatego kolumnę pilnuje
-- wyzwalacz, a nie dobra wola.
-- ============================================================

alter table public.profiles
  add column if not exists wyglad_bez_limitu boolean not null default false;

comment on column public.profiles.wyglad_bez_limitu is
  'Konto zwolnione z odstępu i puli miesięcznej skanów wyglądu (0059). '
  'Ustawia wyłącznie administrator albo klucz serwisowy.';

-- ------------------------------------------------------------
-- Kolumny nie zmienia się z przeglądarki
-- ------------------------------------------------------------
create or replace function private.pilnuj_wyglad_bez_limitu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nie ruszył tej kolumny - nie ma o czym mówić.
  if new.wyglad_bez_limitu is not distinct from old.wyglad_bez_limitu then
    return new;
  end if;

  -- Klucz serwisowy (webhooki, panel administracyjny, migracje) nie ma
  -- auth.uid() i musi móc to ustawić - inaczej nie dałoby się przyznać
  -- zwolnienia nikomu.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Zwykły użytkownik: zapis przechodzi, ale ta jedna kolumna zostaje
  -- nietknięta. Cicho, bez wyjątku - inaczej zwykły zapis profilu
  -- (imię, cel kaloryczny) wywalałby się przez pole, o którym nikt nie wie.
  new.wyglad_bez_limitu := old.wyglad_bez_limitu;
  return new;
end;
$$;

revoke all on function private.pilnuj_wyglad_bez_limitu() from public, anon, authenticated;

drop trigger if exists profiles_pilnuj_wyglad_bez_limitu on public.profiles;
create trigger profiles_pilnuj_wyglad_bez_limitu
  before update on public.profiles
  for each row execute function private.pilnuj_wyglad_bez_limitu();

-- ------------------------------------------------------------
-- Limit uwzględnia zwolnienie
--
-- Ta sama funkcja co w 0056, z jedną zmianą: obok `is_admin()` liczy się też
-- przełącznik z profilu. `wyglad_moze_skanowac()` czyta z tej funkcji, więc
-- reguła zapisu (polityka `wyglad_skany_limit`) przepuszcza takie konto
-- bez żadnej dodatkowej zmiany.
-- ------------------------------------------------------------
create or replace function public.wyglad_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce((value ->> 'odstep_dni')::int, 7) as odstep,
           case
             when public.plan_poziom() >= 2
               then coalesce((value ->> 'limit_miesiaca')::int, 5)
             else coalesce((value ->> 'limit_miesiaca_starter')::int, 1)
           end as limit_mies
      from public.app_settings where key = 'wyglad'
  ),
  s as (
    select max(utworzono) as ostatni,
           count(*) filter (where utworzono >= date_trunc('month', now())) as w_miesiacu
      from public.wyglad_skany
     where user_id = auth.uid()
  ),
  a as (
    select public.is_admin()
        or coalesce(
             (select pr.wyglad_bez_limitu from public.profiles pr where pr.id = auth.uid()),
             false)
      as admin
  )
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

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_skan uuid;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'wyglad_bez_limitu'
  ) then
    raise exception 'Migracja 0059: brak kolumny profiles.wyglad_bez_limitu';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'profiles_pilnuj_wyglad_bez_limitu'
  ) then
    raise exception 'Migracja 0059: brak wyzwalacza pilnującego kolumny';
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0059@grind.local')
    returning id into v_user;

  -- Zgoda i skan, żeby odstęp 7 dni realnie blokował.
  insert into public.wyglad_zgoda (user_id, wiek_potwierdzony) values (v_user, true);
  insert into public.wyglad_skany (user_id, ocena_ogolna)
       values (v_user, 70) returning id into v_skan;

  -- Jako ten użytkownik: limit ma blokować.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  if (public.wyglad_limit() ->> 'mozna')::boolean then
    raise exception 'Migracja 0059: świeżo po skanie limit powinien blokować';
  end if;
  -- Konto testowe nie ma subskrypcji, więc pula miesięczna wynosi 1 i to ona
  -- wyczerpuje się pierwsza; odstęp blokowałby dopiero konto z planem Pro.
  -- Istotne jest, że blokada ma nazwany powód, a nie który z dwóch zadziałał.
  if (public.wyglad_limit() ->> 'powod') not in ('odstep', 'limit_miesiaca') then
    raise exception 'Migracja 0059: blokada bez rozpoznanego powodu (%)',
      (public.wyglad_limit() ->> 'powod');
  end if;

  -- Próba samodzielnego zdjęcia limitu przez użytkownika ma być bez skutku.
  perform set_config('role', 'authenticated', true);
  update public.profiles set wyglad_bez_limitu = true where id = v_user;
  perform set_config('role', 'none', true);

  if (select wyglad_bez_limitu from public.profiles where id = v_user) then
    raise exception 'Migracja 0059: użytkownik sam sobie zdjął limit skanów';
  end if;
  if (public.wyglad_limit() ->> 'mozna')::boolean then
    raise exception 'Migracja 0059: limit puścił mimo nieudanej próby zmiany';
  end if;

  -- To samo kluczem serwisowym (bez auth.uid()) ma zadziałać.
  perform set_config('request.jwt.claim.sub', '', true);
  update public.profiles set wyglad_bez_limitu = true where id = v_user;
  if not (select wyglad_bez_limitu from public.profiles where id = v_user) then
    raise exception 'Migracja 0059: klucz serwisowy nie ustawił zwolnienia';
  end if;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  if not (public.wyglad_limit() ->> 'mozna')::boolean then
    raise exception 'Migracja 0059: zwolnione konto dalej ma blokadę';
  end if;
  if not (public.wyglad_limit() ->> 'bez_limitu')::boolean then
    raise exception 'Migracja 0059: ekran nie dowie się, że konto jest zwolnione';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
