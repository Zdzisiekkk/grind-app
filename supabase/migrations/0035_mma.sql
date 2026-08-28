-- ============================================================
-- Grind — Migracja 0035: MMA wchodzi do katalogu i do planów
--
-- Obserwacja z przeglądu treści: aplikacja nazywa się „siłownia + MMA”,
-- ale policzone dni w gotowych planach dawały 35 siłowych na 3 z MMA,
-- a w katalogu słowo „MMA” padało pięć razy. Ktoś, kto trenuje sporty walki,
-- otwierał katalog i nie znajdował pracy na worku, tarcz, klinczu ani rundy
-- sparingowej — musiał wpisać wszystko sam.
--
-- Ta migracja dokłada 24 pozycje i dwa szablony. Zapis jest inny niż przy
-- ciężarach i taki ma być: runda to nie seria, a minuty to nie powtórzenia.
-- Kolumna `metric` zna 'rounds' i 'time' od pierwszej migracji — tu wreszcie
-- się przydają.
--
-- Czego tu NIE ma i nie będzie: instrukcji technicznych zastępujących trenera.
-- Opisy mówią, jak zapisać i po czym poznać, że runda była zrobiona porządnie.
-- Techniki uczy się w klubie, z żywym człowiekiem.
-- ============================================================

insert into public.exercise_catalog
  (user_id, is_public, source, slug, name, name_en, description, cues, mistakes,
   category, muscle_group, muscles, muscles_secondary, equipment, metric)
values

-- ---------- UDERZENIA ----------
(null, true, 'curated', 'praca-na-worku',
 'Praca na worku', 'Heavy Bag Work',
 'Rundy na worku ciężkim. Zapisuj liczbę rund i ich długość, a w notatce to, nad czym pracowałeś — sama liczba rund po miesiącu nic nie powie. Worek nie oddaje, więc łatwo tu zgubić gardę; jeśli po rundzie ręce są nisko, runda była za długa albo za mocna.',
 array['Wracaj ręką na miejsce, nie zostawiaj jej w dole po ciosie', 'Oddech przy każdym uderzeniu, nie na zapas', 'Kończ rundę tak samo technicznie, jak ją zacząłeś'],
 array['Bicie w pełnej mocy przez całą rundę — to trening ego, nie techniki', 'Płaskie stopy i brak pracy nóg'],
 'MMA', 'Uderzenia',
 array['barki','plecy','core'], array['nogi','przedramiona'], array['worek','rękawice'], 'rounds'),

(null, true, 'curated', 'praca-na-tarczach',
 'Praca na tarczach', 'Pad Work / Mitts',
 'Rundy z partnerem trzymającym tarcze. Najbliżej realnej wymiany ze wszystkiego, co da się zapisać w dzienniku: tempo narzuca ktoś inny. Notuj, kto trzymał i jakie kombinacje — po kilku tygodniach widać, które wchodzą same, a które nadal trzeba myśleć.',
 array['Patrz na klatkę partnera, nie na tarcze', 'Po serii schodzisz z linii, a nie stoisz w miejscu'],
 array['Uderzanie w tarczę zamiast przez tarczę', 'Zapominanie o gardzie między kombinacjami'],
 'MMA', 'Uderzenia',
 array['barki','core'], array['nogi','plecy'], array['tarcze','rękawice','partner'], 'rounds'),

(null, true, 'curated', 'cien-shadowboxing',
 'Walka z cieniem', 'Shadowboxing',
 'Rundy bez sprzętu, przed lustrem albo bez. Najlepsza rozgrzewka i jedyne miejsce, gdzie można w spokoju poprawiać ruch nóg, bo nic nie odpycha ręki. Trzy rundy na rozgrzewkę przed treningiem siłowym też się liczą — zapisz je.',
 array['Ruch nóg przed ruchem rąk', 'Wyobrażaj sobie konkretnego przeciwnika, nie powietrze'],
 array['Machanie rękami bez zamiaru', 'Brak obrony — cień też „bije”'],
 'MMA', 'Uderzenia',
 array['barki','core'], array['nogi'], array['tylko masa ciała'], 'rounds'),

