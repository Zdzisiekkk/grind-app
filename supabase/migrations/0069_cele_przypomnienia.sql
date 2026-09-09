-- ============================================================
-- Grind — Migracja 0069: cel pilnowany albo cel po prostu
--
-- Cel oszczędnościowy bywa dwiema różnymi rzeczami. Czasem to zobowiązanie
-- z terminem, przy którym chcesz wiedzieć, że zaczynasz uciekać. Czasem to
-- zwykła etykieta na odkładane pieniądze - "kiedyś kupię" - i przypominanie
-- o niej jest wyłącznie hałasem.
--
-- Domyślnie CICHO. Przypomnienie to decyzja podejmowana świadomie przy
-- zakładaniu celu, a nie coś, co trzeba potem wyłączać.
--
-- "Nie wyrabiasz się" liczymy przez porównanie postępu z upływem czasu, ten
-- sam wzorzec co przy statusie dnia: cel na 8000 zł z terminem za rok, po
-- trzech miesiącach powinien mieć około ćwiartki. Bez terminu nie ma czego
-- pilnować i pilnowanie się nie włączy.
-- ============================================================

alter table public.finanse_cele
  add column if not exists przypominac boolean not null default false;

comment on column public.finanse_cele.przypominac is
  'Czy ostrzegać, gdy postęp odstaje od upływu czasu. Wymaga terminu (0069).';

/*
 * Widok trzeba postawić od nowa, a nie podmienić: `create or replace view`
 * pozwala tylko dopisywać kolumny na końcu, a poprzednia wersja miała
 * `c.*` rozwinięte w chwili tworzenia - nowa kolumna tabeli wypadłaby
 * w środku listy. Przy okazji wypisujemy kolumny wprost, żeby następna
 * zmiana w tabeli nie wysadzała widoku po cichu.
 */
drop view if exists public.v_finanse_cele;

create view public.v_finanse_cele
with (security_invoker = on) as
  select
    c.id,
    c.user_id,
    c.nazwa,
    c.ikona,
    c.kwota_cel,
    c.termin,
    c.status,
    c.order_index,
    c.created_at,
    c.updated_at,
    c.przypominac,
    coalesce(w.zebrane, 0) as zebrane,
    greatest(0, c.kwota_cel - coalesce(w.zebrane, 0)) as zostalo,
    least(100, round(100.0 * coalesce(w.zebrane, 0) / c.kwota_cel, 0))::integer as procent,
    w.ostatnia_wplata,

    -- Ile trzeba odkładać miesięcznie, żeby zdążyć. Bez terminu: null.
    case
      when c.termin is null or c.termin <= current_date then null
      else round(
        greatest(0, c.kwota_cel - coalesce(w.zebrane, 0))
        / greatest(1, round((c.termin - current_date) / 30.0, 2)),
        2)
    end as rata_potrzebna,

    case when c.termin is null then null else c.termin - current_date end as dni_do_terminu,

    /*
     * Ile procent celu powinno już być odłożone, licząc liniowo od założenia
     * do terminu. Punktem startu jest data założenia, nie początek miesiąca:
     * cel założony wczoraj z terminem za tydzień nie jest spóźniony.
     */
    case
      when c.termin is null then null
      when c.termin <= c.created_at::date then 100
      else least(100, greatest(0, round(
        100.0 * (current_date - c.created_at::date)
        / (c.termin - c.created_at::date)
      )))::integer
    end as oczekiwany_procent,

    /*
     * Spóźniony dopiero przy realnym odstępie. Dziesięć punktów luzu, bo
     * wpłaty idą skokami raz w miesiącu - alarm przy każdym odchyleniu
     * o jeden punkt wyłby przez trzy tygodnie z czterech.
     */
    case
      when not c.przypominac or c.termin is null or c.status <> 'aktywny' then false
      when coalesce(w.zebrane, 0) >= c.kwota_cel then false
      when c.termin < current_date then true
      else least(100, round(100.0 * coalesce(w.zebrane, 0) / c.kwota_cel, 0))
           < least(100, greatest(0, round(
               100.0 * (current_date - c.created_at::date)
               / greatest(1, c.termin - c.created_at::date)
             ))) - 10
    end as spozniony
  from public.finanse_cele c
  left join lateral (
    select sum(p.kwota) as zebrane, max(p.data) as ostatnia_wplata
      from public.finanse_wplaty p
     where p.cel_id = c.id
  ) w on true;

grant select on public.v_finanse_cele to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_cichy uuid;
  v_pilny uuid;
begin
  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0069@grind.local')
    returning id into v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Cel bez pilnowania: minął termin, nic nie odłożone, a mimo to cisza.
  insert into public.finanse_cele (user_id, nazwa, kwota_cel, termin, created_at)
       values (v_user, 'Kiedyś motocykl', 20000, current_date - 10, now() - interval '200 days')
    returning id into v_cichy;
  if (select spozniony from public.v_finanse_cele where id = v_cichy) then
    raise exception 'Migracja 0069: cichy cel wywołał alarm';
  end if;

  -- Ten sam stan, ale z włączonym pilnowaniem.
  insert into public.finanse_cele (user_id, nazwa, kwota_cel, termin, przypominac, created_at)
       values (v_user, 'Kaucja', 6000, current_date + 100, true, now() - interval '200 days')
    returning id into v_pilny;
  if not (select spozniony from public.v_finanse_cele where id = v_pilny) then
    raise exception 'Migracja 0069: pilnowany cel bez wpłat nie zgłosił spóźnienia';
  end if;

  -- Rata potrzebna do zdążenia liczy się z tego, ile zostało.
  if (select rata_potrzebna from public.v_finanse_cele where id = v_pilny) is null then
    raise exception 'Migracja 0069: brak raty potrzebnej mimo terminu w przyszłości';
  end if;

  -- Nadrobione wpłaty gaszą alarm.
  insert into public.finanse_wplaty (user_id, cel_id, kwota) values (v_user, v_pilny, 6000);
  if (select spozniony from public.v_finanse_cele where id = v_pilny) then
    raise exception 'Migracja 0069: zebrany cel dalej alarmuje';
  end if;

  -- Świeży cel z terminem za tydzień nie jest spóźniony pierwszego dnia.
  insert into public.finanse_cele (user_id, nazwa, kwota_cel, termin, przypominac)
       values (v_user, 'Prezent', 300, current_date + 7, true);
  if (select spozniony from public.v_finanse_cele where nazwa = 'Prezent') then
    raise exception 'Migracja 0069: świeży cel od razu uznany za spóźniony';
  end if;

  -- Bez terminu pilnowanie nie ma o co zaczepić i musi milczeć.
  insert into public.finanse_cele (user_id, nazwa, kwota_cel, przypominac)
       values (v_user, 'Bez terminu', 5000, true);
  if (select spozniony from public.v_finanse_cele where nazwa = 'Bez terminu') then
    raise exception 'Migracja 0069: cel bez terminu zgłosił spóźnienie';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
