-- ============================================================
-- Grind — Migracja 0012: pięć gotowych planów do wyboru
--
-- Każdy jest szablonem publicznym (user_id IS NULL), więc kreator kopiuje go
-- na konto użytkownika przez public.clone_plan — od tego momentu jest jego
-- własnością i może go dowolnie zmieniać.
--
-- Doboru pilnuje trójka pól: days_per_week, level, equipment. Kreator zadaje
-- pytania dokładnie o to i nie musi znać nazw planów.
-- ============================================================

/**
 * Migracja 0005 kasuje ten pomocnik na końcu swojego pliku, żeby nie zostawiać
 * śmieci w schemacie — więc odtwarzamy go tutaj. Na końcu tego pliku robimy
 * to samo.
 */
create or replace function public.seed_add_exercise(
  p_day   uuid,
  p_slug  text,
  p_sets  integer,
  p_reps  text,
  p_order integer,
  p_note  text default null
)
returns void
language plpgsql
as $$
declare
  v_ex uuid;
  v_mg text;
begin
  select id, muscle_group into v_ex, v_mg
  from public.exercise_catalog
  where slug = p_slug and user_id is null;

  if v_ex is null then
    raise exception 'Brak ćwiczenia w katalogu globalnym: %', p_slug;
  end if;

  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, muscle_group, target_sets, target_reps, target_note, order_index)
  values
    (p_day, v_ex, v_mg, p_sets, p_reps, p_note, p_order);
end;
$$;

/**
 * Zakłada szablon razem z jedyną fazą i zwraca jej identyfikator.
 * Gdy plan o tej nazwie już istnieje, zwraca NULL — wywołujący ma wtedy
 * pominąć całą resztę i nie zdublować dni.
 */
create or replace function public.seed_template_plan(
  p_name        text,
  p_description text,
  p_goal        text,
  p_days        integer,   -- integer, nie smallint: literał 3 w wywołaniu
                            -- jest typu integer, a Postgres nie zawęża go
                            -- automatycznie przy dobieraniu funkcji
  p_level       text,
  p_equipment   text,
  p_tags        text[]
)
returns uuid
language plpgsql
as $$
declare
  v_plan  uuid;
  v_phase uuid;
begin
  if exists (
    select 1 from public.plans
    where user_id is null and is_template and name = p_name
  ) then
    return null;
  end if;

  insert into public.plans
    (user_id, name, description, goal, is_template, is_public, source,
     days_per_week, level, equipment, tags)
  values
    (null, p_name, p_description, p_goal, true, true, 'template',
     p_days::smallint, p_level, p_equipment, p_tags)
  returning id into v_plan;

  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (v_plan, 'Plan', p_description, p_days || '× w tygodniu', 1)
  returning id into v_phase;

  return v_phase;
end;
$$;

/** Dzień treningowy w fazie — skrót, żeby poniżej był widoczny sam plan. */
create or replace function public.seed_day(
  p_phase uuid,
  p_name  text,
  p_type  text,
  p_order integer,
  p_desc  text default null
)
returns uuid
language plpgsql
as $$
declare
  v_day uuid;
begin
  insert into public.workout_days (phase_id, name, day_type, description, order_index)
  values (p_phase, p_name, p_type, p_desc, p_order)
  returning id into v_day;
  return v_day;
end;
$$;

