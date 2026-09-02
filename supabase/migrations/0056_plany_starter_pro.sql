-- ============================================================
-- Grind — Migracja 0056: dwa plany płatne, Starter i Pro
--
-- Dotąd był jeden przełącznik: has_pro. Od teraz są trzy poziomy dostępu:
--   0 = darmowy, 1 = Starter, 2 = Pro
-- i jedna funkcja, która o nich decyduje: plan_poziom(). has_pro zostaje
-- jako cienka nakładka (poziom >= 1), żeby żadna z dotychczasowych bramek
-- nie wymagała zmiany - wszystkie funkcje AI są dostępne od Startera,
-- a plany różnią się limitami.
--
-- Do tego tabela bonus_plan: dostęp przyznany NIE za pieniądze (nagrody za
-- levele XP, rekompensaty). Trzymana osobno od subscriptions, bo tamta jest
-- lustrem Stripe'a i pisze po niej wyłącznie webhook - mieszanie źródeł
-- prawdy w jednej tabeli skończyłoby się nadpisaniem bonusu przy pierwszym
-- zdarzeniu ze Stripe'a.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolumna plan na subscriptions
--
-- Domyślnie 'pro': każdy, kto płacił do tej pory, płacił za pełen dostęp
-- i nie może go stracić przez to, że dorobiliśmy tańszy plan.
-- ------------------------------------------------------------
alter table public.subscriptions
  add column if not exists plan text not null default 'pro';

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (plan in ('starter', 'pro'));

-- ------------------------------------------------------------
-- 2. Dostęp bonusowy (nagrody XP, rekompensaty)
-- ------------------------------------------------------------
create table if not exists public.bonus_plan (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('starter', 'pro')),
  do_kiedy   timestamptz not null,
  /** Skąd się wziął - np. 'xp_level_5'. Do audytu i do niepowtarzania nagród. */
  zrodlo     text not null,
  created_at timestamptz not null default now()
);

create index if not exists bonus_plan_user_idx on public.bonus_plan (user_id, do_kiedy);

alter table public.bonus_plan enable row level security;

drop policy if exists bonus_plan_owner_read on public.bonus_plan;
create policy bonus_plan_owner_read on public.bonus_plan
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Zapis wyłącznie przez funkcje security definer (nagrody XP w 0057)
-- i klucz serwisowy. Użytkownik, który sam sobie dopisuje dostęp, to nie
-- użytkownik, tylko dziura.
revoke all on table public.bonus_plan from public, anon, authenticated;
grant select on public.bonus_plan to authenticated;

