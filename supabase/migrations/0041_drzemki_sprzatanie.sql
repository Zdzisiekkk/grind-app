-- ============================================================
-- Grind — Migracja 0041: koniec z sleep_logs.nap_min
--
-- Druga połowa zmiany z 0040. Tam kolumna musiała zostać, bo migracja wchodzi
-- na bazę wcześniej niż nowy kod na serwer, a stary jeszcze do niej pisał.
-- Teraz nikt jej już nie dotyka: prawdą o drzemkach jest tabela sleep_naps,
-- a sumę i rozbicie podaje widok v_sleep.
--
-- Uruchamiać PO wdrożeniu kodu, nie przed.
-- ============================================================

alter table public.sleep_logs drop column if exists nap_min;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'sleep_logs'
       and column_name = 'nap_min'
  ) then
    raise exception 'sleep_logs.nap_min nadal istnieje — dwa źródła prawdy o drzemkach';
  end if;
end;
$$;
