-- ============================================================
-- Grind — Migracja 0007: plan treningowy właściciela aplikacji
--
-- Wygenerowane z plan_treningowy.json przez
-- scripts/generate-plan-migration.mjs — nie edytuj ręcznie,
-- popraw źródłowy JSON i wygeneruj ponownie.
--
-- Zawartość: 8 dni, 55 pozycji,
-- 49 ćwiczeń w katalogu.
-- ============================================================

-- icon_key: klucz ilustracji podany w planie, przechowywany przy ćwiczeniu.
alter table public.exercise_catalog add column if not exists icon_key text;
create index if not exists exercise_catalog_icon_key_idx
  on public.exercise_catalog (icon_key) where icon_key is not null;

do $$
declare
  v_plan       uuid;
  v_phase      uuid;
  v_day        uuid;
  v_cat        uuid;
  v_owner      uuid;
  v_copy       uuid;
  v_slug       text;
begin

-- ---------------------------------------------------------------
-- Katalog ćwiczeń: dokładamy tylko to, czego jeszcze nie ma.
-- Istniejące pozycje dostają icon_key, ale nie nadpisujemy ich opisów.
-- ---------------------------------------------------------------

  -- Wyciskanie sztangi na ławce płaskiej
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyciskanie sztangi na ławce płaskiej') or slug = 'bench_press')
   order by (name in ('Wyciskanie sztangi na ławce płaskiej')) desc limit 1;
  if v_cat is null then
    v_slug := 'bench_press';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyciskanie sztangi na ławce płaskiej', 'Sztanga nad klatką piersiową, łokcie ok. 45° od tułowia. Opuszczaj do lekkiego dotknięcia klatki, wypychaj w górę po łuku.', 'Klatka piersiowa, triceps, przód barków', 'weight_reps', 'curated', 'bench_press', true);
  else
    update public.exercise_catalog set icon_key = 'bench_press'
     where id = v_cat and icon_key is distinct from 'bench_press';
  end if;

  -- Podciąganie / ściąganie drążka wyciągu górnego
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Podciąganie / ściąganie drążka wyciągu górnego') or slug = 'lat_pulldown')
   order by (name in ('Podciąganie / ściąganie drążka wyciągu górnego')) desc limit 1;
  if v_cat is null then
    v_slug := 'lat_pulldown';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Podciąganie / ściąganie drążka wyciągu górnego', 'Chwyt szerszy niż barki. Ściągaj łopatki w dół i do tyłu, drążek do górnej części klatki, kontroluj powrót.', 'Plecy (najszerszy), biceps', 'weight_reps', 'curated', 'lat_pulldown', true);
  else
    update public.exercise_catalog set icon_key = 'lat_pulldown'
     where id = v_cat and icon_key is distinct from 'lat_pulldown';
  end if;

  -- Wyciskanie hantli nad głowę
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyciskanie hantli nad głowę') or slug = 'overhead_db_press')
   order by (name in ('Wyciskanie hantli nad głowę')) desc limit 1;
  if v_cat is null then
    v_slug := 'overhead_db_press';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyciskanie hantli nad głowę', 'Hantle na wysokości barków. Wypychaj pionowo w górę bez wyginania odcinka lędźwiowego, core spięty.', 'Barki (naramienne), triceps', 'weight_reps', 'curated', 'overhead_db_press', true);
  else
    update public.exercise_catalog set icon_key = 'overhead_db_press'
     where id = v_cat and icon_key is distinct from 'overhead_db_press';
  end if;

  -- Martwy ciąg rumuński z hantlami
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Martwy ciąg rumuński z hantlami') or slug = 'rdl')
   order by (name in ('Martwy ciąg rumuński z hantlami')) desc limit 1;
  if v_cat is null then
    v_slug := 'rdl';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Martwy ciąg rumuński z hantlami', 'Delikatne ugięcie kolan, biodro cofasz do tyłu, plecy proste. Hantle blisko nóg — czujesz naciąg tyłu uda. Zatrzymaj jeśli coś poczujesz w kolanie.', 'Dwugłowy uda, pośladki', 'weight_reps', 'curated', 'rdl', true);
  else
    update public.exercise_catalog set icon_key = 'rdl'
     where id = v_cat and icon_key is distinct from 'rdl';
  end if;

  -- Prostownik nóg
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Prostownik nóg') or slug = 'leg_extension')
   order by (name in ('Prostownik nóg')) desc limit 1;
  if v_cat is null then
    v_slug := 'leg_extension';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Prostownik nóg', 'Lekkie obciążenie. Pracuj tylko w zakresie bez bólu, na górze nie „zamykaj” kolana z impetem.', 'Czworogłowy uda', 'weight_reps', 'curated', 'leg_extension', true);
  else
    update public.exercise_catalog set icon_key = 'leg_extension'
     where id = v_cat and icon_key is distinct from 'leg_extension';
  end if;

  -- Odwodziciele/przywodziciele bioder
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Odwodziciele/przywodziciele bioder') or slug = 'hip_abduction')
   order by (name in ('Odwodziciele/przywodziciele bioder')) desc limit 1;
  if v_cat is null then
    v_slug := 'hip_abduction';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Odwodziciele/przywodziciele bioder', 'Ruch płynny i kontrolowany, bez szarpania. Obciążenie na tyle małe, by nie prowokować bólu kolana.', 'Pośladek średni, przywodziciele', 'weight_reps', 'curated', 'hip_abduction', true);
  else
    update public.exercise_catalog set icon_key = 'hip_abduction'
     where id = v_cat and icon_key is distinct from 'hip_abduction';
  end if;

  -- Uginanie ramion ze sztangą
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Uginanie ramion ze sztangą') or slug = 'bicep_curl')
   order by (name in ('Uginanie ramion ze sztangą')) desc limit 1;
  if v_cat is null then
    v_slug := 'bicep_curl';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Uginanie ramion ze sztangą', 'Łokcie przy tułowiu przez cały ruch. Unoś sztangę kontrolowanym tempem, bez bujania biodrami.', 'Biceps', 'weight_reps', 'curated', 'bicep_curl', true);
  else
    update public.exercise_catalog set icon_key = 'bicep_curl'
     where id = v_cat and icon_key is distinct from 'bicep_curl';
  end if;

  -- Prostowanie ramion na wyciągu
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Prostowanie ramion na wyciągu') or slug = 'tricep_pushdown')
   order by (name in ('Prostowanie ramion na wyciągu')) desc limit 1;
  if v_cat is null then
    v_slug := 'tricep_pushdown';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Prostowanie ramion na wyciągu', 'Łokcie przyklejone do boków. Prostuj przedramiona w dół, na górze pełne wyprostowanie bez odbijania.', 'Triceps', 'weight_reps', 'curated', 'tricep_pushdown', true);
  else
    update public.exercise_catalog set icon_key = 'tricep_pushdown'
     where id = v_cat and icon_key is distinct from 'tricep_pushdown';
  end if;

  -- Face pull
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Face pull') or slug = 'face_pull')
   order by (name in ('Face pull')) desc limit 1;
  if v_cat is null then
    v_slug := 'face_pull';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Face pull', 'Lina wyciągu na wysokości twarzy. Ciągnij do twarzy z rotacją zewnętrzną barków, łokcie wysoko.', 'Tylne barki, mięśnie łopatki', 'weight_reps', 'curated', 'face_pull', true);
  else
    update public.exercise_catalog set icon_key = 'face_pull'
     where id = v_cat and icon_key is distinct from 'face_pull';
  end if;

  -- Plank
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Plank') or slug = 'plank')
   order by (name in ('Plank')) desc limit 1;
  if v_cat is null then
    v_slug := 'plank';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Plank', 'Linia prosta od głowy do pięt. Brzuch i pośladki spięte, nie zapadaj się w biodrach.', 'Core — mięśnie głębokie brzucha', 'time', 'curated', 'plank', true);
  else
    update public.exercise_catalog set icon_key = 'plank'
     where id = v_cat and icon_key is distinct from 'plank';
  end if;

  -- Wyciskanie na ławce skośnej hantlami
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyciskanie na ławce skośnej hantlami') or slug = 'incline_db_press')
   order by (name in ('Wyciskanie na ławce skośnej hantlami')) desc limit 1;
  if v_cat is null then
    v_slug := 'incline_db_press';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyciskanie na ławce skośnej hantlami', 'Ławka pod kątem ok. 30°. Hantle schodzą do wysokości górnej klatki, wypychaj po lekkim łuku do środka.', 'Górna klatka piersiowa, barki', 'weight_reps', 'curated', 'incline_db_press', true);
  else
    update public.exercise_catalog set icon_key = 'incline_db_press'
     where id = v_cat and icon_key is distinct from 'incline_db_press';
  end if;

  -- Wiosłowanie sztangą w opadzie
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wiosłowanie sztangą w opadzie') or slug = 'bent_row')
   order by (name in ('Wiosłowanie sztangą w opadzie')) desc limit 1;
  if v_cat is null then
    v_slug := 'bent_row';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wiosłowanie sztangą w opadzie', 'Tułów pochylony ok. 45°, plecy proste. Ciągnij sztangę do dolnej części brzucha, łokcie blisko ciała.', 'Plecy środkowe, biceps', 'weight_reps', 'curated', 'bent_row', true);
  else
    update public.exercise_catalog set icon_key = 'bent_row'
     where id = v_cat and icon_key is distinct from 'bent_row';
  end if;

  -- Wiosłowanie hantlą jednorącz
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wiosłowanie hantlą jednorącz') or slug = 'one_arm_row')
   order by (name in ('Wiosłowanie hantlą jednorącz')) desc limit 1;
  if v_cat is null then
    v_slug := 'one_arm_row';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wiosłowanie hantlą jednorącz', 'Kolano i dłoń oparte o ławkę, plecy równolegle do podłogi. Ciągnij hantlę do biodra.', 'Plecy, biceps', 'weight_reps', 'curated', 'one_arm_row', true);
  else
    update public.exercise_catalog set icon_key = 'one_arm_row'
     where id = v_cat and icon_key is distinct from 'one_arm_row';
  end if;

  -- Wyprosty bioder na wyciągu / hip thrust
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyprosty bioder na wyciągu / hip thrust') or slug = 'hip_thrust')
   order by (name in ('Wyprosty bioder na wyciągu / hip thrust')) desc limit 1;
  if v_cat is null then
    v_slug := 'hip_thrust';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyprosty bioder na wyciągu / hip thrust', 'Barki oparte o ławkę. Biodra unosisz do linii prostej z tułowiem, ściśnij pośladki na górze.', 'Pośladki, dwugłowy uda', 'weight_reps', 'curated', 'hip_thrust', true);
  else
    update public.exercise_catalog set icon_key = 'hip_thrust'
     where id = v_cat and icon_key is distinct from 'hip_thrust';
  end if;

  -- Wyciskanie nóg na suwnicy
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyciskanie nóg na suwnicy', 'Wyciskanie nóg na suwnicy (leg press)') or slug = 'leg_press')
   order by (name in ('Wyciskanie nóg na suwnicy', 'Wyciskanie nóg na suwnicy (leg press)')) desc limit 1;
  if v_cat is null then
    v_slug := 'leg_press';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyciskanie nóg na suwnicy', 'Stopy na szerokość barków. Dobierz zakres suwu tak, by nie boleć, nie blokuj kolan na starcie ruchu.', 'Czworogłowy, pośladki', 'weight_reps', 'curated', 'leg_press', true);
  else
    update public.exercise_catalog set icon_key = 'leg_press'
     where id = v_cat and icon_key is distinct from 'leg_press';
  end if;

  -- Łydki na maszynie
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Łydki na maszynie') or slug = 'calf_raise')
   order by (name in ('Łydki na maszynie')) desc limit 1;
  if v_cat is null then
    v_slug := 'calf_raise';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Łydki na maszynie', 'Pełny zakres — od rozciągnięcia w dole do wspięcia na palce, pauza na górze.', 'Łydki (brzuchaty łydki)', 'weight_reps', 'curated', 'calf_raise', true);
  else
    update public.exercise_catalog set icon_key = 'calf_raise'
     where id = v_cat and icon_key is distinct from 'calf_raise';
  end if;

  -- Rotacje tułowia na wyciągu
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rotacje tułowia na wyciągu') or slug = 'cable_rotation')
   order by (name in ('Rotacje tułowia na wyciągu')) desc limit 1;
  if v_cat is null then
    v_slug := 'cable_rotation';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rotacje tułowia na wyciągu', 'Ruch prowadzony z bioder i tułowia. Ręce względnie sztywne, kontrolowana rotacja bez szarpania.', 'Skośne brzucha, core rotacyjny', 'weight_reps', 'curated', 'cable_rotation', true);
  else
    update public.exercise_catalog set icon_key = 'cable_rotation'
     where id = v_cat and icon_key is distinct from 'cable_rotation';
  end if;

  -- Deska boczna
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Deska boczna') or slug = 'side_plank')
   order by (name in ('Deska boczna')) desc limit 1;
  if v_cat is null then
    v_slug := 'side_plank';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Deska boczna', 'Ciało w jednej linii, biodro nie opada. Wsparcie na przedramieniu i krawędzi stopy.', 'Skośne brzucha, stabilizacja boczna', 'time', 'curated', 'side_plank', true);
  else
    update public.exercise_catalog set icon_key = 'side_plank'
     where id = v_cat and icon_key is distinct from 'side_plank';
  end if;

  -- Martwy robak
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Martwy robak', 'Martwy robak (dead bug)') or slug = 'dead_bug')
   order by (name in ('Martwy robak', 'Martwy robak (dead bug)')) desc limit 1;
  if v_cat is null then
    v_slug := 'dead_bug';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Martwy robak', 'Plecy przyklejone do maty. Opuszczaj przeciwną rękę i nogę powoli, nie odrywaj lędźwi od podłoża.', 'Core, stabilizacja lędźwi', 'reps', 'curated', 'dead_bug', true);
  else
    update public.exercise_catalog set icon_key = 'dead_bug'
     where id = v_cat and icon_key is distinct from 'dead_bug';
  end if;

  -- Martwy ciąg sztangą
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Martwy ciąg sztangą', 'Martwy ciąg sztangą (opcjonalnie)') or slug = 'deadlift')
   order by (name in ('Martwy ciąg sztangą', 'Martwy ciąg sztangą (opcjonalnie)')) desc limit 1;
  if v_cat is null then
    v_slug := 'deadlift';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Martwy ciąg sztangą', 'Sztanga blisko goleni, plecy proste przez cały ruch. Rób tylko jeśli fizjo/brak bólu na to pozwala — inaczej pomiń.', 'Cały łańcuch tylny: plecy, pośladki, dwugłowy', 'weight_reps', 'curated', 'deadlift', true);
  else
    update public.exercise_catalog set icon_key = 'deadlift'
     where id = v_cat and icon_key is distinct from 'deadlift';
  end if;

  -- Mobilność bioder w kółku
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Mobilność bioder w kółku', 'Mobilność bioder w kółku (stojąc)') or slug = 'hip_circles')
   order by (name in ('Mobilność bioder w kółku', 'Mobilność bioder w kółku (stojąc)')) desc limit 1;
  if v_cat is null then
    v_slug := 'hip_circles';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Mobilność bioder w kółku', 'Stań na jednej nodze (trzymaj się czegoś), zataczaj drugą nogą duże koła w obu kierunkach.', 'Mobilność stawu biodrowego pod kopnięcia', 'reps', 'curated', 'hip_circles', true);
  else
    update public.exercise_catalog set icon_key = 'hip_circles'
     where id = v_cat and icon_key is distinct from 'hip_circles';
  end if;

  -- Rotacja odcinka piersiowego
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rotacja odcinka piersiowego', 'Rotacja odcinka piersiowego (stojąc)') or slug = 'thoracic_rotation')
   order by (name in ('Rotacja odcinka piersiowego', 'Rotacja odcinka piersiowego (stojąc)')) desc limit 1;
  if v_cat is null then
    v_slug := 'thoracic_rotation';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rotacja odcinka piersiowego', 'Stopy nieruchome, ramiona rozłożone, rotuj tułów maksymalnie w jedną stronę, wracaj przez środek.', 'Mobilność klatki, rotacja pod ciosy', 'reps', 'curated', 'thoracic_rotation', true);
  else
    update public.exercise_catalog set icon_key = 'thoracic_rotation'
     where id = v_cat and icon_key is distinct from 'thoracic_rotation';
  end if;

  -- Krążenia ramion
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Krążenia ramion', 'Krążenia ramion (shoulder CARs)') or slug = 'shoulder_cars')
   order by (name in ('Krążenia ramion', 'Krążenia ramion (shoulder CARs)')) desc limit 1;
  if v_cat is null then
    v_slug := 'shoulder_cars';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Krążenia ramion', 'Ramię wyciągnięte w bok, zataczaj nim najszersze możliwe koło, powoli, z pełną kontrolą.', 'Mobilność i zdrowie barków', 'reps', 'curated', 'shoulder_cars', true);
  else
    update public.exercise_catalog set icon_key = 'shoulder_cars'
     where id = v_cat and icon_key is distinct from 'shoulder_cars';
  end if;

  -- Uderzenia z taśmą oporową
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Uderzenia z taśmą oporową', 'Uderzenia z taśmą oporową (pełna prędkość)') or slug = 'band_punch')
   order by (name in ('Uderzenia z taśmą oporową', 'Uderzenia z taśmą oporową (pełna prędkość)')) desc limit 1;
  if v_cat is null then
    v_slug := 'band_punch';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Uderzenia z taśmą oporową', 'Taśma zaczepiona za plecami na wysokości klatki. Wyrzucaj rękę do przodu z pełną szybkością, kontroluj powrót.', 'Szybkość i moc wyrzutu ciosu', 'reps', 'curated', 'band_punch', true);
  else
    update public.exercise_catalog set icon_key = 'band_punch'
     where id = v_cat and icon_key is distinct from 'band_punch';
  end if;

  -- Rotacyjne rzuty piłką lekarską
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rotacyjne rzuty piłką lekarską', 'Rotacyjne rzuty piłką lekarską (kontrolowanie)', 'Rotacyjne rzuty piłką lekarską (z impetem)') or slug = 'med_ball_rotation')
   order by (name in ('Rotacyjne rzuty piłką lekarską', 'Rotacyjne rzuty piłką lekarską (kontrolowanie)', 'Rotacyjne rzuty piłką lekarską (z impetem)')) desc limit 1;
  if v_cat is null then
    v_slug := 'med_ball_rotation';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rotacyjne rzuty piłką lekarską', 'Rotacja prowadzona z bioder, rzut w bok o ścianę w umiarkowanym tempie — bez dynamicznego obciążania nóg.', 'Moc rotacyjna core pod ciosy', 'weight_reps', 'curated', 'med_ball_rotation', true);
  else
    update public.exercise_catalog set icon_key = 'med_ball_rotation'
     where id = v_cat and icon_key is distinct from 'med_ball_rotation';
  end if;

  -- Szybkie uderzenia w powietrzu
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Szybkie uderzenia w powietrzu', 'Szybkie uderzenia w powietrzu (shadowboxing)') or slug = 'shadowbox')
   order by (name in ('Szybkie uderzenia w powietrzu', 'Szybkie uderzenia w powietrzu (shadowboxing)')) desc limit 1;
  if v_cat is null then
    v_slug := 'shadowbox';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Szybkie uderzenia w powietrzu', 'Luźna postawa, ręce przy twarzy, rzucaj szybkie proste ciosy w powietrze — skup się na tempie, nie sile.', 'Szybkość rąk, koordynacja', 'time', 'curated', 'shadowbox', true);
  else
    update public.exercise_catalog set icon_key = 'shadowbox'
     where id = v_cat and icon_key is distinct from 'shadowbox';
  end if;

  -- Deep squat hold
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Deep squat hold', 'Deep squat hold (jeśli bezbolesny)') or slug = 'deep_squat_hold')
   order by (name in ('Deep squat hold', 'Deep squat hold (jeśli bezbolesny)')) desc limit 1;
  if v_cat is null then
    v_slug := 'deep_squat_hold';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Deep squat hold', 'Pełny przysiad, pięty na podłodze jeśli możliwe. Rób tylko jeśli pozycja jest bezbolesna dla kolana.', 'Mobilność bioder/kostek', 'time', 'curated', 'deep_squat_hold', true);
  else
    update public.exercise_catalog set icon_key = 'deep_squat_hold'
     where id = v_cat and icon_key is distinct from 'deep_squat_hold';
  end if;

  -- Rower stacjonarny / ergometr wioślarski
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rower stacjonarny / ergometr wioślarski') or slug = 'farmers_walk_2')
   order by (name in ('Rower stacjonarny / ergometr wioślarski')) desc limit 1;
  if v_cat is null then
    v_slug := 'farmers_walk_2';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rower stacjonarny / ergometr wioślarski', 'Forma niskoobciążająca kolano zgięciowo (w przeciwieństwie do biegania). Rób wyłącznie jeśli bezbolesne — jeśli nie, zamień na ergometr górnych partii.', 'Wydolność ogólna, oszczędza kolano', 'time', 'curated', 'farmers_walk', true);
  else
    update public.exercise_catalog set icon_key = 'farmers_walk'
     where id = v_cat and icon_key is distinct from 'farmers_walk';
  end if;

  -- Przysiad z hantlą
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Przysiad z hantlą', 'Przysiad z hantlą (goblet squat)') or slug = 'goblet_squat')
   order by (name in ('Przysiad z hantlą', 'Przysiad z hantlą (goblet squat)')) desc limit 1;
  if v_cat is null then
    v_slug := 'goblet_squat';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Przysiad z hantlą', 'Punkt wejścia po powrocie do zdrowia. Hantel przy klatce, siadaj między stopy, plecy proste, kolana w linii ze stopami.', 'Czworogłowy, pośladki, core', 'weight_reps', 'curated', 'goblet_squat', true);
  else
    update public.exercise_catalog set icon_key = 'goblet_squat'
     where id = v_cat and icon_key is distinct from 'goblet_squat';
  end if;

  -- Przysiad ze sztangą
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Przysiad ze sztangą', 'Przysiad ze sztangą (back squat)') or slug = 'back_squat')
   order by (name in ('Przysiad ze sztangą', 'Przysiad ze sztangą (back squat)')) desc limit 1;
  if v_cat is null then
    v_slug := 'back_squat';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Przysiad ze sztangą', 'Wchodzisz dopiero po pełnej progresji z goblet squat. Sztanga na górnej części pleców, głębokość dopasowana do komfortu kolana.', 'Czworogłowy, pośladki, dół pleców', 'weight_reps', 'curated', 'back_squat', true);
  else
    update public.exercise_catalog set icon_key = 'back_squat'
     where id = v_cat and icon_key is distinct from 'back_squat';
  end if;

  -- Wypady
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wypady') or slug = 'lunge')
   order by (name in ('Wypady')) desc limit 1;
  if v_cat is null then
    v_slug := 'lunge';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wypady', 'Krok do przodu, tylne kolano opada w kierunku podłogi, tułów pionowo. Wracaj kontrolowanie, bez odbicia.', 'Czworogłowy, pośladki, stabilizacja jednonóż', 'weight_reps', 'curated', 'lunge', true);
  else
    update public.exercise_catalog set icon_key = 'lunge'
     where id = v_cat and icon_key is distinct from 'lunge';
  end if;

  -- Wyskoki plyometryczne
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wyskoki plyometryczne', 'Wyskoki plyometryczne (box jump)') or slug = 'box_jump')
   order by (name in ('Wyskoki plyometryczne', 'Wyskoki plyometryczne (box jump)')) desc limit 1;
  if v_cat is null then
    v_slug := 'box_jump';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wyskoki plyometryczne', 'Wprowadzaj dopiero po pełnym powrocie do zdrowia. Ląduj miękko z ugięciem kolan, schodź ze skrzyni — nie zeskakuj.', 'Moc nóg — eksplozywność', 'reps', 'curated', 'box_jump', true);
  else
    update public.exercise_catalog set icon_key = 'box_jump'
     where id = v_cat and icon_key is distinct from 'box_jump';
  end if;

  -- Rotacje z kettlebell
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rotacje z kettlebell') or slug = 'kb_rotation')
   order by (name in ('Rotacje z kettlebell')) desc limit 1;
  if v_cat is null then
    v_slug := 'kb_rotation';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rotacje z kettlebell', 'Kettlebell trzymana oburącz przed klatką. Obracasz tułów kontrolując ruch bioder — pod obrót przy uderzeniach.', 'Core rotacyjny, stabilizacja', 'weight_reps', 'curated', 'kb_rotation', true);
  else
    update public.exercise_catalog set icon_key = 'kb_rotation'
     where id = v_cat and icon_key is distinct from 'kb_rotation';
  end if;

  -- Farmer's walk
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Farmer''s walk') or slug = 'farmers_walk')
   order by (name in ('Farmer''s walk')) desc limit 1;
  if v_cat is null then
    v_slug := 'farmers_walk';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Farmer''s walk', 'Ciężary po bokach, plecy proste, spokojny chód, spięty core. Buduje siłę chwytu i stabilizację pod klincz.', 'Chwyt, core, obręcz barkowa', 'distance', 'curated', 'farmers_walk', true);
  else
    update public.exercise_catalog set icon_key = 'farmers_walk'
     where id = v_cat and icon_key is distinct from 'farmers_walk';
  end if;

  -- Wisy na drążku
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Wisy na drążku', 'Wisy na drążku (dead hang)') or slug = 'dead_hang')
   order by (name in ('Wisy na drążku', 'Wisy na drążku (dead hang)')) desc limit 1;
  if v_cat is null then
    v_slug := 'dead_hang';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Wisy na drążku', 'Pełny wis na wyprostowanych ramionach, barki lekko spięte. Świetne pod chwyty i zdrowie stawów barkowych.', 'Chwyt, barki, dekompresja kręgosłupa', 'time', 'curated', 'dead_hang', true);
  else
    update public.exercise_catalog set icon_key = 'dead_hang'
     where id = v_cat and icon_key is distinct from 'dead_hang';
  end if;

  -- 90/90 hip stretch
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('90/90 hip stretch') or slug = 'hip_90_90')
   order by (name in ('90/90 hip stretch')) desc limit 1;
  if v_cat is null then
    v_slug := 'hip_90_90';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, '90/90 hip stretch', 'Obie nogi ugięte pod kątem 90° (jedna z przodu, jedna z boku). Pochyl tułów do przedniej nogi — rotacja bioder pod kopnięcia.', 'Mobilność rotacyjna bioder', 'time', 'curated', 'hip_90_90', true);
  else
    update public.exercise_catalog set icon_key = 'hip_90_90'
     where id = v_cat and icon_key is distinct from 'hip_90_90';
  end if;

  -- Skakanka
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Skakanka') or slug = 'jump_rope')
   order by (name in ('Skakanka')) desc limit 1;
  if v_cat is null then
    v_slug := 'jump_rope';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Skakanka', 'Luźne nadgarstki, małe podskoki na palcach, rytmiczne tempo.', 'Szybkość stóp, koordynacja', 'time', 'curated', 'jump_rope', true);
  else
    update public.exercise_catalog set icon_key = 'jump_rope'
     where id = v_cat and icon_key is distinct from 'jump_rope';
  end if;

  -- Odskoki boczne
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Odskoki boczne', 'Odskoki boczne (lateral bounds)') or slug = 'lateral_bound')
   order by (name in ('Odskoki boczne', 'Odskoki boczne (lateral bounds)')) desc limit 1;
  if v_cat is null then
    v_slug := 'lateral_bound';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Odskoki boczne', 'Odbij się jedną nogą w bok, wyląduj miękko na drugiej, zatrzymaj na moment przed kolejnym odbiciem.', 'Moc i szybkość zmiany kierunku', 'reps', 'curated', 'lateral_bound', true);
  else
    update public.exercise_catalog set icon_key = 'lateral_bound'
     where id = v_cat and icon_key is distinct from 'lateral_bound';
  end if;

  -- Praca na worku bokserskim
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Praca na worku bokserskim', 'Praca na worku bokserskim (kombinacje)') or slug = 'heavy_bag')
   order by (name in ('Praca na worku bokserskim', 'Praca na worku bokserskim (kombinacje)')) desc limit 1;
  if v_cat is null then
    v_slug := 'heavy_bag';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Praca na worku bokserskim', 'Kombinacje ciosów w tempie zbliżonym do walki, 1 min przerwy między rundami.', 'Moc i szybkość ciosów', 'time', 'curated', 'heavy_bag', true);
  else
    update public.exercise_catalog set icon_key = 'heavy_bag'
     where id = v_cat and icon_key is distinct from 'heavy_bag';
  end if;

  -- Sprinty interwałowe
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Sprinty interwałowe') or slug = 'sprint')
   order by (name in ('Sprinty interwałowe')) desc limit 1;
  if v_cat is null then
    v_slug := 'sprint';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Sprinty interwałowe', 'Maksymalna prędkość na krótkim dystansie, pełny odpoczynek między powtórzeniami.', 'Szybkość, moc eksplozywna nóg', 'time', 'curated', 'sprint', true);
  else
    update public.exercise_catalog set icon_key = 'sprint'
     where id = v_cat and icon_key is distinct from 'sprint';
  end if;

  -- Stojące rozciąganie czworogłowego
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Stojące rozciąganie czworogłowego') or slug = 'quad_stand')
   order by (name in ('Stojące rozciąganie czworogłowego')) desc limit 1;
  if v_cat is null then
    v_slug := 'quad_stand';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Stojące rozciąganie czworogłowego', 'Chwyć stopę od tyłu, przyciągnij piętę do pośladka, kolana blisko siebie, biodro lekko wypchnięte do przodu. Trzymaj się czegoś dla równowagi.', 'czworogłowy uda', 'time', 'curated', 'quad_stand', true);
  else
    update public.exercise_catalog set icon_key = 'quad_stand'
     where id = v_cat and icon_key is distinct from 'quad_stand';
  end if;

  -- Klęczące rozciąganie
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Klęczące rozciąganie', 'Klęczące rozciąganie (half-kneeling)') or slug = 'quad_kneel')
   order by (name in ('Klęczące rozciąganie', 'Klęczące rozciąganie (half-kneeling)')) desc limit 1;
  if v_cat is null then
    v_slug := 'quad_kneel';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Klęczące rozciąganie', 'Klęk jednonóż, druga stopa płasko przed Tobą. Biodro tylnej nogi przesuń do przodu aż poczujesz naciąg z przodu uda.', 'czworogłowy uda', 'time', 'curated', 'quad_kneel', true);
  else
    update public.exercise_catalog set icon_key = 'quad_kneel'
     where id = v_cat and icon_key is distinct from 'quad_kneel';
  end if;

  -- Leżące rozciąganie czworogłowego
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Leżące rozciąganie czworogłowego') or slug = 'quad_lying')
   order by (name in ('Leżące rozciąganie czworogłowego')) desc limit 1;
  if v_cat is null then
    v_slug := 'quad_lying';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Leżące rozciąganie czworogłowego', 'Leż na boku, chwyć stopę i przyciągnij do pośladka. Mniej obciąża staw kolanowy niż wersja stojąca — dobra opcja przy wrażliwym kolanie.', 'czworogłowy uda', 'time', 'curated', 'quad_lying', true);
  else
    update public.exercise_catalog set icon_key = 'quad_lying'
     where id = v_cat and icon_key is distinct from 'quad_lying';
  end if;

  -- Rozciąganie w siadzie prostym
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rozciąganie w siadzie prostym') or slug = 'ham_seated')
   order by (name in ('Rozciąganie w siadzie prostym')) desc limit 1;
  if v_cat is null then
    v_slug := 'ham_seated';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rozciąganie w siadzie prostym', 'Jedna noga wyprostowana, druga ugięta stopą przy udzie. Pochyl tułów do wyprostowanej nogi, trzymając plecy proste.', 'dwugłowy uda', 'time', 'curated', 'ham_seated', true);
  else
    update public.exercise_catalog set icon_key = 'ham_seated'
     where id = v_cat and icon_key is distinct from 'ham_seated';
  end if;

  -- Rozciąganie z paskiem
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Rozciąganie z paskiem', 'Rozciąganie z paskiem (leżąc)') or slug = 'ham_strap')
   order by (name in ('Rozciąganie z paskiem', 'Rozciąganie z paskiem (leżąc)')) desc limit 1;
  if v_cat is null then
    v_slug := 'ham_strap';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Rozciąganie z paskiem', 'Owiń pasek wokół stopy, unieś nogę prosto w górę. Najbardziej kontrolowana wersja — nie zgina kolana pod obciążeniem.', 'dwugłowy uda', 'time', 'curated', 'ham_strap', true);
  else
    update public.exercise_catalog set icon_key = 'ham_strap'
     where id = v_cat and icon_key is distinct from 'ham_strap';
  end if;

  -- Standing forward fold
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Standing forward fold', 'Standing forward fold (lekki)') or slug = 'forward_fold')
   order by (name in ('Standing forward fold', 'Standing forward fold (lekki)')) desc limit 1;
  if v_cat is null then
    v_slug := 'forward_fold';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Standing forward fold', 'Lekko ugięte kolana, pochyl się od bioder, ręce swobodnie w dół. Nie forsuj prostych nóg jeśli kolano protestuje.', 'dwugłowy uda', 'time', 'curated', 'forward_fold', true);
  else
    update public.exercise_catalog set icon_key = 'forward_fold'
     where id = v_cat and icon_key is distinct from 'forward_fold';
  end if;

  -- Figure-four stretch
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Figure-four stretch', 'Figure-four stretch (leżąc)') or slug = 'figure_four')
   order by (name in ('Figure-four stretch', 'Figure-four stretch (leżąc)')) desc limit 1;
  if v_cat is null then
    v_slug := 'figure_four';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Figure-four stretch', 'Skrzyżuj kostkę jednej nogi na kolanie drugiej (układ „4”). Chwyć udo nogi wspierającej i przyciągnij do klatki.', 'pośladki', 'time', 'curated', 'figure_four', true);
  else
    update public.exercise_catalog set icon_key = 'figure_four'
     where id = v_cat and icon_key is distinct from 'figure_four';
  end if;

  -- Pigeon stretch
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Pigeon stretch', 'Pigeon stretch (siedząc)') or slug = 'pigeon')
   order by (name in ('Pigeon stretch', 'Pigeon stretch (siedząc)')) desc limit 1;
  if v_cat is null then
    v_slug := 'pigeon';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Pigeon stretch', 'Jedna noga ugięta z przodu, druga wyprostowana z tyłu, pochyl tułów do przodu. Jeśli kolano przedniej nogi protestuje — pomiń.', 'pośladki', 'time', 'curated', 'pigeon', true);
  else
    update public.exercise_catalog set icon_key = 'pigeon'
     where id = v_cat and icon_key is distinct from 'pigeon';
  end if;

  -- Knee-to-chest
  select id into v_cat from public.exercise_catalog
   where user_id is null and (name in ('Knee-to-chest') or slug = 'knee_to_chest')
   order by (name in ('Knee-to-chest')) desc limit 1;
  if v_cat is null then
    v_slug := 'knee_to_chest';
    while exists (select 1 from public.exercise_catalog
                   where user_id is null and slug = v_slug) loop
      v_slug := v_slug || '_2';
    end loop;
    insert into public.exercise_catalog
      (slug, name, description, muscle_group, metric, source, icon_key, is_public)
    values (v_slug, 'Knee-to-chest', 'Leż na plecach, przyciągnij jedno kolano do klatki piersiowej obiema rękami. Najbezpieczniejsza wersja przy wrażliwym kolanie.', 'pośladki', 'time', 'curated', 'knee_to_chest', true);
  else
    update public.exercise_catalog set icon_key = 'knee_to_chest'
     where id = v_cat and icon_key is distinct from 'knee_to_chest';
  end if;