-- ------------------------------------------------------------
-- 3. plan_poziom() - jedno miejsce, które decyduje o poziomie dostępu
--
-- Te same zasady prywatności co w has_pro (0045): o cudze konto może pytać
-- wyłącznie administrator, każdy inny dostaje 0 zamiast odpowiedzi.
-- ------------------------------------------------------------
create or replace function public.plan_poziom(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then 0
    when p_user <> auth.uid() and not public.is_admin() then 0
    -- Administrator ma pełen dostęp z urzędu - konto właściciela aplikacji.
    when coalesce((select p.role = 'admin' from public.profiles p where p.id = p_user), false)
      then 2
    else greatest(
      coalesce(
        (select case
                  when s.status in ('active', 'trialing')
                       and (s.current_period_end is null or s.current_period_end > now())
                    then case s.plan when 'pro' then 2 else 1 end
                  else 0
                end
           from public.subscriptions s
          where s.user_id = p_user),
        0),
      coalesce(
        (select max(case b.plan when 'pro' then 2 else 1 end)
           from public.bonus_plan b
          where b.user_id = p_user
            and b.do_kiedy > now()),
        0)
    )
  end;
$$;

revoke all on function public.plan_poziom(uuid) from public, anon;
grant execute on function public.plan_poziom(uuid) to authenticated, service_role;

-- has_pro znaczy od teraz "dowolny plan płatny". Wszystkie bramki AI
-- zostają jak były - dostęp do AI daje już Starter, różnica siedzi
-- w limitach niżej.
create or replace function public.has_pro(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.plan_poziom(p_user) >= 1;
$$;

-- ------------------------------------------------------------
-- 4. Licznik miesięczny
--
-- ai_licznik z 0046 liczy dziennie (data = current_date). Plany różnią się
-- pulami MIESIĘCZNYMI, więc dokładamy drugą funkcję na tej samej tabeli:
-- data = pierwszy dzień miesiąca, kategoria z prefiksem 'mies:', żeby wiersze
-- dzienne i miesięczne nie wchodziły sobie w drogę.
-- ------------------------------------------------------------
create or replace function public.ai_licznik_zuzyj_mies(p_kategoria text, p_limit integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n    integer;
begin
  if v_user is null then return false; end if;

  insert into public.ai_licznik (user_id, data, kategoria, wywolan)
  values (v_user, date_trunc('month', current_date)::date, 'mies:' || p_kategoria, 1)
  on conflict (user_id, data, kategoria) do update
    set wywolan = public.ai_licznik.wywolan + 1
  returning wywolan into v_n;

  return public.is_admin() or v_n <= greatest(p_limit, 0);
end;
$$;

/** Stan miesięcznej puli dla ekranu - ile zużyte, zanim ktokolwiek kliknie. */
create or replace function public.ai_licznik_stan_mies(p_kategoria text, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'limit',      p_limit,
    'wywolan',    coalesce((select wywolan from public.ai_licznik
                             where user_id = auth.uid()
                               and data = date_trunc('month', current_date)::date
                               and kategoria = 'mies:' || p_kategoria), 0),
    'bez_limitu', public.is_admin());
$$;

revoke all on function public.ai_licznik_zuzyj_mies(text, integer) from public, anon;
revoke all on function public.ai_licznik_stan_mies(text, integer)  from public, anon;
grant execute on function public.ai_licznik_zuzyj_mies(text, integer) to authenticated;
grant execute on function public.ai_licznik_stan_mies(text, integer)  to authenticated;

-- ------------------------------------------------------------
-- 5. apply_subscription uczy się planu
--
-- Nowy parametr z domyślną wartością 'pro' - webhook w starszej wersji kodu
-- (okno między migracją a wdrożeniem) woła funkcję bez niego i wszystko
-- działa jak dotąd. CREATE OR REPLACE z nowym parametrem utworzyłby DRUGĄ
-- funkcję obok starej, dlatego starą jawnie usuwamy.
-- ------------------------------------------------------------
drop function if exists public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, text, timestamptz
);

create or replace function public.apply_subscription(
  p_secret       text,
  p_user_id      uuid,
  p_status       text,
  p_customer_id  text,
  p_subscription_id text,
  p_price_id     text,
  p_period_end   timestamptz,
  p_cancel_at_period_end boolean,
  p_trial_end    timestamptz,
  p_event_id     text default null,
  p_event_at     timestamptz default null,
  p_plan         text default 'pro'
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_secret text;
  v_last_at timestamptz;
  v_last_id text;
  v_plan text := case when p_plan in ('starter', 'pro') then p_plan else 'pro' end;
begin
  select value into v_secret from private.config where key = 'stripe_webhook_secret';

  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    return false;
  end if;

  if p_status not in ('none','trialing','active','past_due','canceled','incomplete') then
    return false;
  end if;

  select last_event_at, last_event_id into v_last_at, v_last_id
    from public.subscriptions where user_id = p_user_id;

  if p_event_id is not null and v_last_id is not null and p_event_id = v_last_id then
    return true;
  end if;

  if p_event_at is not null and v_last_at is not null and p_event_at < v_last_at then
    return true;
  end if;

  insert into public.subscriptions as s
    (user_id, status, plan, stripe_customer_id, stripe_subscription_id, price_id,
     current_period_end, cancel_at_period_end, trial_end, last_event_at, last_event_id)
  values
    (p_user_id, p_status, v_plan, p_customer_id, p_subscription_id, p_price_id,
     p_period_end, coalesce(p_cancel_at_period_end, false), p_trial_end,
     p_event_at, p_event_id)
  on conflict (user_id) do update set
    status                 = excluded.status,
    plan                   = excluded.plan,
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, s.stripe_subscription_id),
    price_id               = coalesce(excluded.price_id, s.price_id),
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    trial_end              = excluded.trial_end,
    last_event_at          = coalesce(excluded.last_event_at, s.last_event_at),
    last_event_id          = coalesce(excluded.last_event_id, s.last_event_id);

  return true;
end;
$$;

comment on function public.apply_subscription is
  'Jedyna droga do zmiany stanu subskrypcji. Chroniona sekretem, odporna na '
  'powtórzone i spóźnione zdarzenia Stripe''a. Od 0056 zna plan (starter/pro).';

revoke all on function public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, text, timestamptz, text
) from public;
-- Bez sekretu funkcja i tak nic nie zrobi - jak dotąd.
grant execute on function public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, text, timestamptz, text
) to authenticated, anon;

-- ------------------------------------------------------------
-- 6. Limity zależne od planu tam, gdzie pilnuje ich baza
-- ------------------------------------------------------------

-- Plan treningowy AI: Pro może częściej. Wartości w app_settings, żeby
-- zmiana nie wymagała wdrożenia.
insert into public.app_settings (key, value)
values ('plan_ai', jsonb_build_object('odstep_dni', 30, 'odstep_dni_pro', 7))
on conflict (key) do update
  set value = public.app_settings.value || excluded.value;

