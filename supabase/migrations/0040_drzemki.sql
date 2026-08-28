-- ============================================================
-- Grind — Migracja 0040: drzemki osobno, nie jedną liczbą
--
-- Do tej pory drzemka była jedną kolumną `nap_min` na całą dobę. Trzy drzemki
-- po 20 minut i jedna sześćdziesięciominutowa wyglądały w bazie identycznie,
-- a dla organizmu są czymś innym: drzemka do pół godziny kończy się przed fazą
-- snu głębokiego, więc budzisz się wypoczęty i wieczorem nadal chce ci się
-- spać. Godzinna wchodzi w sen głęboki, daje otępienie po przebudzeniu i zjada
-- ciśnienie snu potrzebne w nocy.
--
-- Skoro to ma wpływać na wynik nocy, musi dać się rozróżnić. Stąd osobna
-- tabela: każda drzemka to wiersz, opcjonalnie z godziną rozpoczęcia (bo
-- drzemka o 20:00 kosztuje więcej niż ta o 13:00).
--
-- `sleep_logs.nap_min` znika. Zostawienie go obok tabeli znaczyłoby dwa źródła
-- tej samej prawdy i pytanie „które z nich jest aktualne" przy każdym zapisie.
-- Zamiast tego widok `v_sleep` liczy sumę z drzemek — dzięki temu wszystko,
-- co czyta `nap_min`, działa bez zmiany.
--
-- Drzemki NIE są podpięte do `sleep_logs`. Można się zdrzemnąć w dniu, którego
-- nocy się nie zapisało, i taki wiersz też ma prawo istnieć.
-- ============================================================

create table if not exists public.sleep_naps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  /** Dzień, w którym drzemka się odbyła — ta sama konwencja co w sleep_logs. */
  date       date not null default current_date,

  /** Godzina rozpoczęcia. Opcjonalna: nie każdy ją pamięta, a bez niej
      drzemka nadal się liczy — tylko bez kary za późną porę. */
  start_time time,

  minutes    integer not null check (minutes between 1 and 600),

  created_at timestamptz not null default now()
);

create index if not exists sleep_naps_user_idx
  on public.sleep_naps (user_id, date desc);

-- ------------------------------------------------------------
-- Przeniesienie tego, co już zapisano
--
-- Stara kolumna nie mówi, o której była drzemka ani na ile kawałków — więc
-- z jednej liczby robimy jedną drzemkę bez godziny. To jest wierne temu, co
-- naprawdę wiemy, i nie udaje wiedzy, której nie mamy.
-- ------------------------------------------------------------
insert into public.sleep_naps (user_id, date, minutes)
select user_id, date, nap_min
  from public.sleep_logs
 where nap_min > 0
   and not exists (
     select 1 from public.sleep_naps n
      where n.user_id = sleep_logs.user_id and n.date = sleep_logs.date
   );

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.sleep_naps enable row level security;

drop policy if exists sleep_naps_owner_all on public.sleep_naps;
create policy sleep_naps_owner_all on public.sleep_naps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.sleep_naps to authenticated;

-- ------------------------------------------------------------
-- Widok: nap_min jako suma, plus liczba drzemek
--
-- Kolumny na końcu, bo `create or replace view` pozwala dokładać wyłącznie
-- z tyłu. Kolejność i typy wcześniejszych muszą zostać co do jednej.
--
-- Rozbicie idzie razem z sumą, w tym samym wierszu. Gdyby każdy ekran musiał
-- dociągać drzemki osobnym zapytaniem, prędzej czy później któryś by tego nie
-- zrobił — i ta sama noc miałaby dwa różne wyniki, zależnie od tego, gdzie się
-- na nią patrzy.
-- ------------------------------------------------------------
create or replace view public.v_sleep
with (security_invoker = on) as
  select
    s.user_id,
    s.date,
    s.bedtime,
    s.wake_time,
    s.time_in_bed_min,
    greatest(0, s.time_in_bed_min - s.fell_asleep_min - s.awake_min) as sleep_min,
    s.fell_asleep_min,
    s.awakenings,
    s.awake_min,
    s.quality,
    s.morning_energy,
    coalesce(d.suma, 0)::integer as nap_min,
    s.factors,
    s.note,
    coalesce(d.ile, 0)::integer  as nap_count,
    coalesce(d.lista, '[]'::jsonb) as naps
  from public.sleep_logs s
  left join lateral (
    select
      sum(n.minutes)                        as suma,
      count(*)                              as ile,
      jsonb_agg(
        jsonb_build_object('minutes', n.minutes, 'start_time', n.start_time)
        order by n.start_time nulls last, n.created_at
      )                                     as lista
      from public.sleep_naps n
     where n.user_id = s.user_id and n.date = s.date
  ) d on true;

/*
 * Kolumny NIE kasujemy tutaj.
 *
 * Migracja wchodzi na bazę zanim nowy kod trafi na serwer, a stary wciąż
 * wpisuje `nap_min` przy zapisie nocy. Skasowanie jej w tym momencie
 * wywaliłoby zapisywanie snu wszystkim na te kilka minut, w których jedno
 * wyprzedza drugie. Zostaje jako martwa kolumna do migracji 0041, która
 * zdejmuje ją po wdrożeniu.
 */
comment on column public.sleep_logs.nap_min is
  'PRZESTARZAŁE od 0040. Prawdą jest tabela sleep_naps, a sumę podaje v_sleep. '
  'Kolumna czeka wyłącznie na migrację 0041 — nic jej już nie czyta.';

-- ------------------------------------------------------------
-- Sprawdzenie na miejscu
-- ------------------------------------------------------------
do $$
declare v_ile integer;
begin
  select count(*) into v_ile
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'sleep_naps' and c.relrowsecurity;
  if v_ile <> 1 then
    raise exception 'sleep_naps bez RLS';
  end if;

  if array_length(public.policies_rechecking_uid(), 1) > 0 then
    raise exception 'Polityka przeliczająca tożsamość co wiersz: %',
      public.policies_rechecking_uid();
  end if;
end;
$$;
