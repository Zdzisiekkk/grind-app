-- ============================================================
-- Grind — Migracja 0075: funkcje przestają odpowiadać na cudze pytania
--
-- Reguły dostępu do TABEL są szczelne: każda tabela z user_id ma RLS
-- i politykę, każdy widok chodzi z prawami pytającego. Ale obok tabel stoją
-- funkcje SECURITY DEFINER, które z definicji działają z prawami właściciela
-- bazy - i trzy z nich przyjmowały identyfikator użytkownika jako ARGUMENT.
--
-- To znaczyło dokładnie tyle: zalogowana osoba mogła wywołać
-- finanse_zarezerwowane('<cudze id>') i dostać odpowiedź. Nie przez dziurę
-- w RLS - RLS w ogóle nie ma tu głosu, bo funkcja omija go z założenia.
--
-- Trzy warstwy naprawy:
--
--   1. Funkcje pomocnicze z argumentem `p_user` tracą prawo wykonania dla
--      zalogowanych. Wołają je wyłącznie inne funkcje SECURITY DEFINER,
--      a te sprawdzają uprawnienia jako właściciel, nie jako człowiek.
--   2. plan_poziom i has_pro przestają odpowiadać na pytania o cudze konta.
--      Status subskrypcji to też czyjaś prywatna sprawa.
--   3. Funkcje zwracające właściciela wiersza mówią teraz tylko "to Twoje"
--      albo nic. Polityki porównują wynik z auth.uid(), więc null działa
--      identycznie jak cudze id - a przestaje być odpowiedzią na pytanie
--      "czyje to jest".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pomocnicze liczydła: tylko dla wnętrza bazy
-- ------------------------------------------------------------
revoke execute on function public.finanse_koszty_stale(uuid) from authenticated;
revoke execute on function public.finanse_zarezerwowane(uuid) from authenticated;
revoke execute on function public.finanse_dzienny_limit(uuid, date) from authenticated;

-- ------------------------------------------------------------
-- 2. Poziom planu wyłącznie o sobie
--
-- Administrator zostaje wyjątkiem, bo bez tego nie da się nikomu pomóc
-- ani sprawdzić, czy płatność się zaksięgowała.
-- ------------------------------------------------------------
create or replace function public.plan_poziom(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Pytanie o cudzy plan nie dostaje odpowiedzi. Zero, nie wyjątek:
    -- funkcja jest wołana w politykach i wyjątek wysadzałby zapytania
    -- zamiast po prostu niczego nie ujawniać.
    when p_user is distinct from auth.uid() and not public.is_admin() then 0
    when public.is_admin() and p_user = auth.uid() then 2
    else greatest(
      coalesce((
        select case when s.plan = 'starter' then 1 else 2 end
          from public.subscriptions s
         where s.user_id = p_user
           and s.status in ('active', 'trialing')
           and (s.current_period_end is null or s.current_period_end > now())
         order by case when s.plan = 'starter' then 1 else 2 end desc
         limit 1
      ), 0),
      coalesce((
        select case when b.plan = 'starter' then 1 else 2 end
          from public.bonus_plan b
         where b.user_id = p_user
           and (b.do_kiedy is null or b.do_kiedy > now())
         order by case when b.plan = 'starter' then 1 else 2 end desc
         limit 1
      ), 0)
    )
  end;
$$;

revoke all on function public.plan_poziom(uuid) from public, anon;
grant execute on function public.plan_poziom(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Właściciel wiersza: "to Twoje" albo nic
--
-- Polityki używają tych funkcji w postaci `wlasciciel(id) = auth.uid()`,
-- więc null zachowuje się tak samo jak cudze id - dostęp odmówiony.
-- Zmienia się wyłącznie to, czego można się z nich dowiedzieć.
-- ------------------------------------------------------------
create or replace function public.finanse_cel_wlasciciel(p_cel_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.user_id from public.finanse_cele c
   where c.id = p_cel_id and c.user_id = (select auth.uid());
$$;

create or replace function public.finanse_zrodlo_wlasciciel(p_zrodlo_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select z.user_id from public.finanse_zrodla z
   where z.id = p_zrodlo_id and z.user_id = (select auth.uid());
$$;

create or replace function public.finanse_stale_wlasciciel(p_stale_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.user_id from public.finanse_stale s
   where s.id = p_stale_id and s.user_id = (select auth.uid());
$$;

create or replace function public.finanse_pozycja_wlasciciel(p_pozycja_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.user_id from public.finanse_pozycje p
   where p.id = p_pozycja_id and p.user_id = (select auth.uid());
$$;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_a uuid;
  v_b uuid;
  v_cel uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0075-a@grind.local') returning id into v_a;
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0075-b@grind.local') returning id into v_b;

  -- A zakłada dane.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  insert into public.finanse_stale (user_id, nazwa, kwota) values (v_a, 'Czynsz A', 2500);
  insert into public.finanse_cele (user_id, nazwa, kwota_cel)
       values (v_a, 'Cel A', 10000) returning id into v_cel;
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_a, v_cel, 4000);

  -- B pyta o A.
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  if public.finanse_cel_wlasciciel(v_cel) is not null then
    raise exception 'Migracja 0075: funkcja zdradziła właściciela cudzego celu';
  end if;

  if public.plan_poziom(v_a) <> 0 then
    raise exception 'Migracja 0075: B poznał poziom planu A';
  end if;

  if public.has_pro(v_a) then
    raise exception 'Migracja 0075: B dowiedział się o subskrypcji A';
  end if;

  -- Prawo wykonania liczydeł ma być odebrane, a nie tylko "trudne do trafienia".
  if has_function_privilege('authenticated', 'public.finanse_zarezerwowane(uuid)', 'EXECUTE') then
    raise exception 'Migracja 0075: zalogowani dalej mogą wołać finanse_zarezerwowane';
  end if;
  if has_function_privilege('authenticated', 'public.finanse_koszty_stale(uuid)', 'EXECUTE') then
    raise exception 'Migracja 0075: zalogowani dalej mogą wołać finanse_koszty_stale';
  end if;
  if has_function_privilege('authenticated', 'public.finanse_dzienny_limit(uuid, date)', 'EXECUTE') then
    raise exception 'Migracja 0075: zalogowani dalej mogą wołać finanse_dzienny_limit';
  end if;

  -- A dalej widzi swoje - uszczelnienie nie może zepsuć własnego dostępu.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  if public.finanse_cel_wlasciciel(v_cel) <> v_a then
    raise exception 'Migracja 0075: właściciel przestał rozpoznawać własny cel';
  end if;
  if (public.finanse_podsumowanie() ->> 'zarezerwowane')::numeric <> 4000 then
    raise exception 'Migracja 0075: podsumowanie straciło dostęp do własnych liczydeł';
  end if;
  if (public.finanse_podsumowanie() ->> 'koszty_miesieczne')::numeric <> 2500 then
    raise exception 'Migracja 0075: koszty z szablonu przestały się liczyć';
  end if;

  -- Wpłata na własny cel dalej przechodzi przez politykę.
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_a, v_cel, 100);

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id in (v_a, v_b);
end;
$$;
