-- ============================================================
-- Grind — Migracja 0031: webhook Stripe'a odporny na kolejność
--
-- Problem znaleziony w przeglądzie kodu.
--
-- Podpis zdarzenia był sprawdzany prawidłowo i to najważniejsze. Brakowało
-- drugiej rzeczy: Stripe NIE gwarantuje kolejności doręczeń i ponawia te,
-- które się nie udały. Dwa zdarzenia `customer.subscription.updated` mogą
-- dotrzeć odwrotnie, niż powstały — a wtedy starszy stan nadpisuje nowszy.
--
-- Konkretny scenariusz: ktoś anuluje subskrypcję i od razu wykupuje ją
-- ponownie. Jeśli zdarzenie o anulowaniu dotrze jako drugie, człowiek traci
-- dostęp mimo opłaconej subskrypcji — i nie ma jak tego zauważyć poza
-- zgłoszeniem od niego.
--
-- Rozwiązanie: zapamiętujemy znacznik czasu ostatnio zastosowanego zdarzenia
-- i jego identyfikator. Zdarzenie starsze albo już widziane jest przyjmowane
-- (żeby Stripe przestał ponawiać), ale nic nie zmienia.
-- ============================================================

alter table public.subscriptions
  add column if not exists last_event_at timestamptz,
  add column if not exists last_event_id text;

comment on column public.subscriptions.last_event_at is
  'Czas powstania ostatnio zastosowanego zdarzenia Stripe''a. Starsze są mijane, '
  'bo doręczenia nie przychodzą w kolejności.';

-- Stara sygnatura znika: nowa ma dwa dodatkowe parametry i nie chcemy, żeby
-- webhook mógł przypadkiem trafić w wersję bez ochrony kolejności.
drop function if exists public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz
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
  p_event_at     timestamptz default null
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

  select last_event_at, last_event_id into v_last_at, v_last_id
    from public.subscriptions where user_id = p_user_id;

  -- To samo zdarzenie drugi raz: Stripe ponawia doręczenia. Odpowiadamy
  -- „przyjęte”, żeby przestał, ale niczego nie ruszamy.
  if p_event_id is not null and v_last_id is not null and p_event_id = v_last_id then
    return true;
  end if;

  -- Zdarzenie starsze niż ostatnio zastosowane. Doręczenia nie przychodzą
  -- w kolejności, więc to jest normalne, a nie błąd.
  if p_event_at is not null and v_last_at is not null and p_event_at < v_last_at then
    return true;
  end if;

  insert into public.subscriptions as s
    (user_id, status, stripe_customer_id, stripe_subscription_id, price_id,
     current_period_end, cancel_at_period_end, trial_end, last_event_at, last_event_id)
  values
    (p_user_id, p_status, p_customer_id, p_subscription_id, p_price_id,
     p_period_end, coalesce(p_cancel_at_period_end, false), p_trial_end,
     p_event_at, p_event_id)
  on conflict (user_id) do update set
    status                 = excluded.status,
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
  'powtórzone i spóźnione zdarzenia Stripe''a.';

-- Wykonanie wolno wywołać każdemu, bo bez sekretu funkcja i tak nic nie zrobi.
grant execute on function public.apply_subscription(
  text, uuid, text, text, text, text, timestamptz, boolean, timestamptz, text, timestamptz
) to authenticated, anon;