-- ------------------------------------------------------------
-- 1. Full body 3× — dla kogoś, kto zaczyna albo wraca po przerwie
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Full body 3× w tygodniu',
    'Całe ciało na każdym treningu, trzy razy w tygodniu z dniem przerwy pomiędzy. Najlepszy start dla kogoś, kto zaczyna albo wraca po dłuższej przerwie: każdy ruch powtarza się co drugi trening, więc technika wchodzi szybko.',
    'Nauka techniki i pierwsza siła', 3, 'beginner', 'gym',
    array['strength', 'muscle']
  );
  if v_p is null then raise notice 'Full body 3× już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Dzień A', 'gym', 1, 'Przysiad, wyciskanie, wiosłowanie.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 3, '8', 1, 'Zacznij od samego gryfu i dokładaj po 2,5 kg tygodniowo.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-sztangi-lawka-plaska', 3, '8', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-sztanga-w-opadzie', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'plank', 3, '30 s', 4);

  v_d := public.seed_day(v_p, 'Dzień B', 'gym', 2, 'Zawias w biodrze, wyciskanie nad głowę, ciąg pionowy.');
  perform public.seed_add_exercise(v_d, 'martwy-ciag-rumunski-hantle', 3, '10', 1);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-nad-glowa', 3, '10', 2);
  perform public.seed_add_exercise(v_d, 'podciaganie-sciaganie-drazka', 3, '10', 3, 'Nie robisz jeszcze podciągnięć? Ta sama technika na wyciągu górnym.');
  perform public.seed_add_exercise(v_d, 'dead-bug', 3, '10', 4);

  v_d := public.seed_day(v_p, 'Dzień C', 'gym', 3, 'Lżejszy akcent, więcej zakresu ruchu.');
  perform public.seed_add_exercise(v_d, 'goblet-squat', 3, '12', 1);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-lawka-skosna', 3, '10', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-hantla-jednoracz', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'face-pull', 3, '15', 4, 'Zdrowie barków — nie pomijaj, nawet gdy się spieszysz.');
  perform public.seed_add_exercise(v_d, 'plank', 3, '40 s', 5);
end $$;