create or replace function public.plan_ai_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select case
             when public.plan_poziom() >= 2
               then coalesce((value ->> 'odstep_dni_pro')::int, 7)
             else coalesce((value ->> 'odstep_dni')::int, 30)
           end as odstep
      from public.app_settings where key = 'plan_ai'
  ),
  s as (
    select max(created_at) as ostatni
      from public.ai_plan_requests
     where user_id = auth.uid()
       and status = 'ok'
  )
  select jsonb_build_object(
    'odstep_dni',  p.odstep,
    'ostatni_plan', s.ostatni,
    'nastepny_od', case when s.ostatni is null then now()
                        else s.ostatni + make_interval(days => p.odstep) end,
    'mozna',       s.ostatni is null
                     or s.ostatni + make_interval(days => p.odstep) <= now(),
    'powod',       case
                     when s.ostatni is not null
                          and s.ostatni + make_interval(days => p.odstep) > now()
                       then 'odstep'
                     else null
                   end
  )
  from p cross join s;
$$;

-- Skan wyglądu: Starter raz w miesiącu, Pro po staremu (5/mies, odstęp 7 dni).
insert into public.app_settings (key, value)
values ('wyglad', jsonb_build_object('odstep_dni', 7, 'limit_miesiaca', 5, 'limit_miesiaca_starter', 1))
on conflict (key) do update
  set value = public.app_settings.value || jsonb_build_object('limit_miesiaca_starter', 1);

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
  a as (select public.is_admin() as admin)
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

-- ------------------------------------------------------------
-- 7. Cennik na ekran: dwie kwoty zamiast jednej
-- ------------------------------------------------------------
update public.app_settings
   set value = value || jsonb_build_object('amount', 2999, 'starter_amount', 1499)
 where key = 'pricing';

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  -- Kolumna plan istnieje i ma ograniczenie wartości.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'plan'
  ) then
    raise exception 'Migracja 0056: brak kolumny subscriptions.plan';
  end if;

  -- Stara sygnatura apply_subscription zniknęła - została dokładnie jedna.
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'apply_subscription';
  if v_count <> 1 then
    raise exception 'Migracja 0056: apply_subscription ma % wersji, ma być 1', v_count;
  end if;

  -- Nowe funkcje zamknięte przed anonem, otwarte dla zalogowanych.
  if has_function_privilege('anon', 'public.plan_poziom(uuid)', 'EXECUTE') then
    raise exception 'Migracja 0056: plan_poziom wykonywalna przez anona';
  end if;
  if not has_function_privilege('authenticated', 'public.plan_poziom(uuid)', 'EXECUTE') then
    raise exception 'Migracja 0056: plan_poziom niewykonywalna przez zalogowanych';
  end if;
  if has_function_privilege('anon', 'public.ai_licznik_zuzyj_mies(text, integer)', 'EXECUTE') then
    raise exception 'Migracja 0056: ai_licznik_zuzyj_mies wykonywalna przez anona';
  end if;

  -- bonus_plan: użytkownik może tylko czytać.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'bonus_plan'
       and grantee in ('anon', 'authenticated')
       and privilege_type <> 'SELECT'
  ) then
    raise exception 'Migracja 0056: bonus_plan ma nadmiarowe uprawnienia';
  end if;

  -- Bez zalogowanego użytkownika poziom to 0, a has_pro - false.
  if public.plan_poziom() <> 0 then
    raise exception 'Migracja 0056: plan_poziom bez auth.uid() ma zwracać 0';
  end if;
  if public.has_pro() then
    raise exception 'Migracja 0056: has_pro bez auth.uid() ma zwracać false';
  end if;
  if public.ai_licznik_zuzyj_mies('test_0056', 10) then
    raise exception 'Migracja 0056: licznik miesięczny bez auth.uid() ma zwracać false';
  end if;

  -- Limity planowo-zależne dalej zwracają komplet pól.
  if (public.plan_ai_limit() ->> 'mozna') is null then
    raise exception 'Migracja 0056: plan_ai_limit() nie zwraca pola mozna';
  end if;
  if (public.wyglad_limit() ->> 'mozna') is null then
    raise exception 'Migracja 0056: wyglad_limit() nie zwraca pola mozna';
  end if;

  -- Cennik ma obie kwoty.
  if not exists (
    select 1 from public.app_settings
     where key = 'pricing'
       and (value ? 'starter_amount')
       and (value ->> 'amount')::int = 2999
  ) then
    raise exception 'Migracja 0056: cennik nie ma dwóch kwot';
  end if;
end;
$$;