(null, true, 'curated', 'kopniecia-na-tarcze',
 'Kopnięcia na tarczę', 'Kick Pad Work',
 'Rundy kopnięć na dużą tarczę. Zapisuj stronę osobno, jeśli jedna wyraźnie odstaje — u większości ludzi tak jest i to normalne, dopóki różnica się nie pogłębia.',
 array['Bark i biodro idą razem z nogą', 'Stopa nogi podporowej obraca się, kolano nie skręca'],
 array['Kopnięcie samą nogą, bez obrotu biodra', 'Ręka opada przy kopnięciu'],
 'MMA', 'Kopnięcia',
 array['nogi','core'], array['biodra','pośladki'], array['tarcze','partner'], 'rounds'),

(null, true, 'curated', 'sparing-lekki',
 'Sparing lekki', 'Light Sparring',
 'Kontrolowana wymiana z partnerem. Zapisz rundy i partnera, a w notatce jedną rzecz, która nie wyszła — to jest cały sens prowadzenia dziennika ze sparingu. Ciężki sparing przed zawodami zapisuj osobno, żeby nie mieszać obciążeń.',
 array['Umów tempo PRZED pierwszą rundą, nie w trakcie', 'Ochraniacze zawsze, także na „lekki”'],
 array['Podkręcanie tempa, gdy dostaniesz mocniej', 'Sparing zamiast treningu techniki — to dwie różne rzeczy'],
 'MMA', 'Sparing',
 array['całe ciało'], array[]::text[], array['rękawice','ochraniacze','partner'], 'rounds'),

-- ---------- KLINCZ I ZAPASY ----------
(null, true, 'curated', 'klincz-praca-w-zwarciu',
 'Klincz — praca w zwarciu', 'Clinch Work',
 'Rundy walki o pozycję w zwarciu z partnerem. Najbardziej męcząca część treningu i ta, którą najłatwiej pominąć. Zapisuj rundy, a w notatce, czy kontrolowałeś, czy byłeś kontrolowany.',
 array['Łokcie ciasno przy sobie, głowa pod brodą partnera', 'Biodra bliżej niż ręce'],
 array['Siłowanie się ramionami zamiast pracy bioder', 'Wyprostowane plecy i zadarta głowa'],
 'MMA', 'Klincz',
 array['plecy','core','chwyt'], array['barki','nogi'], array['partner'], 'rounds'),

(null, true, 'curated', 'obalenia-sprint',
 'Wejścia w obalenie', 'Takedown Entries',
 'Powtórzenia samego wejścia (bez kończenia) na partnerze albo na manekinie. Zapisuj powtórzenia na stronę. To ruch, który musi być odruchem, a odruch bierze się z liczby, nie z natężenia.',
 array['Zmiana poziomu NOGAMI, nie zgięciem pleców', 'Głowa nad kolanem przy dojściu'],
 array['Schylanie się do nóg zamiast schodzenia w dół', 'Wejście z odległości, z której nie da się dojechać'],
 'MMA', 'Zapasy',
 array['nogi','core'], array['plecy','pośladki'], array['partner'], 'reps'),

(null, true, 'curated', 'obrona-obalenia-sprawl',
 'Sprawl — obrona obalenia', 'Sprawl',
 'Powtórzenia zrzutu bioder w dół i do tyłu. Robione na czas jako kondycja albo na powtórzenia jako technika — wybierz jedno i trzymaj się go, żeby liczby dało się porównywać.',
 array['Biodra w podłogę pierwsze, nogi w tył', 'Ciężar na barki partnera, nie na własne ręce'],
 array['Sam odskok nogami, bez opuszczenia bioder'],
 'MMA', 'Zapasy',
 array['core','pośladki'], array['barki','nogi'], array['tylko masa ciała'], 'reps'),

(null, true, 'curated', 'przechodzenie-gardy',
 'Przechodzenie gardy', 'Guard Passing Drill',
 'Rundy przechodzenia gardy z oporującym partnerem. Zapisuj rundy i to, ilu przejść dokończyłeś — sama liczba rund nie mówi, czy coś się poprawia.',
 array['Kontrola bioder przed próbą przejścia', 'Jedno przejście do końca zamiast trzech zaczętych'],
 array['Spieszenie się i oddawanie plecy', 'Praca samymi rękami'],
 'MMA', 'Parter',
 array['core','plecy'], array['nogi','chwyt'], array['partner'],  'rounds'),