-- ------------------------------------------------------------
-- 2. Góra / dół 4× — pierwszy krok po full body
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Góra / dół 4× w tygodniu',
    'Dwa treningi górnej partii i dwa dolnej. Naturalny krok po full body: więcej objętości na partię, a każda z nich wraca dwa razy w tygodniu — czyli wciąż wystarczająco często, żeby rosnąć.',
    'Siła i masa mięśniowa', 4, 'intermediate', 'gym',
    array['muscle', 'strength']
  );
  if v_p is null then raise notice 'Góra / dół 4× już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Góra A — ciężko', 'gym', 1, 'Nacisk na wyciskanie poziome i ciąg poziomy.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-sztangi-lawka-plaska', 4, '6-8', 1);
  perform public.seed_add_exercise(v_d, 'wioslowanie-sztanga-w-opadzie', 4, '8', 2);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-nad-glowa', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'podciaganie-sciaganie-drazka', 3, 'maks', 4);
  perform public.seed_add_exercise(v_d, 'face-pull', 3, '15', 5);

  v_d := public.seed_day(v_p, 'Dół A — przysiad', 'gym', 2, 'Kolanowy akcent.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 4, '6-8', 1);
  perform public.seed_add_exercise(v_d, 'martwy-ciag-rumunski-hantle', 3, '10', 2);
  perform public.seed_add_exercise(v_d, 'prostownik-nog', 3, '12', 3);
  perform public.seed_add_exercise(v_d, 'lydki-maszyna', 4, '15', 4);

  v_d := public.seed_day(v_p, 'Góra B — objętość', 'gym', 3, 'Ten sam wzorzec, lżej i w wyższych zakresach.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-lawka-skosna', 4, '8-10', 1);
  perform public.seed_add_exercise(v_d, 'podciaganie-sciaganie-drazka', 4, '8-10', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-hantla-jednoracz', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'uginanie-ramion-sztanga', 3, '12', 4);
  perform public.seed_add_exercise(v_d, 'prostowanie-ramion-wyciag', 3, '12', 5);

  v_d := public.seed_day(v_p, 'Dół B — zawias', 'gym', 4, 'Biodrowy akcent, tylny łańcuch.');
  perform public.seed_add_exercise(v_d, 'martwy-ciag-sztanga', 4, '5', 1, 'Technika przed ciężarem. Plecy proste od pierwszego do ostatniego powtórzenia.');
  perform public.seed_add_exercise(v_d, 'wypady', 3, '10 na nogę', 2);
  perform public.seed_add_exercise(v_d, 'hip-thrust', 3, '12', 3);
  perform public.seed_add_exercise(v_d, 'wyciskanie-nog-suwnica', 3, '12', 4);
  perform public.seed_add_exercise(v_d, 'plank', 3, '45 s', 5);
end $$;

-- ------------------------------------------------------------
-- 3. Push / Pull / Legs 5× — dla kogoś z przebiegiem
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Push / Pull / Legs 5× w tygodniu',
    'Pchanie, ciągnięcie i nogi, pięć razy w tygodniu. Dużo objętości na partię, ale wymaga regularności i porządnego snu — przy czterech treningach zamiast pięciu lepiej wybrać góra/dół.',
    'Masa mięśniowa', 5, 'advanced', 'gym',
    array['muscle']
  );
  if v_p is null then raise notice 'Push / Pull / Legs 5× już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Push A', 'gym', 1, 'Klatka, barki, triceps — ciężko.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-sztangi-lawka-plaska', 4, '6-8', 1);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-nad-glowa', 3, '10', 2);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-lawka-skosna', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'prostowanie-ramion-wyciag', 3, '12', 4);

  v_d := public.seed_day(v_p, 'Pull A', 'gym', 2, 'Plecy i biceps — ciężko.');
  perform public.seed_add_exercise(v_d, 'martwy-ciag-sztanga', 3, '5', 1);
  perform public.seed_add_exercise(v_d, 'podciaganie-sciaganie-drazka', 4, '8', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-sztanga-w-opadzie', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'face-pull', 3, '15', 4);
  perform public.seed_add_exercise(v_d, 'uginanie-ramion-sztanga', 3, '12', 5);

  v_d := public.seed_day(v_p, 'Nogi', 'gym', 3, 'Cały dół w jednym dniu.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 4, '6-8', 1);
  perform public.seed_add_exercise(v_d, 'wyciskanie-nog-suwnica', 3, '12', 2);
  perform public.seed_add_exercise(v_d, 'martwy-ciag-rumunski-hantle', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'prostownik-nog', 3, '12', 4);
  perform public.seed_add_exercise(v_d, 'lydki-maszyna', 4, '15', 5);

  v_d := public.seed_day(v_p, 'Push B', 'gym', 4, 'To samo lżej, w wyższych zakresach.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-lawka-skosna', 4, '8-10', 1);
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-nad-glowa', 4, '8-10', 2);
  perform public.seed_add_exercise(v_d, 'face-pull', 3, '15', 3);
  perform public.seed_add_exercise(v_d, 'prostowanie-ramion-wyciag', 3, '15', 4);

  v_d := public.seed_day(v_p, 'Pull B', 'gym', 5, 'Objętość i chwyt.');
  perform public.seed_add_exercise(v_d, 'podciaganie-sciaganie-drazka', 4, '10', 1);
  perform public.seed_add_exercise(v_d, 'wioslowanie-hantla-jednoracz', 4, '10', 2);
  perform public.seed_add_exercise(v_d, 'rotacje-tulowia-wyciag', 3, '15', 3);
  perform public.seed_add_exercise(v_d, 'uginanie-ramion-sztanga', 3, '15', 4);
  perform public.seed_add_exercise(v_d, 'wisy-na-drazku', 3, 'maks', 5);
end $$;

-- ------------------------------------------------------------
-- 4. Siła pod sporty walki 3×
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Siła pod sporty walki 3×',
    'Siłownia ma dokładać mocy do walki, a nie zabierać ją przed sparingiem — dlatego mało powtórzeń, dużo prędkości i żadnego dobijania się do upadku. Trzy dni zostawiają miejsce na treningi na macie.',
    'Moc i siła bez utraty świeżości', 3, 'intermediate', 'gym',
    array['combat', 'strength']
  );
  if v_p is null then raise notice 'Siła pod sporty walki już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Siła', 'gym', 1, 'Ciężko, ale z zapasem — kończ serię, mając jeszcze dwa powtórzenia w baku.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 4, '5', 1, 'Zostaw 2 powtórzenia zapasu. Zajechany dół nogi to gorszy sparing w środę.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-sztangi-lawka-plaska', 4, '5', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-sztanga-w-opadzie', 3, '8', 3);
  perform public.seed_add_exercise(v_d, 'spacer-farmera', 3, '40 m', 4, 'Chwyt i tułów — obie rzeczy w klinczu decydują.');

  v_d := public.seed_day(v_p, 'Moc i szybkość', 'gym', 2, 'Wszystko z maksymalną prędkością, długie przerwy.');
  perform public.seed_add_exercise(v_d, 'box-jump', 5, '3', 1, 'Jakość skoku, nie zmęczenie. Gdy lądowanie robi się miękkie, kończysz.');
  perform public.seed_add_exercise(v_d, 'rzuty-pilka-lekarska-rotacyjne', 4, '6 na stronę', 2);
  perform public.seed_add_exercise(v_d, 'lateral_bound', 3, '6 na stronę', 3);
  perform public.seed_add_exercise(v_d, 'sprint', 6, '20 m', 4);
  perform public.seed_add_exercise(v_d, 'band_punch', 3, '10 na stronę', 5);

  v_d := public.seed_day(v_p, 'Kondycja i mobilność', 'conditioning', 3, 'Dzień, który ma poprawiać samopoczucie, a nie je zabierać.');
  perform public.seed_add_exercise(v_d, 'jump_rope', 5, '3 min', 1);
  perform public.seed_add_exercise(v_d, 'heavy_bag', 5, '3 min', 2);
  perform public.seed_add_exercise(v_d, 'thoracic_rotation', 2, '10 na stronę', 3);
  perform public.seed_add_exercise(v_d, 'shoulder_cars', 2, '5 na stronę', 4);
  perform public.seed_add_exercise(v_d, 'hip_circles', 2, '10 na stronę', 5);
  perform public.seed_add_exercise(v_d, 'deska-boczna', 3, '30 s na stronę', 6);
