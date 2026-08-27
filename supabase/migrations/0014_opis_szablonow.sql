-- ============================================================
-- Grind — Migracja 0014: każdy publiczny szablon musi się przedstawić
--
-- Kreator dobiera plan po trzech polach: days_per_week, level, equipment.
-- Szablon, który ich nie ma, jest dla kreatora niewidzialny — a użytkownik
-- widzi go dopiero na liście planów, bez informacji, ile dni zajmuje i czy
-- potrzeba do niego siłowni.
--
-- Migracja 0012 uzupełniła opis starego szablonu z 0005, ale przeoczyła ten
-- z 0007, który go zastąpił. Tu domykamy sprawę i zostawiamy sieć
-- bezpieczeństwa na przyszłość.
-- ============================================================

update public.plans
   set days_per_week = coalesce(days_per_week, 4),
       level         = coalesce(level, 'intermediate'),
       equipment     = coalesce(equipment, 'gym'),
       tags          = case when tags = '{}' then array['rehab', 'combat'] else tags end
 where user_id is null
   and is_template
   and name = 'Plan treningowy: Siłownia + MMA';

-- Sieć bezpieczeństwa: gdy w przyszłości ktoś doda publiczny szablon i zapomni
-- o opisie, dostanie wartości domyślne zamiast zniknąć z kreatora. Liczba dni
-- bierze się z tego, ile dni faktycznie ma plan — to jedyna z tych trzech
-- rzeczy, którą da się uczciwie policzyć z danych.
update public.plans p
   set days_per_week = coalesce(
         p.days_per_week,
         least(7, greatest(1, (
           select count(*)
             from public.workout_days d
             join public.phases f on f.id = d.phase_id
            where f.plan_id = p.id
         )))::smallint
       ),
       level     = coalesce(p.level, 'intermediate'),
       equipment = coalesce(p.equipment, 'gym')
 where p.user_id is null
   and p.is_template
   and p.is_public
   and (p.days_per_week is null or p.level is null or p.equipment is null);