(null, true, 'curated', 'ucieczki-z-dolu',
 'Ucieczki z dołu', 'Escapes from Bottom',
 'Rundy wychodzenia z niekorzystnych pozycji. Nudne, męczące i to właśnie one decydują o tym, jak wygląda druga runda walki.',
 array['Ramkuj, zanim zaczniesz się ruszać', 'Oddychaj — panika kosztuje więcej niż pozycja'],
 array['Wypychanie na siłę bez ramek', 'Wstrzymywanie oddechu pod ciężarem'],
 'MMA', 'Parter',
 array['core','biodra'], array['plecy','nogi'], array['partner'], 'rounds'),

(null, true, 'curated', 'shrimping',
 'Shrimping (ucieczka biodrem)', 'Shrimping / Hip Escape',
 'Przemieszczanie się po macie na plecach przez wypychanie bioder. Podstawowy ruch parteru i zarazem rozgrzewka. Zapisuj długość maty lub czas.',
 array['Bark i biodro odrywają się razem', 'Pchasz nogą, nie ciągniesz ręką'],
 array['Sam ruch bioder bez obrotu barków'],
 'MMA', 'Parter',
 array['core','biodra'], array['pośladki'], array['tylko masa ciała'], 'time'),

(null, true, 'curated', 'mostkowanie-bridge',
 'Mostkowanie', 'Wrestler''s Bridge',
 'Wypchnięcie bioder z leżenia, z kontrolą karku. Buduje ten sam ruch, którym zrzuca się przeciwnika z góry. Zaczynaj bez obciążenia karku i nie spiesz się — to jedno z niewielu ćwiczeń, gdzie pośpiech kończy się realną kontuzją.',
 array['Ciężar na barki i stopy, kark tylko prowadzi', 'Kilka tygodni samej masy ciała przed jakimkolwiek dociążeniem'],
 array['Przenoszenie ciężaru na sam kark', 'Dokładanie obciążenia przed opanowaniem ruchu'],
 'MMA', 'Kark',
 array['kark','pośladki'], array['plecy','core'], array['tylko masa ciała'], 'reps'),

(null, true, 'curated', 'kark-izometria',
 'Izometria karku', 'Neck Isometrics',
 'Napięcie karku w czterech kierunkach przeciw własnej dłoni albo gumie, bez ruchu głowy. Kark to jedyna partia, która w sportach walki chroni przed czymś więcej niż zadyszką. Zapisuj czas napięcia.',
 array['Napięcie narasta powoli, przez 2–3 sekundy', 'Bez zatrzymywania oddechu'],
 array['Szarpane napinanie', 'Zakres ruchu — to ma być izometria, głowa stoi'],
 'MMA', 'Kark',
 array['kark'], array['barki'], array['tylko masa ciała','gumy oporowe'], 'time'),

-- ---------- KONDYCJA POD WALKĘ ----------
(null, true, 'curated', 'interwaly-rundowe',
 'Interwały rundowe', 'Round-Based Intervals',
 'Praca w rytmie walki: rundy po 5 minut z minutą przerwy, cokolwiek robisz w środku. Sens jest w rytmie, nie w ćwiczeniu — organizm uczy się wracać do siebie w tę jedną minutę.',
 array['Przerwa jest częścią treningu — nie skracaj jej', 'Ostatnia runda ma wyglądać jak pierwsza'],
 array['Ciągły wysiłek bez przerw — to inny trening', 'Zaczynanie od tempa, którego nie utrzymasz'],
 'MMA', 'Kondycja',
 array['całe ciało'], array[]::text[], array['tylko masa ciała'], 'rounds'),

(null, true, 'curated', 'skakanka',
 'Skakanka', 'Jump Rope',
 'Klasyczna rozgrzewka przed treningiem walki. Rozgrzewa łydki i stopy, uczy lekkości i kosztuje minutę przygotowań. Zapisuj czas albo rundy.',
 array['Nadgarstki kręcą, nie całe ramiona', 'Nisko nad podłogą — wysoko skacze się tylko na pokaz'],
 array['Skakanie na piętach', 'Zbyt długa linka'],
 'MMA', 'Kondycja',
 array['łydki','core'], array['barki'], array['skakanka'], 'time'),