-- ---------------------------------------------------------------
-- Plan jako publiczny szablon — kopiowalny przez każdego.
-- ---------------------------------------------------------------
  select id into v_plan from public.plans
   where user_id is null and is_template and name = 'Plan treningowy: Siłownia + MMA' limit 1;

  if v_plan is not null then
    -- Migracja już przeszła: nic nie duplikujemy.
    delete from public.phases where plan_id = v_plan;
  else
    insert into public.plans (user_id, name, description, goal, is_template, is_public, source)
    values (null, 'Plan treningowy: Siłownia + MMA', 'Plan nie zastępuje fizjoterapeuty. Zalecenia fizjo (rozciąganie czworogłowego, dwugłowego, pośladków) wykonuj dokładnie jak przepisane. Jeśli ćwiczenie nasila ból kolana — pomiń je. Progresja obciążeń na nodze z problemem w tempie, na które pozwala fizjo.

Założenia:
• Wieloletnie doświadczenie w sportach walki, rok przerwy od MMA
• Doświadczenie siłowe: głównie maszyny, trening sylwetkowy
• Kolano w trakcie rehabilitacji — ból pojawia się przy wysiłku
• Cel: balans — siła, mobilność, wydolność pod MMA
• Faza 1: 3 dni/tydz (2x full body + 1x moc/szybkość/mobilność)
• Faza 2: 4-5 dni/tydz (siłownia + MMA + dzień mocy/szybkości)

Przykładowy tydzień (4 dni): Pon: Siłownia — Dzień A · Wt: MMA (technika/sparing) · Śr: Siłownia — Dzień B · Czw: Dzień D — Moc/szybkość/mobilność · Pt: MMA (technika/sparing) · Sob: Odpoczynek · Nd: Odpoczynek
Przykładowy tydzień (5 dni): Pon: Siłownia — Dzień A · Wt: MMA · Śr: Siłownia — Dzień B · Czw: MMA · Pt: Dzień D — Moc/szybkość/mobilność · Sob: MMA (opcjonalnie, lekko) · Nd: Odpoczynek

Przejście Faza 1 → Faza 2 warunkowane zgodą fizjo, nie kalendarzem. Co 3-4 tygodnie lekka progresja obciążeń w Fazie 1 (jeśli bez bólu), w Fazie 2 progresja bardziej agresywna.', 'Powrót po kontuzji kolana + przygotowanie pod MMA', true, true, 'template')
    returning id into v_plan;
  end if;

  -- === Faza 1 — Teraz ===
  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (v_plan, 'Faza 1 — Teraz', 'Baza siłowa całego ciała, nauka wzorców ruchowych pod sztangą, utrzymanie kondycji bez obciążania kolana, wsparcie rehabilitacji, plus dzień mobilności/szybkości/mocy ciosów.', '3x / tydzień', 0)
  returning id into v_phase;

  -- --- Dzień A — Full body: pchanie + dół ciała A (10 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Dzień A — Full body: pchanie + dół ciała A', 'A', null, 'gym', true, 0)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'bench_press' or name = 'Wyciskanie sztangi na ławce płaskiej' or slug = 'bench_press')
   order by (name = 'Wyciskanie sztangi na ławce płaskiej') desc, (icon_key = 'bench_press') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyciskanie sztangi na ławce płaskiej', 'Klatka piersiowa, triceps, przód barków', 4, '6-8', null, 'Sztanga nad klatką piersiową, łokcie ok. 45° od tułowia. Opuszczaj do lekkiego dotknięcia klatki, wypychaj w górę po łuku.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'lat_pulldown' or name = 'Podciąganie / ściąganie drążka wyciągu górnego' or slug = 'lat_pulldown')
   order by (name = 'Podciąganie / ściąganie drążka wyciągu górnego') desc, (icon_key = 'lat_pulldown') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Podciąganie / ściąganie drążka wyciągu górnego', 'Plecy (najszerszy), biceps', 4, '8-10', null, 'Chwyt szerszy niż barki. Ściągaj łopatki w dół i do tyłu, drążek do górnej części klatki, kontroluj powrót.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'overhead_db_press' or name = 'Wyciskanie hantli nad głowę' or slug = 'overhead_db_press')
   order by (name = 'Wyciskanie hantli nad głowę') desc, (icon_key = 'overhead_db_press') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyciskanie hantli nad głowę', 'Barki (naramienne), triceps', 3, '8-10', null, 'Hantle na wysokości barków. Wypychaj pionowo w górę bez wyginania odcinka lędźwiowego, core spięty.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'rdl' or name = 'Martwy ciąg rumuński z hantlami' or slug = 'rdl')
   order by (name = 'Martwy ciąg rumuński z hantlami') desc, (icon_key = 'rdl') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Martwy ciąg rumuński z hantlami', 'Dwugłowy uda, pośladki', 4, '8', null, 'Delikatne ugięcie kolan, biodro cofasz do tyłu, plecy proste. Hantle blisko nóg — czujesz naciąg tyłu uda. Zatrzymaj jeśli coś poczujesz w kolanie.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'leg_extension' or name = 'Prostownik nóg' or slug = 'leg_extension')
   order by (name = 'Prostownik nóg') desc, (icon_key = 'leg_extension') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Prostownik nóg', 'Czworogłowy uda', 3, '12-15', null, 'Lekkie obciążenie. Pracuj tylko w zakresie bez bólu, na górze nie „zamykaj” kolana z impetem.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'hip_abduction' or name = 'Odwodziciele/przywodziciele bioder' or slug = 'hip_abduction')
   order by (name = 'Odwodziciele/przywodziciele bioder') desc, (icon_key = 'hip_abduction') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Odwodziciele/przywodziciele bioder', 'Pośladek średni, przywodziciele', 3, '15', null, 'Ruch płynny i kontrolowany, bez szarpania. Obciążenie na tyle małe, by nie prowokować bólu kolana.', 6);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'bicep_curl' or name = 'Uginanie ramion ze sztangą' or slug = 'bicep_curl')
   order by (name = 'Uginanie ramion ze sztangą') desc, (icon_key = 'bicep_curl') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Uginanie ramion ze sztangą', 'Biceps', 3, '10-12', null, 'Łokcie przy tułowiu przez cały ruch. Unoś sztangę kontrolowanym tempem, bez bujania biodrami.', 7);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'tricep_pushdown' or name = 'Prostowanie ramion na wyciągu' or slug = 'tricep_pushdown')
   order by (name = 'Prostowanie ramion na wyciągu') desc, (icon_key = 'tricep_pushdown') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Prostowanie ramion na wyciągu', 'Triceps', 3, '10-12', null, 'Łokcie przyklejone do boków. Prostuj przedramiona w dół, na górze pełne wyprostowanie bez odbijania.', 8);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'face_pull' or name = 'Face pull' or slug = 'face_pull')
   order by (name = 'Face pull') desc, (icon_key = 'face_pull') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Face pull', 'Tylne barki, mięśnie łopatki', 3, '15', null, 'Lina wyciągu na wysokości twarzy. Ciągnij do twarzy z rotacją zewnętrzną barków, łokcie wysoko.', 9);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'plank' or name = 'Plank' or slug = 'plank')
   order by (name = 'Plank') desc, (icon_key = 'plank') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Plank', 'Core — mięśnie głębokie brzucha', 3, '40s', null, 'Linia prosta od głowy do pięt. Brzuch i pośladki spięte, nie zapadaj się w biodrach.', 10);

  -- --- Dzień B — Full body: ciągnięcie + dół ciała B (10 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Dzień B — Full body: ciągnięcie + dół ciała B', 'B', null, 'gym', true, 1)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'incline_db_press' or name = 'Wyciskanie na ławce skośnej hantlami' or slug = 'incline_db_press')
   order by (name = 'Wyciskanie na ławce skośnej hantlami') desc, (icon_key = 'incline_db_press') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyciskanie na ławce skośnej hantlami', 'Górna klatka piersiowa, barki', 4, '8-10', null, 'Ławka pod kątem ok. 30°. Hantle schodzą do wysokości górnej klatki, wypychaj po lekkim łuku do środka.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'bent_row' or name = 'Wiosłowanie sztangą w opadzie' or slug = 'bent_row')
   order by (name = 'Wiosłowanie sztangą w opadzie') desc, (icon_key = 'bent_row') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wiosłowanie sztangą w opadzie', 'Plecy środkowe, biceps', 3, '8-10', null, 'Tułów pochylony ok. 45°, plecy proste. Ciągnij sztangę do dolnej części brzucha, łokcie blisko ciała.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'one_arm_row' or name = 'Wiosłowanie hantlą jednorącz' or slug = 'one_arm_row')
   order by (name = 'Wiosłowanie hantlą jednorącz') desc, (icon_key = 'one_arm_row') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wiosłowanie hantlą jednorącz', 'Plecy, biceps', 3, '10/stronę', null, 'Kolano i dłoń oparte o ławkę, plecy równolegle do podłogi. Ciągnij hantlę do biodra.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'hip_thrust' or name = 'Wyprosty bioder na wyciągu / hip thrust' or slug = 'hip_thrust')
   order by (name = 'Wyprosty bioder na wyciągu / hip thrust') desc, (icon_key = 'hip_thrust') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyprosty bioder na wyciągu / hip thrust', 'Pośladki, dwugłowy uda', 3, '10-12', null, 'Barki oparte o ławkę. Biodra unosisz do linii prostej z tułowiem, ściśnij pośladki na górze.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'leg_press' or name = 'Wyciskanie nóg na suwnicy' or slug = 'leg_press')
   order by (name = 'Wyciskanie nóg na suwnicy') desc, (icon_key = 'leg_press') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyciskanie nóg na suwnicy (leg press)', 'Czworogłowy, pośladki', 3, '10-12', null, 'Stopy na szerokość barków. Dobierz zakres suwu tak, by nie boleć, nie blokuj kolan na starcie ruchu.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'calf_raise' or name = 'Łydki na maszynie' or slug = 'calf_raise')
   order by (name = 'Łydki na maszynie') desc, (icon_key = 'calf_raise') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Łydki na maszynie', 'Łydki (brzuchaty łydki)', 3, '15', null, 'Pełny zakres — od rozciągnięcia w dole do wspięcia na palce, pauza na górze.', 6);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'cable_rotation' or name = 'Rotacje tułowia na wyciągu' or slug = 'cable_rotation')
   order by (name = 'Rotacje tułowia na wyciągu') desc, (icon_key = 'cable_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacje tułowia na wyciągu', 'Skośne brzucha, core rotacyjny', 3, '12/stronę', null, 'Ruch prowadzony z bioder i tułowia. Ręce względnie sztywne, kontrolowana rotacja bez szarpania.', 7);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'side_plank' or name = 'Deska boczna' or slug = 'side_plank')
   order by (name = 'Deska boczna') desc, (icon_key = 'side_plank') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Deska boczna', 'Skośne brzucha, stabilizacja boczna', 3, '30-40s', null, 'Ciało w jednej linii, biodro nie opada. Wsparcie na przedramieniu i krawędzi stopy.', 8);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'dead_bug' or name = 'Martwy robak' or slug = 'dead_bug')
   order by (name = 'Martwy robak') desc, (icon_key = 'dead_bug') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Martwy robak (dead bug)', 'Core, stabilizacja lędźwi', 3, '10/stronę', null, 'Plecy przyklejone do maty. Opuszczaj przeciwną rękę i nogę powoli, nie odrywaj lędźwi od podłoża.', 9);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'deadlift' or name = 'Martwy ciąg sztangą' or slug = 'deadlift')
   order by (name = 'Martwy ciąg sztangą') desc, (icon_key = 'deadlift') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Martwy ciąg sztangą (opcjonalnie)', 'Cały łańcuch tylny: plecy, pośladki, dwugłowy', 3, '6', null, 'Sztanga blisko goleni, plecy proste przez cały ruch. Rób tylko jeśli fizjo/brak bólu na to pozwala — inaczej pomiń.', 10);

  -- --- Dzień C — Moc, szybkość i mobilność (bezpieczny dla kolana) (7 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Dzień C — Moc, szybkość i mobilność (bezpieczny dla kolana)', 'C', 'Fokus na tempo ciosów, koordynację i mobilność bioder/klatki/barków, bez skoków i sprintów.', 'mobility', false, 2)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'hip_circles' or name = 'Mobilność bioder w kółku' or slug = 'hip_circles')
   order by (name = 'Mobilność bioder w kółku') desc, (icon_key = 'hip_circles') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Mobilność bioder w kółku (stojąc)', 'Mobilność stawu biodrowego pod kopnięcia', null, null, '2 rundy/nogę', 'Stań na jednej nodze (trzymaj się czegoś), zataczaj drugą nogą duże koła w obu kierunkach.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'thoracic_rotation' or name = 'Rotacja odcinka piersiowego' or slug = 'thoracic_rotation')
   order by (name = 'Rotacja odcinka piersiowego') desc, (icon_key = 'thoracic_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacja odcinka piersiowego (stojąc)', 'Mobilność klatki, rotacja pod ciosy', 2, '10/stronę', null, 'Stopy nieruchome, ramiona rozłożone, rotuj tułów maksymalnie w jedną stronę, wracaj przez środek.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'shoulder_cars' or name = 'Krążenia ramion' or slug = 'shoulder_cars')
   order by (name = 'Krążenia ramion') desc, (icon_key = 'shoulder_cars') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Krążenia ramion (shoulder CARs)', 'Mobilność i zdrowie barków', 2, '8/ramię', null, 'Ramię wyciągnięte w bok, zataczaj nim najszersze możliwe koło, powoli, z pełną kontrolą.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'band_punch' or name = 'Uderzenia z taśmą oporową' or slug = 'band_punch')
   order by (name = 'Uderzenia z taśmą oporową') desc, (icon_key = 'band_punch') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Uderzenia z taśmą oporową', 'Szybkość i moc wyrzutu ciosu', 3, '15/stronę', null, 'Taśma zaczepiona za plecami na wysokości klatki. Wyrzucaj rękę do przodu z pełną szybkością, kontroluj powrót.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'med_ball_rotation' or name = 'Rotacyjne rzuty piłką lekarską' or slug = 'med_ball_rotation')
   order by (name = 'Rotacyjne rzuty piłką lekarską') desc, (icon_key = 'med_ball_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacyjne rzuty piłką lekarską (kontrolowanie)', 'Moc rotacyjna core pod ciosy', 3, '8/stronę', null, 'Rotacja prowadzona z bioder, rzut w bok o ścianę w umiarkowanym tempie — bez dynamicznego obciążania nóg.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'shadowbox' or name = 'Szybkie uderzenia w powietrzu' or slug = 'shadowbox')
   order by (name = 'Szybkie uderzenia w powietrzu') desc, (icon_key = 'shadowbox') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Szybkie uderzenia w powietrzu (shadowboxing)', 'Szybkość rąk, koordynacja', 4, '30s', null, 'Luźna postawa, ręce przy twarzy, rzucaj szybkie proste ciosy w powietrze — skup się na tempie, nie sile.', 6);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'deep_squat_hold' or name = 'Deep squat hold' or slug = 'deep_squat_hold')
   order by (name = 'Deep squat hold') desc, (icon_key = 'deep_squat_hold') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Deep squat hold (jeśli bezbolesny)', 'Mobilność bioder/kostek', 2, '30-40s', null, 'Pełny przysiad, pięty na podłodze jeśli możliwe. Rób tylko jeśli pozycja jest bezbolesna dla kolana.', 7);

  -- --- Kondycja (2x/tydzień, poza dniami siłowymi) (1 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Kondycja (2x/tydzień, poza dniami siłowymi)', 'Kond.', null, 'conditioning', false, 3)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'farmers_walk' or name = 'Rower stacjonarny / ergometr wioślarski' or slug = 'farmers_walk_2')
   order by (name = 'Rower stacjonarny / ergometr wioślarski') desc, (icon_key = 'farmers_walk') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rower stacjonarny / ergometr wioślarski', 'Wydolność ogólna, oszczędza kolano', 2, '/tydz, 15-20 min interwałów', null, 'Forma niskoobciążająca kolano zgięciowo (w przeciwieństwie do biegania). Rób wyłącznie jeśli bezbolesne — jeśli nie, zamień na ergometr górnych partii.', 1);

  -- --- Rozciąganie rehabilitacyjne (zalecenia fizjo) (9 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Rozciąganie rehabilitacyjne (zalecenia fizjo)', 'Rehab', 'Standardowe warianty rozciągania — potwierdź z fizjo, że pasują do Twojego przypadku. Rozciągaj do lekkiego napięcia, nigdy do bólu. Jeśli wariant boli — przejdź na wersję leżącą.', 'mobility', false, 4)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'quad_stand' or name = 'Stojące rozciąganie czworogłowego' or slug = 'quad_stand')
   order by (name = 'Stojące rozciąganie czworogłowego') desc, (icon_key = 'quad_stand') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Stojące rozciąganie czworogłowego', 'czworogłowy uda', null, null, null, 'Chwyć stopę od tyłu, przyciągnij piętę do pośladka, kolana blisko siebie, biodro lekko wypchnięte do przodu. Trzymaj się czegoś dla równowagi.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'quad_kneel' or name = 'Klęczące rozciąganie' or slug = 'quad_kneel')
   order by (name = 'Klęczące rozciąganie') desc, (icon_key = 'quad_kneel') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Klęczące rozciąganie (half-kneeling)', 'czworogłowy uda', null, null, null, 'Klęk jednonóż, druga stopa płasko przed Tobą. Biodro tylnej nogi przesuń do przodu aż poczujesz naciąg z przodu uda.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'quad_lying' or name = 'Leżące rozciąganie czworogłowego' or slug = 'quad_lying')
   order by (name = 'Leżące rozciąganie czworogłowego') desc, (icon_key = 'quad_lying') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Leżące rozciąganie czworogłowego', 'czworogłowy uda', null, null, null, 'Leż na boku, chwyć stopę i przyciągnij do pośladka. Mniej obciąża staw kolanowy niż wersja stojąca — dobra opcja przy wrażliwym kolanie.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'ham_seated' or name = 'Rozciąganie w siadzie prostym' or slug = 'ham_seated')
   order by (name = 'Rozciąganie w siadzie prostym') desc, (icon_key = 'ham_seated') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rozciąganie w siadzie prostym', 'dwugłowy uda', null, null, null, 'Jedna noga wyprostowana, druga ugięta stopą przy udzie. Pochyl tułów do wyprostowanej nogi, trzymając plecy proste.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'ham_strap' or name = 'Rozciąganie z paskiem' or slug = 'ham_strap')
   order by (name = 'Rozciąganie z paskiem') desc, (icon_key = 'ham_strap') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rozciąganie z paskiem (leżąc)', 'dwugłowy uda', null, null, null, 'Owiń pasek wokół stopy, unieś nogę prosto w górę. Najbardziej kontrolowana wersja — nie zgina kolana pod obciążeniem.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'forward_fold' or name = 'Standing forward fold' or slug = 'forward_fold')
   order by (name = 'Standing forward fold') desc, (icon_key = 'forward_fold') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Standing forward fold (lekki)', 'dwugłowy uda', null, null, null, 'Lekko ugięte kolana, pochyl się od bioder, ręce swobodnie w dół. Nie forsuj prostych nóg jeśli kolano protestuje.', 6);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'figure_four' or name = 'Figure-four stretch' or slug = 'figure_four')
   order by (name = 'Figure-four stretch') desc, (icon_key = 'figure_four') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Figure-four stretch (leżąc)', 'pośladki', null, null, null, 'Skrzyżuj kostkę jednej nogi na kolanie drugiej (układ „4”). Chwyć udo nogi wspierającej i przyciągnij do klatki.', 7);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'pigeon' or name = 'Pigeon stretch' or slug = 'pigeon')
   order by (name = 'Pigeon stretch') desc, (icon_key = 'pigeon') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Pigeon stretch (siedząc)', 'pośladki', null, null, null, 'Jedna noga ugięta z przodu, druga wyprostowana z tyłu, pochyl tułów do przodu. Jeśli kolano przedniej nogi protestuje — pomiń.', 8);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'knee_to_chest' or name = 'Knee-to-chest' or slug = 'knee_to_chest')
   order by (name = 'Knee-to-chest') desc, (icon_key = 'knee_to_chest') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Knee-to-chest', 'pośladki', null, null, null, 'Leż na plecach, przyciągnij jedno kolano do klatki piersiowej obiema rękami. Najbezpieczniejsza wersja przy wrażliwym kolanie.', 9);

  -- === Faza 2 — Po powrocie do zdrowia ===
  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (v_plan, 'Faza 2 — Po powrocie do zdrowia', 'Wchodzisz dopiero po zielonym świetle od fizjo. Struktura: 2-3 dni siłowni + 2-3 dni MMA, rozłożone tak by się nie kolidowały.', '4-5x / tydzień', 1)
  returning id into v_phase;

  -- --- Trening dolnych partii w Fazie 2 (po zgodzie fizjo) (4 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Trening dolnych partii w Fazie 2 (po zgodzie fizjo)', 'Dół', 'Progresja powolna, priorytet dla techniki, nie ciężaru.', 'gym', true, 0)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'goblet_squat' or name = 'Przysiad z hantlą' or slug = 'goblet_squat')
   order by (name = 'Przysiad z hantlą') desc, (icon_key = 'goblet_squat') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Przysiad z hantlą (goblet squat)', 'Czworogłowy, pośladki, core', 3, '8-10', null, 'Punkt wejścia po powrocie do zdrowia. Hantel przy klatce, siadaj między stopy, plecy proste, kolana w linii ze stopami.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'back_squat' or name = 'Przysiad ze sztangą' or slug = 'back_squat')
   order by (name = 'Przysiad ze sztangą') desc, (icon_key = 'back_squat') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Przysiad ze sztangą (back squat)', 'Czworogłowy, pośladki, dół pleców', 4, '5-6', null, 'Wchodzisz dopiero po pełnej progresji z goblet squat. Sztanga na górnej części pleców, głębokość dopasowana do komfortu kolana.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'lunge' or name = 'Wypady' or slug = 'lunge')
   order by (name = 'Wypady') desc, (icon_key = 'lunge') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wypady', 'Czworogłowy, pośladki, stabilizacja jednonóż', 3, '8/nogę', null, 'Krok do przodu, tylne kolano opada w kierunku podłogi, tułów pionowo. Wracaj kontrolowanie, bez odbicia.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'box_jump' or name = 'Wyskoki plyometryczne' or slug = 'box_jump')
   order by (name = 'Wyskoki plyometryczne') desc, (icon_key = 'box_jump') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wyskoki plyometryczne (box jump)', 'Moc nóg — eksplozywność', 3, '5', null, 'Wprowadzaj dopiero po pełnym powrocie do zdrowia. Ląduj miękko z ugięciem kolan, schodź ze skrzyni — nie zeskakuj.', 4);

  -- --- Element MMA-specific w siłowni (6 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Element MMA-specific w siłowni', 'MMA', 'Rotacyjna siła core, grip strength, wydolność interwałowa, mobilność bioder.', 'mma', false, 1)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'med_ball_rotation' or name = 'Rotacyjne rzuty piłką lekarską' or slug = 'med_ball_rotation')
   order by (name = 'Rotacyjne rzuty piłką lekarską') desc, (icon_key = 'med_ball_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacyjne rzuty piłką lekarską', 'Core rotacyjny, moc uderzenia', 3, '8/stronę', null, 'Rotacja prowadzona z bioder. Rzut w bok o ścianę z pełnym wyprostem ramion na końcu ruchu — pod moc uderzeń.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'kb_rotation' or name = 'Rotacje z kettlebell' or slug = 'kb_rotation')
   order by (name = 'Rotacje z kettlebell') desc, (icon_key = 'kb_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacje z kettlebell', 'Core rotacyjny, stabilizacja', 3, '10/stronę', null, 'Kettlebell trzymana oburącz przed klatką. Obracasz tułów kontrolując ruch bioder — pod obrót przy uderzeniach.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'farmers_walk' or name = 'Farmer''s walk' or slug = 'farmers_walk')
   order by (name = 'Farmer''s walk') desc, (icon_key = 'farmers_walk') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Farmer''s walk', 'Chwyt, core, obręcz barkowa', 3, '30-40m', null, 'Ciężary po bokach, plecy proste, spokojny chód, spięty core. Buduje siłę chwytu i stabilizację pod klincz.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'dead_hang' or name = 'Wisy na drążku' or slug = 'dead_hang')
   order by (name = 'Wisy na drążku') desc, (icon_key = 'dead_hang') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Wisy na drążku (dead hang)', 'Chwyt, barki, dekompresja kręgosłupa', 3, '20-30s', null, 'Pełny wis na wyprostowanych ramionach, barki lekko spięte. Świetne pod chwyty i zdrowie stawów barkowych.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'deep_squat_hold' or name = 'Deep squat hold' or slug = 'deep_squat_hold')
   order by (name = 'Deep squat hold') desc, (icon_key = 'deep_squat_hold') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Deep squat hold', 'Mobilność bioder/kostek', 2, '30-40s', null, 'Pełny przysiad, pięty na podłodze jeśli możliwe. Mobilność bioder i kostek — przydatna pod partery i kopnięcia.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'hip_90_90' or name = '90/90 hip stretch' or slug = 'hip_90_90')
   order by (name = '90/90 hip stretch') desc, (icon_key = 'hip_90_90') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, '90/90 hip stretch', 'Mobilność rotacyjna bioder', 2, '30s/stronę', null, 'Obie nogi ugięte pod kątem 90° (jedna z przodu, jedna z boku). Pochyl tułów do przedniej nogi — rotacja bioder pod kopnięcia.', 6);

  -- --- Dzień D — Moc, szybkość i mobilność (pełna wersja) (8 pozycji) ---
  insert into public.workout_days
    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
  values (v_phase, 'Dzień D — Moc, szybkość i mobilność (pełna wersja)', 'D', 'Ta sama idea co w Fazie 1, ale z pełnym obciążeniem nóg — skakanka, sprinty, odskoki, worek bokserski.', 'mobility', false, 2)
  returning id into v_day;

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'jump_rope' or name = 'Skakanka' or slug = 'jump_rope')
   order by (name = 'Skakanka') desc, (icon_key = 'jump_rope') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Skakanka', 'Szybkość stóp, koordynacja', 5, '1 min', null, 'Luźne nadgarstki, małe podskoki na palcach, rytmiczne tempo.', 1);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'lateral_bound' or name = 'Odskoki boczne' or slug = 'lateral_bound')
   order by (name = 'Odskoki boczne') desc, (icon_key = 'lateral_bound') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Odskoki boczne (lateral bounds)', 'Moc i szybkość zmiany kierunku', 3, '6/stronę', null, 'Odbij się jedną nogą w bok, wyląduj miękko na drugiej, zatrzymaj na moment przed kolejnym odbiciem.', 2);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'thoracic_rotation' or name = 'Rotacja odcinka piersiowego' or slug = 'thoracic_rotation')
   order by (name = 'Rotacja odcinka piersiowego') desc, (icon_key = 'thoracic_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacja odcinka piersiowego', 'Mobilność klatki, rotacja pod ciosy', 2, '10/stronę', null, 'Stopy nieruchome, ramiona rozłożone, rotuj tułów maksymalnie w jedną stronę, wracaj przez środek.', 3);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'band_punch' or name = 'Uderzenia z taśmą oporową' or slug = 'band_punch')
   order by (name = 'Uderzenia z taśmą oporową') desc, (icon_key = 'band_punch') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Uderzenia z taśmą oporową (pełna prędkość)', 'Szybkość i moc ciosu', 4, '15/stronę', null, 'Maksymalna szybkość wyrzutu, pełna kontrola powrotu — trenuje moc wybuchową ciosu.', 4);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'med_ball_rotation' or name = 'Rotacyjne rzuty piłką lekarską' or slug = 'med_ball_rotation')
   order by (name = 'Rotacyjne rzuty piłką lekarską') desc, (icon_key = 'med_ball_rotation') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Rotacyjne rzuty piłką lekarską (z impetem)', 'Moc rotacyjna pełna', 4, '8/stronę', null, 'Pełna rotacja bioder i tułowia, rzut z maksymalnym impetem o ścianę/partnera.', 5);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'heavy_bag' or name = 'Praca na worku bokserskim' or slug = 'heavy_bag')
   order by (name = 'Praca na worku bokserskim') desc, (icon_key = 'heavy_bag') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Praca na worku bokserskim (kombinacje)', 'Moc i szybkość ciosów', 5, '2 min rund', null, 'Kombinacje ciosów w tempie zbliżonym do walki, 1 min przerwy między rundami.', 6);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'sprint' or name = 'Sprinty interwałowe' or slug = 'sprint')
   order by (name = 'Sprinty interwałowe') desc, (icon_key = 'sprint') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, 'Sprinty interwałowe', 'Szybkość, moc eksplozywna nóg', 6, '10-15s / 45s przerwy', null, 'Maksymalna prędkość na krótkim dystansie, pełny odpoczynek między powtórzeniami.', 7);

  select id into v_cat from public.exercise_catalog
   where user_id is null and (icon_key = 'hip_90_90' or name = '90/90 hip stretch' or slug = 'hip_90_90')
   order by (name = '90/90 hip stretch') desc, (icon_key = 'hip_90_90') desc limit 1;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, name_override, muscle_group,
     target_sets, target_reps, target_note, technique_notes, order_index)
  values (v_day, v_cat, '90/90 hip stretch', 'Mobilność rotacyjna bioder', 2, '30s/stronę', null, 'Obie nogi ugięte pod kątem 90° (jedna z przodu, jedna z boku). Pochyl tułów do przedniej nogi.', 8);

