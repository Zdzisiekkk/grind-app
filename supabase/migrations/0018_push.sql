-- ============================================================
-- Grind — Migracja 0018: powiadomienia w tle
--
-- Do tej pory przypomnienia działały tylko przy otwartej aplikacji — czyli
-- dokładnie wtedy, gdy i tak nie były potrzebne. Web Push wysyła je nawet
-- przy zamkniętej apce, ale wymaga dwóch rzeczy: zapisanej subskrypcji
-- przeglądarki i czegoś, co obudzi serwer o właściwej porze.
--
-- Harmonogram robi pg_cron w Supabase, a nie cron Vercela: darmowy plan
-- Vercela daje jedno uruchomienie DZIENNIE, co przy przypomnieniu o wodzie
-- co półtorej godziny jest bezużyteczne.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  -- Adres nadany przez przeglądarkę. Jest unikalny na urządzenie, więc
  -- służy nam za klucz — dzięki temu ponowne włączenie powiadomień na tym
  -- samym telefonie nadpisuje wpis zamiast tworzyć duplikat.
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,

  /** Do rozpoznania urządzenia na liście: „iPhone (Safari)". */
  label      text,
  /** Kiedy ostatnio udało się coś wysłać — martwe wpisy sprzątamy. */
  last_ok_at timestamptz,
  failures   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_owner_all on public.push_subscriptions;
create policy push_subscriptions_owner_all on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Żeby to samo powiadomienie nie przyszło dwa razy, gdy cron odpali się
-- gęściej albo serwer odpowie z opóźnieniem.
create table if not exists public.push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  /** Klucz zdarzenia, np. 'water:3' albo 'habit:<uuid>' — jak przy
      przypomnieniach w aplikacji. */
  key     text not null,
  date    date not null default current_date,
  sent_at timestamptz not null default now(),
  primary key (user_id, key, date)
);

alter table public.push_sent enable row level security;

drop policy if exists push_sent_owner_read on public.push_sent;
create policy push_sent_owner_read on public.push_sent
  for select to authenticated using (user_id = auth.uid());

grant select on public.push_sent to authenticated;

-- ------------------------------------------------------------
-- Harmonogram
-- ------------------------------------------------------------
/**
 * Ustawia (albo przestawia) budzik wysyłający powiadomienia.
 *
 * Adres i sekret trzymamy w schemacie `private`, którego PostgREST nie
 * wystawia — ten sam wzorzec co przy webhooku Stripe'a. Wywołanie jest
 * ręczne, raz, po wdrożeniu:
 *
 *   select private.schedule_push('https://…/api/push/send', 'sekret');
 *
 * Co 15 minut wystarcza: przypomnienia mają okno tolerancji, a częstsze
 * budzenie to koszt bez korzyści.
 */
create or replace function private.schedule_push(p_url text, p_secret text)
returns text
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_job text := 'grind-push';
begin
  perform private.set_config_value('push_endpoint', p_url);
  perform private.set_config_value('push_cron_secret', p_secret);

  -- cron.unschedule wysypuje się, gdy zadania nie ma — stąd sprawdzenie.
  if exists (select 1 from cron.job where jobname = v_job) then
    perform cron.unschedule(v_job);
  end if;

  perform cron.schedule(
    v_job,
    '*/15 * * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-grind-cron', %L),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );$cmd$,
      p_url, p_secret
    )
  );

  return v_job;
end;
$$;

/** Wyłączenie budzika — na wypadek, gdyby trzeba było go szybko uciszyć. */
create or replace function private.unschedule_push()
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
begin
  if exists (select 1 from cron.job where jobname = 'grind-push') then
    perform cron.unschedule('grind-push');
  end if;
end;
$$;