(null, true, 'curated', 'rzuty-pilka-lekarska-rotacja',
 'Rzuty piłką lekarską w rotacji', 'Rotational Medicine Ball Throw',
 'Rzut piłką w ścianę z obrotu. Najbliższy sztangi sposób na moc rotacyjną, czyli to, co przenosi cios z ziemi do ręki. Zapisuj powtórzenia na stronę.',
 array['Ruch zaczyna się od stopy, kończy w rękach', 'Rzucaj mocno — to ćwiczenie mocy, nie wytrzymałości'],
 array['Rzucanie samymi rękami', 'Zbyt ciężka piłka i wolny ruch'],
 'MMA', 'Moc rotacyjna',
 array['core','skośne brzucha'], array['barki','biodra'], array['piłka lekarska'], 'reps'),

(null, true, 'curated', 'przewroty-i-wstawanie',
 'Przewroty i wstawanie', 'Rolls and Get-ups',
 'Przewrót w przód, w tył, wstanie technicznie. Rozgrzewka każdego treningu zapasów i najprostszy sposób na to, żeby upadek przestał być zaskoczeniem.',
 array['Broda do klatki przy każdym przewrocie', 'Wstawaj przez rękę i biodro, nie przez kolano'],
 array['Przewrót przez sam kark', 'Wstawanie plecami do wyimaginowanego przeciwnika'],
 'MMA', 'Kondycja',
 array['core'], array['nogi','barki'], array['tylko masa ciała'], 'time'),

(null, true, 'curated', 'noszenie-partnera',
 'Noszenie partnera', 'Partner Carry',
 'Spacer z partnerem na barkach na dystans. Nic nie przygotowuje do klinczu tak jak cudzy ciężar, który się rusza. Zapisuj dystans lub czas.',
 array['Plecy proste, ciężar na barkach, nie na lędźwiach', 'Zaczynaj od krótkich odcinków'],
 array['Zaokrąglone plecy przy podnoszeniu', 'Partner cięższy o pół ciebie na pierwszym treningu'],
 'MMA', 'Kondycja',
 array['nogi','plecy','core'], array['barki'], array['partner'], 'distance'),

-- ---------- SIŁA POD SPORTY WALKI ----------
(null, true, 'curated', 'turkish-get-up',
 'Turkish get-up', 'Turkish Get-Up',
 'Wstawanie z leżenia z ciężarem nad głową. Najlepszy pojedynczy ruch łączący bark, biodro i core w jedną całość — dokładnie to, czego wymaga wyjście z parteru. Powoli, na powtórzenia na stronę.',
 array['Wzrok na ciężarze przez cały ruch', 'Każda pozycja pośrednia ma być stabilna sama w sobie'],
 array['Pośpiech', 'Zbyt duży ciężar na start — zacznij od butelki wody'],
 'MMA', 'Siła ogólna',
 array['barki','core'], array['nogi','pośladki'], array['kettlebell','hantle'], 'weight_reps'),

(null, true, 'curated', 'wymachy-kettlebell',
 'Wymachy kettlebell', 'Kettlebell Swing',
 'Wyprost bioder z odważnikiem. Buduje moc zawiasu biodrowego, który stoi za obaleniem i za każdym mocnym ciosem tylnej ręki.',
 array['Ruch z bioder, nie przysiad', 'Odważnik leci sam — nie unosisz go rękami'],
 array['Kucanie zamiast zawiasu', 'Przeprost lędźwi na górze'],
 'MMA', 'Moc',
 array['pośladki','dwugłowy uda'], array['plecy','core'], array['kettlebell'], 'weight_reps'),

(null, true, 'curated', 'podciaganie-z-recznikiem',
 'Podciąganie na ręczniku', 'Towel Pull-up',
 'Podciąganie z chwytem za przewieszony ręcznik. Ten sam ruch co zwykłe podciąganie, ale chwyt puszcza pierwszy — a w klinczu i w gi to właśnie chwyt decyduje.',
 array['Ręcznik owinięty raz, nie namotany na dłoń', 'Schodź kontrolowanie, nie spadaj'],
 array['Przechodzenie na ręcznik przed opanowaniem zwykłych podciągnięć'],
 'MMA', 'Chwyt',
 array['plecy','przedramiona'], array['biceps','core'], array['drążek','ręcznik'], 'reps'),