-- ---------------------------------------------------------------
-- Szablon odtworzony wcześniej ze specyfikacji przestaje być publiczny —
-- zastępuje go plan z tego pliku. Nie kasujemy go, żeby nie zabrać planu
-- nikomu, kto zdążył go skopiować.
-- ---------------------------------------------------------------
  update public.plans set is_public = false
   where user_id is null and is_template
     and name = 'Powrót po kontuzji kolana + MMA'
     and id <> v_plan;

-- ---------------------------------------------------------------
-- Kopia na koncie właściciela, jeśli takie konto istnieje.
-- Dzięki temu plan jest od razu aktywny, a szablon zostaje dla innych.
-- ---------------------------------------------------------------
  select id into v_owner from auth.users where email = 'zdzis.paschalski@gmail.com' limit 1;

  if v_owner is not null then
    select id into v_copy from public.plans
     where user_id = v_owner and name = 'Plan treningowy: Siłownia + MMA' limit 1;

    if v_copy is null then
      insert into public.plans (user_id, name, description, goal, source, is_active)
      select v_owner, 'Plan treningowy: Siłownia + MMA', description, goal, 'template', true
        from public.plans where id = v_plan
      returning id into v_copy;

      update public.plans set is_active = false
       where user_id = v_owner and id <> v_copy;

      insert into public.phases (plan_id, name, description, frequency, order_index)
      select v_copy, name, description, frequency, order_index
        from public.phases where plan_id = v_plan;

      insert into public.workout_days
        (phase_id, name, short_label, description, day_type, tracks_pain, order_index)
      select np.id, d.name, d.short_label, d.description, d.day_type, d.tracks_pain, d.order_index
        from public.workout_days d
        join public.phases op on op.id = d.phase_id and op.plan_id = v_plan
        join public.phases np on np.plan_id = v_copy and np.order_index = op.order_index;

      insert into public.workout_exercises
        (workout_day_id, catalog_exercise_id, name_override, muscle_group,
         target_sets, target_reps, target_note, technique_notes, rest_seconds, order_index)
      select nd.id, we.catalog_exercise_id, we.name_override, we.muscle_group,
             we.target_sets, we.target_reps, we.target_note, we.technique_notes,
             we.rest_seconds, we.order_index
        from public.workout_exercises we
        join public.workout_days od on od.id = we.workout_day_id
        join public.phases op on op.id = od.phase_id and op.plan_id = v_plan
        join public.phases np on np.plan_id = v_copy and np.order_index = op.order_index
        join public.workout_days nd on nd.phase_id = np.id and nd.order_index = od.order_index;
    end if;
  end if;
end;
$$;
