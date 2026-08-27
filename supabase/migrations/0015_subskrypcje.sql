-- ============================================================
-- Grind — Migracja 0015: subskrypcje
--
-- Stripe jest ŹRÓDŁEM PRAWDY o tym, kto płaci. Ta tabela to tylko lokalna
-- kopia stanu, żeby każde sprawdzenie uprawnień nie kończyło się zapytaniem
-- do ich API. Wypełnia ją wyłącznie webhook, kluczem serwisowym.
--
-- Dlatego użytkownik ma tu prawo TYLKO do odczytu własnego wiersza. Gdyby
-- mógł pisać, wystarczyłoby jedno żądanie z konsoli przeglądarki, żeby
-- przyznać sobie dostęp do płatnych funkcji.
-- ============================================================

create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users (id) on delete cascade,

  -- Nazwy stanów jak w Stripe, żeby webhook nie musiał ich tłumaczyć.
  status      text not null default 'none'
              check (status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),

  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  price_id               text,

  /** Do kiedy opłacone. Po tej dacie dostęp gaśnie, nawet jeśli status został. */
  current_period_end     timestamptz,
  /** Rezygnacja z odnowienia — dostęp trwa do końca okresu. */
  cancel_at_period_end   boolean not null default false,

  trial_end   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Tylko odczyt własnego wiersza. Zapis idzie kluczem serwisowym z webhooka,
-- który RLS omija — i to jest cała ochrona tego mechanizmu.
drop policy if exists subscriptions_owner_read on public.subscriptions;
create policy subscriptions_owner_read on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.subscriptions to authenticated;

-- ------------------------------------------------------------
-- Czy ten użytkownik ma dostęp do płatnych funkcji
-- ------------------------------------------------------------
/**
 * Jedno miejsce, które o tym decyduje — używane i przez aplikację, i przez
 * polityki RLS. Administrator ma dostęp z urzędu: to konto właściciela
 * aplikacji, nie chcemy, żeby płacił sam sobie.
 *
 * Sam status nie wystarcza: Stripe potrafi zostawić 'active' po nieudanej
 * płatności aż do końca okresu ponawiania, więc sprawdzamy też datę.
 */
create or replace function public.has_pro(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select p.role = 'admin' from public.profiles p where p.id = p_user),
      false
    )
    or coalesce(
      (
        select s.status in ('active', 'trialing')
           and (s.current_period_end is null or s.current_period_end > now())
        from public.subscriptions s
        where s.user_id = p_user
      ),
      false
    );
$$;

grant execute on function public.has_pro(uuid) to authenticated;

-- ------------------------------------------------------------
-- Ustawienia aplikacji (cena, okres próbny)
-- ------------------------------------------------------------
/**
 * Cena ma być ustawieniem, a nie liczbą w kodzie — zmiana cennika nie może
 * wymagać wdrożenia. Czytać może każdy zalogowany (ekran subskrypcji musi
 * pokazać kwotę), pisać wyłącznie administrator.
 *
 * Uwaga: to jest tylko OPIS cennika do pokazania. Ile naprawdę zostanie
 * pobrane, decyduje cena po stronie Stripe'a.
 */
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values (
  'pricing',
  jsonb_build_object(
    'amount', 2900,
    'currency', 'PLN',
    'interval', 'month',
    'trial_days', 7,
    'enabled', false
  )
)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.app_settings to authenticated;
grant insert, update, delete on public.app_settings to authenticated;

-- ------------------------------------------------------------
-- Furtka dla webhooka Stripe'a
-- ------------------------------------------------------------
/*
 * Webhook musi zapisać wiersz, do którego użytkownik nie ma prawa pisać.
 * Naturalnym rozwiązaniem byłby klucz serwisowy Supabase w zmiennych Vercela —
 * ale ten klucz OMIJA CAŁE Row Level Security. Wyciek jednej zmiennej
 * środowiskowej oznaczałby wtedy dostęp do dzienników zdrowia wszystkich
 * użytkowników.
 *
 * Dlatego robimy furtkę tak wąską, jak się da: jedna funkcja, która potrafi
 * wyłącznie ustawić stan subskrypcji, chroniona osobnym sekretem. Gdyby ten
 * sekret wyciekł, najgorsze, co może się stać, to ktoś przyzna sobie dostęp
 * do płatnych funkcji. Żadnych cudzych danych.
 *
 * Sekret mieszka w schemacie `private`, którego PostgREST w ogóle nie
 * wystawia — nie da się go odczytać przez API nawet przypadkiem.
 */
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key   text primary key,
  value text not null
);

/**
 * Ustawia sekret webhooka. Wołane raz, ręcznie, z panelu SQL Supabase:
 *   select private.set_config_value('stripe_webhook_secret', 'losowy-ciag');
 */
create or replace function private.set_config_value(p_key text, p_value text)
returns void
language sql
as $$
  insert into private.config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
$$;

/**
 * Zapisuje stan subskrypcji przysłany przez webhook Stripe'a.
 *
 * Zwraca true, gdy zapis się udał. Błędny sekret to zwykłe false, bez
 * szczegółów — komunikat „nie ma takiego sekretu" byłby podpowiedzią dla
 * kogoś, kto próbuje zgadywać.
 */
create or replace function public.apply_subscription(
  p_secret       text,
  p_user_id      uuid,
  p_status       text,
  p_customer_id  text,
  p_subscription_id text,
  p_price_id     text,
  p_period_end   timestamptz,
  p_cancel_at_period_end boolean,
  p_trial_end    timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_secret text;
begin
  select value into v_secret from private.config where key = 'stripe_webhook_secret';

  -- Brak ustawionego sekretu również oznacza odmowę: pusty sekret nie może
  -- być hasłem, które pasuje do wszystkiego.
  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    return false;
  end if;

  if p_status not in ('none','trialing','active','past_due','canceled','incomplete') then
    return false;
  end if;

  insert into public.subscriptions as s
    (user_id, status, stripe_customer_id, stripe_subscription_id, price_id,
     current_period_end, cancel_at_period_end, trial_end)
  values
    (p_user_id, p_status, p_customer_id, p_subscription_id, p_price_id,
     p_period_end, coalesce(p_cancel_at_period_end, false), p_trial_end)
  on conflict (user_id) do update set
    status                 = excluded.status,
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, s.stripe_subscription_id),
    price_id               = coalesce(excluded.price_id, s.price_id),
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    trial_end              = excluded.trial_end;

  return true;
end;
$$;

-- Wykonanie wolno wywołać każdemu, bo bez sekretu funkcja i tak nic nie zrobi.
grant execute on function public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz
) to authenticated, anon;