(null, true, 'curated', 'spacer-farmera',
 'Spacer farmera', 'Farmer''s Walk',
 'Marsz z ciężarem w obu rękach. Chwyt, kark, core i cierpliwość w jednym. Zapisuj dystans przy stałym ciężarze albo ciężar przy stałym dystansie — nie oba naraz.',
 array['Barki ściągnięte w dół i w tył', 'Normalny krok, bez dreptania'],
 array['Zaokrąglone plecy', 'Puszczanie ciężaru zamiast odstawienia'],
 'MMA', 'Chwyt',
 array['przedramiona','core'], array['barki','nogi'], array['hantle','kettlebell'], 'distance'),

-- ---------- MOBILNOŚĆ SPECYFICZNA ----------
(null, true, 'curated', 'mobilnosc-bioder-pod-garde',
 'Mobilność bioder pod gardę', 'Hip Mobility for Guard',
 'Zestaw otwierający biodra: 90/90, głęboki przysiad z rozepchnięciem kolan, koła biodrem w podporze. Robiony po treningu albo w dzień wolny. Zapisuj czas.',
 array['Bez odbijania — pozycja i oddech', 'Codziennie po pięć minut bije raz w tygodniu po trzydzieści'],
 array['Rozciąganie na zimno przed sparingiem'],
 'MMA', 'Mobilność',
 array['biodra'], array['pośladki','przywodziciele'], array['tylko masa ciała'], 'time'),

(null, true, 'curated', 'mobilnosc-barku-pod-obrone',
 'Mobilność barku pod gardę', 'Shoulder Mobility for Guard',
 'Krążenia z kijem, przeploty i praca w podporze. Bark trzymany w gardzie przez pięć rund robi się sztywny; ten zestaw ma temu przeciwdziałać.',
 array['Kij szeroko na start, zwężaj z tygodniami', 'Ruch wolny, bez szarpania'],
 array['Wymuszanie zakresu bólem'],
 'MMA', 'Mobilność',
 array['barki'], array['klatka piersiowa','plecy'], array['tylko masa ciała'], 'time')

on conflict do nothing;

-- ============================================================
-- Dwa szablony planów
-- ============================================================

create or replace function public.seed_add_exercise(
  p_day uuid, p_slug text, p_sets integer, p_reps text, p_order integer, p_note text default null
)
returns void language plpgsql as $$
declare v_ex uuid; v_mg text;
begin
  select id, muscle_group into v_ex, v_mg
  from public.exercise_catalog where slug = p_slug and user_id is null;
  if v_ex is null then raise exception 'Brak ćwiczenia w katalogu globalnym: %', p_slug; end if;
  insert into public.workout_exercises
    (workout_day_id, catalog_exercise_id, muscle_group, target_sets, target_reps, target_note, order_index)
  values (p_day, v_ex, v_mg, p_sets, p_reps, p_note, p_order);
end; $$;

create or replace function public.seed_template_plan(
  p_name text, p_description text, p_goal text, p_days integer,
  p_level text, p_equipment text, p_tags text[]
)
returns uuid language plpgsql as $$
declare v_plan uuid; v_phase uuid;
begin
  if exists (select 1 from public.plans where user_id is null and is_template and name = p_name) then
    return null;
  end if;
  insert into public.plans
    (user_id, name, description, goal, is_template, is_public, source,
     days_per_week, level, equipment, tags)
  values (null, p_name, p_description, p_goal, true, true, 'template',
          p_days::smallint, p_level, p_equipment, p_tags)
  returning id into v_plan;
  insert into public.phases (plan_id, name, description, frequency, order_index)
  values (v_plan, 'Plan', p_description, p_days || '× w tygodniu', 1)
  returning id into v_phase;
  return v_phase;
end; $$;

create or replace function public.seed_day(
  p_phase uuid, p_name text, p_type text, p_order integer, p_desc text default null
)
returns uuid language plpgsql as $$
declare v_day uuid;
begin
  insert into public.workout_days (phase_id, name, day_type, description, order_index)
  values (p_phase, p_name, p_type, p_desc, p_order)
  returning id into v_day;
  return v_day;
end; $$;

