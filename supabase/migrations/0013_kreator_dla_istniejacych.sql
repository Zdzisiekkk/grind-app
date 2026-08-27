-- ============================================================
-- Grind — Migracja 0013: kto już korzysta, tego kreator nie zaczepia
--
-- Kreator startowy odpala się wszystkim, którzy mają puste onboarded_at.
-- Bez tej migracji porwałby też osoby, które używają aplikacji od miesięcy —
-- i nadpisałby im cele kaloryczne wyliczonymi ze wzoru. Dlatego każdego,
-- kto zostawił po sobie jakikolwiek ślad, oznaczamy jako „przeszedł".
--
-- Datą jest moment założenia konta, a nie now(): to bliżej prawdy niż
-- udawanie, że wszyscy przeszli kreator w dniu wdrożenia.
-- ============================================================

update public.profiles p
   set onboarded_at = p.created_at
 where p.onboarded_at is null
   and (
     exists (select 1 from public.plans           x where x.user_id = p.id)
     or exists (select 1 from public.workout_sessions x where x.user_id = p.id)
     or exists (select 1 from public.meals        x where x.user_id = p.id)
     or exists (select 1 from public.body_weight_logs x where x.user_id = p.id)
     or exists (select 1 from public.habits       x where x.user_id = p.id)
     or exists (select 1 from public.injuries     x where x.user_id = p.id)
     or exists (select 1 from public.activities   x where x.user_id = p.id)
     -- Cel kaloryczny ustawiony ręcznie też znaczy, że ktoś tu już był.
     or p.daily_kcal is not null
   );

-- Cel treningów tygodniowo miał do tej pory zaszytą w kodzie czwórkę.
-- Kto już trenuje, dostaje ją wpisaną wprost, żeby Health Score liczył
-- to samo co wcześniej — a nie żeby wynik skoczył bez powodu.
update public.profiles p
   set weekly_workouts = 4
 where p.weekly_workouts is null
   and p.onboarded_at is not null;