end $$;

-- ------------------------------------------------------------
-- 5. W domu, bez sprzętu 3×
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'W domu bez sprzętu 3×',
    'Cały plan robisz na podłodze i na krześle — nie potrzebujesz karnetu, hantli ani drążka. Progres robi się tu liczbą powtórzeń i trudniejszą wersją ruchu, a nie ciężarem.',
    'Forma i siła bez siłowni', 3, 'beginner', 'home',
    array['fatloss', 'strength']
  );
  if v_p is null then raise notice 'Plan domowy już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Dzień A', 'gym', 1, 'Pchanie i nogi.');
  perform public.seed_add_exercise(v_d, 'pompki', 4, 'maks', 1, 'Za trudne? Oprzyj dłonie o stół albo parapet — im wyżej, tym łatwiej.');
  perform public.seed_add_exercise(v_d, 'przysiad-masa-ciala', 4, '20', 2);
  perform public.seed_add_exercise(v_d, 'most-biodrowy', 3, '15', 3);
  perform public.seed_add_exercise(v_d, 'plank', 3, '45 s', 4);

  v_d := public.seed_day(v_p, 'Dzień B', 'gym', 2, 'Jedna noga i tył ciała.');
  perform public.seed_add_exercise(v_d, 'przysiad-bulgarski', 3, '12 na nogę', 1);
  perform public.seed_add_exercise(v_d, 'pompki-diamentowe', 3, 'maks', 2);
  perform public.seed_add_exercise(v_d, 'superman', 3, '15', 3);
  perform public.seed_add_exercise(v_d, 'hollow-hold', 3, '30 s', 4);

  v_d := public.seed_day(v_p, 'Dzień C', 'conditioning', 3, 'Szybciej, krótsze przerwy.');
  perform public.seed_add_exercise(v_d, 'burpees', 4, '10', 1);
  perform public.seed_add_exercise(v_d, 'wypady-w-miejscu', 3, '16', 2);
  perform public.seed_add_exercise(v_d, 'dipy-na-krzesle', 3, '12', 3);
  perform public.seed_add_exercise(v_d, 'wspinaczka-gorska', 4, '40 s', 4);
  perform public.seed_add_exercise(v_d, 'unoszenie-nog-lezac', 3, '12', 5);
end $$;

-- ------------------------------------------------------------
-- Stary szablon też dostaje opis, inaczej kreator by go nie zobaczył
-- ------------------------------------------------------------
update public.plans
   set days_per_week = coalesce(days_per_week, 4),
       level         = coalesce(level, 'intermediate'),
       equipment     = coalesce(equipment, 'gym'),
       tags          = case when tags = '{}' then array['rehab', 'combat'] else tags end
 where user_id is null
   and is_template
   and name = 'Powrót po kontuzji kolana + MMA';

-- Sprzątamy po sobie: pomocniki są potrzebne tylko na czas tej migracji.
drop function if exists public.seed_add_exercise(uuid, text, integer, text, integer, text);
drop function if exists public.seed_day(uuid, text, text, integer, text);
drop function if exists public.seed_template_plan(text, text, text, integer, text, text, text[]);