-- ------------------------------------------------------------
-- Walka + siła 4× — dla kogoś, kto trenuje MMA i chce dołożyć siłownię
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Walka + siła 4× w tygodniu',
    'Dwa treningi na macie i dwa na siłowni, ułożone tak, żeby sobie nie przeszkadzały: ciężary idą w dni po lżejszej pracy technicznej, a nie dzień przed sparingiem. Siła jest tu dodatkiem do walki, nie odwrotnie — dlatego serii jest mało, a przerwy są długie.',
    'Siła i kondycja pod sporty walki', 4, 'intermediate', 'gym',
    array['combat', 'strength', 'conditioning']
  );
  if v_p is null then raise notice 'Walka + siła 4× już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Mata A — uderzenia', 'mma', 1,
    'Technika i worek. Nogi zostają świeże na jutro.');
  perform public.seed_add_exercise(v_d, 'skakanka', 1, '6 min', 1, 'Rozgrzewka, nie trening.');
  perform public.seed_add_exercise(v_d, 'cien-shadowboxing', 3, '3 min', 2);
  perform public.seed_add_exercise(v_d, 'praca-na-tarczach', 5, '3 min', 3, 'Jeśli nie ma partnera — worek.');
  perform public.seed_add_exercise(v_d, 'praca-na-worku', 3, '3 min', 4);
  perform public.seed_add_exercise(v_d, 'kark-izometria', 4, '20 s', 5, 'Cztery kierunki po jednym podejściu.');

  v_d := public.seed_day(v_p, 'Siła A — dół i zawias', 'gym', 2,
    'Ciężko, mało serii, długie przerwy. Nie robimy tu kondycji.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 4, '5', 1, 'Przerwa 3 min. Zostaw dwa powtórzenia w zapasie.');
  perform public.seed_add_exercise(v_d, 'martwy-ciag-rumunski-hantle', 3, '8', 2);
  perform public.seed_add_exercise(v_d, 'wymachy-kettlebell', 4, '12', 3, 'Moc, nie zmęczenie — odkładaj, gdy zwalnia.');
  perform public.seed_add_exercise(v_d, 'spacer-farmera', 3, '30 m', 4);
  perform public.seed_add_exercise(v_d, 'mobilnosc-bioder-pod-garde', 1, '6 min', 5);

  v_d := public.seed_day(v_p, 'Mata B — zapasy i parter', 'mma', 3,
    'Najcięższy dzień tygodnia. Ciężarów po nim nie ma.');
  perform public.seed_add_exercise(v_d, 'przewroty-i-wstawanie', 1, '5 min', 1);
  perform public.seed_add_exercise(v_d, 'shrimping', 1, '4 min', 2);
  perform public.seed_add_exercise(v_d, 'obalenia-sprint', 5, '10 na stronę', 3);
  perform public.seed_add_exercise(v_d, 'klincz-praca-w-zwarciu', 5, '3 min', 4);
  perform public.seed_add_exercise(v_d, 'ucieczki-z-dolu', 4, '3 min', 5);
  perform public.seed_add_exercise(v_d, 'mostkowanie-bridge', 3, '10', 6, 'Bez obciążenia. Serio.');

  v_d := public.seed_day(v_p, 'Siła B — góra i chwyt', 'gym', 4,
    'Ciągnięcie przed pchaniem: w klinczu ciągniesz częściej.');
  perform public.seed_add_exercise(v_d, 'podciaganie-z-recznikiem', 4, 'maks', 1, 'Nie wychodzi? Zwykły drążek.');
  perform public.seed_add_exercise(v_d, 'wyciskanie-hantli-nad-glowa', 3, '8', 2);
  perform public.seed_add_exercise(v_d, 'wioslowanie-sztanga-w-opadzie', 4, '8', 3);
  perform public.seed_add_exercise(v_d, 'turkish-get-up', 3, '3 na stronę', 4, 'Powoli. To nie jest ćwiczenie na czas.');
  perform public.seed_add_exercise(v_d, 'rzuty-pilka-lekarska-rotacja', 4, '6 na stronę', 5);
  perform public.seed_add_exercise(v_d, 'face-pull', 3, '15', 6);
end $$;

-- ------------------------------------------------------------
-- Obóz przedstartowy 5× — osiem tygodni przed walką
-- ------------------------------------------------------------
do $$
declare v_p uuid; v_d uuid;
begin
  v_p := public.seed_template_plan(
    'Obóz przedstartowy 5× w tygodniu',
    'Osiem tygodni przed walką: dużo rund, mało nowych rzeczy. Siła schodzi do jednego krótkiego treningu podtrzymującego, bo w obozie nie buduje się siły — pilnuje się, żeby nie uciekła. Jeśli nie masz konkretnej daty walki, to nie jest plan dla Ciebie: tego tempa nie da się utrzymać na okrągło.',
    'Szczyt formy na konkretną datę', 5, 'advanced', 'gym',
    array['combat', 'conditioning', 'peak']
  );
  if v_p is null then raise notice 'Obóz przedstartowy już istnieje — pomijam.'; return; end if;

  v_d := public.seed_day(v_p, 'Poniedziałek — uderzenia', 'mma', 1, 'Objętość techniczna.');
  perform public.seed_add_exercise(v_d, 'skakanka', 1, '8 min', 1);
  perform public.seed_add_exercise(v_d, 'cien-shadowboxing', 3, '3 min', 2);
  perform public.seed_add_exercise(v_d, 'praca-na-tarczach', 6, '3 min', 3);
  perform public.seed_add_exercise(v_d, 'kopniecia-na-tarcze', 4, '3 min', 4);
  perform public.seed_add_exercise(v_d, 'kark-izometria', 4, '25 s', 5);

  v_d := public.seed_day(v_p, 'Wtorek — zapasy', 'mma', 2, 'Obalenia i obrona obalenia.');
  perform public.seed_add_exercise(v_d, 'przewroty-i-wstawanie', 1, '6 min', 1);
  perform public.seed_add_exercise(v_d, 'obalenia-sprint', 6, '10 na stronę', 2);
  perform public.seed_add_exercise(v_d, 'obrona-obalenia-sprawl', 5, '10', 3);
  perform public.seed_add_exercise(v_d, 'klincz-praca-w-zwarciu', 6, '3 min', 4);
  perform public.seed_add_exercise(v_d, 'mostkowanie-bridge', 3, '12', 5);

  v_d := public.seed_day(v_p, 'Środa — siła podtrzymująca', 'gym', 3,
    'Krótko i ciężko. Wchodzisz i wychodzisz w 40 minut.');
  perform public.seed_add_exercise(v_d, 'przysiad-ze-sztanga', 3, '3', 1, 'Ciężko, ale bez maksów. Do zawodów zostało za mało czasu na ryzyko.');
  perform public.seed_add_exercise(v_d, 'podciaganie-z-recznikiem', 3, '5', 2);
  perform public.seed_add_exercise(v_d, 'wymachy-kettlebell', 3, '10', 3);
  perform public.seed_add_exercise(v_d, 'mobilnosc-barku-pod-obrone', 1, '5 min', 4);

  v_d := public.seed_day(v_p, 'Czwartek — sparing', 'mma', 4,
    'Dzień, pod który ułożona jest reszta tygodnia.');
  perform public.seed_add_exercise(v_d, 'cien-shadowboxing', 2, '3 min', 1);
  perform public.seed_add_exercise(v_d, 'sparing-lekki', 5, '5 min', 2, 'Tempo umówione przed pierwszą rundą.');
  perform public.seed_add_exercise(v_d, 'przechodzenie-gardy', 3, '4 min', 3);
  perform public.seed_add_exercise(v_d, 'mobilnosc-bioder-pod-garde', 1, '8 min', 4);

  v_d := public.seed_day(v_p, 'Sobota — kondycja rundowa', 'conditioning', 5,
    'Rytm walki. Przerwa jest częścią treningu.');
  perform public.seed_add_exercise(v_d, 'interwaly-rundowe', 5, '5 min', 1, 'Minuta przerwy między rundami. Nie skracaj jej.');
  perform public.seed_add_exercise(v_d, 'noszenie-partnera', 4, '40 m', 2);
  perform public.seed_add_exercise(v_d, 'spacer-farmera', 3, '40 m', 3);
  perform public.seed_add_exercise(v_d, 'shrimping', 1, '5 min', 4);
end $$;

drop function if exists public.seed_add_exercise(uuid, text, integer, text, integer, text);
drop function if exists public.seed_day(uuid, text, text, integer, text);
drop function if exists public.seed_template_plan(text, text, text, integer, text, text, text[]);
