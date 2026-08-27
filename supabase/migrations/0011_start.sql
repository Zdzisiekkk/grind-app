-- ============================================================
-- Grind — Migracja 0011: start dla nowej osoby
--
-- Do tej pory aplikacja zakładała, że wie o użytkowniku wszystko: kontuzja
-- kolana, MMA, własny plan. Pierwsza obca osoba nie ma nic — i widziała pusty
-- pulpit z napisem „wybierz plan". Ta migracja daje jej z czego wybierać:
--
--   1. ćwiczenia z masą ciała (bez nich nie da się ułożyć planu domowego),
--   2. opis szablonu: ile dni w tygodniu, dla kogo, jaki sprzęt,
--   3. pola profilu, które wypełnia kreator startowy,
--   4. pięć gotowych planów.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ćwiczenia z masą ciała
-- ------------------------------------------------------------
insert into public.exercise_catalog
  (user_id, is_public, source, slug, name, name_en, description, cues, mistakes,
   category, muscle_group, muscles, muscles_secondary, equipment, metric)
values

(null, true, 'curated', 'pompki',
 'Pompki', 'Push-up',
 'Dłonie nieco szerzej niż barki, palce skierowane do przodu. Ciało od głowy do pięt tworzy jedną linię — napnij pośladki i brzuch. Opuszczaj się aż klatka będzie kilka centymetrów nad podłogą, łokcie pod kątem około 45° do tułowia. Wypchnij się z powrotem bez zapadania bioder.',
 array['Pośladki i brzuch napięte przez cały ruch', 'Łokcie do tyłu i lekko na zewnątrz, nie prostopadle do boków', 'Wzrok w podłogę pół metra przed dłońmi'],
 array['Zapadnięte biodra i wygięte lędźwie', 'Skrócony zakres — zatrzymywanie się w połowie'],
 'Klatka piersiowa', 'Klatka piersiowa',
 array['klatka piersiowa'], array['triceps','przód barków','core'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'pompki-diamentowe',
 'Pompki diamentowe', 'Diamond Push-up',
 'Jak zwykłe pompki, ale dłonie razem pod klatką, kciuki i palce wskazujące stykają się w kształt rombu. Łokcie prowadź blisko tułowia. Trudniejsza wersja — jeśli nie wychodzi z podłogi, oprzyj dłonie o ławkę albo parapet.',
 array['Łokcie ocierają o żebra, nie uciekają na boki', 'Barki z dala od uszu'],
 array['Rozjeżdżanie łokci — wtedy to zwykłe pompki', 'Wypychanie biodrami zamiast ramionami'],
 'Ramiona', 'Triceps',
 array['triceps'], array['klatka piersiowa','przód barków'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'dipy-na-krzesle',
 'Dipy na krześle', 'Bench Dip',
 'Usiądź na krawędzi krzesła lub kanapy, dłonie obok bioder, palce skierowane do przodu. Zsuń biodra poza krawędź i opuszczaj się, zginając łokcie do kąta prostego. Wypchnij się w górę tricepsami. Nogi bliżej ciała = łatwiej, wyprostowane = trudniej.',
 array['Łokcie prowadź do tyłu, nie na boki', 'Barki ściągnięte w dół, nie podjeżdżają do uszu'],
 array['Zbyt głębokie opuszczanie i przeciążenie przodu barku', 'Odsuwanie bioder daleko od krzesła'],
 'Ramiona', 'Triceps',
 array['triceps'], array['przód barków','klatka piersiowa'], array['masa ciała','krzesło'], 'reps'),

(null, true, 'curated', 'przysiad-masa-ciala',
 'Przysiad z masą ciała', 'Bodyweight Squat',
 'Stopy na szerokość barków, palce lekko na zewnątrz. Zainicjuj ruch biodrami do tyłu, potem zginaj kolana. Schodź tak nisko, jak pozwala Ci mobilność bez zaokrąglania pleców. Ramiona możesz wyciągnąć przed siebie dla równowagi.',
 array['Kolana podążają za palcami stóp, nie zapadają do środka', 'Cały stopa na podłodze — pięta nie odrywa się', 'Klatka wysoko, wzrok przed siebie'],
 array['Zapadanie kolan do środka', 'Zaokrąglenie lędźwi na dole ruchu'],
 'Nogi', 'Czworogłowy',
 array['czworogłowy uda'], array['pośladki','dwugłowy uda'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'przysiad-bulgarski',
 'Przysiad bułgarski', 'Bulgarian Split Squat',
 'Stań tyłem do ławki lub krzesła, oprzyj na nim grzbiet tylnej stopy. Przednia stopa około 60-70 cm przed podporą. Opuszczaj się pionowo w dół, aż tylne kolano prawie dotknie podłogi. Cały ciężar na przedniej nodze.',
 array['Ruch pionowy — nie wypychaj kolana daleko przed palce', 'Tułów lekko pochylony do przodu odciąża kolano', 'Napnij pośladek przedniej nogi na górze'],
 array['Za bliska odległość od podpory — kolano przeciążone', 'Odpychanie się tylną nogą'],
 'Nogi', 'Czworogłowy',
 array['czworogłowy uda','pośladki'], array['dwugłowy uda','core'], array['masa ciała','ławka'], 'reps'),

(null, true, 'curated', 'wypady-w-miejscu',
 'Wypady w miejscu', 'Static Lunge',
 'Zrób krok w przód, ustaw stopy w rozkroku przód-tył. Opuszczaj biodra pionowo w dół, aż oba kolana zegną się do kąta prostego. Wróć wypychając się piętą przedniej nogi. Zrób wszystkie powtórzenia na jedną nogę, potem zmień.',
 array['Tułów pionowo, nie pochylaj się do przodu', 'Przednia pięta wbita w podłogę'],
 array['Uderzanie tylnym kolanem o podłogę', 'Za krótki rozkrok — kolano ucieka przed palce'],
 'Nogi', 'Czworogłowy',
 array['czworogłowy uda'], array['pośladki','dwugłowy uda'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'most-biodrowy',
 'Most biodrowy', 'Glute Bridge',
 'Połóż się na plecach, kolana zgięte, stopy płasko na podłodze blisko pośladków. Napnij pośladki i unieś biodra aż tułów i uda utworzą jedną linię. Zatrzymaj na sekundę u góry, opuść kontrolowanie.',
 array['Ruch napędzają pośladki, nie lędźwie', 'Żebra ściągnięte w dół, brzuch napięty', 'Sekunda zatrzymania na górze'],
 array['Przeprost w lędźwiach zamiast wyprostu bioder', 'Odpychanie się palcami stóp'],
 'Nogi', 'Pośladki',
 array['pośladki'], array['dwugłowy uda','core'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'superman',
 'Superman', 'Superman Hold',
 'Połóż się na brzuchu, ramiona wyciągnięte przed siebie. Unieś jednocześnie ramiona, klatkę i nogi kilka centymetrów nad podłogę, ściskając pośladki. Utrzymaj napięcie, oddychaj, opuść kontrolowanie.',
 array['Szyja w przedłużeniu kręgosłupa — wzrok w podłogę', 'Unieś tyle, ile daje napięcie, a nie ile się da'],
 array['Odchylanie głowy do tyłu', 'Szarpane unoszenie z rozpędu'],
 'Plecy', 'Prostowniki grzbietu',
 array['prostowniki grzbietu'], array['pośladki','tylne barki'], array['masa ciała'], 'reps'),

(null, true, 'curated', 'hollow-hold',
 'Hollow hold', 'Hollow Body Hold',
 'Leżąc na plecach, dociśnij lędźwie do podłogi. Unieś łopatki i wyprostowane nogi tak, żeby ciało utworzyło płytką łódkę. Ramiona nad głową albo wzdłuż ciała, jeśli za trudno. Utrzymuj napięcie i oddychaj.',
 array['Lędźwie PRZYKLEJONE do podłogi — to jest cała istota ćwiczenia', 'Gdy plecy się odrywają, ugnij kolana lub opuść ramiona'],
 array['Prześwit pod lędźwiami', 'Wstrzymywanie oddechu'],
 'Brzuch', 'Core',
 array['mięsień prosty brzucha'], array['zginacze bioder'], array['masa ciała'], 'time'),

(null, true, 'curated', 'wspinaczka-gorska',
 'Wspinaczka górska', 'Mountain Climber',
 'Podpór przodem jak do pompki, ciało w linii prostej. Naprzemiennie przyciągaj kolana do klatki w szybkim, ale kontrolowanym tempie. Biodra pozostają nisko przez cały czas.',
 array['Biodra nie podskakują w górę', 'Dłonie dokładnie pod barkami', 'Tempo szybkie, ale bez utraty pozycji'],
 array['Wypinanie pośladków do góry', 'Skakanie stopami zamiast pracy brzucha'],
 'Kondycja', 'Core',
 array['core'], array['barki','czworogłowy uda'], array['masa ciała'], 'time'),

(null, true, 'curated', 'burpees',
 'Burpees', 'Burpee',
 'Ze stania zejdź do podporu przodem, zrób pompkę, przyciągnij stopy pod klatkę i wyskocz w górę z klaśnięciem nad głową. Wersja łatwiejsza: bez pompki i bez wyskoku, samo wejście i wyjście z podporu.',
 array['Kontroluj lądowanie — miękkie kolana', 'Plecy proste przy schodzeniu do podporu'],
 array['Zapadanie bioder w podporze przy zmęczeniu', 'Twarde lądowanie na wyprostowanych nogach'],
 'Kondycja', 'Kondycja',
 array['całe ciało'], array[]::text[], array['masa ciała'], 'reps'),

(null, true, 'curated', 'unoszenie-nog-lezac',
 'Unoszenie nóg w leżeniu', 'Lying Leg Raise',
 'Leżąc na plecach, dłonie pod pośladkami dla podparcia lędźwi. Unieś wyprostowane nogi do pionu, opuszczaj powoli, zatrzymując tuż nad podłogą. Jeśli lędźwie się odrywają, ugnij kolana.',
 array['Lędźwie dociśnięte do podłogi', 'Opuszczanie wolniejsze niż unoszenie'],
 array['Odrywanie lędźwi i przeciążanie kręgosłupa', 'Rzucanie nogami z rozpędu'],
 'Brzuch', 'Core',
 array['dolna część brzucha'], array['zginacze bioder'], array['masa ciała'], 'reps')

on conflict do nothing;

-- ------------------------------------------------------------
-- 2. Opis szablonu — po tym kreator dobiera plan
-- ------------------------------------------------------------
alter table public.plans
  add column if not exists days_per_week smallint
    check (days_per_week is null or days_per_week between 1 and 7);

alter table public.plans
  add column if not exists level text
    check (level is null or level in ('beginner', 'intermediate', 'advanced'));

-- 'gym' — potrzebna siłownia, 'minimal' — hantle i drążek, 'home' — nic.
alter table public.plans
  add column if not exists equipment text
    check (equipment is null or equipment in ('gym', 'minimal', 'home'));

-- Do czego plan się nadaje: 'strength', 'muscle', 'fatloss', 'combat', 'rehab'.
alter table public.plans
  add column if not exists tags text[] not null default '{}';

-- ------------------------------------------------------------
-- 3. Pola, które wypełnia kreator startowy
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists goal text
    check (goal is null or goal in ('cut', 'maintain', 'bulk'));

alter table public.profiles
  add column if not exists activity_level text
    check (activity_level is null or activity_level in ('sedentary', 'light', 'moderate', 'high', 'athlete'));

alter table public.profiles
  add column if not exists experience text
    check (experience is null or experience in ('beginner', 'intermediate', 'advanced'));

alter table public.profiles
  add column if not exists equipment text
    check (equipment is null or equipment in ('gym', 'minimal', 'home'));

-- Ile treningów tygodniowo uznajemy za komplet. Do tej pory Health Score
-- miał tu zaszyte na sztywno 4 — teraz mówi to użytkownik.
alter table public.profiles
  add column if not exists weekly_workouts smallint
    check (weekly_workouts is null or weekly_workouts between 1 and 14);

-- Pusty = kreator jeszcze nie przeszedł. Po tym poznajemy, kogo o niego prosić.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;
