-- ============================================================
-- Grind — Migracja 0024: zgody, eksport i usunięcie konta
--
-- Aplikacja zbiera dane o zdrowiu: sen, ból, kontuzje, wagę. RODO traktuje
-- je jako SZCZEGÓLNĄ KATEGORIĘ (art. 9) — do ich przetwarzania nie wystarczy
-- „korzystanie z serwisu oznacza akceptację", potrzebna jest zgoda wyrażona
-- wprost i osobno.
--
-- Do tego dochodzą dwa prawa, które muszą działać, a nie być obietnicą
-- w regulaminie: prawo do kopii własnych danych i prawo do bycia zapomnianym.
-- ============================================================

/**
 * Wersja dokumentów, na którą człowiek się zgodził.
 *
 * Numer, a nie samo `true`: gdy regulamin się zmieni, trzeba wiedzieć, kto
 * widział którą wersję i kogo zapytać ponownie.
 */
alter table public.profiles
  add column if not exists terms_version smallint;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

/**
 * Osobna zgoda na przetwarzanie danych o zdrowiu.
 *
 * Trzymana oddzielnie od regulaminu celowo — art. 9 RODO wymaga zgody
 * odrębnej i jednoznacznej, a nie schowanej w akceptacji reszty.
 * Bez niej aplikacja ma działać dalej, tylko bez dziennika snu, bólu i wagi.
 */
alter table public.profiles
  add column if not exists health_consent_at timestamptz;

-- ------------------------------------------------------------
-- Usunięcie własnego konta
-- ------------------------------------------------------------
/**
 * Kasuje konto razem ze wszystkim, co po nim zostało.
 *
 * Wszystkie tabele mają `references auth.users on delete cascade`, więc
 * usunięcie wiersza z auth.users zabiera dziennik, plany, notatki i
 * subskrypcję. Sprzątanie ręczne byłoby listą, o której zawsze zapomina się
 * przy dodaniu nowej tabeli.
 *
 * SECURITY DEFINER, bo do auth.users zwykły użytkownik nie ma dostępu —
 * ale kasujemy WYŁĄCZNIE auth.uid(), więc nie da się tym ruszyć cudzego konta.
 */
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Brak zalogowanego użytkownika.';
  end if;

  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Trwałe usunięcie własnego konta. Kasuje wiersz z auth.users, a kaskady '
  'zabierają resztę. Działa tylko na koncie wywołującego.';
