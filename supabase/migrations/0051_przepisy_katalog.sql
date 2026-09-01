-- ============================================================
-- 0051: 97 przepisów z krokami wykonania
--
-- Treść pochodzi z polskiej Książki kucharskiej na Wikibooks (CC BY-SA 4.0).
-- Licencja wymaga podania źródła, więc każdy przepis niesie autora, licencję
-- i odnośnik do strony, z której pochodzi - a ekran przepisu je pokazuje.
-- Tak samo jak przy ćwiczeniach z wger.
--
-- MAKRA NIE SĄ WPISANE Z RĘKI. Poniżej są wyłącznie gramy składników; kalorie
-- dania liczy widok v_recipe_totals z wartości surowców z migracji 0050.
-- Dzięki temu nie da się tu wstawić przepisu ze zmyśloną kalorycznością -
-- kaloryczności dania w ogóle nie ma w danych.
--
-- CO ZNACZY makra_orientacyjne. Książka kucharska pisze "2 łyżki oleju",
-- a nie "20 g oleju". Przepis, w którym choć jeden składnik przeszedł przez
-- miarę domową albo przez wagę sztuki, dostaje ten znacznik, a ekran mówi
-- wprost, że to szacunek.
--
-- Plik powstaje ze skryptu (npm run import:przepisy). Poprawki nanoś
-- w scripts/dane/, nie tutaj.
-- ============================================================

do $$
declare v_id uuid;
begin

if exists (select 1 from public.recipes where user_id is null) then
  raise notice 'Katalog przepisów już jest - pomijam.';
  return;
end if;

-- Ajntopf - 310 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ajntopf', '🥗', 8, 20,
        'trudny', array['warzywa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FAjntopf')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Bulion warzywny', 200, 4, 0.2, 0.6, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Ziemniaki', 300, 77, 2, 17.5, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Kalarepa', 400, 27, 1.7, 6.2, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kalarepa' limit 1)),
    (v_id, 'Marchew', 70, 41, 0.9, 9.6, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Seler korzeniowy', 400, 42, 1.5, 9.2, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler korzeniowy' limit 1)),
    (v_id, 'Pietruszka korzeń', 80, 75, 2.9, 17, 0.8, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Por', 150, 61, 1.5, 14.2, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Por' limit 1)),
    (v_id, 'Kapusta biała', 25, 25, 1.3, 5.8, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Koperek', 5, 43, 3.5, 7, 1.1, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koperek' limit 1)),
    (v_id, 'Margaryna', 100, 717, 0.2, 0.7, 80, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Mąka pszenna', 200, 364, 10.3, 76.3, 1, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Śmietana 18%', 180, 184, 2.6, 3.6, 18, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Przyprawa do zup', 2, 150, 10, 20, 3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Przyprawa do zup' limit 1)),
    (v_id, 'Bazylia', 0.5, 233, 14.4, 47.8, 4, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bazylia' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Umyć włoszczyznę, ziemniaki i je obrać. Pokroić na kawałki i ugotować w wodzie, bulionie lub wywarze.', null),
    (v_id, 1, 'Zrobić zasmażkę, rozgrzewając w rondlu masło i po oprószeniu go mąką przyrumienić.', null),
    (v_id, 2, 'Dodać zasmażkę do zupy i mieszając zagotować. Przyprawić solą, pieprzem, dodać przyprawę do zup i (ewentualnie) kminek.', null),
    (v_id, 3, 'Wlać śmietanę wymieszaną z kilkoma łyżkami zupy, zagotować i posypać zieleniną.', null);

-- Amerykańskie naleśniki - 532 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Amerykańskie naleśniki', '🥞', 3, 25,
        'sredni', array['naleśniki', 'kuchnia amerykańska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FAmeryka%C5%84skie_nale%C5%9Bniki')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 260, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Maślanka', 500, 40, 3.3, 4.7, 0.9, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Maślanka' limit 1)),
    (v_id, 'Proszek do pieczenia', 4, 97, 0, 23, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Proszek do pieczenia' limit 1)),
    (v_id, 'Soda oczyszczona', 5, 0, 0, 0, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Soda oczyszczona' limit 1)),
    (v_id, 'Jajko kurze', 55, 143, 12.6, 0.7, 9.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sól', 3, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Syrop klonowy', 10, 260, 0, 67, 0.1, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Syrop klonowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Masło rozpuścić w rondelku i odstawić do przestudzenia.', null),
    (v_id, 1, 'W jednej misce wymieszać mąkę z solą, cukrem, sodą i proszkiem do pieczenia.', null),
    (v_id, 2, 'W drugiej wymieszać maślankę z jajkiem i przestudzonym, wcześniej roztopionym masłem.', null),
    (v_id, 3, 'Następnie połączyć suche składniki z mokrymi i tak powstałe ciasto odstawić na godzinę do lodówki.', null),
    (v_id, 4, 'Na dobrze rozgrzanej patelni usmażyć (na maśle lub na oleju) nieduże placki, z obu stron na złoty kolor.', null);

-- Boczek pieczony - 1031 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Boczek pieczony', '🍖', 4, 195,
        'sredni', array['wieprzowina']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FBoczek_pieczony')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Boczek surowy', 1000, 393, 12.6, 0, 37.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Cebula', 300, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 16, 149, 6.4, 33.1, 0.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Papryka czerwona', 10, 31, 1, 6, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Majeranek', 15, 271, 12.7, 60.6, 7, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majeranek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Czosnek obrać i rozetrzeć z solą.', null),
    (v_id, 1, 'Boczek umyć, odkroić plaster grubości centymetra. Pozostałą część natrzeć solą z czosnkiem, posypać majerankiem, solą, pieprzem i papryką. Owinąć w folię i odstawić w chłodne miejsce na około 2 godziny.', 120),
    (v_id, 2, 'Mięso ułożyć w brytfannie.', null),
    (v_id, 3, 'Odkrojony plaster pokroić w kostkę i zrumienić na patelni.', null),
    (v_id, 4, 'Gorącym tłuszczem polać mięso w brytfannie i piec około 45 minut w temperaturze .', 45),
    (v_id, 5, 'Cebulę obrać, pokroić w cząstki, włożyć do brytfanny i piec razem jeszcze 15 minut.', 15);

-- Brownies - 580 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Brownies', '🍰', 12, 45,
        'sredni', array['ciasto', 'kuchnia amerykańska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FBrownies')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Masło', 330, 735, 0.7, 0.7, 82, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Czekolada gorzka', 340, 546, 7.8, 45.9, 35.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czekolada gorzka' limit 1)),
    (v_id, 'Jajko kurze', 330, 143, 12.6, 0.7, 9.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Ekstrakt waniliowy', 13, 288, 0.1, 12.7, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ekstrakt waniliowy' limit 1)),
    (v_id, 'Mąka pszenna', 100, 364, 10.3, 76.3, 1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Sól', 6, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Czekolada gorzka', 125, 546, 7.8, 45.9, 35.4, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czekolada gorzka' limit 1)),
    (v_id, 'Czekolada gorzka', 125, 546, 7.8, 45.9, 35.4, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czekolada gorzka' limit 1)),
    (v_id, 'Cukier puder', 10, 400, 0, 100, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier puder' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Nagrzać piekarnik do ok. . Stopić masło i czekoladę na małym ogniu.', null),
    (v_id, 1, 'W osobnej misce ubić jajka razem z cukrem i ekstraktem z wanilii.', null),
    (v_id, 2, 'Ostudzić trochę czekoladę, potem dodać miksturę z jajkiem i wszystko dobrze ubić. Dodać mąkę i sól. Następnie wsypać czekoladowe guziczki. Zmieszać wszystko razem i wlać do formy.', null),
    (v_id, 3, 'Piec ok. 25 minut. Kiedy ciasto jest gotowe, góra jest trochę jaśniejsza, bledsza, a środek jest ciemny i trochę gumowy. Koniecznie sprawdzać ciasto, różnica między gumowym a wyschniętym „brownie” to tylko kilka minut.', 25),
    (v_id, 4, 'Uwaga! Ciasto będzie wciąż się piec, nawet w czasie stygnięcia.', null);

-- Caldo verde - 112 kcal/porcja, 9 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Caldo verde', '🍲', 9, 20,
        'sredni', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCaldo_verde')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Bulion warzywny', 2500, 4, 0.2, 0.6, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Ziemniaki', 300, 77, 2, 17.5, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Por', 150, 61, 1.5, 14.2, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Por' limit 1)),
    (v_id, 'Cebula', 50, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Jarmuż', 100, 49, 4.3, 8.8, 0.9, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jarmuż' limit 1)),
    (v_id, 'Kiełbasa', 100, 298, 15, 1.5, 26, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kiełbasa' limit 1)),
    (v_id, 'Koncentrat pomidorowy', 15, 82, 4.3, 18.9, 0.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koncentrat pomidorowy' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Koperek', 8, 43, 3.5, 7, 1.1, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koperek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Na rozgrzanym maśle zeszklić pokrojoną w kostkę cebulę, pod koniec dodać też posiekany czosnek. Potem wlać oliwę i dodać pokrojony por, po czym dusić przez około 3 minuty do zmięknięcia.', 3),
    (v_id, 1, 'Kolejno dodać obrane i pokrojone ziemniaki, doprawić solą i podgrzewać przez 3 minuty. Całość zalać gorącym bulionem, doprawić pieprzem i gotować przez 15 minut do momentu, aż ziemniaki będą prawie miękkie.', 3),
    (v_id, 2, 'Następnie dodać umyte i posiekane liście jarmużu oraz koncentrat pomidorowy i gotować przez kolejne 10 minut.', 10),
    (v_id, 3, 'Tymczasem pokrojoną w kostkę (lub plasterki) kiełbasę chorizo obsmażyć na patelni przez 2-3 minuty. Kiełbasę wraz z wytopionym tłuszczem dodać do zupy, przez minutę podgrzewać ją i na koniec zmieszać z dorzuconym koperkiem.', 3);

-- Cepeliny - 277 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Cepeliny', '🍖', 12, 25,
        'latwy', array['kuchnia litewska', 'kuchnia polska', 'mięso', 'ziemniaki']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCepeliny')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 3000, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Wołowina', 500, 175, 20.5, 0, 10, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wołowina' limit 1)),
    (v_id, 'Słonina', 15, 812, 2.9, 0, 88.7, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Słonina' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Majeranek', 2, 271, 12.7, 60.6, 7, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majeranek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Polędwicę i łój posiekać nożem, dodając do smaku pieprz, roztarty z solą czosnek i majeranek. Całość farszu starannie wyrobić na gładką masę.', null),
    (v_id, 1, 'Surowe ziemniaki po umyciu obrać i zetrzeć na tarce. Odcisnąć sok i odczekać aż na dnie oddzieli się krochmal, który należy dodać do utartych ziemniaków (pozostały płyn wylać).', null),
    (v_id, 2, 'Resztę ziemniaków (ugotowanych) roztłuc i połączyć z utartymi, posolić i dobrze wyrobić w jednolitą masę. Z niej formować (jak pyzy) kule wielkości dużego jabłka; po spłaszczeniu nakładać w nie farsz i kształtować w duże podłużne kluchy.', null),
    (v_id, 3, 'Wyrobione pyzy wrzucić do wrzącej osolonej wody i gotować przez pół godziny; dla zachowania kształtu wyjmować łyżką cedzakową.', null),
    (v_id, 4, 'Podawać po polaniu stopionym masłem albo śmietaną.', null);

-- Chleb turecki - 786 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Chleb turecki', '🍞', 7, 30,
        'sredni', array['pieczywo', 'kuchnia polska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FChleb_turecki')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 1000, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Miód', 100, 322, 0.3, 79.5, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Miód' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Mleko 3,2%', 250, 61, 3.3, 4.7, 3.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 50, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Drożdże świeże', 60, 105, 12, 12, 1.5, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Drożdże świeże' limit 1)),
    (v_id, 'Rodzynki', 50, 299, 3.1, 79.2, 0.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rodzynki' limit 1)),
    (v_id, 'Migdały', 30, 579, 21.2, 21.6, 49.9, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Migdały' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Przesiać i ogrzać mąkę.', null),
    (v_id, 1, 'Drożdże wymieszać z miodem, ½ mleka i odrobiną mąki w ilości, która zapewni po wyrośnięciu konsystencję gęstej śmietany.', null),
    (v_id, 2, 'Do ubitych z cukrem jajek dolać resztę mleka, wymieszać z rozczynem i zarobić z mąką. Do tak przygotowanego ciasta dodać stopniowo stopione masło dokładnie wyrabiając, a na koniec wsypać rodzynki i dodać szczyptę soli.', null),
    (v_id, 3, 'Dokładnie wyrobione i uformowane w wałki ciasto nakładać do form (keksowych) wysmarowanych tłuszczem, tak by wypełniały je w ¾ wysokości.', null),
    (v_id, 4, 'Chleby odstawić do wyrośnięcia przykryte płócienną ściereczką w ciepłym miejscu. Wyrośnięte chleby posmarować z wierzchu jajkiem roztrzepanym z 2 łyżkami mleka i posypać migdałami.', null),
    (v_id, 5, 'Piec w dobrze rozgrzanym piekarniku, a upieczone chleby ciepłe chleby ułożyć na desce.', null);

-- Chutney pomidorowy - 228 kcal/porcja, 10 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Chutney pomidorowy', '🍽️', 10, 95,
        'trudny', array[]::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FChutney_pomidorowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pomidory', 1000, 18, 0.9, 3.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Jabłka', 500, 52, 0.3, 13.8, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jabłka' limit 1)),
    (v_id, 'Cebula', 250, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 24, 149, 6.4, 33.1, 0.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Imbir świeży', 2, 80, 1.8, 17.8, 0.8, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Imbir świeży' limit 1)),
    (v_id, 'Rodzynki', 120, 299, 3.1, 79.2, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rodzynki' limit 1)),
    (v_id, 'Papryczka chili', 30, 40, 1.9, 8.8, 0.4, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryczka chili' limit 1)),
    (v_id, 'Cynamon', 2, 247, 4, 80.6, 1.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Gorczyca', 10, 508, 26.1, 28.1, 36.2, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Gorczyca' limit 1)),
    (v_id, 'Pieprz czarny', 4.5, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 3, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Cukier', 300, 400, 0, 100, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Ocet', 375, 18, 0, 0.4, 0, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ocet' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Pomidory sparzyć, przelać zimną wodą i obrać ze skórki. Pokroić w kostkę.', null),
    (v_id, 1, 'Jabłka obrać, usunąć gniazda nasienne i pokroić na ósemki.', null),
    (v_id, 2, 'Cebulę obrać i pokroić na ósemki.', null),
    (v_id, 3, 'Czosnek i imbir obrać i posiekać.', null),
    (v_id, 4, 'Wszystkie składniki wymieszać w rondlu. Wlać ćwierć szklanki octu i – mieszając – zagotować. Następnie gotować na małym ogniu 60–75 minut, często mieszając i wlewając po trochu resztę octu.', 68),
    (v_id, 5, 'Gorący chutney przekładać do wyparzonych słoików i natychmiast zamykać.', null);

-- Ciapkapusta - 216 kcal/porcja, 11 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ciapkapusta', '🥗', 11, 20,
        'latwy', array['kapusta', 'ziemniaki', 'kuchnia polska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCiapkapusta')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 1000, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Ziemniaki', 1000, 77, 2, 17.5, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 400, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Boczek surowy', 200, 393, 12.6, 0, 37.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Słonina', 50, 812, 2.9, 0, 88.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Słonina' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ugotować osobno kiszoną kapustę i ziemniaki.', null),
    (v_id, 1, 'Cebule drobno posiekać w kostki, pokroić też w kostkę boczek wędzony i słoninę.', null),
    (v_id, 2, 'Posiekaną cebulę przysmażyć na patelni, do słoniny roztopionej na patelni dodać boczek i go przysmażyć.', null),
    (v_id, 3, 'Wypłukaną i odcedzoną kapustę pokroić drobno i dodać do ziemniaków. Przysmażoną cebulę i boczek również. Wszystko dobrze wymieszać, dodać soli i pieprzu do smaku.', null);

-- Ciasto drożdżowe - 655 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ciasto drożdżowe', '🍽️', 5, 240,
        'trudny', array[]::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCiasto_dro%C5%BCd%C5%BCowe')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 500, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Drożdże świeże', 75, 105, 12, 12, 1.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Drożdże świeże' limit 1)),
    (v_id, 'Mleko 3,2%', 250, 61, 3.3, 4.7, 3.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Masło', 50, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sól', 3, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Rodzynki', 15, 299, 3.1, 79.2, 0.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rodzynki' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Podgrzać mleko', null),
    (v_id, 1, 'Mąkę przesiać do miski i zrobić dołek', null),
    (v_id, 2, 'Do dołka krusząc wsypać drożdże i cukier', null),
    (v_id, 3, 'Stopniowo polewać ciepłym mlekiem', null),
    (v_id, 4, 'Wymieszać bardzo delikatnie drożdże cukier i mleko', null),
    (v_id, 5, 'Mieszaninę zasypać niewielką ilością mąki', null),
    (v_id, 6, 'Odstawić na 15 - 20 minut', 18),
    (v_id, 7, 'Roztopić masło w rondelku.', null),
    (v_id, 8, 'Utrzeć żółtka z cukrem.', null),
    (v_id, 9, 'Do mąki dodać drożdże z mlekiem, żółtka z cukrem, resztę mleka i wyrobić na gładką masę.', null),
    (v_id, 10, 'Dodać roztopione masło i olej, wyrabiać, aż ciasto będzie odchodziło od ręki.', null),
    (v_id, 11, 'Uformować kulę i odstawić pod przykryciem do wyrośnięcia (1/2 – 2 godziny).', 120),
    (v_id, 12, 'Gdy ciasto wyrośnie, wyrobić je ponownie. Można dodać rodzynki.', null),
    (v_id, 13, 'Włożyć do wysmarowanej masłem i posypanej tartą bułką formy. Można posmarować z wierzchu surowym białkiem lub posypać kruszonką.', null),
    (v_id, 14, 'Piec przez 40 minut w średnio nagrzanym ( ) piekarniku.', 40);

-- Ciasto marchewkowe - 475 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ciasto marchewkowe', '🍰', 12, 95,
        'sredni', array['ciasto']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCiasto_marchewkowe')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 260, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Marchew', 500, 41, 0.9, 9.6, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Olej rzepakowy', 220, 884, 0, 0, 100, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Soda oczyszczona', 5, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Soda oczyszczona' limit 1)),
    (v_id, 'Proszek do pieczenia', 4, 97, 0, 23, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Proszek do pieczenia' limit 1)),
    (v_id, 'Orzechy włoskie', 300, 654, 15.2, 13.7, 65.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Orzechy włoskie' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Jajka miksować z cukrem, aż do utworzenia gładkiej masy.', null),
    (v_id, 1, 'Do masy stopniowo dodawać olej, cały czas mieszając.', null),
    (v_id, 2, 'Do innego naczynia przesiać mąkę, sodę i proszek do pieczenia.', null),
    (v_id, 3, 'Do mąki dodać masę jajeczną z olejem i dokładnie wymieszać.', null),
    (v_id, 4, 'Gdy ciasto będzie miało gładką konsystencję – dodać orzechy i marchew, i zamieszać.', null),
    (v_id, 5, 'Włożyć do wysmarowanej masłem i posypanej tartą bułką formy.', null),
    (v_id, 6, 'Piec przez 60 minut w średnio nagrzanym ( ) piekarniku.', 60),
    (v_id, 7, 'Dodatkowo ciasto można polać .', null);

-- Cielęcina w sosie - 378 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Cielęcina w sosie', '🍖', 4, 40,
        'sredni', array['mięso']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCiel%C4%99cina_w_sosie')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Cielęcina', 750, 131, 20.4, 0, 5.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cielęcina' limit 1)),
    (v_id, 'Włoszczyzna', 300, 45, 1.3, 9.8, 0.3, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Włoszczyzna' limit 1)),
    (v_id, 'Masło', 40, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Żółtko jaja', 18, 322, 15.9, 3.6, 26.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żółtko jaja' limit 1)),
    (v_id, 'Sok z cytryny', 15, 22, 0.4, 6.9, 0.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sok z cytryny' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Cielęcinę włożyć do garnka, zalać litrem wrzątku i gotować na bardzo małym ogniu około 20 minut. Dodać włoszczyznę i gotować jeszcze około 30 minut.', 20),
    (v_id, 1, 'Miękkie mięso wyjąć i pokroić na 4 porcje w poprzek włókien.', null),
    (v_id, 2, 'Z wywaru wyjąć włoszczyznę.', null),
    (v_id, 3, 'Mąkę rozetrzeć z masłem, dodać do wywaru i zagotować. Powstały sos przyprawić sokiem cytrynowym i podprawić żółtkiem.', null),
    (v_id, 4, 'Mięso rozłożyć na talerze, polać sosem i posypać posiekaną natką.', null);

-- Crema catalana - 191 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Crema catalana', '🍰', 8, 60,
        'sredni', array['deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCrema_catalana')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jajko kurze', 330, 143, 12.6, 0.7, 9.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Śmietanka 12%', 200, 127, 2.9, 4, 12, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietanka 12%' limit 1)),
    (v_id, 'Mleko 3,2%', 62.5, 61, 3.3, 4.7, 3.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Cynamon', 250, 247, 4, 80.6, 1.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Cytryna', 100, 29, 1.1, 9.3, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Cukier puder', 10, 400, 0, 100, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier puder' limit 1)),
    (v_id, 'Cukier', 18, 400, 0, 100, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Cynamon', 2, 247, 4, 80.6, 1.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Z cytryny zdjąć skórkę. W rondlu podgrzać na małym ogniu śmietankę wraz z 3 paskami cytrynowej skórki i laskami cynamonu. Kiedy masa będzie niemal wrzała, należy zdjąć garnek z palnika, odstawić na 3–5 minut do wychłodzenia, a następnie przelać masę przez sito. Wyrzucić laskę cynamonu i skórkę cytrynową.', 4),
    (v_id, 1, 'Z 5 jajek uzyskać żółtka. Ucierać je z jednym całym jajkiem i 75 g (ok. 1/3 szklanki) cukru pudru. Po uzyskaniu gładkiej masy, należy ją wlać do podgrzanej śmietanki. Uzyskany w ten sposób płyn wlać do żaroodpornych miseczek.', null),
    (v_id, 2, 'Naczynia żaroodporne wstawić do brytfanny wypełnionej wrzątkiem (wrzątek nie może sięgać wyżej niż połowa wysokości żaroodpornych miseczek). Brytfannę umieścić w lekko nagrzanym piekarniku i piec, aż do ścięcia się masy (ok. 30–40 minut). Wyjąć żaroodporne miseczki z wody, odłożyć je do wystudzenia, a następnie wstawić do lodówki na kilka lub kilkanaście godzin (co najmniej 4).', 35),
    (v_id, 3, 'Wyjąć miseczki. Ćwierć łyżeczki mielonego cynamonu, cukier brązowy i łyżkę cukru pudru wymieszać, przesiać przez sitko i posypać miseczki. Całość wychłodzić w lodówce.', null),
    (v_id, 4, 'Następnie należy skarmelizować warstwę z cukru i cynamonu. Najlepiej zrobić to za pomocą ręcznego palnika, przypiekając nim cukier z wierzchu. Można też posłużyć się piekarnikiem – w tym wypadku należy spryskać delikatnie cynamonowo-cukrową warstwę wodą i wstawić do silnie nagrzanego piekarnika na kilka minut, aż do skarmelizowania się cukru.', null),
    (v_id, 5, 'Podawać po tym, jak skorupka cukru zastygnie, można wcześniej schłodzić.', null);

-- Crêpes - 528 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Crêpes', '🍰', 3, 750,
        'sredni', array['naleśniki', 'deser', 'kuchnia francuska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FCr%C3%AApes')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 250, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Mleko 3,2%', 600, 61, 3.3, 4.7, 3.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Do naczynia wsypać mąkę i sól.', null),
    (v_id, 1, 'Zrobić w mące wgłębienie, do którego wbić jajka, wszystko zamieszać.', null),
    (v_id, 2, 'Pomału dodawać 500 ml mleka.', null),
    (v_id, 3, 'Stopić masło i połączyć z pozostałymi produktami.', null),
    (v_id, 4, 'Pozostawić na 12 godzin.', 720),
    (v_id, 5, 'Dodać pozostałe 100 ml mleka.', null),
    (v_id, 6, '150 ml ciasta (niepełną łyżkę wazową) wlać na rozgrzaną, posmarowaną masłem patelnię; smażyć przez 2 minuty, obrócić i smażyć jeszcze przez minutę.', 2),
    (v_id, 7, 'Powtarzać ostatnią czynność, dopóki wystarczy ciasta.', null);

-- Deser budyniowy - 325 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Deser budyniowy', '🍰', 12, 25,
        'sredni', array['deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FDeser_budyniowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Herbatniki', 400, 458, 6.8, 74, 15, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Herbatniki' limit 1)),
    (v_id, 'Budyń w proszku', 80, 355, 0.5, 87, 0.3, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Budyń w proszku' limit 1)),
    (v_id, 'Budyń w proszku', 80, 355, 0.5, 87, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Budyń w proszku' limit 1)),
    (v_id, 'Mleko 3,2%', 1500, 61, 3.3, 4.7, 3.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Kiwi', 150, 61, 1.1, 14.7, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kiwi' limit 1)),
    (v_id, 'Żelatyna', 20, 335, 84, 0, 0.1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żelatyna' limit 1)),
    (v_id, 'Cukier', 96, 400, 0, 100, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Woda', 83.3, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Wysoką okrągłą formę wyłożyć folią aluminiową, na dnie naczynia układać biszkopty tak, aby zbiegły się pośrodku.', null),
    (v_id, 1, 'Na połowie mleka i cukru ugotować budyń czekoladowy.', null),
    (v_id, 2, 'Żelatynę namoczyć w wodzie, połowę wymieszać z budyniem.', null),
    (v_id, 3, 'Boki naczynia obłożyć biszkoptami, nałożyć budyń czekoladowy, przykryć biszkoptami, układając je promieniście.', null),
    (v_id, 4, 'Budyń śmietankowy ugotować na pozostałym mleku i cukrze. Wymieszać z żelatyną i kiwi, wyłożyć na biszkopty, schłodzić.', null);

-- Dopalacz mózgu - 525 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Dopalacz mózgu', '🍰', 8, 70,
        'sredni', array['deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FDopalacz_m%C3%B3zgu')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Orzechy włoskie', 200, 654, 15.2, 13.7, 65.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Orzechy włoskie' limit 1)),
    (v_id, 'Płatki owsiane', 200, 366, 11.9, 60, 7.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Płatki owsiane' limit 1)),
    (v_id, 'Cukier', 50, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Mąka pszenna', 30, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Proszek do pieczenia', 4, 97, 0, 23, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Proszek do pieczenia' limit 1)),
    (v_id, 'Cynamon', 2.5, 247, 4, 80.6, 1.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Czekolada gorzka', 50, 546, 7.8, 45.9, 35.4, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czekolada gorzka' limit 1)),
    (v_id, 'Dynia', 50, 26, 1, 6.5, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dynia' limit 1)),
    (v_id, 'Wiórki kokosowe', 30, 660, 6.9, 23.7, 64.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wiórki kokosowe' limit 1)),
    (v_id, 'Brzoskwinie', 100, 39, 0.9, 9.5, 0.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brzoskwinie' limit 1)),
    (v_id, 'Miód', 125, 322, 0.3, 79.5, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Miód' limit 1)),
    (v_id, 'Masło', 125, 735, 0.7, 0.7, 82, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Wymieszaj: płatki owsiane, cukier, mąkę orkiszową, proszek do pieczenia, cynamon, grubo startą czekoladę, pestki dyni i jeśli chcesz, wiórki kokosowe.', null),
    (v_id, 1, 'Morele pokrój w drobną kostkę i ugnieć na purée. Dodaj do nich miód i masło.', null),
    (v_id, 2, 'Dokładnie wymieszaj uzyskaną masę i wcześniej przygotowane składniki.', null),
    (v_id, 3, 'Blachę do pieczenia wyłóż specjalnym papierem, rozłóż na niej równomiernie masę, jaką uzyskałeś, dociskając ją do blachy.', null),
    (v_id, 4, 'Baton piecz przez około 45 minut w temperaturze .', 45),
    (v_id, 5, 'Upieczony baton posyp warstwą rozdrobnionych orzechów włoskich. Wystarczy on na około 12 porcji.', null);

-- Francuska zupa cebulowa - 782 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Francuska zupa cebulowa', '🍲', 4, 30,
        'sredni', array['zupa', 'kuchnia francuska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FFrancuska_zupa_cebulowa')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Cebula', 250, 40, 1.1, 9.3, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Bulion warzywny', 30, 4, 0.2, 0.6, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Masło', 50, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Wino białe wytrawne', 120, 82, 0.1, 2.6, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Chleb pszenny', 800, 265, 8.5, 49, 3.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Chleb pszenny' limit 1)),
    (v_id, 'Ser żółty', 100, 358, 25, 1.3, 28, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Oregano', 2, 265, 9, 68.9, 4.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Cebulę pokroić, rzucić na patelnię i zeszklić na maśle, dodatkowo oprószyć mąką. Przez chwilę smażyć, dodając posiekany czosnek.', null),
    (v_id, 1, 'Do dużego garnka wlać do 1,5 litra wody i rozpuścić kostki rosołowe (najlepiej wołowe) – w ten uproszczony sposób przygotować rosół, później tylko wrzucając do niego zasmażoną cebulę i dolewając wino (ewentualnie też 3 łyżki brandy). Przyprawić solą, pieprzem i tymiankiem, w tym składzie gotować około 15 minut.', 15),
    (v_id, 2, 'W międzyczasie przygotować grzanki z pokrojonej bagietki i posmarowane masłem przez około 5 minut podpiec w piekarniku.', 5),
    (v_id, 3, 'Gotową zupę przelać do miseczek żaroodpornych, dodając podsmażone i posypane serem grzanki, po czym jeszcze lekko zapiec.', null);

-- Gołąbki z kaszą i mięsem - 302 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Gołąbki z kaszą i mięsem', '🍽️', 7, 35,
        'sredni', array['kuchnia polska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FGo%C5%82%C4%85bki_z_kasz%C4%85_i_mi%C4%99sem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 1000, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Łopatka wieprzowa', 200, 214, 17.6, 0, 16, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Kasza jęczmienna', 250, 345, 8, 74, 1.4, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza jęczmienna' limit 1)),
    (v_id, 'Cebula', 50, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Olej rzepakowy', 30, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Śmietana 18%', 125, 184, 2.6, 3.6, 18, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Przyprawa do zup', 10, 150, 10, 20, 3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Przyprawa do zup' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Dużą główkę kapusty opłukać, wyciąć głąb, oddzielić ostrożnie liście i wrzucać po kilka do wrzącej wody. Następnie odcedzić i wystudzić. Najgrubsze partie (tzw. nerw liściowy) zbić tłuczkiem do miękkości, uważając jednak, by liścia nie przedziurawić.', null),
    (v_id, 1, 'Ryż lub kaszę zagotować według przepisu z tłuszczem. Następnie wyłożyć do miski, dodać zrumienioną cebulę, mielone mięso i przyprawy, wymieszać.', null),
    (v_id, 2, 'Na rozprostowany liść nakładać farsz łyżką, zagiąć dwa przeciwległe boki do środka, następnie zrolować wzdłuż niezagiętego boku (rulon można dla pewności obwiązać niebarwioną nitką, choć to niekonieczne.', null),
    (v_id, 3, 'Na dnie naczynia ułożyć warstwę liści kapuścianych, na nich warstwami układać ciasno zwinięte gołąbki (im więcej warstw, tym większa szansa na przypalenie). Z wierzchu przykryć warstwą liści kapusty.', null),
    (v_id, 4, 'Naczynie zalać ćwierć litra wrzącej osolonej wody i wstawić do piekarnika nastawionego na średnią temperaturę. Gdy liście na wierzchu się zarumienią - zmniejszyć temperaturę i przykryć naczynie. Dusić w ten sposób do miękkości.', null),
    (v_id, 5, 'Wyjąć naczynie z piekarnika, zdjąć z wierzchu liście, zalać śmietaną zmieszaną z mąką i kostką przyprawy do zup, zapiec w piekarniku jeszcze przez 10 minut. Podawać gorące, polane sosem z dna naczynia.', 10);

-- Gęś nadziewana kaszą z grzybami - 605 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Gęś nadziewana kaszą z grzybami', '🍗', 5, 50,
        'sredni', array['drób']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FG%C4%99%C5%9B_nadziewana_kasz%C4%85_z_grzybami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Gęś', 100, 305, 15.9, 0, 27, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Gęś' limit 1)),
    (v_id, 'Pietruszka korzeń', 160, 75, 2.9, 17, 0.8, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Cebula', 150, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Pieczarki', 550, 22, 3.1, 3.3, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Kasza gryczana', 360, 336, 12.6, 69.3, 2.6, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza gryczana' limit 1)),
    (v_id, 'Jajko kurze', 55, 143, 12.6, 0.7, 9.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Słonina', 125, 812, 2.9, 0, 88.7, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Słonina' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Oczyszczoną i osoloną gęś przeciąć od strony grzbietu i wyjąć kości.', null),
    (v_id, 1, 'Z kości, włoszczyzny i suszonych grzybów ugotować bulion.', null),
    (v_id, 2, 'Kości wyrzucić. Grzybki wyłowić, posiekać drobno i wrzucić z powrotem do bulionu. Dodać garść siekanej pietruszki i łyżkę masła. Zagotować.', null),
    (v_id, 3, '2 szklanki kaszy gryczanej utrzeć z surowym jajkiem, następnie wysuszyć (można w średnio nagrzanym piekarniku).', null),
    (v_id, 4, 'Dodać kaszę gryczaną do bulionu z grzybami i gotować pod przykryciem przez 20 minut.', 20),
    (v_id, 5, 'Nadziać gęś kaszą i zaszyć.', null),
    (v_id, 6, 'W naczyniu żaroodpornym obłożyć gęś od spodu i z wierzchu słoniną. Piec przez półtorej do dwóch godzin.', null);

-- Harira - 487 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Harira', '🍲', 3, 85,
        'sredni', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FHarira')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Wołowina', 300, 175, 20.5, 0, 10, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wołowina' limit 1)),
    (v_id, 'Ciecierzyca', 125, 364, 19.3, 60.6, 6, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ciecierzyca' limit 1)),
    (v_id, 'Soczewica czerwona', 50, 352, 24.6, 63, 1.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Soczewica czerwona' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Seler naciowy', 20, 16, 0.7, 3, 0.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler naciowy' limit 1)),
    (v_id, 'Makaron', 50, 363, 12.5, 71.5, 1.8, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Pomidory', 400, 18, 0.9, 3.9, 0.2, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Koncentrat pomidorowy', 10, 82, 4.3, 18.9, 0.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koncentrat pomidorowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Suchą ciecierzycę należy namoczyć dzień wcześniej, zalewając ją zimną wodą (co najmniej 10 cm powyżej poziomu) i pozostawiając na całą noc.', null),
    (v_id, 1, 'Do dużego garnka włożyć pokrojone w kostkę mięso (w tym kości – jeśli dostępne), zalać 1,5 litra wody i doprowadzić do wrzenia, usuwając powstałe szumowiny. Następnie dodać namoczoną i odcedzoną ciecierzycę, suchą soczewicę, masło, pokrojoną cebulę oraz seler naciowy. Doprawić szafranem, imbirem, kolendrą, solą morską i pieprzem.', null),
    (v_id, 2, 'Zupę gotować pod przykryciem na wolnym ogniu przez 1 godzinę i 15 minut. Potem dodać zmiksowane pomidory z puszki oraz koncentrat pomidorowy, doprawić do smaku solą i pieprzem, i gotować przez kolejne 30 minut.', 60),
    (v_id, 3, 'Na koniec dodać ugotowaną ciecierzycę z zalewą oraz suchy makaron, gotując całość przez około 15 minut do momentu, gdy makaron dojdzie do stanu al dente.', 15);

-- Haupia - 297 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Haupia', '🍰', 7, 25,
        'latwy', array['deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FHaupia')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mleko kokosowe', 720, 197, 2, 2.8, 21.3, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko kokosowe' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sól', 0.5, 0, 0, 0, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Mąka ziemniaczana', 75, 343, 0.5, 83.1, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka ziemniaczana' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Zmieszaj i podgrzej mleko, cukier i sól na średnim ogniu.', null),
    (v_id, 1, 'Powoli dodawaj skrobię, mieszając i gotując, aż zgęstnieje.', null),
    (v_id, 2, 'Wlej do formy (najlepiej kwadratowej).', null),
    (v_id, 3, 'Chłodź przez godzinę.', null),
    (v_id, 4, 'Pokrój na kwadraty i podawaj.', null);

-- Jajka na jarzynce - 154 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Jajka na jarzynce', '🥚', 7, 25,
        'sredni', array['jajka', 'warzywa', 'sałatka', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FJajka_na_jarzynce')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jajko kurze', 330, 143, 12.6, 0.7, 9.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Marchew', 280, 41, 0.9, 9.6, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Dymka', 100, 32, 1.8, 7.3, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dymka' limit 1)),
    (v_id, 'Sałata', 500, 15, 1.4, 2.9, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sałata' limit 1)),
    (v_id, 'Kukurydza konserwowa', 340, 86, 3.2, 19, 1.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kukurydza konserwowa' limit 1)),
    (v_id, 'Jogurt naturalny', 33.3, 61, 3.5, 4.7, 3.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jogurt naturalny' limit 1)),
    (v_id, 'Śmietana 18%', 33.3, 184, 2.6, 3.6, 18, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Musztarda', 5, 66, 4.4, 5.8, 3.4, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Musztarda' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Jajka ugotować na twardo, obrać.', null),
    (v_id, 1, 'Dymkę oczyścić i pokroić na kawałki. Marchewki obrać i zetrzeć na tarce o dużych oczkach. Kukurydzę osączyć. Sałatę opłukać i osuszyć.', null),
    (v_id, 2, 'Przygotować sos: wymieszać w miseczce jogurt ze śmietaną i łyżeczką musztardy, doprawić solą i pieprzem.', null),
    (v_id, 3, 'Do dużej miski przesypać dymkę, marchew, kukurydzę i wymieszać.', null),
    (v_id, 4, 'Sałatę położyć na talerzach. Polać sosem. Jajka przekroić na połówki, ułożyć na sałatce. Udekorować natką.', null);

-- Jajka w koszyczkach - 563 kcal/porcja, 1 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Jajka w koszyczkach', '🥚', 1, 35,
        'sredni', array['jajka', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FJajka_w_koszyczkach')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Chleb pszenny', 70, 265, 8.5, 49, 3.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Chleb pszenny' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Wyciąć w kromkach okrągłe otwory za pomocą foremki do ciastek lub szklanki.', null),
    (v_id, 1, 'Wycięte krążki można również podsmażyć na maśle, a następnie ułożyć na gotowym daniu tworząc „pokrywki od koszyczków”.', null),
    (v_id, 2, 'Jeśli używamy foremek, otwory nie muszą być okrągłe, a mogą mieć kształt np. serduszka.', null),
    (v_id, 3, 'Posmarować chleb masłem po obu stronach.', null),
    (v_id, 4, 'Położyć na rozgrzanej patelni i smażyć z jednej strony na złocistobrązowy kolor.', null),
    (v_id, 5, 'Przewrócić na drugą stronę i wbić do środka każdej kromki po jednym jajku.', null),
    (v_id, 6, 'Posolić i popieprzyć. Smażyć, aż jajko się zetnie; w razie potrzeby można jeszcze raz przewrócić na drugą stronę.', null);

-- Janssons frestelse - 333 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Janssons frestelse', '🐟', 7, 35,
        'latwy', array['ryba', 'ziemniaki', 'wigilia']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FJanssons_frestelse')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 1350, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Sardele', 200, 210, 20.4, 0, 14, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sardele' limit 1)),
    (v_id, 'Śmietana 18%', 300, 184, 2.6, 3.6, 18, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Bułka tarta', 20, 383, 12.5, 71, 4.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka tarta' limit 1)),
    (v_id, 'Masło', 22.5, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ziemniaki pokroić w paski. Cebulę pokroić w plasterki lub posiekać drobno, sardelki również pokroić.', null),
    (v_id, 1, 'Foremkę posmarować.', null),
    (v_id, 2, 'Układać w foremce ziemniaki, cebulę i sardelki warstwami (należy zacząć i zakończyć ziemniakami).', null),
    (v_id, 3, 'Zalać 1,5 dl śmietany. Bułkę tartą posypać cienką warstwą. Zapiec.', null),
    (v_id, 4, 'Po około 30 minutach polać resztą śmietany i piec jeszcze 15 minut.', 15);

-- Kaczka po włosku - 292 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kaczka po włosku', '🍗', 3, 30,
        'sredni', array['drób']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKaczka_po_w%C5%82osku')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kaczka', 100, 236, 18.3, 0, 18, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kaczka' limit 1)),
    (v_id, 'Pomarańcze', 600, 47, 0.9, 11.8, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomarańcze' limit 1)),
    (v_id, 'Szałwia', 7, 315, 10.6, 60.7, 12.8, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szałwia' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Oliwa z oliwek', 20, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Wino białe wytrawne', 120, 82, 0.1, 2.6, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Bulion warzywny', 62.5, 4, 0.2, 0.6, 0.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Sprawioną i umytą kaczkę podzielić na porcje, natrzeć pieprzem.', null),
    (v_id, 1, 'Pomarańcze dokładnie wyszorować, sparzyć wrzątkiem. Bardzo ostrym nożem ściąć tylko żółtą cieniutką skórkę.', null),
    (v_id, 2, 'Obraną cebulę drobno posiekać.', null),
    (v_id, 3, 'W płaskim rondlu mocno rozgrzać olej, usmażyć porcje kaczki na złotobrązowy kolor. Dodać cebulę, szałwię, pokrojoną skórkę z pomarańczy, posypać solą i pieprzem. Chwilę smażyć, delikatnie mieszając, po czym skropić winem i gotować kilka minut na dość silnym ogniu bez przykrycia.', null),
    (v_id, 4, 'Następnie wlać bulion, przykryć potrawę, zmniejszyć płomień i dusić około godziny.', null),
    (v_id, 5, 'Miękką kaczkę wyjąć, ułożyć na żaroodpornym półmisku, sos zmiksować lub przetrzeć przez sito, wlać do rondla, dodać cukier i pokrojone w kostkę pomarańcze bez pestek. Wymieszać, podgrzewać, aż cukier się rozpuści, polać kaczkę, wstawić na kilka minut do nagrzanego piekarnika.', null);

-- Kapusta z fasolą i kaszą jaglaną - 318 kcal/porcja, 9 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kapusta z fasolą i kaszą jaglaną', '🥗', 9, 755,
        'sredni', array['kapusta']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKapusta_z_fasol%C4%85_i_kasz%C4%85_jaglan%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 1500, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Fasola biała sucha', 400, 333, 21.4, 60.3, 1.6, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Fasola biała sucha' limit 1)),
    (v_id, 'Kasza jaglana', 300, 346, 10.5, 71.6, 3.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza jaglana' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Namocz fasolę. Przepłucz fasolę i zalej zimną wodą. Zostaw do namoczenia (najwygodniej na noc).', null),
    (v_id, 1, 'Ugotuj fasolę. Ugotuj ją w tej samej wodzie, w której się moczyła, lekko osolonej, aż będzie miękka. Odcedź i odstaw.', null),
    (v_id, 2, 'Zmniejsz kwaśność kapusty. Kapustę krótko obgotuj, odcedź, a następnie zalej zimną wodą.', null),
    (v_id, 3, 'Gotuj kapustę. Postaw garnek na małym ogniu i gotuj kapustę powoli, aż zacznie mięknąć.', null),
    (v_id, 4, 'Dodaj kaszę jaglaną. Kaszę wypłucz w zimnej wodzie. Gdy kapusta jest już podgotowana, wsyp kaszę na wierzch (warstwą na powierzchnię kapusty). Gotuj na bardzo małym ogniu bez mieszania, aż kasza zacznie „pękać” i zmięknie (kasza wchłonie płyn i dojdzie na parze).', null),
    (v_id, 5, 'Przygotuj cebulę. Cebulę posiekaj i podsmaż na maśle lub na wybranym tłuszczu do zeszklenia.', null),
    (v_id, 6, 'Połącz składniki. Do ugotowanej kapusty z kaszą dodaj ugotowaną fasolę oraz podsmażoną cebulę razem z tłuszczem. Wymieszaj już bez dalszego gotowania.', null),
    (v_id, 7, 'Odstaw do „przegryzienia”. Przełóż do chłodnego miejsca na co najmniej 12 godzin. Podawaj najlepiej podgrzane następnego dnia.', 720);

-- Kapusta z grzybami - 114 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kapusta z grzybami', '🥗', 4, 20,
        'latwy', array['kapusta']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKapusta_z_grzybami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 500, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Kapusta biała', 500, 25, 1.3, 5.8, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Pieczarki', 30, 22, 3.1, 3.3, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Namoczyć grzyby przez co najmniej godzinę.', null),
    (v_id, 1, 'Poszatkować surową kapustę i gotować w osolonej wodzie przez pół godziny.', null),
    (v_id, 2, 'Zlać wodę, dodać kwaszoną kapustę i namoczone grzyby; dusić jeszcze przez pół godziny, podlewając wodą, w której grzyby się moczyły.', null),
    (v_id, 3, 'Pod koniec duszenia dodać łyżkę masła podsmażonego z mąką i łyżkę karmelizowanego cukru.', null);

-- Kapuśniak - 96 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kapuśniak', '🍲', 8, 40,
        'sredni', array['zupa', 'kapusta']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKapu%C5%9Bniak')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 500, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Boczek surowy', 100, 393, 12.6, 0, 37.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Ziemniaki', 300, 77, 2, 17.5, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Liść laurowy', 0.4, 313, 7.6, 75, 8.4, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Bulion warzywny', 20, 4, 0.2, 0.6, 0.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Woda', 2000, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kapustę opłukać na sicie pod bieżącą wodą. Osączyć z wody, drobno pokroić. Boczek pokroić w kostkę. Cebulę obrać, opłukać, drobno posiekać. Ziemniaki obrać, opłukać i pokroić w kostkę.', null),
    (v_id, 1, 'Na dużej patelni podsmażyć boczek, dodać cebule, smażyć tak długo, aż cebula się zrumieni. Dodać pokrojoną kapustę, smażyć 3-4 minuty. Następnie wlać niewielką ilość wody, dusić pod przykryciem na małym ogniu 10 min.', 4),
    (v_id, 2, 'Zagotować wodę, wrzucić pokrojone ziemniaki, gotować 10 minut. Dodać kapustę z boczkiem i cebulą.', 10),
    (v_id, 3, 'W małej ilości wody rozpuścić pokruszone kostki bulionu i wlać do kapusty.', null),
    (v_id, 4, 'Dodać liście laurowe i czosnek roztarty z solą. Doprawić pieprzem. Gotować pod przykryciem jeszcze 15 minut.', 15);

-- Kapuśniak czeski - 369 kcal/porcja, 6 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kapuśniak czeski', '🍲', 6, 45,
        'trudny', array['kapusta', 'zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKapu%C5%9Bniak_czeski')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 200, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Boczek surowy', 50, 393, 12.6, 0, 37.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Łopatka wieprzowa', 200, 214, 17.6, 0, 16, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Ziemniaki', 100, 77, 2, 17.5, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Woda', 1000, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Pieczarki', 30, 22, 3.1, 3.3, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Śmietana 18%', 125, 184, 2.6, 3.6, 18, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Cukier', 25, 400, 0, 100, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sól', 6, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Papryka czerwona', 5, 31, 1, 6, 0.3, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Ziele angielskie', 2, 263, 6.1, 72.1, 8.7, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziele angielskie' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Chleb pszenny', 400, 265, 8.5, 49, 3.2, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Chleb pszenny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Pokroić boczek i wieprzowinę w kostki wielkości ok. 3 mm i odłożyć je do miski. Cebulę drobno posiekać i włożyć do osobnej miski.', null),
    (v_id, 1, 'Zagotować wodę i wrzucić do niej obrane ziemniaki; kiedy się ugotują, rozgnieść je tłuczkiem. Czosnek obrać i rozdrobnić, pieprz zmielić.', null),
    (v_id, 2, 'Tłuszcz z boczku wytopić na patelni, po czym zdjąć boczek. Na wytopiony tłuszcz wrzucić cebulę i ją zeszklić, następnie posypać ją 1 łyżką czerwonej papryki i dolać litr wody. Dodać kapustę, sól, pieprz, grzyby, cukier, czosnek i śmietanę. Całość wymieszać.', null),
    (v_id, 3, 'Gotować przez ok. 30 minut na wolnym ogniu, dodać mięso, a następnie gotować jeszcze przez 10 minut. Dodać ziemniaki.', 30);

-- Karmazyn pieczony - 270 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Karmazyn pieczony', '🐟', 5, 25,
        'sredni', array['ryba']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKarmazyn_pieczony')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Karmazyn', 200, 94, 19, 0, 1.6, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Karmazyn' limit 1)),
    (v_id, 'Masło', 100, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Por', 300, 61, 1.5, 14.2, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Por' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Piwo jasne', 250, 43, 0.5, 3.6, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Piwo jasne' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Bulion warzywny', 250, 4, 0.2, 0.6, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Pomidory', 240, 18, 0.9, 3.9, 0.2, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Piekarnik rozgrzać do temperatury .', null),
    (v_id, 1, 'W rondlu roztopić masło, wrzucić pokrojone wcienkie plastry białe części porów i dusić 2-3 minuty. Następnie dodać pokrojone szalotki i dusić kolejne 3-4 minuty. Wlać piwo i wywar rybny, przyprawić solą i pieprzem. Gotować bez przykrycia do czasu, aż 1/3 płynu odparuje.', 3),
    (v_id, 2, 'Do rondla włożyć filety i przykryć pokrojonymi w plastry pomidorami. Danie przyprawić do smaku, wstawić do gorącego piekarnika na około 10 minut.', 10),
    (v_id, 3, 'Przełożyć na talerze, a do powstałego sosu dodać odrobinę masła i przprawić do smaku. Rybę polać sosem i podawać.', null);

-- Kartofle zapiekane ze śledziem - 322 kcal/porcja, 9 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kartofle zapiekane ze śledziem', '🐟', 9, 50,
        'sredni', array['ryba']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKartofle_zapiekane_ze_%C5%9Bledziem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 2000, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Masło', 37.5, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Śledź solony', 200, 217, 17, 0, 16.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śledź solony' limit 1)),
    (v_id, 'Bułka pszenna', 45, 279, 8.6, 55, 2.6, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Śmietana 18%', 240, 184, 2.6, 3.6, 18, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ziemniaki ugotować w mundurkach, następnie obrać i pokroić w cienkie talarki.', null),
    (v_id, 1, 'Namoczyć śledzie (jeśli solone), usunąć z nich ości, drobno pokroić.', null),
    (v_id, 2, '2 cebule podpiec w piekarniku lub bezpośrednio nad palnikiem, posiekać i podsmażyć w łyżce masła.', null),
    (v_id, 3, 'W wysmarowanym masłem naczyniu żaroodpornym układać warstwami ziemniaki, śledzie i cebulę, aż będzie pełne.', null),
    (v_id, 4, 'Posypać po wierzchu tartą bułką, polać roztopionym masłem lub śmietaną.', null),
    (v_id, 5, 'Piec przez 20–30 minut w mocno nagrzanym piekarniku (200%).', 25);

-- Kasza gryczana z fetą - 398 kcal/porcja, 6 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kasza gryczana z fetą', '🌾', 6, 40,
        'latwy', array['kasze', 'nabiał', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKasza_gryczana_z_fet%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kasza gryczana', 200, 336, 12.6, 69.3, 2.6, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza gryczana' limit 1)),
    (v_id, 'Ser żółty', 300, 358, 25, 1.3, 28, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Pomidory', 420, 18, 0.9, 3.9, 0.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Oliwki', 250, 145, 1, 3.8, 15.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwki' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Zalać kaszę gryczaną gorącą wodą (w proporcji 1:2). Wodę osolić, dodać pół lub całą łyżkę masła, zamieszać. Po zagotowaniu wody gotować (już nie mieszać!) pod lekko uchyloną przykrywką (lub przykrywką z dziurką) na bardzo małym ogniu. Po 15 minutach wyłączyć palnik. Zostawić na nagrzanej płycie palnika lub owinąć garnek w gazety i schować pod kołdrę na 10-30 minut (kasza powinna wchłonąć resztę wody).', 20),
    (v_id, 1, 'Pokroić fetę w kostkę.', null),
    (v_id, 2, 'Posiekać pietruszkę.', null),
    (v_id, 3, 'Pokroić suszone pomidory w wąskie paseczki, a oliwki w plasterki.', null),
    (v_id, 4, 'Wymieszać wszystkie składniki.', null);

-- Knedle ze śliwkami - 388 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Knedle ze śliwkami', '🍝', 5, 20,
        'latwy', array['ziemniaki', 'makaron', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKnedle_ze_%C5%9Bliwkami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 600, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Mąka pszenna', 300, 364, 10.3, 76.3, 1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Śliwki', 500, 46, 0.7, 11.4, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śliwki' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ziemniaki obrać, ugotować, zmielić w maszynce i wystudzić.', null),
    (v_id, 1, 'Zimne wyłożyć na stolnicę, połączyć z mąką i jajkami, doprawić solą. Zagnieść.', null),
    (v_id, 2, 'Z wyrobionego ciasta uformować wałek średnicy około 4 centymetrów i kroić go na krążki o grubości 2 centymetrów.', null),
    (v_id, 3, 'Każdy kawałek spłaszczyć, na środku ułożyć śliwkę bez pestki, skleić i uformować małą kulkę.', null);

-- Kolorowa sałatka warzywna - 234 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kolorowa sałatka warzywna', '🥗', 3, 30,
        'trudny', array['warzywa', 'sałatka', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKolorowa_sa%C5%82atka_warzywna')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Rzodkiewka', 60, 16, 0.7, 3.4, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rzodkiewka' limit 1)),
    (v_id, 'Pomidory', 240, 18, 0.9, 3.9, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Cukinia', 10, 17, 1.2, 3.1, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukinia' limit 1)),
    (v_id, 'Papryka czerwona', 300, 31, 1, 6, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Kalarepa', 10, 27, 1.7, 6.2, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kalarepa' limit 1)),
    (v_id, 'Szczypiorek', 6.3, 30, 3.3, 4.4, 0.7, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szczypiorek' limit 1)),
    (v_id, 'Koperek', 12.5, 43, 3.5, 7, 1.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koperek' limit 1)),
    (v_id, 'Rzeżucha', 6, 32, 2.6, 5.5, 0.7, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rzeżucha' limit 1)),
    (v_id, 'Śmietana 18%', 45, 184, 2.6, 3.6, 18, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Ocet', 15, 18, 0, 0.4, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ocet' limit 1)),
    (v_id, 'Musztarda', 16, 66, 4.4, 5.8, 3.4, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Musztarda' limit 1)),
    (v_id, 'Olej rzepakowy', 50, 884, 0, 0, 100, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Warzywa umyć i osuszyć.', null),
    (v_id, 1, 'Rzodkiewki pokroić w krążki, pomidory na drobne kawałki. Cukinię pokroić na zapałkę. Paprykę przekroić, wydrążyć i pokroić na cieniutkie paseczki. Obraną kalarepę zetrzeć na grubej tarce. Szczypiorek i koperek drobno posiekać.', null),
    (v_id, 2, 'Wszystko wymieszać w misce.', null),
    (v_id, 3, 'Śmietanę, ocet i musztardę wymieszać, przyprawić solą i pieprzem. Stopniowo dodawać olej i ubijać, aż sos zgęstnieje na krem.', null),
    (v_id, 4, 'Sałatkę polać sosem, starannie wymieszać i odstawić na około 10 minut.', 10);

-- Kotlety z kaszy gryczanej i ziemniaków - 783 kcal/porcja, 1 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kotlety z kaszy gryczanej i ziemniaków', '🌾', 1, 50,
        'sredni', array['kasze', 'warzywa', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKotlety_z_kaszy_gryczanej_i_ziemniak%C3%B3w')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 45, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Kasza gryczana', 90, 336, 12.6, 69.3, 2.6, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza gryczana' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Jajko kurze', 55, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Bułka pszenna', 30, 279, 8.6, 55, 2.6, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Oregano', 2, 265, 9, 68.9, 4.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ugotować kaszę na sypko w następujący sposób:', null),
    (v_id, 1, 'Zalać kaszę gryczaną gorącą wodą (w proporcji 1:2). Wodę osolić, dodać masło (0,5 łyżki na szklankę kaszy), zamieszać. Po zagotowaniu wody gotować (już nie mieszać!) pod lekko uchyloną przykrywką (lub przykrywką z dziurką) na bardzo małym ogniu. Po 15 minutach wyłączyć palnik. Zostawić na nagrzanej płycie palnika lub owinąć garnek w gazety i schować pod kołdrę na 10-30 minut (kasza powinna wchłonąć resztę wody).', 20),
    (v_id, 2, 'Ugotować ziemniaki.', null),
    (v_id, 3, 'Cebulę pokroić i zeszklić na patelni.', null),
    (v_id, 4, 'Połączyć kaszę, ziemniaki, cebulę z jajkiem i mąkami, dodać posiekany koperek.', null),
    (v_id, 5, 'Doprawić do smaku.', null),
    (v_id, 6, 'Obtoczyć w bułce tartej i smażyć na rumiano.', null);

-- Krokiety z mięsem - 406 kcal/porcja, 1 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Krokiety z mięsem', '🍖', 1, 35,
        'sredni', array['mięso']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKrokiety_z_mi%C4%99sem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Jajko kurze', 55, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Bułka pszenna', 30, 279, 8.6, 55, 2.6, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso przepuścić przez maszynkę lub bardzo drobno posiekać.', null),
    (v_id, 1, 'Drobno pokrojoną cebulę zeszklić na maśle lub oleju.', null),
    (v_id, 2, 'Dodać mięso do cebuli, posolić i popieprzyć.', null),
    (v_id, 3, 'Na każdy naleśnik nałożyć 2-3 łyżki farszu.', null),
    (v_id, 4, 'Zagiąć 2 brzegi naleśnika do środka, następnie zwinąć w rulonik.', null),
    (v_id, 5, 'Obtoczyć zwinięte krokiety w jajku i tartej bułce.', null),
    (v_id, 6, 'Smażyć na rozgrzanym oleju przez 2-3 minuty.', 3);

-- Kurczak bazyliowy - 234 kcal/porcja, 6 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Kurczak bazyliowy', '🍗', 6, 40,
        'sredni', array['drób']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FKurczak_bazyliowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pierś z kurczaka', 500, 110, 21.5, 0, 2.6, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pierś z kurczaka' limit 1)),
    (v_id, 'Marchew', 500, 41, 0.9, 9.6, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Śmietana 18%', 250, 184, 2.6, 3.6, 18, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Bazylia', 20, 233, 14.4, 47.8, 4, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bazylia' limit 1)),
    (v_id, 'Bulion warzywny', 250, 4, 0.2, 0.6, 0.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso pokroić w grubą kostkę.', null),
    (v_id, 1, 'Marchewkę i cebulę obrać, pokroić w plastry.', null),
    (v_id, 2, 'Czosnek obrać i posiekać.', null),
    (v_id, 3, 'Na patelni rozgrzać tłuszcz, wrzucić mięso i smażyć około 8–10 minut. Doprawić solą i pieprzem. Dodać warzywa i smażyć jeszcze 3 minuty.', 9),
    (v_id, 4, 'Dolać bulion i śmietanę, krótko gotować, zagęścić mąką.', null),
    (v_id, 5, 'Zmniejszyć ogień i dusić jeszcze 10 minut. Na koniec dodać drobno posiekaną bazylię i doprawić do smaku.', 10);

-- Lasagne ze szpinakiem - 637 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Lasagne ze szpinakiem', '🍽️', 12, 55,
        'trudny', array['kuchnia włoska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FLasagne_ze_szpinakiem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Makaron', 1500, 363, 12.5, 71.5, 1.8, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Szpinak', 300, 23, 2.9, 3.6, 0.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szpinak' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 20, 149, 6.4, 33.1, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Papryka czerwona', 150, 31, 1, 6, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Ser parmezan', 60, 392, 35.8, 3.2, 25.8, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser parmezan' limit 1)),
    (v_id, 'Ser mozzarella', 100, 280, 22, 2.2, 20, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser mozzarella' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Serek śmietankowy', 400, 253, 6.2, 4.1, 23.4, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Serek śmietankowy' limit 1)),
    (v_id, 'Pomidory', 800, 18, 0.9, 3.9, 0.2, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Rozgrzać olej na patelni, na którą drobno pokrojoną, pozbawioną gniazd nasiennych zieloną paprykę oraz poszatkowaną cebulę. Warzywa podsmażać do nabrania złocistego koloru. Pod koniec dodać pokrojony w cieniutkie plasterki czosnek, zamieszać i smażyć jeszcze przez chwilę. Po zdjęciu patelni z ognia wystudzić.', null),
    (v_id, 1, 'Do miski wbić jajka i roztrzepać je widelcem, a następnie dodać ser ricotta, drobno posiekany szpinak oraz połowę startego sera grana padano i połowę startej na grubych oczkach mozzarelli. Przyprawić do smaku solą i pieprzem, i zmieszać razem z podsmażonymi warzywami do połączenia się składników.', null),
    (v_id, 2, 'Obrane ze skóry pomidory drobno posiekać i razem z sosem przełożyć do miseczki. Przyprawić solą i pieprzem do smaku. Połowę sosu wylać na dno żaroodpornego naczynia (powinno być na tyle duże, by mieściły się w nim trzy płaty makaronu lasagne) i rozprowadzić równomiernie.', null),
    (v_id, 3, 'W dużym garnku zagotować osoloną wodę. Płaty makaronu wrzucać partiami do wrzątku (po trzy sztuki naraz) i gotować dopóki makaron nieco nie zmięknie (nie powinien być całkiem ugotowany).', null),
    (v_id, 4, 'Trzy płaty makaronu ułożyć na sosie wylanym na dno naczynia. Na wierzch nałożyć 1/4 farszu złożoną z ricotty i szpinaku, po czym ułożyć kolejne partie makaronu i farszu do lasagne. Ostatnią część farszu przykryć pozostałymi płatami ugotowanego makaronu i całość polać sosem pomidorowym. Resztą startego sera )(grana padano i mozzarelli) posypać wierzch lasagne.', null),
    (v_id, 5, 'Po przykryciu naczynia folią aluminiową włożyć je do piekarnika rozgrzanego do na 30 minut. Po tym czasie zdjąć folię i piec przez kolejne 15-20 minut, aż ser na wierzchu się przyrumieni.', 30);

-- Lotus cheesecake - 1009 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Lotus cheesecake', '🍽️', 5, 50,
        'trudny', array[]::text[], false,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FLotus_cheesecake')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Herbatniki', 300, 458, 6.8, 74, 15, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Herbatniki' limit 1)),
    (v_id, 'Masło', 65, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Krem karmelowy', 300, 450, 3, 60, 22, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Krem karmelowy' limit 1)),
    (v_id, 'Serek śmietankowy', 650, 253, 6.2, 4.1, 23.4, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Serek śmietankowy' limit 1)),
    (v_id, 'Cukier', 50, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Tortownicę o średnicy 20 cm wyłożyć papierem do pieczenia.', null),
    (v_id, 1, 'Połowę ciasteczek (200 g) zblendować lub rozkruszyć na piasek i wsypać do miski.', null),
    (v_id, 2, 'Masło roztopić i wlać do rozkruszonych ciasteczek.', null),
    (v_id, 3, 'Wymieszać ugniatając.', null),
    (v_id, 4, 'Dno tortownicy wyłożyć ciasteczkami rozkruszonymi i wymieszanymi z masłem i przygnieść tworząc spód tortu.', null),
    (v_id, 5, 'Połowę kremu karmelowego (200 g) rozmieszać z serkiem homogenizowanym (600-700 g), ręcznie albo mikserem na wolnych obrotach.', null),
    (v_id, 6, 'Dodać cukier pudrowy i ponownie wymieszać.', null),
    (v_id, 7, 'Masę przełożyć do tortownicy i wygładzić wierzch.', null),
    (v_id, 8, 'Resztę kremu karmelowego (100 g) roztopić i polać nim masę kremową w tortownicy.', null),
    (v_id, 9, 'Resztę ciastek karmelowych (100 g) rozkruszyć i posypać nimi wierzch tortu.', null);

-- Maczki drożdżowe - 583 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Maczki drożdżowe', '🍰', 12, 50,
        'sredni', array['ciasto']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FMaczki_dro%C5%BCd%C5%BCowe')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 650, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Margaryna', 500, 717, 0.2, 0.7, 80, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 36, 400, 0, 100, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Drożdże świeże', 100, 105, 12, 12, 1.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Drożdże świeże' limit 1)),
    (v_id, 'Mak', 15, 525, 17.9, 28.1, 41.6, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mak' limit 1)),
    (v_id, 'Żółtko jaja', 36, 322, 15.9, 3.6, 26.5, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żółtko jaja' limit 1)),
    (v_id, 'Śmietana 18%', 240, 184, 2.6, 3.6, 18, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Margarynę posiekać z mąką, dodać jajka i drożdże wymieszane ze śmietaną i cukrem. Wyrobić ciasto.', null),
    (v_id, 1, 'Wstawić na 30 min do lodówki.', 30),
    (v_id, 2, 'Ciasto wałkować na cienkie placki i rozsmarować mak.', null),
    (v_id, 3, 'Zwinąć ciasto w rulon, kroić na kawałki długości 3 cm.', null),
    (v_id, 4, 'Posmarować roztrzepanym żółtkiem.', null);

-- Migdałowy pischinger - 524 kcal/porcja, 10 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Migdałowy pischinger', '🍰', 10, 40,
        'sredni', array['ciasto', 'deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FMigda%C5%82owy_pischinger')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Herbatniki', 80, 458, 6.8, 74, 15, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Herbatniki' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cukier', 150, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Migdały', 150, 579, 21.2, 21.6, 49.9, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Migdały' limit 1)),
    (v_id, 'Czekolada gorzka', 150, 546, 7.8, 45.9, 35.4, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czekolada gorzka' limit 1)),
    (v_id, 'Masło', 200, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mleko 3,2%', 250, 61, 3.3, 4.7, 3.2, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Budyń w proszku', 60, 355, 0.5, 87, 0.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Budyń w proszku' limit 1)),
    (v_id, 'Cukier', 80, 400, 0, 100, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Cukier puder', 80, 400, 0, 100, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier puder' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Masło rozpuścić, wsypać cukier i mieszając, gotować około 10 minut. Dodać migdały.', 10),
    (v_id, 1, 'Masę rozsmarować na posmarowanej olejem folii aluminiowej. Gdy wystygnie, włożyć między dwa kawałki papieru i pokruszyć wałkiem do ciasta.', null),
    (v_id, 2, '2 łyżki mleka wymieszać z proszkiem budyniowym. Dodać do reszty mleka zagotowanego z cukrem kryształem i przez chwilę gotować. Wystudzić.', null),
    (v_id, 3, 'Czekoladę stopić w garnuszku wstawionym do kąpieli wodnej. Przestudzić.', null),
    (v_id, 4, 'Masło utrzeć z cukrem pudrem i po łyżce dodawać do budyniu. Wmieszać płynną czekoladę.', null),
    (v_id, 5, 'Odłożyć 1/3 kremu, resztą przełożyć wafle, składając jeden na drugim. Połową odłożonego kremu posmarować wierzch i boki tortu, a następnie posypywać okruchami wysuszonej masy migdałowej.', null),
    (v_id, 6, 'Z reszty kremu wokół brzegu wycisnąć małe rozetki. Przybrać listkami czekoladowymi.', null);

-- Modro kapusta - 474 kcal/porcja, 1 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Modro kapusta', '🥗', 1, 20,
        'latwy', array['warzywa', 'kuchnia polska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FModro_kapusta')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta czerwona', 100, 31, 1.4, 7.4, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta czerwona' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Boczek surowy', 100, 393, 12.6, 0, 37.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Ocet', 5, 18, 0, 0.4, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ocet' limit 1)),
    (v_id, 'Cukier', 10, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Poszatkowaną kapustę ugotować do miękkości i odlać nadmiar wody.', null),
    (v_id, 1, 'Doprawić octem, łyżeczką cukru, szczyptą soli i pieprzu.', null),
    (v_id, 2, 'Następnie dodać drobno posiekaną cebulę surową lub zeszkloną i podsmażony boczek.', null),
    (v_id, 3, 'Wszystkie składniki dokładnie wymieszać.', null);

-- Morelowy przysmak - 402 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Morelowy przysmak', '🍰', 12, 25,
        'trudny', array['ciasto']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FMorelowy_przysmak')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 150, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Masło', 100, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Jajko kurze', 20, 143, 12.6, 0.7, 9.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Mąka pszenna', 200, 364, 10.3, 76.3, 1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Masło', 125, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cukier', 100, 400, 0, 100, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Cukier', 200, 400, 0, 100, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Proszek do pieczenia', 4, 97, 0, 23, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Proszek do pieczenia' limit 1)),
    (v_id, 'Brzoskwinie', 500, 39, 0.9, 9.5, 0.3, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brzoskwinie' limit 1)),
    (v_id, 'Dżem', 80, 250, 0.4, 62, 0.1, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dżem' limit 1)),
    (v_id, 'Migdały', 20, 579, 21.2, 21.6, 49.9, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Migdały' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Z mąki, masła, jajka i soli szybko zagnieść kruche ciasto, owinąć w folię i schłodzić w lodówce.', null),
    (v_id, 1, 'Morele umyć, usunąć z nich pestki, odstawić.', null),
    (v_id, 2, 'Przygotować drugie ciasto: masło utrzeć na puszystą masę z cukrem, cukrem waniliowym i jajkami. Nadal ucierając, powoli wsypywać mąkę wymieszaną z proszkiem do pieczenia.', null),
    (v_id, 3, 'Dno i boki tortownicy o średnicy 26 cm wysmarować margaryną. Wyjąć ciasto z lodówki, rozwałkować, wyłożyć na dno tortownicy. Na to wylać ciasto ucierane.', null),
    (v_id, 4, 'Wyrównać nożem wierzch, ułożyć połówki moreli, lekko je wciskając. Piec około godziny w temperaturze .', null);

-- Musaka z bakłażanów - 320 kcal/porcja, 10 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Musaka z bakłażanów', '🥗', 10, 105,
        'sredni', array['warzywa', 'kuchnia grecka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FMusaka_z_bak%C5%82a%C5%BCan%C3%B3w')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Bakłażan', 300, 25, 1, 5.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bakłażan' limit 1)),
    (v_id, 'Wołowina', 700, 175, 20.5, 0, 10, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wołowina' limit 1)),
    (v_id, 'Pomidory', 360, 18, 0.9, 3.9, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Wino białe wytrawne', 125, 82, 0.1, 2.6, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Sos beszamelowy', 750, 120, 3.4, 8, 8, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos beszamelowy' limit 1)),
    (v_id, 'Ser żółty', 100, 358, 25, 1.3, 28, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Bułka pszenna', 45, 279, 8.6, 55, 2.6, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 10, 735, 0.7, 0.7, 82, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Bakłażany opalić nad płomieniem, zetrzeć zewnętrzną błonkę, pokroić na plasterki, oprószyć solą i zostawić w chłodnym miejscu na godzinę.', null),
    (v_id, 1, 'Rozgrzać masło na patelni i podgrzewać drobno posiekaną cebulę, aż będzie miękka, lecz nie zrumieniona. Dodać 4 łyżki gorącej wody i włożyć mięso, dokładnie rozgniatając je widelcem, aby nie tworzyły się grudki. Smażyć mieszając. Dodać pomidory bez skóry i pestek, wsypać dużą garść natki pietruszki, rozmieszać, dodać wino i dalej ogrzewać mieszając. Następnie oprószyć solą i pieprzem. Przykryć i postawić na bardzo małym ogniu na około 45 minut. Zestawić z ognia, dodać tartą bułkę, rozmieszać.', 45),
    (v_id, 2, 'Ubić niezbyt sztywną pianę z białek, rozmieszać z masą mięsną. Bakłażany opłukać i dokładnie osuszyć na ściereczce. Rozgrzać na patelni oliwę (niezbyt gorącą) i smażyć plasterki bakłażanów z obu stron na zloty kolor.', null),
    (v_id, 3, 'Płaską formę do pieczenia o wymiarach ok. 30x20x5 cm wysmarować masłem i wysypać tartą bułką. Położyć na dnie warstwę bakłażanów, na nich ułożyć warstwę mięsa z pomidorami, przykryć bakłażanami.', null),
    (v_id, 4, 'Przyrządzić sos beszamelowy z żółtkami, dodać 6 dag tartego sera. Zalać nim potrawę, posypać resztą tartego sera. Wstawić do średnio rozgrzanego piekarnika i piec, aż wierzchnia warstwa przypiecze się na złoty kolor (ok. 45 minut).', 45);

-- Naleśniki z czereśniami - 381 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Naleśniki z czereśniami', '🥞', 5, 45,
        'latwy', array['naleśniki', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FNale%C5%9Bniki_z_czere%C5%9Bniami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mleko 3,2%', 500, 61, 3.3, 4.7, 3.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Mąka pszenna', 250, 364, 10.3, 76.3, 1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Czereśnie', 450, 63, 1.1, 16, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czereśnie' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier puder', 20, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier puder' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mleko zmiksować z cukrem, mąką, jajkami i olejem. Powstałe ciasto przykryć i odstawić na około 30 minut do lodówki.', 30),
    (v_id, 1, 'Czereśnie umyć, przeciąć na pół, usunąć pestki, lekko osączyć i dodać do ciasta.', null),
    (v_id, 2, 'Wstawić na kolejne pół godziny do lodówki.', null),
    (v_id, 3, 'Patelnię posmarować masłem i smażyć grube naleśniki.', null);

-- Naleśniki ze szpinakiem i serem feta - 293 kcal/porcja, 9 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Naleśniki ze szpinakiem i serem feta', '🍽️', 9, 50,
        'trudny', array['kuchnia grecka', 'wegańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FNale%C5%9Bniki_ze_szpinakiem_i_serem_feta')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Mąka pszenna', 400, 364, 10.3, 76.3, 1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Sól', 3, 0, 0, 0, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Mleko 3,2%', 150, 61, 3.3, 4.7, 3.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Woda', 150, 0, 0, 0, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Pomidory', 720, 18, 0.9, 3.9, 0.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Szpinak', 400, 23, 2.9, 3.6, 0.4, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szpinak' limit 1)),
    (v_id, 'Ser żółty', 100, 358, 25, 1.3, 28, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Olej rzepakowy', 16, 884, 0, 0, 100, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Czosnek', 2.5, 149, 6.4, 33.1, 0.5, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'W misce połączyć jaja z solą, mlekiem i oliwą.', null),
    (v_id, 1, 'Dodać mąkę i dokładnie wymieszać.', null),
    (v_id, 2, 'Ciągle mieszając, dodawać powoli wodę, aż do otrzymania jednolitej masy.', null),
    (v_id, 3, 'Na posmarowanej olejem patelni smażyć cienkie naleśniki.', null),
    (v_id, 4, 'Cebulę pokroić w kostkę i podsmażyć na oleju na złoty kolor.', null),
    (v_id, 5, 'Dodać umyty i sparzony szpinak, pokrojone w paski suszone pomidory, pokruszony ser feta i czosnek suszony.', null),
    (v_id, 6, 'Całość wymieszać i doprawić do smaku ulubioną przyprawą.', null),
    (v_id, 7, 'Na usmażone naleśniki nakładać farsz serowo-szpinakowy i zwijać w rulony.', null),
    (v_id, 8, 'Tak przygotowane naleśniki obsmażyć na patelni.', null),
    (v_id, 9, 'Można podawać z sosem czosnkowym.', null);

-- Naleśnikowy tort warzywny - 257 kcal/porcja, 6 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Naleśnikowy tort warzywny', '🥞', 6, 25,
        'sredni', array['naleśniki', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FNale%C5%9Bnikowy_tort_warzywny')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pomidory', 800, 18, 0.9, 3.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 24, 149, 6.4, 33.1, 0.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Por', 10, 61, 1.5, 14.2, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Por' limit 1)),
    (v_id, 'Ser żółty', 300, 358, 25, 1.3, 28, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Szpinak', 450, 23, 2.9, 3.6, 0.4, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szpinak' limit 1)),
    (v_id, 'Oregano', 2, 265, 9, 68.9, 4.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, '1 cebulę i 3 ząbki czosnku drobno posiekać. Podsmażyć na odrobinie oliwy. Dodać pomidory z puszki. Doprawić pieprzem i solą. Gotować na małym ogniu, aż sos mocno zgęstnieje. Dodać oregano.', null),
    (v_id, 1, 'Pora pokroić drobno, zalać wrzątkiem, żeby trochę zmiękł.', null),
    (v_id, 2, 'Pozostałą cebulę i czosnek pokroić drobno. Szpinak ugotować wraz z cebulą i czosnkiem. Doprawić solą i pieprzem.', null),
    (v_id, 3, 'Ser żółty zetrzeć.', null),
    (v_id, 4, 'W tortownicy układać warstwami: naleśnik, szpinak, naleśnik, sos pomidorowy i starty ser, naleśnik, por, naleśnik, sos pomidorowy i starty ser, naleśnik, szpinak itd. (do warstwy z porem również można dodać odrobinę sera). Ostatnią, górną warstwę powinien stanowić naleśnik wysmarowany sosem pomidorowym i posypany serem.', null);

-- Paszteciki z grzybami - 107 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Paszteciki z grzybami', '🥗', 5, 45,
        'sredni', array['grzyby', 'przystawka', 'wigilia']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPaszteciki_z_grzybami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Pieczarki', 1100, 22, 3.1, 3.3, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Śmietana 18%', 30, 184, 2.6, 3.6, 18, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Bułka pszenna', 30, 279, 8.6, 55, 2.6, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ugotować suszone grzyby, odcedzić i posiekać.', null),
    (v_id, 1, 'Na patelni stopić łyżkę masła, dodać łyżkę mąki i drobno pokrojoną cebulę.', null),
    (v_id, 2, 'Dodać posiekane grzyby, 2 łyżki śmietany, sól i pieprz.', null),
    (v_id, 3, 'Smażyć, aż zgęstnieją, a następnie ostudzić.', null),
    (v_id, 4, 'Z ciasta maślanego wykrawać nieduże okrągłe lub kwadratowe kawałki, nakładać farsz, składać na pół i zlepiać brzegi.', null),
    (v_id, 5, 'Posypać paszteciki tartą bułką i zapiekać przez 15–20 minut w dobrze nagrzanym piekarniku.', 18);

-- Pańska skórka - 321 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Pańska skórka', '🍰', 4, 55,
        'sredni', array['ciasto', 'deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPa%C5%84ska_sk%C3%B3rka')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Białko jaja', 66, 52, 10.9, 0.7, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Białko jaja' limit 1)),
    (v_id, 'Cukier', 200, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Woda', 125, 0, 0, 0, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Miód', 125, 322, 0.3, 79.5, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Miód' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Do rondelka dodajemy cukier, miód i wodę, mieszamy i zostawiamy na na dość małym ogniu.', null),
    (v_id, 1, 'Czekamy aż masa osiągnie temperaturę (przydatny może być termometr spożywczy). Gdy termometru nie mamy, to w momencie gdy na powierzchni pojawią się złociste bąble łyżeczką nabieramy trochę masy karmelowej i wrzucamy do szklanki z zimną wodą.', null),
    (v_id, 2, 'Gdy karmel zastygnie szybko i da się przełamać, to oznacza, że już jest gotowy.', null),
    (v_id, 3, 'W przypadku gdy będzie ciągnący - gotujemy jeszcze kilka minut.', null),
    (v_id, 4, 'W sumie przygotowanie karmelowej masy nie powinno trwać dłużej niż 20 minut.', 20),
    (v_id, 5, 'Następnie ubijamy "na sztywno" pianę z białek i cienką strużką dodajmy przygotowany karmel, cały czas mieszając, aż powstała masa zrobi się całkiem biała.', null),
    (v_id, 6, 'Dodajemy cukier waniliowy i dalej mieszamy.', null),
    (v_id, 7, 'Połowę masy przekładamy do formy wyłożonej papierem do pieczenia. Do drugiej połowy dodajemy sok malinowy lub barwnik i mieszamy. Układamy drugą (zabarwioną na różowo) warstwę masy w formie i zostawiamy do wystygnięcia (można także na kilka godzin umieścić ją w lodówce).', null);

-- Pejzanka - 689 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Pejzanka', '🍲', 7, 25,
        'trudny', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPejzanka')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kiełbasa', 500, 298, 15, 1.5, 26, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kiełbasa' limit 1)),
    (v_id, 'Boczek surowy', 500, 393, 12.6, 0, 37.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Kapusta biała', 300, 25, 1.3, 5.8, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Włoszczyzna', 400, 45, 1.3, 9.8, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Włoszczyzna' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Fasola biała sucha', 100, 333, 21.4, 60.3, 1.6, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Fasola biała sucha' limit 1)),
    (v_id, 'Ziemniaki', 750, 77, 2, 17.5, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Pomidory z puszki', 10, 32, 1.6, 5.3, 0.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory z puszki' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Ziele angielskie', 2, 263, 6.1, 72.1, 8.7, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziele angielskie' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Przygotować wywar na żeberkach.', null),
    (v_id, 1, 'Fasolę namoczyć, a następnie ugotować.', null),
    (v_id, 2, 'Włoszczyznę pokroić, kapustę poszatkować i razem udusić.', null),
    (v_id, 3, 'Wywar odcedzić i ugotować w nim pokrojone w kostkę ziemniaki. Dodać uduszone warzywa z kapustą i fasolę. Kiełbasę pokroić w plastry, podsmażyć i dodać do zupy.', null),
    (v_id, 4, 'Podprawić przecierem, zielem angielskim, solą, pieprzem i czosnkiem. Zagotować.', null);

-- Pizza carbonara - 263 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Pizza carbonara', '🍽️', 8, 70,
        'trudny', array[]::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPizza_carbonara')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 200, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Woda', 200, 0, 0, 0, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Drożdże świeże', 15, 105, 12, 12, 1.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Drożdże świeże' limit 1)),
    (v_id, 'Oliwa z oliwek', 15, 884, 0, 0, 100, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sól', 0.5, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Papryka czerwona', 0.5, 31, 1, 6, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Oregano', 2, 265, 9, 68.9, 4.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Szynka', 60, 108, 18.5, 1.2, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szynka' limit 1)),
    (v_id, 'Pieczarki', 1000, 22, 3.1, 3.3, 0.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Oregano', 2, 265, 9, 68.9, 4.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Ser żółty', 20, 358, 25, 1.3, 28, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Boczek surowy', 50, 393, 12.6, 0, 37.5, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Czosnek', 10, 149, 6.4, 33.1, 0.5, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Ser parmezan', 40, 392, 35.8, 3.2, 25.8, 15,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser parmezan' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 16,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 17,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Śmietana 18%', 45, 184, 2.6, 3.6, 18, 18,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 19,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 20,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 21,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Przygotować zaczyn – drożdże pokruszyć w miseczce, wymieszać z cukrem i zalać ok. 180-200 ml ciepłej (nie wrzącej) wody, posypać odrobiną mąki, przykryć ściereczką i odstawić na 20 min w ciepłe miejsce do wyrośnięcia.', 20),
    (v_id, 1, 'Mąkę połączyć z papryką, solą i ziołami. Gdy zaczyn wyroście, wlać go do mąki, dodać oliwę i wyrabiać na zwarte ciasto. Ciasto oprószyć mąką i pozostawić w misce przykryte, w ciepłym miejscu do wyrośnięcia na ok. 20-30 min.', 25),
    (v_id, 2, 'Boczek pokroić w małą kostkę i usmażyć na chrupiąco na oliwie z oliwek. Następnie wyjąć z patelni i odsączyć na kawałku papierowego ręcznika. w tym samym tłuszczu podsmażyć pokrojony drobno czosnek.', null),
    (v_id, 3, 'Ubić trzepaczką na pianę jajka, śmietanę, sól i pieprz. Dodać starty parmezan (musi być koniecznie świeży, gdyż inaczej nie rozpuści się zbyt łatwo w sosie). Powstały sos połączyć z czosnkiem i boczkiem i dokładnie wymieszać.', null),
    (v_id, 4, 'Sos podgrzać na bardzo małym ogniu, w celu rozpuszczenia się parmezanu, uważając jednak, żeby nie ścięły się jajka. Jeżeli sos będzie wydawał się zbyt rzadki – zagęścić odrobiną mąki.', null),
    (v_id, 5, 'Gdy ciasto wyrośnie, podzielić je na 2 części. Na blaszce do pizzy rozłożyć ciasto uzyskując cieniutki placek. Zawinąć brzegi.', null),
    (v_id, 6, 'Ułożyć pieczarki, cebulę i szynkę, posypać przyprawą do pizzy, a następnie zalać każdą pizzę połową sosu. Posypać sporą ilością żółtego sera.', null);

-- Potrawka z kaczek z kapustą - 179 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Potrawka z kaczek z kapustą', '🍗', 7, 60,
        'trudny', array['drób']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPotrawka_z_kaczek_z_kapust%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kaczka', 200, 236, 18.3, 0, 18, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kaczka' limit 1)),
    (v_id, 'Kapusta biała', 1500, 25, 1.3, 5.8, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Pietruszka korzeń', 160, 75, 2.9, 17, 0.8, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Ziele angielskie', 0.6, 263, 6.1, 72.1, 8.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziele angielskie' limit 1)),
    (v_id, 'Liść laurowy', 0.5, 313, 7.6, 75, 8.4, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Bułka pszenna', 30, 279, 8.6, 55, 2.6, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Koperek', 7.5, 43, 3.5, 7, 1.1, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koperek' limit 1)),
    (v_id, 'Śmietana 18%', 45, 184, 2.6, 3.6, 18, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kapustę ugotować w osolonej wodzie, odcedzić i pokroić na ćwiartki.', null),
    (v_id, 1, 'Kaczki podzielić na części (ćwiartki), ugotować w wodzie z włoszczyzną, cebulą, zielem angielskim i liśćmi laurowymi.', null),
    (v_id, 2, 'Ułożyć kaczki w naczyniu żaroodpornym, przekładając kapustą. Oprószyć bułką tartą.', null),
    (v_id, 3, 'Aby przygotować sos:', null),
    (v_id, 4, 'Podsmażyć łyżkę mąki z łyżką masła.', null),
    (v_id, 5, 'Wsypać garść siekanego koperku.', null),
    (v_id, 6, 'Rozprowadzić wywarem, w którym gotowały się kaczki.', null),
    (v_id, 7, 'Dodać kilka łyżek śmietany.', null),
    (v_id, 8, 'Gotować przez kilka minut, mieszając, aż zgęstnieje.', null),
    (v_id, 9, 'Potrawę zalać sosem i zapiekać w dobrze nagrzanym piekarniku ( ) przez około 15 minut.', 15);

-- Przystawka z łososia i awokado - 439 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Przystawka z łososia i awokado', '🥚', 12, 20,
        'sredni', array['przystawka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPrzystawka_z_%C5%82ososia_i_awokado')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Łosoś', 300, 208, 20, 0, 13, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łosoś' limit 1)),
    (v_id, 'Seler naciowy', 600, 16, 0.7, 3, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler naciowy' limit 1)),
    (v_id, 'Cebula', 550, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Awokado', 1600, 160, 2, 8.5, 14.7, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Awokado' limit 1)),
    (v_id, 'Cytryna', 60, 29, 1.1, 9.3, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Śmietana 18%', 60, 184, 2.6, 3.6, 18, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Majonez', 60, 680, 1.1, 2.4, 74, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majonez' limit 1)),
    (v_id, 'Ketchup', 10, 102, 1.7, 24, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ketchup' limit 1)),
    (v_id, 'Sos tabasco', 300, 21, 1.3, 1.8, 0.8, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos tabasco' limit 1)),
    (v_id, 'Migdały', 200, 579, 21.2, 21.6, 49.9, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Migdały' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Łososia pokroić w cienkie paski lub posiekać. Dymkę i seler oczyścić i drobno posiekać. Awokado umyć, przekroić na połówki, usunąć pestki, delikatnie wydrążyć łyżeczką.', null),
    (v_id, 1, 'Miąższ natrzeć sokiem z cytryny i wymieszać z masą łososiową.', null),
    (v_id, 2, 'Tak przygotowaną sałatką napełnić skropione sokiem z cytryny miseczki awokado.', null),
    (v_id, 3, 'Ze śmietany, majonezu i ketchupu utrzeć sos, przyprawić go solą, pieprzem i sosem tabasco, po czym nałożyć na każdą porcję przystawki. Udekorować migdałami.', null);

-- Pulpety florenckie - 490 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Pulpety florenckie', '🍖', 5, 25,
        'trudny', array['mięso']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FPulpety_florenckie')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Łopatka wieprzowa', 500, 214, 17.6, 0, 16, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Boczek surowy', 100, 393, 12.6, 0, 37.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Boczek surowy' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Olej rzepakowy', 30, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Margaryna', 15, 717, 0.2, 0.7, 80, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Szałwia', 5, 315, 10.6, 60.7, 12.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szałwia' limit 1)),
    (v_id, 'Oregano', 0.4, 265, 9, 68.9, 4.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Wino białe wytrawne', 240, 82, 0.1, 2.6, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Pietruszka korzeń', 10, 75, 2.9, 17, 0.8, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Seler korzeniowy', 10, 42, 1.5, 9.2, 0.3, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler korzeniowy' limit 1)),
    (v_id, 'Bazylia', 0.3, 233, 14.4, 47.8, 4, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bazylia' limit 1)),
    (v_id, 'Cytryna', 30, 29, 1.1, 9.3, 0.3, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Cukier', 0.5, 400, 0, 100, 0, 15,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Natka pietruszki', 8, 36, 3, 6.3, 0.8, 16,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 17,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 18,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso, boczek i cebule zmielić, dodać szałwię, sól, pieprz, rozmaryn i jajka. Dokładnie wyrobić masę i odstawić na pół godziny.', null),
    (v_id, 1, 'Obrane i umyte jarzyny zetrzeć na tarce o dużych oczkach.', null),
    (v_id, 2, 'W rondlu stopić margarynę, wrzucić jarzyny, zrumienić na silnym ogniu, po czym zmniejszyć płomień, dodać sól, bazylię, wino i dusić kilka minut pod przykryciem.', null),
    (v_id, 3, 'Z przygotowanego mięsa formować mokrymi rękami małe kulki i obtaczać je w mące. Na głębokiej patelni mocno rozgrzać olej, smażyć kulki na złoty kolor.', null),
    (v_id, 4, 'Usmażone przełożyć do jarzyn i dusić razem około pół godziny. Pod koniec dodać cukier, sok z cytryny i delikatnie wymieszać. Posypać pietruszką.', null);

-- Ravioli - 493 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ravioli', '🍝', 4, 25,
        'sredni', array['nabiał', 'makaron', 'wołowina']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FRavioli')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Oliwa z oliwek', 10, 884, 0, 0, 100, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Wołowina', 345, 175, 20.5, 0, 10, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wołowina' limit 1)),
    (v_id, 'Szynka parmeńska', 60, 268, 27, 0.4, 17.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szynka parmeńska' limit 1)),
    (v_id, 'Jajko kurze', 55, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Bazylia', 2, 233, 14.4, 47.8, 4, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bazylia' limit 1)),
    (v_id, 'Ser żółty', 55, 358, 25, 1.3, 28, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Śmietana 18%', 250, 184, 2.6, 3.6, 18, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Pomidory', 480, 18, 0.9, 3.9, 0.2, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ciasto makaronowe przyrządzić zgodnie z instrukcją. Rozwałkować na cienkie arkusze. Przykryć wilgotną ściereczką.', null),
    (v_id, 1, 'Na patelni rozgrzać olej i brązowić wołowinę. Odsączyć olej i mięso ostudzić; przełożyć do miski.', null),
    (v_id, 2, 'Dodać prosciutto, jajko, przyprawy i ser.', null),
    (v_id, 3, 'Na arkusz cienko rozwałkowanego ciasta układać w równomiernych odstępach małe porcje nadzienia. Nawilżyć ciasto dookoła farszu. Całość przykryć drugim arkuszem ciasta. Ciasto pokroić wzdłuż brzegów nadzienia ozdobnym nożykiem.', null),
    (v_id, 4, 'W rondlu rozgrzać masło, wsypać mąkę i smażyć przez 2 minuty na wolnym ogniu. Wlać śmietanę i dusić, aż sos zgęstnieje. Wmieszać pomidory i dusić przez 20 minut.', 2),
    (v_id, 5, 'Ravioli gotować w dużym garnku z wrzącą wodą przez 2 minuty, lub aż wypłyną na powierzchnię. Odcedzić i wyłożyć na talerze, polać sosem i podawać.', 2);

-- Ryba po podhalańsku - 276 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ryba po podhalańsku', '🥗', 7, 35,
        'trudny', array['ziemniaki']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FRyba_po_podhala%C5%84sku')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Dorsz', 800, 82, 17.8, 0, 0.7, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dorsz' limit 1)),
    (v_id, 'Ziemniaki', 450, 77, 2, 17.5, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Seler korzeniowy', 10, 42, 1.5, 9.2, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler korzeniowy' limit 1)),
    (v_id, 'Marchew', 100, 41, 0.9, 9.6, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Śliwki', 70, 46, 0.7, 11.4, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śliwki' limit 1)),
    (v_id, 'Śmietana 18%', 30, 184, 2.6, 3.6, 18, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Koncentrat pomidorowy', 150, 82, 4.3, 18.9, 0.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koncentrat pomidorowy' limit 1)),
    (v_id, 'Natka pietruszki', 4, 36, 3, 6.3, 0.8, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Sok z cytryny', 15, 22, 0.4, 6.9, 0.2, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sok z cytryny' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Olej rzepakowy', 40, 884, 0, 0, 100, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 15,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Śliwki namoczyć, osączyć i pokroić w paski.', null),
    (v_id, 1, 'Filety umyć, osuszyć, skropić sokiem cytrynowym, oprószyć solą, pieprzem i mąką. Smażyć z obu stron na złoty kolor.', null),
    (v_id, 2, 'Jarzyny obrać. Ziemniaki i marchew pokroić w plastry, seler w kostkę, cebulę w półplastry. Usmażyć w brytfance na łyżce oleju, pod koniec dodać masło i śliwki.', null),
    (v_id, 3, 'Na jarzynach ułożyć rybę i zalać potrawę sokiem pomidorowym wymieszanym ze śmietaną, posiekanym czosnkiem, solą i pieprzem. Zapiekać przez 10–15 minut w nagrzanym do piekarniku.', 13),
    (v_id, 4, 'Posypać natką.', null);

-- Ryż po chińsku - 493 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ryż po chińsku', '🥩', 4, 270,
        'trudny', array['kasze', 'wołowina']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FRy%C5%BC_po_chi%C5%84sku')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ryż biały', 250, 344, 6.7, 78.9, 0.7, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ryż biały' limit 1)),
    (v_id, 'Dymka', 400, 32, 1.8, 7.3, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dymka' limit 1)),
    (v_id, 'Wołowina', 250, 175, 20.5, 0, 10, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wołowina' limit 1)),
    (v_id, 'Białko jaja', 20, 52, 10.9, 0.7, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Białko jaja' limit 1)),
    (v_id, 'Cukier', 2.5, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sos sojowy', 32, 53, 8.1, 4.9, 0.6, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos sojowy' limit 1)),
    (v_id, 'Olej rzepakowy', 50, 884, 0, 0, 100, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Wino białe wytrawne', 30, 82, 0.1, 2.6, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Czosnek', 16, 149, 6.4, 33.1, 0.5, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Mąka pszenna', 3, 364, 10.3, 76.3, 1, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Imbir świeży', 2, 80, 1.8, 17.8, 0.8, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Imbir świeży' limit 1)),
    (v_id, 'Kapusta biała', 3, 25, 1.3, 5.8, 0.1, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Opłukany ryż zagotować w półtorej szklanki osolonej wody. Zawinąć w koc i odstawić na 4 godziny.', 240),
    (v_id, 1, 'Mięso pokroić w paski.', null),
    (v_id, 2, 'Cebulki, szczypiorek, czosnek i imbir obrać i posiekać.', null),
    (v_id, 3, 'Z cukru, połowy sosu sojowego i wina oraz mąki ziemniaczanej i białka sporządzić marynatę. Marynować w niej mięso przez 15 minut.', 15),
    (v_id, 4, 'Na patelni lub w woku rozgrzać olej. Wrzucić czosnek i cebulę, dodać mięso z marynatą i imbir. Smażyć na ostrym ogniu przez 2 minuty, cały czas mieszając. Dodać resztę alkoholu i sosu sojowego.', 2),
    (v_id, 5, 'Połączyć z ryżem, dodać sól i pieprz oraz posypać pokrojoną w paski kapustą pekińską.', null);

-- Sakiewki z rybą i ryżem - 336 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sakiewki z rybą i ryżem', '🐟', 7, 20,
        'sredni', array['ryba', 'warzywa', 'kasze']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSakiewki_z_ryb%C4%85_i_ry%C5%BCem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Kapusta biała', 1200, 25, 1.3, 5.8, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kapusta biała' limit 1)),
    (v_id, 'Ryż biały', 95, 344, 6.7, 78.9, 0.7, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ryż biały' limit 1)),
    (v_id, 'Dymka', 200, 32, 1.8, 7.3, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dymka' limit 1)),
    (v_id, 'Makrela wędzona', 200, 305, 20.7, 0, 24, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makrela wędzona' limit 1)),
    (v_id, 'Marchew', 10, 41, 0.9, 9.6, 0.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Ogórki kiszone', 180, 12, 0.6, 2.2, 0.1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ogórki kiszone' limit 1)),
    (v_id, 'Majonez', 150, 680, 1.1, 2.4, 74, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majonez' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Marchew obrać i pokroić w słupki. Gotować w osolonym wrzątku 2 minuty. Osączyć.', 2),
    (v_id, 1, 'Liście kapusty obgotować krótko, osączyć, wystudzić.', null),
    (v_id, 2, 'Ryż ugotować na miękko, osączyć, wystudzić.', null),
    (v_id, 3, 'Ogórki pokroić w kostkę, a rybę na kawałki. Cebule drobno posiekać.', null),
    (v_id, 4, 'Ryż wymieszać z rybą, ogórkami, cebulą i majonezem. Przyprawić. Nadzienie nałożyć na liść kapusty, zebrać i spiąć wykałaczkami. Przewiązać paskami marchewki.', null);

-- Sałata zielona w kremie szynkowym - 155 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sałata zielona w kremie szynkowym', '🥗', 5, 25,
        'latwy', array['warzywa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSa%C5%82ata_zielona_w_kremie_szynkowym')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Sałata', 1000, 15, 1.4, 2.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sałata' limit 1)),
    (v_id, 'Szynka', 50, 108, 18.5, 1.2, 3.3, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szynka' limit 1)),
    (v_id, 'Śmietana 30%', 120, 292, 2.3, 3.2, 30, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 30%' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Masło', 20, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Sok z cytryny', 15, 22, 0.4, 6.9, 0.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sok z cytryny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Sałatę przebrać, umyć, wrzucić do garnka i gotować w osolonej wodzie około 10 minut. Wyjąć, osączyć i odstawić w ciepłe miejsce.', 10),
    (v_id, 1, 'Masło roztopić na patelni, rozprowadzić mąkę, dodać odwar z gotowania sałaty. Mieszać, aż powstanie jasny sos. Przyprawić sokiem z cytryny i solą.', null),
    (v_id, 2, 'Szynkę posiekać drobniutko i dodać do sosu. Na koniec dodać ubitą śmietanę.', null),
    (v_id, 3, 'Sałatę ułożyć na półmisku i polać sosem tak, aby zielone końce pozostały odkryte. Pozostały sos podać oddzielnie.', null);

-- Sałatka italiana - 614 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sałatka italiana', '🍝', 4, 50,
        'sredni', array['sałatka', 'makaron', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSa%C5%82atka_italiana')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pomidory', 360, 18, 0.9, 3.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Ogórek świeży', 10, 15, 0.7, 3.6, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ogórek świeży' limit 1)),
    (v_id, 'Kukurydza konserwowa', 340, 86, 3.2, 19, 1.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kukurydza konserwowa' limit 1)),
    (v_id, 'Makaron', 500, 363, 12.5, 71.5, 1.8, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Oliwa z oliwek', 30, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Bulion warzywny', 30, 4, 0.2, 0.6, 0.1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Woda', 30, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Koperek', 10, 43, 3.5, 7, 1.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koperek' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Oregano', 1, 265, 9, 68.9, 4.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kukurydzę osączyć.', null),
    (v_id, 1, 'Makaron ugotować.', null),
    (v_id, 2, 'Ogórek i pomidory umyć, pokroić na plasterki, wymieszać delikatnie z makaronem.', null),
    (v_id, 3, 'Bulion zalać niewielką ilością wody, aby wytworzył się rodzaj pasty. Przełożyć do słoiczka, dodać oliwę, wodę, posiekaną drobno zieleninę, sól i pieprz. Słoik zakręcić i kilka razy mocno potrząsnąć, aby składniki dobrze się wymieszały.', null),
    (v_id, 4, 'Sałatkę polać sosem, delikatnie wymieszać i odstawić na około 30 minut w chłodne miejsce.', 30);

-- Sałatka z ryżem i owocami - 516 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sałatka z ryżem i owocami', '🌾', 3, 25,
        'sredni', array['kasze', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSa%C5%82atka_z_ry%C5%BCem_i_owocami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ryż biały', 190, 344, 6.7, 78.9, 0.7, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ryż biały' limit 1)),
    (v_id, 'Śmietanka 12%', 120, 127, 2.9, 4, 12, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietanka 12%' limit 1)),
    (v_id, 'Żółtko jaja', 36, 322, 15.9, 3.6, 26.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żółtko jaja' limit 1)),
    (v_id, 'Rodzynki', 50, 299, 3.1, 79.2, 0.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rodzynki' limit 1)),
    (v_id, 'Jabłka', 300, 52, 0.3, 13.8, 0.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jabłka' limit 1)),
    (v_id, 'Śliwki', 150, 46, 0.7, 11.4, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śliwki' limit 1)),
    (v_id, 'Brzoskwinie', 50, 39, 0.9, 9.5, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brzoskwinie' limit 1)),
    (v_id, 'Cukier', 48, 400, 0, 100, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Cukier wanilinowy', 10, 400, 0, 100, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier wanilinowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ryż ugotować na sypko.', null),
    (v_id, 1, 'Śliwki namoczyć, osuszyć i pokroić w paski. Rodzynki namoczyć.', null),
    (v_id, 2, 'Brzoskwinie osączyć i pokroić. Jabłka pokroić.', null),
    (v_id, 3, 'Żółtka utrzeć w rondelku z cukrem, dodać śmietankę. Rondelek postawić na małym ogniu i ubijać, aż sos zacznie gęstnieć.', null),
    (v_id, 4, 'Ryż wymieszać z owocami, polać sosem i posypać cukrem waniliowym.', null);

-- Ser brie z bułką paryską - 446 kcal/porcja, 2 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Ser brie z bułką paryską', '🥚', 2, 75,
        'trudny', array['przystawka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSer_brie_z_bu%C5%82k%C4%85_parysk%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Chleb pszenny', 100, 265, 8.5, 49, 3.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Chleb pszenny' limit 1)),
    (v_id, 'Ser brie', 100, 334, 20.8, 0.5, 27.7, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser brie' limit 1)),
    (v_id, 'Oliwa z oliwek', 15, 884, 0, 0, 100, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Czosnek', 100, 149, 6.4, 33.1, 0.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Bazylia', 1, 233, 14.4, 47.8, 4, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bazylia' limit 1)),
    (v_id, 'Oregano', 1.5, 265, 9, 68.9, 4.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Sól', 0.5, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Piekarnik nagrzej do (grzanie góra–dół). Blachę wyłóż papierem do pieczenia.', null),
    (v_id, 1, 'Ser brie wyjmij z opakowania, osusz ręcznikiem papierowym. Jeśli ma bardzo twardą skórkę, lekko ją ponacinaj nożem w kratkę.', null),
    (v_id, 2, 'W małej miseczce wymieszaj oliwę, drobno posiekany lub przetarty czosnek, bazylię, oregano, szczyptę soli i trochę pieprzu.', null),
    (v_id, 3, 'Płat ciasta francuskiego rozłóż na blacie. Pośrodku ułóż ser brie. Wierzch sera posmaruj połową przygotowanej oliwy z ziołami.', null),
    (v_id, 4, 'Zawiń ser w ciasto: zagnij do środka brzegi, tak aby szczelnie go okryć, a łączenie znalazło się na spodzie. W razie potrzeby odetnij nadmiar ciasta.', null),
    (v_id, 5, 'Owinięty ser przełóż na blachę złączeniem do dołu. Wierzch możesz naciąć delikatnie nożem w kratkę, aby ciasto ładnie się upiekło.', null),
    (v_id, 6, 'Wstaw do piekarnika i piecz ok. 20–25 minut, aż ciasto francuskie będzie wyraźnie wyrośnięte i złociste.', 23),
    (v_id, 7, 'W międzyczasie pokrój bułkę paryską w ukośne kromki. Ułóż je na osobnej blasze lub ruszcie, posmaruj resztą oliwy z ziołami.', null),
    (v_id, 8, 'Na ostatnie 5–7 minut pieczenia sera włóż do piekarnika kromki bułki i podpiecz, aż lekko się zrumienią i będą chrupiące.', 6),
    (v_id, 9, 'Upieczony ser w cieście wyjmij z piekarnika, odstaw na 5 minut, żeby nie był zbyt rzadki.', 5),
    (v_id, 10, 'Podawaj gorący ser brie w cieście francuskim razem z podpieczoną bułką paryską – kawałki bagietki maczaj w płynnym serze.', null);

-- Siemieniotka - 90 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Siemieniotka', '🍲', 7, 20,
        'latwy', array['zupa', 'wigilia', 'kuchnia polska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSiemieniotka')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Woda', 2000, 0, 0, 0, 0, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Woda' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Cukier', 7.5, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Bułka pszenna', 120, 279, 8.6, 55, 2.6, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Konopie opłukać, sparzyć wrzącą wodą lub zagotować. Gdy ziarenka zaczną pękać, odcedzić je na sitku; Umieścić w granku, zalać drobną ilością wrzątku; Gotując ucierać na drobno aż z nasion wyciśnie się mleczko; Przeciśnięte konopie należy uzupełniać wodą, tak by nie przywarły do naczynia; Po utarciu zalać wcześniej uzyskanym wywarem z konopi (opcjonalnie pół na pół z mlekiem i gotować aż osiągnie konsystencję kleiku. Do gotujących konopii dodać cebulę pokrojoną w plastry.', null),
    (v_id, 1, 'Z oleju (lub masła) i mąki zrobić ciemną zasmażkę i dodać do zupy, przyprawić według preferencji solą, pieprzem, cukrem.', null),
    (v_id, 2, 'Bułki pokroić w małe kostki i zasmażyć na grzanki.', null),
    (v_id, 3, 'Gotowe grzanki ułożyć na talerzach i zalać zupą.', null);

-- Snikers - 704 kcal/porcja, 12 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Snikers', '🍰', 12, 200,
        'trudny', array['ciasto', 'deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSnikers')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 585, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Cukier', 150, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Żółtko jaja', 36, 322, 15.9, 3.6, 26.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żółtko jaja' limit 1)),
    (v_id, 'Margaryna', 200, 717, 0.2, 0.7, 80, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Mleko 3,2%', 45, 61, 3.3, 4.7, 3.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Miód', 75, 322, 0.3, 79.5, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Miód' limit 1)),
    (v_id, 'Soda oczyszczona', 10, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Soda oczyszczona' limit 1)),
    (v_id, 'Cukier', 200, 400, 0, 100, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Margaryna', 125, 717, 0.2, 0.7, 80, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Cukier', 48, 400, 0, 100, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Miód', 50, 322, 0.3, 79.5, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Miód' limit 1)),
    (v_id, 'Orzechy włoskie', 200, 654, 15.2, 13.7, 65.2, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Orzechy włoskie' limit 1)),
    (v_id, 'Budyń w proszku', 40, 355, 0.5, 87, 0.3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Budyń w proszku' limit 1)),
    (v_id, 'Mleko 3,2%', 400, 61, 3.3, 4.7, 3.2, 14,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mąkę wymieszaną z sodą i przesianą przez sito na stolnicę posiekać z margaryną. Dodać pozostałe składniki i zagnieść ciasto. Podzielić je na trzy części.', null),
    (v_id, 1, 'Trzy identyczne prostokątne formy (20x30 cm) posmarowane margaryną i wyłożone papierem do pieczenia wylepić cienko ciastem. Na jedną część ciasta wylać gorącą polewę orzechową i upiec razem z pozostałymi.', null),
    (v_id, 2, 'Ugotować budyń według przepisu na opakowaniu, zużywając o jedną trzecią mleka mniej niż podano w przepisie. Ostudzić i utrzeć margaryną dodać 2 łyżeczki rozpuszczonej kawy.', null),
    (v_id, 3, 'Aby otrzymać karmel, puszkę z mlekiem wstawić do garnka z wodą i gotować 3 godziny. Ostudzić.', 180),
    (v_id, 4, 'Na jeden upieczony i ostudzony placek nałożyć budyń, przykryć drugim plackiem posmarowanym karmelem, a następnie nakryć plackiem z polewą orzechową.', null);

-- Sos ogórkowy - 203 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sos ogórkowy', '🥚', 3, 20,
        'sredni', array['nabiał']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSos_og%C3%B3rkowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ogórek świeży', 150, 15, 0.7, 3.6, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ogórek świeży' limit 1)),
    (v_id, 'Bulion warzywny', 250, 4, 0.2, 0.6, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Ogórek świeży', 62.5, 15, 0.7, 3.6, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ogórek świeży' limit 1)),
    (v_id, 'Smalec', 35, 900, 0, 0, 100, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Smalec' limit 1)),
    (v_id, 'Śmietana 18%', 60, 184, 2.6, 3.6, 18, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Żółtko jaja', 20, 322, 15.9, 3.6, 26.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żółtko jaja' limit 1)),
    (v_id, 'Mąka pszenna', 20, 364, 10.3, 76.3, 1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Z tłuszczu i mąki sporządzić zasmażkę i rozprowadzić ją zimnym wywarem.', null),
    (v_id, 1, 'Ogórki pokroić w kostkę i udusić na soku z ogórków, po czym dodać rozprowadzoną zasmażkę i zagotować.', null),
    (v_id, 2, 'Żółtko roztrzepać ze śmietaną i wlać do sosu. Przyprawić.', null),
    (v_id, 3, 'Podawać na gorąco do klopsów lub gotowanej wołowiny.', null);

-- Spaghetti con sugo alla diavola - 480 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Spaghetti con sugo alla diavola', '🍝', 7, 20,
        'trudny', array['makaron', 'wegetariańskie', 'kuchnia włoska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSpaghetti_con_sugo_alla_diavola')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Makaron', 400, 363, 12.5, 71.5, 1.8, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Pomidory', 1000, 18, 0.9, 3.9, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Seler korzeniowy', 6, 42, 1.5, 9.2, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler korzeniowy' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Papryka czerwona', 150, 31, 1, 6, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Czosnek', 10, 149, 6.4, 33.1, 0.5, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Oregano', 3, 265, 9, 68.9, 4.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oregano' limit 1)),
    (v_id, 'Oliwa z oliwek', 125, 884, 0, 0, 100, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Papryka czerwona', 10, 31, 1, 6, 0.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Ser żółty', 125, 358, 25, 1.3, 28, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Seler, marchew, cebulę, czosnek i rozmaryn zmiksować. Rozgrzać olej, wsypać zmiksowane warzywa i dobrze podsmażyć.', null),
    (v_id, 1, 'Dodać gotowe obrane pomidory (albo wcześniej sparzone i obrane ze skórki; jeśli są w całości, drobno pokroić). Dodać sól, pieprz i rozdrobnione suszone papryczki. Następnie dolać szklankę wody i na małym ogniu dusić około pół godziny, co raz mieszając drewnianą łyżką.', null),
    (v_id, 2, 'Na kilka minut przed zakończeniem gotowania dodać świeżą papryczkę. Jeżeli sos jest stosunkowo gęsty, można go odstawić i ugotować spaghetti. Odcedzony makaron dodać do ponownie podgrzanego sosu, delikatnie mieszając wsypać ser i zamieszać.', null),
    (v_id, 3, 'Nakładać szczypcami do spaghetti na talerze dodając na wierzch pozostały w garnku sos.', null);

-- Spaghetti z brokułami w sosie serowym - 680 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Spaghetti z brokułami w sosie serowym', '🍝', 4, 20,
        'sredni', array['makaron', 'kuchnia włoska', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSpaghetti_z_broku%C5%82ami_w_sosie_serowym')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Makaron', 400, 363, 12.5, 71.5, 1.8, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Brokuły', 350, 34, 2.8, 6.6, 0.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brokuły' limit 1)),
    (v_id, 'Ser parmezan', 20, 392, 35.8, 3.2, 25.8, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser parmezan' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Ser żółty', 200, 358, 25, 1.3, 28, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Masło', 5, 735, 0.7, 0.7, 82, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Wino białe wytrawne', 50, 82, 0.1, 2.6, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Śmietana 18%', 50, 184, 2.6, 3.6, 18, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Brokuły (jeśli surowe) umyć i zostawić same końcówki („różyczki”). Wrzucić je na rozgrzany tłuszcz, aby puściły soki i delikatnie je podsmażyć. Potem zalać odrobiną wody i dusić do momentu, gdy różyczki zaczną się rozsypywać. Drewnianą łyżką rozdrobnić (rozgnieść) brokuły na malutkie cząstki.', null),
    (v_id, 1, 'Starty ser żółty wrzucić do rondelka na rozgrzane masło i chwilę podgrzewać, wciąż mieszając. Dodać serek topiony, dolać wino (lub mleko) i nadal podgrzewać, mieszać do chwili całkowitego rozpuszczenia sera. Powstały sos przelać do brokułów, doprawić i ewentualnie zagęścić śmietanką.', null),
    (v_id, 2, 'Makaron w osolonej wodzie ugotować al dente (czas gotowania zależny od producenta makaronu).', null),
    (v_id, 3, 'Spaghetti ułożyć na talerzu, polać sosem. Tuż przed podaniem posypać tartym parmezanem.', null);

-- Spaghetti z szynką - 546 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Spaghetti z szynką', '🍝', 3, 20,
        'sredni', array['makaron', 'wieprzowina', 'kuchnia włoska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSpaghetti_z_szynk%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Makaron', 250, 363, 12.5, 71.5, 1.8, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Brokuły', 250, 34, 2.8, 6.6, 0.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brokuły' limit 1)),
    (v_id, 'Szynka', 130, 108, 18.5, 1.2, 3.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szynka' limit 1)),
    (v_id, 'Masło', 5, 735, 0.7, 0.7, 82, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Wino białe wytrawne', 240, 82, 0.1, 2.6, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Ser parmezan', 20, 392, 35.8, 3.2, 25.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser parmezan' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Makaron ugotować w osolonej wodzie według przepisu na opakowaniu. Odcedzić i odstawić w ciepłe miejsce.', null),
    (v_id, 1, 'Brokuły obgotować krótko, opłukać chłodną wodą i odsączyć.', null),
    (v_id, 2, 'Czosnek obrać, rozgnieść, podsmażyć na maśle pomieszanym z olejem, zalać winem i dusić aż do odparowania 2/3 płynu.', null),
    (v_id, 3, 'Szynkę pokroić w paski, dodać do sosu razem z brokułami, przyprawić solą i pieprzem.', null);

-- Sum duszony z pomidorami - 419 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Sum duszony z pomidorami', '🐟', 5, 40,
        'sredni', array['ryba']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSum_duszony_z_pomidorami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Sum', 1000, 143, 16.4, 0, 8.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sum' limit 1)),
    (v_id, 'Pomidory', 420, 18, 0.9, 3.9, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Mąka pszenna', 7.5, 364, 10.3, 76.3, 1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Śmietana 30%', 120, 292, 2.3, 3.2, 30, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 30%' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Musztarda', 40, 66, 4.4, 5.8, 3.4, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Musztarda' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Suma przygotować, opłukać, odfiletować, pokroić na kawałki szerokości 3 cm. Osolić, posypać mąką i usmażyć na oleju z dwóch stron.', null),
    (v_id, 1, 'Cebulę obrać, pokroić w krążki, usmażyć na oleju na jasnozłoty kolor. Do rondla włożyć cebulę, dodać pomidory pokrojone w talarki, musztardę, suma, zalać litrem wody. Dusić powoli 15-20 minut.', 18),
    (v_id, 2, 'Suma ostrożnie wyjąć, wyłożyć na półmisek, zostawić w ciepłym miejscu pod przykryciem.', null),
    (v_id, 3, 'Sos z duszenia przetrzeć, zagęścić mąką. Przyprawić do smaku solą, pieprzem, dodać śmietanę.', null),
    (v_id, 4, 'Suma na półmisku zalać sosem i posypać zieleniną. Podawać z kluskami półfrancuskimi lub z ziemniakami.', null);

-- Szaszłyki smakosza - 393 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Szaszłyki smakosza', '🍖', 5, 150,
        'sredni', array['mięso']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSzasz%C5%82yki_smakosza')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Łopatka wieprzowa', 200, 214, 17.6, 0, 16, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Schab wieprzowy', 200, 152, 21, 0, 7.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Schab wieprzowy' limit 1)),
    (v_id, 'Kiełbasa', 200, 298, 15, 1.5, 26, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kiełbasa' limit 1)),
    (v_id, 'Papryka czerwona', 375, 31, 1, 6, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Cebula', 250, 40, 1.1, 9.3, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Majeranek', 37.5, 271, 12.7, 60.6, 7, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majeranek' limit 1)),
    (v_id, 'Musztarda', 10, 66, 4.4, 5.8, 3.4, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Musztarda' limit 1)),
    (v_id, 'Czosnek', 12, 149, 6.4, 33.1, 0.5, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Oliwa z oliwek', 30, 884, 0, 0, 100, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Sos sojowy', 48, 53, 8.1, 4.9, 0.6, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos sojowy' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Czosnek posiekać. Zmieszać oliwę, sos sojowy i musztardę. Dodać majeranek, czosnek i pieprz, wymieszać.', null),
    (v_id, 1, 'Mięso pociąć w dość dużą kostkę włożyć do marynaty na minimalnie 2 godziny.', 120),
    (v_id, 2, 'Kiełbasę pokroić w grube plastry. Papryki pokroić na kwadraty wielkości mięsa, a cebulę na plastry.', null),
    (v_id, 3, 'Na patyki do szaszłyków nabijać po kolei paprykę, cebulę, pierwszy rodzaj mięsa, kiełbasę, drugi rodzaj mięsa, paprykę, cebulę, trzeci rodzaj mięsa.', null),
    (v_id, 4, 'Szaszłyki piec 10–15 minut na dobrze rozgrzanym grillu. Po tym czasie zawinąć je w folię aluminiową i ułożyć na brzegu grilla na dodatkowe 10 minut, by mięso nabrało smaku i aromatu.', 13);

-- Szpajza - 606 kcal/porcja, 2 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Szpajza', '🥚', 2, 50,
        'trudny', array['jajka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSzpajza')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jajko kurze', 220, 143, 12.6, 0.7, 9.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 200, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Żelatyna', 20, 335, 84, 0, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żelatyna' limit 1)),
    (v_id, 'Cytryna', 50, 29, 1.1, 9.3, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Kakao', 7, 228, 19.6, 57.9, 13.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kakao' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ubij pianę z białek. Oddzielnie utrzyj żółtka z cukrem.', null),
    (v_id, 1, 'Ostrożnie połącz obie masy, uważając, aby piana nie opadła.', null),
    (v_id, 2, 'Dodaj namoczoną i rozpuszczoną żelatynę (przepis na torebce).', null),
    (v_id, 3, 'Krem podziel na 2 równe części, do jednej dodaj sok z cytryny i dokładnie wymieszaj.', null),
    (v_id, 4, 'Do drugiej części dodaj kakao rozpuszczone w wódce, również wymieszaj.', null),
    (v_id, 5, 'Obie masy wkładaj na przemian do pucharków koktajlowych, każdą warstwę wygładzaj łyżeczką.', null),
    (v_id, 6, 'Możesz udekorować wisienką z konfitury albo wiśnią koktajlową.', null),
    (v_id, 7, 'Na niedzielny deser przeważnie robi się jednolitą szpajzę cytrynową.', null),
    (v_id, 8, 'Można ją przyrządzić łatwiej, miksując zastygającą galaretkę cytrynową (z torebki) z jajkami ubitymi z cukrem.', null),
    (v_id, 9, 'Do szpajzy dodaje się czasami drobno startą skórkę cytrynową, w sezonie można podać ją z truskawkami albo wiśniami.', null);

-- Szpinak zapiekany - 137 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Szpinak zapiekany', '🍖', 5, 30,
        'sredni', array['mięso', 'zapiekanka', 'lekkie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FSzpinak_zapiekany')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Szpinak', 1000, 23, 2.9, 3.6, 0.4, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szpinak' limit 1)),
    (v_id, 'Jajko kurze', 110, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Margaryna', 15, 717, 0.2, 0.7, 80, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Mleko 3,2%', 125, 61, 3.3, 4.7, 3.2, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Oliwa z oliwek', 4, 884, 0, 0, 100, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Oliwa z oliwek' limit 1)),
    (v_id, 'Przyprawa do zup', 15, 150, 10, 20, 3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Przyprawa do zup' limit 1)),
    (v_id, 'Gałka muszkatołowa', 0.2, 525, 5.8, 49.3, 36.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Gałka muszkatołowa' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Szpinak przebrać, opłukać, przez minutę w osolonym wrzątku, przelać zimną wodą, osączyć i posiekać.', null),
    (v_id, 1, 'Cebulę i czosnek obrać, posiekać i udusić na margarynie. Dodać szpinak i trzymać na ogniu aż odparuje (około dwóch minut).', null),
    (v_id, 2, 'Posiekać ogonówkę i wymieszać ze szpinakiem.', null),
    (v_id, 3, 'Jajka roztrzepać z mlekiem i przyprawą do zup. Doprawić gałką muszkatołową.', null),
    (v_id, 4, 'Żaroodporny półmisek wysmarować oliwą i ułożyć na nim szpinak. Polać zalewą z jajek i mleka. Zapiekać w gorącym piekarniku 10 minut.', 10);

-- Tort Bajgus - 448 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Tort Bajgus', '🍰', 7, 35,
        'sredni', array['ciasto']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FTort_Bajgus')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 50, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Jajko kurze', 247.5, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 84, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Mąka pszenna', 80, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Kakao', 21, 228, 19.6, 57.9, 13.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kakao' limit 1)),
    (v_id, 'Śmietana 30%', 500, 292, 2.3, 3.2, 30, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 30%' limit 1)),
    (v_id, 'Jabłka', 750, 52, 0.3, 13.8, 0.2, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jabłka' limit 1)),
    (v_id, 'Cukier wanilinowy', 10, 400, 0, 100, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier wanilinowy' limit 1)),
    (v_id, 'Żelatyna', 10, 335, 84, 0, 0.1, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żelatyna' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Oddzielić białka od żółtek. Z białek ubić pianę. W trakcie ubijania wsypywać powoli cukier, dodać też żółtka.', null),
    (v_id, 1, 'Mąkę pszenną wymieszać z ziemniaczaną i kakao, połączyć z masą jajeczną.', null),
    (v_id, 2, 'Do natłuszczonej tortownicy o średnicy 20–22 cm wlać ciasto i piec około pół godziny.', null),
    (v_id, 3, 'Jabłka obrać, pokroić na kawałki i gotować kilka minut w soku jabłkowym. Osączyć.', null),
    (v_id, 4, 'Ubić 30 dag śmietanki, wsypać do niej cukier waniliowy, dodać żelatynę rozpuszczoną w minimalnej ilości wody.', null),
    (v_id, 5, 'Krem połączyć z jabłkami. Biszkopt przekroić na dwa krążki i przełożyć kremem.', null),
    (v_id, 6, 'Resztę śmietany ubić, posmarować nią tort.', null);

-- Tort śmietanowy - 748 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Tort śmietanowy', '🍰', 5, 65,
        'sredni', array['ciasto']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FTort_%C5%9Bmietanowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jajko kurze', 330, 143, 12.6, 0.7, 9.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cukier', 200, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Mąka pszenna', 130, 364, 10.3, 76.3, 1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Mąka pszenna', 65, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Proszek do pieczenia', 4, 97, 0, 23, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Proszek do pieczenia' limit 1)),
    (v_id, 'Ocet', 5, 18, 0, 0.4, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ocet' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Śmietana 30%', 200, 292, 2.3, 3.2, 30, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 30%' limit 1)),
    (v_id, 'Budyń w proszku', 300, 355, 0.5, 87, 0.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Budyń w proszku' limit 1)),
    (v_id, 'Żelatyna', 20, 335, 84, 0, 0.1, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Żelatyna' limit 1)),
    (v_id, 'Cukier', 10, 400, 0, 100, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Białka ubić z cukrem na pianę. Żółtka wymieszać z octem i proszkiem do pieczenia, dodać białka i wymieszać. Po trochu dodawać mąkę.', null),
    (v_id, 1, 'Wlać do formy i piec około 40 minut.', 40),
    (v_id, 2, 'Budynie rozpuścić w połowie soku, dodać cukier i wlać do reszty gotującego się soku.', null),
    (v_id, 3, 'Śmietankę ubić. Dodać rozpuszczoną żelatynę.', null),
    (v_id, 4, 'Ciasto przekroić na pół. Na jedną połówkę wylać budyń, na drugą śmietanę. Po ostudzeniu obie części złączyć.', null),
    (v_id, 5, 'Wierzch posmarować śmietaną, udekorować i schłodzić.', null);

-- Twaróg z awokado - 313 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Twaróg z awokado', '🥚', 4, 35,
        'sredni', array['przystawka', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FTwar%C3%B3g_z_awokado')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Awokado', 400, 160, 2, 8.5, 14.7, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Awokado' limit 1)),
    (v_id, 'Twaróg półtłusty', 200, 133, 18.7, 3.7, 4.7, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Twaróg półtłusty' limit 1)),
    (v_id, 'Pieczarki', 100, 22, 3.1, 3.3, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Natka pietruszki', 8, 36, 3, 6.3, 0.8, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Orzechy włoskie', 20, 654, 15.2, 13.7, 65.2, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Orzechy włoskie' limit 1)),
    (v_id, 'Sok z cytryny', 15, 22, 0.4, 6.9, 0.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sok z cytryny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Pieczarki pokroić w kostkę. Cebulę posiekać.', null),
    (v_id, 1, 'Na patelni rozgrzać olej, zeszklić cebulę, dodać pieczarki i poddusić.', null),
    (v_id, 2, 'Twaróg rozetrzeć na gładką masę, wymieszać z pieczarkami, natką i orzechami.', null),
    (v_id, 3, 'Awokado umyć, przekroić wzdłuż na pół, wyjąć pestkę, wyjąć miąższ, pozostawiając około centymetra przy skórce.', null),
    (v_id, 4, 'Wydrążony miąższ rozgnieść widelcem, skropić sokiem z cytryny, dodać do masy serowej. Masę doprawić, wypełnić nią połówki awokado.', null),
    (v_id, 5, 'Zapiekać 10 minut w temperaturze .', 10);

-- Udka z kurczaka z pieczarkami - 407 kcal/porcja, 2 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Udka z kurczaka z pieczarkami', '🍗', 2, 30,
        'sredni', array['drób']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FUdka_z_kurczaka_z_pieczarkami')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pierś z kurczaka', 360, 110, 21.5, 0, 2.6, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pierś z kurczaka' limit 1)),
    (v_id, 'Pieczarki', 150, 22, 3.1, 3.3, 0.3, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Seler naciowy', 10, 16, 0.7, 3, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Seler naciowy' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Liść laurowy', 0.2, 313, 7.6, 75, 8.4, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Śmietana 18%', 120, 184, 2.6, 3.6, 18, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Udka kurczaka przeciąć na pół, osolić, oprószyć pieprzem i obsmażyć na maśle, aż skórka stanie się cienka,rumiana i chrupiąca. Przełożyć do innego naczynia, a na tłuszcz wrzucić pokrajany seler i cebulę.', null),
    (v_id, 1, 'Smażyć kilka minut, przełożyć do naczynia z kurczakiem.', null),
    (v_id, 2, 'Wrzucić pokrajane na grube kawałki pieczarki i smażyć do zrumienienia, po czym przełożyć do osobnego naczynia.', null),
    (v_id, 3, 'Wrzucić posiekany czosnek, chwilę podsmażyć, uważając, by się nie zrumienił, po czym wlać 1/4 szklanki wody. Podgotować, aż od dna naczynia odkleją się wszystkie pozostałości po smażeniu.', null),
    (v_id, 4, 'Wrzucić kurczaka, seler i cebulę, przyprawić, przykryć, dusić na bardzo małym ogniu aż mięso zacznie odchodzić od kości. Wrzucić pieczarki, dusić jeszcze kilka minut.', null),
    (v_id, 5, 'Wlać śmietanę rozbełtaną z mąką, wymieszać, gotować jeszcze przez chwilę, aż sos zgęstnieje.', null);

-- Warzywa z piekarnika - 146 kcal/porcja, 2 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Warzywa z piekarnika', '🥗', 2, 60,
        'sredni', array['warzywa', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FWarzywa_z_piekarnika')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Masło', 5, 735, 0.7, 0.7, 82, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Brokuły', 150, 34, 2.8, 6.6, 0.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brokuły' limit 1)),
    (v_id, 'Kalafior', 10, 25, 1.9, 5, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kalafior' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Cukinia', 10, 17, 1.2, 3.1, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukinia' limit 1)),
    (v_id, 'Cukinia', 10, 17, 1.2, 3.1, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukinia' limit 1)),
    (v_id, 'Natka pietruszki', 30, 36, 3, 6.3, 0.8, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Bułka pszenna', 45, 279, 8.6, 55, 2.6, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka pszenna' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Piekarnik nagrzać do temperatury .', null),
    (v_id, 1, 'Blachę wysmarować masłem.', null),
    (v_id, 2, 'Brokuły i kalafior podzielić na różyczki. Marchewki obrać, cukinie opłukać i pokroić w plastry.', null),
    (v_id, 3, 'W garnku zagotować pół litra osolonej wody. Na wrzątek wrzucić brokuły, kalafior i marchewkę, gotować na małym ogniu przez 5 minut.', 5),
    (v_id, 4, 'Po minucie dodać cukinie.', null),
    (v_id, 5, 'Warzywa osaczyć i ułożyć na przygotowanej blasze. Przyprawić. Natkę opłukać i posiekać, wymieszać z tartą bułką i posypać nią warzywa. Na wierzchu rozłożyć płatki masła.', null),
    (v_id, 6, 'Warzywa piec 30 minut przewracając co jakiś czas.', 30);

-- Warzywne miseczki - 134 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Warzywne miseczki', '🥗', 3, 25,
        'sredni', array['warzywa', 'wegańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FWarzywne_miseczki')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Pomidory', 480, 18, 0.9, 3.9, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Ogórek świeży', 10, 15, 0.7, 3.6, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ogórek świeży' limit 1)),
    (v_id, 'Kukurydza konserwowa', 200, 86, 3.2, 19, 1.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kukurydza konserwowa' limit 1)),
    (v_id, 'Czosnek', 4, 149, 6.4, 33.1, 0.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Natka pietruszki', 4, 36, 3, 6.3, 0.8, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Cytryna', 5, 29, 1.1, 9.3, 0.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Cukier', 10, 400, 0, 100, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kolby kukurydzy oczyścić z włókien, wrzucić na wrzątek z łyżką cukru i ugotować.', null),
    (v_id, 1, 'Z pomidorów ściąć czubki.', null),
    (v_id, 2, 'Z ogórka odkroić końce, pokroić na duże kawłki.', null),
    (v_id, 3, 'Z pomidorów i ogórków wydrążyć miąższ (zostawić nieco na końcu) i pokroić go w kostkę. Z kolby ściąć ziarna i wymieszać z miąższem. Posiekany czosnek rozetrzeć z olejem, pieprzem i solą.', null),
    (v_id, 4, 'Doprawić sokiem z cytryny, wymieszać z masą kukurydzianą i nałożyć do wydrążonych warzyw.', null);

-- Wiejska zupa z fasolą - 810 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Wiejska zupa z fasolą', '🍲', 4, 30,
        'sredni', array['mięso', 'kasze', 'zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FWiejska_zupa_z_fasol%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Fasola biała sucha', 250, 333, 21.4, 60.3, 1.6, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Fasola biała sucha' limit 1)),
    (v_id, 'Kasza jęczmienna', 150, 345, 8, 74, 1.4, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kasza jęczmienna' limit 1)),
    (v_id, 'Włoszczyzna', 400, 45, 1.3, 9.8, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Włoszczyzna' limit 1)),
    (v_id, 'Łopatka wieprzowa', 300, 214, 17.6, 0, 16, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Kiełbasa', 100, 298, 15, 1.5, 26, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Kiełbasa' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Ziele angielskie', 0.3, 263, 6.1, 72.1, 8.7, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziele angielskie' limit 1)),
    (v_id, 'Pieprz czarny', 300, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Liść laurowy', 0.2, 313, 7.6, 75, 8.4, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Majeranek', 0.5, 271, 12.7, 60.6, 7, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Majeranek' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Fasolę zalać wodą, wsypać kminek i moczyć przez noc. Zagotować i odstawić.', null),
    (v_id, 1, 'Mięso zalać wodą, posolić, wrzucić pieprz, ziele angielskie i zagotować.', null),
    (v_id, 2, 'Włoszczyznę wrzucić do wywaru. Jałowiec i liść laurowy rozgnieść w moździerzu i dodać do zupy.', null),
    (v_id, 3, 'Po godzinie wsypać kaszę i fasolę.', null),
    (v_id, 4, 'Cebulę i czosnek posiekać, kiełbasę pokroić, obsmażyć, dodać warzywa.', null),
    (v_id, 5, 'Kiedy składniki będą miękkie, dodać do niej zawartość patelni i chwilę gotować.', null);

-- Wieprzowe szaszłyki - 674 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Wieprzowe szaszłyki', '🍖', 3, 305,
        'trudny', array['wieprzowina']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FWieprzowe_szasz%C5%82yki')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Łopatka wieprzowa', 700, 214, 17.6, 0, 16, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Sos sojowy', 48, 53, 8.1, 4.9, 0.6, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos sojowy' limit 1)),
    (v_id, 'Cytryna', 30, 29, 1.1, 9.3, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Cukier', 12, 400, 0, 100, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Imbir świeży', 5, 80, 1.8, 17.8, 0.8, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Imbir świeży' limit 1)),
    (v_id, 'Curry', 2, 325, 12.7, 55.8, 13.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Curry' limit 1)),
    (v_id, 'Papryka czerwona', 2.5, 31, 1, 6, 0.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Olej rzepakowy', 25, 884, 0, 0, 100, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sezam', 18, 573, 17.7, 23.4, 49.7, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sezam' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso opłucz, osusz ręcznikiem papierowym i pokrój w podłużne paski lub większą kostkę, wygodną do nadziewania na patyczki.', null),
    (v_id, 1, 'W misce wymieszaj sos sojowy, sok z limonki, miód, olej sezamowy, czosnek, imbir, curry oraz chili; dopraw niewielką ilością soli i pieprzu (pamiętaj, że sos sojowy jest słony).', null),
    (v_id, 2, 'Do marynaty włóż pokrojone mięso, dokładnie obtocz każdy kawałek, przykryj i odstaw do lodówki na minimum 4 godziny, a najlepiej na całą noc.', 240),
    (v_id, 3, 'Drewniane patyczki przed użyciem namocz w zimnej wodzie przez około 20 minut, aby nie przypalały się podczas obróbki cieplnej.', 20),
    (v_id, 4, 'Zamarynowane mięso nadziewaj ściśle na patyczki, tworząc zgrabne szaszłyki. Nadmiar marynaty możesz zachować do smarowania w trakcie grillowania.', null),
    (v_id, 5, 'Rozgrzej grill, patelnię grillową lub zwykłą patelnię z 2–3 łyżkami oleju.', null),
    (v_id, 6, 'Szaszłyki smaż lub grilluj na średnim ogniu około 10–12 minut, regularnie obracając i smarując pozostałą marynatą, aż mięso będzie rumiane i soczyste w środku.', 11),
    (v_id, 7, 'Pod koniec obróbki posyp szaszłyki podprażonym sezamem, delikatnie dociskając, by ziarna przylgnęły do mięsa.', null),
    (v_id, 8, 'Jeśli przygotowujesz dip: wymieszaj jogurt z koncentratem pomidorowym, ziołami, solą i pieprzem, aż powstanie gładki sos.', null),
    (v_id, 9, 'Gotowe szaszłyki podawaj od razu, gorące, z jogurtowo‑pomidorowym dipem, świeżą sałatką i pieczywem lub ryżem.', null);

-- Wytrawny serowiec - 521 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Wytrawny serowiec', '🥚', 8, 95,
        'sredni', array['nabiał', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FWytrawny_serowiec')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mąka pszenna', 250, 364, 10.3, 76.3, 1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Jajko kurze', 330, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Masło', 125, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Szczypiorek', 75, 30, 3.3, 4.4, 0.7, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szczypiorek' limit 1)),
    (v_id, 'Twaróg półtłusty', 500, 133, 18.7, 3.7, 4.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Twaróg półtłusty' limit 1)),
    (v_id, 'Czosnek', 8, 149, 6.4, 33.1, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Czosnek' limit 1)),
    (v_id, 'Ser żółty', 300, 358, 25, 1.3, 28, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mąkę zagnieść z jajkiem, masłem i pół łyżeczki soli. Z ciasta uformować kulę, owinąć folią i wstawić na 30 minut do lodówki.', 30),
    (v_id, 1, 'Pomidorki umyć. Szczypiorek opłukać, osuszyć, posiekać. Łyżkę siekaniny odłożyć. Twaróg zmiksować z resztą jajek, czosnkiem, solą i pieprzem. Wymieszać ze szczypiorkiem i pomidorkami.', null),
    (v_id, 2, 'Ciastem wylepić wysmarowaną tłuszczem tortownicę. Wyłożyć na nie masę serową. Na wierzchu położyć pokrojony w plastry kozi ser.', null),
    (v_id, 3, 'Piec 50-60 minut w . Przed podaniem posypać szczypiorkiem.', 55);

-- Wątróbka po żydowsku z drobiu - 294 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Wątróbka po żydowsku z drobiu', '🥚', 5, 180,
        'trudny', array['przystawka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FW%C4%85tr%C3%B3bka_po_%C5%BCydowsku_z_drobiu')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Wątróbka drobiowa', 400, 128, 19, 1.4, 4.8, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wątróbka drobiowa' limit 1)),
    (v_id, 'Jajko kurze', 220, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Cebula', 400, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Olej rzepakowy', 35, 884, 0, 0, 100, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Masło', 22.5, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Jajka ugotuj na twardo (ok. 8–9 minut od chwili zagotowania wody), ostudź w zimnej wodzie, obierz i odstaw.', 9),
    (v_id, 1, 'Cebule obierz i pokrój w drobną kostkę lub cienkie półplasterki.', null),
    (v_id, 2, 'Na dużej patelni rozgrzej połowę tłuszczu, dodaj cebulę i smaż na małym ogniu, często mieszając, aż mocno się zeszkli i zacznie się lekko karmelizować. Przełóż do dużej miski.', null),
    (v_id, 3, 'Wątróbkę oczyść z błon i żyłek, umyj, dobrze osusz ręcznikiem papierowym.', null),
    (v_id, 4, 'Na tej samej patelni rozgrzej pozostały tłuszcz, dodaj wątróbkę i smaż na średnim ogniu 5–7 minut, aż przestanie być krwista w środku, ale pozostanie miękka. Pod koniec smażenia dopraw solą i pieprzem.', 6),
    (v_id, 5, 'Usmażoną wątróbkę przełóż do miski z cebulą i zostaw na kilka minut do przestudzenia.', null),
    (v_id, 6, 'Jajka pokrój na kawałki i dodaj do wątróbki z cebulą.', null),
    (v_id, 7, 'Całość bardzo drobno posiekaj dużym nożem albo krótko zmiksuj w malakserze pulsacyjnie, aby uzyskać gładką, ale lekko ziarnistą pastę.', null),
    (v_id, 8, 'Jeśli chcesz, dodaj masło o temperaturze pokojowej i dokładnie wymieszaj, aż masa będzie jednolita.', null),
    (v_id, 9, 'Spróbuj i dopraw do smaku dodatkową solą oraz pieprzem.', null),
    (v_id, 10, 'Natkę pietruszki drobno posiekaj; część wmieszaj w pastę, resztą posyp wierzch.', null),
    (v_id, 11, 'Gotową wątróbkę po żydowsku przykryj i schłodź w lodówce co najmniej 1–2 godziny. Podawaj dobrze schłodzoną, jako pastę do pieczywa lub krakersów.', 120);

-- Zapiekanka pikantna - 557 kcal/porcja, 11 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zapiekanka pikantna', '🍖', 11, 25,
        'trudny', array['mięso', 'warzywa', 'zapiekanka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZapiekanka_pikantna')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Mięso mielone wieprzowo-wołowe', 1000, 240, 17, 0, 19, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mięso mielone wieprzowo-wołowe' limit 1)),
    (v_id, 'Pomidory', 500, 18, 0.9, 3.9, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Pieczarki', 500, 22, 3.1, 3.3, 0.3, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Pomidory z puszki', 300, 32, 1.6, 5.3, 0.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory z puszki' limit 1)),
    (v_id, 'Makaron', 500, 363, 12.5, 71.5, 1.8, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makaron' limit 1)),
    (v_id, 'Ser żółty', 400, 358, 25, 1.3, 28, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Ziele angielskie', 0.3, 263, 6.1, 72.1, 8.7, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziele angielskie' limit 1)),
    (v_id, 'Olej rzepakowy', 10, 884, 0, 0, 100, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Papryka czerwona', 10, 31, 1, 6, 0.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1)),
    (v_id, 'Liść laurowy', 0.2, 313, 7.6, 75, 8.4, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Papryczka chili', 10, 40, 1.9, 8.8, 0.4, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryczka chili' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Makaron ugotować na półtwardo, przelać zimną wodą i pozostawić do osączenia.', null),
    (v_id, 1, 'Mięso usmażyć z cebulą i przyprawami.', null),
    (v_id, 2, 'Pieczarki oczyścić i smażyć na oleju. Pod koniec smażenia dodać pokrojone w kostkę i obrane ze skórki pomidory.', null),
    (v_id, 3, 'Pieczarki z pomidorami dodać do mięsa, przyprawić przecierem.', null),
    (v_id, 4, 'Naczynie żaroodporne natłuścić i warstwami układać na przemian makaron i farsz mięsny. Wierzch posypać startym serem.', null);

-- Zapiekanka z cielęciny i warzyw - 292 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zapiekanka z cielęciny i warzyw', '🍖', 4, 45,
        'sredni', array['mięso']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZapiekanka_z_ciel%C4%99ciny_i_warzyw')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Cielęcina', 300, 131, 20.4, 0, 5.5, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cielęcina' limit 1)),
    (v_id, 'Marchew', 300, 41, 0.9, 9.6, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Cebula', 10, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Bulion warzywny', 10, 4, 0.2, 0.6, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Sos sojowy', 16, 53, 8.1, 4.9, 0.6, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sos sojowy' limit 1)),
    (v_id, 'Ziemniaki', 500, 77, 2, 17.5, 0.1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Jajko kurze', 20, 143, 12.6, 0.7, 9.5, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Śmietana 18%', 120, 184, 2.6, 3.6, 18, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso zalać dwiema szklankami wrzącego bulionu warzywnego i gotować do miękkości. Wyjąć z wywaru, ostudzić i zmielić lub bardzo drobno posiekać.', null),
    (v_id, 1, 'Ziemniaki ugotować w mundurkach, odparować, ostudzić, obrać i pokroić w plastry.', null),
    (v_id, 2, 'Cebulę pokroić, skropić sosem sojowym, wlać 2-3 łyżki wywaru i udusić. Wymieszać z osączoną marchewką z groszkiem.', null),
    (v_id, 3, 'Naczynie żaroodporne wysmarować oliwą i ułożyć w nim warstwami: połowę ziemniaków, połowę warzyw, mięso, resztę warzyw i pozostałe ziemniaki.', null),
    (v_id, 4, 'Jajko roztrzepać ze śmietaną, rozprowadzić 1/5 szklanki wywaru i polać zapiekankę.', null),
    (v_id, 5, 'Wstawić do piekarnika nagrzanego do na 15-20 minut.', 18);

-- Zapiekanka z marchwi - 248 kcal/porcja, 6 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zapiekanka z marchwi', '🧀', 6, 20,
        'sredni', array['warzywa', 'zapiekanka', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZapiekanka_z_marchwi')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Marchew', 1000, 41, 0.9, 9.6, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Cukier', 6, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Wino białe wytrawne', 60, 82, 0.1, 2.6, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Pieczarki', 250, 22, 3.1, 3.3, 0.3, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieczarki' limit 1)),
    (v_id, 'Ser żółty', 150, 358, 25, 1.3, 28, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Śmietana 18%', 100, 184, 2.6, 3.6, 18, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Natka pietruszki', 10, 36, 3, 6.3, 0.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Marchew obrać, umyć, pokroić w grube słupki, a następnie smażyć na maśle z dodatkiem cukru około trzy minuty. Przyprawić solą i pieprzem.', null),
    (v_id, 1, 'Wino wlać do rondelka i gotować 6 minut na małym ogniu. Dodać połowę śmietany.', 6),
    (v_id, 2, 'Pieczarki obrać, pokroić w plasterki i przesmażyć na maśle.', null),
    (v_id, 3, 'W naczyniu żaroodpornym ułożyć marchew, pieczarki, polać winem, posypać natką i pokrojonym w małą kostkę serem. Zalać resztą śmietany. Krótko zapiec.', null);

-- Zapiekanka z pieczonym mięsem - 256 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zapiekanka z pieczonym mięsem', '🧀', 3, 20,
        'latwy', array['zapiekanka', 'warzywa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZapiekanka_z_pieczonym_mi%C4%99sem')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 300, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Brokuły', 400, 34, 2.8, 6.6, 0.4, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Brokuły' limit 1)),
    (v_id, 'Ser żółty', 45, 358, 25, 1.3, 28, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ziemniaki i marchew ugotować w mundurkach, obrać i pokroić - ziemniaki w plasterki, marchewkę w kostkę.', null),
    (v_id, 1, 'Brokuł krótko obgotować, podzielić na różyczki.', null),
    (v_id, 2, 'Naczynie żaroodporne nasmarować olejem i układać w nim na przemian plastry ziemniaków i mięsa. Obłożyć brokułem i marchewką, posypać przyprawami i serem.', null),
    (v_id, 3, 'Zapiekać około pół godziny w piekarniku nagrzanym do temperatury .', null);

-- Zapiekanka z rybą wędzoną - 358 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zapiekanka z rybą wędzoną', '🐟', 7, 30,
        'sredni', array['ryba', 'zapiekanka']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZapiekanka_z_ryb%C4%85_w%C4%99dzon%C4%85')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Ziemniaki', 1500, 77, 2, 17.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Margaryna', 5, 717, 0.2, 0.7, 80, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Margaryna' limit 1)),
    (v_id, 'Jajko kurze', 165, 143, 12.6, 0.7, 9.5, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Makrela wędzona', 300, 305, 20.7, 0, 24, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Makrela wędzona' limit 1)),
    (v_id, 'Śmietana 18%', 20, 184, 2.6, 3.6, 18, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Pietruszka korzeń', 10, 75, 2.9, 17, 0.8, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ziemniaki ugotować w mundurkach, wystudzić, obrać i pokroić w krążki.', null),
    (v_id, 1, 'Cebulę obrać, pokroić w półplasterki i podsmażyć na tłuszczu.', null),
    (v_id, 2, 'Jajka ugotować na twardo, obrać i pokroić.', null),
    (v_id, 3, 'Rybę obrać ze skóry i ości, podzielić na małe kawałki.', null),
    (v_id, 4, 'Naczynie żaroodporne wysmarować tłuszczem. Ułożyć warstwę ziemniaków, warstwę cebuli, ryby i jajek i przykryć pozostałymi ziemniakami. Warstwy układać tak, by na wierzchu były ziemniaki.', null),
    (v_id, 5, 'Śmietanę rozmieszać z mąką, posolić, oprószyć pieprzem. Zapiekankę zalać przygotowaną zasmażką, posypać posiekaną pietruszką i zapiec.', null);

-- Zawijasy z Sudowy - 345 kcal/porcja, 10 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zawijasy z Sudowy', '🍖', 10, 25,
        'trudny', array['mięso', 'nabiał', 'kuchnia litewska']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZawijasy_z_Sudowy')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Łopatka wieprzowa', 800, 214, 17.6, 0, 16, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Łopatka wieprzowa' limit 1)),
    (v_id, 'Jajko kurze', 20, 143, 12.6, 0.7, 9.5, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jajko kurze' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Bułka tarta', 20, 383, 12.5, 71, 4.7, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bułka tarta' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Liść laurowy', 0.2, 313, 7.6, 75, 8.4, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Liść laurowy' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Szynka', 150, 108, 18.5, 1.2, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szynka' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Masło', 15, 735, 0.7, 0.7, 82, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Wino białe wytrawne', 250, 82, 0.1, 2.6, 0, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Śmietana 18%', 250, 184, 2.6, 3.6, 18, 12,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Masło', 45, 735, 0.7, 0.7, 82, 13,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Mięso pokroić na plastry, rozbić, oprószyć solą i pieprzem.', null),
    (v_id, 1, 'Marchewkę, szynkę i cebulę posiekać i usmażyć na maśle. Farszem posmarować plastry mięsa, zwinąć i spiąć wykałaczkami.', null),
    (v_id, 2, 'Boki zawijasów przykryć liśćmi laurowymi w miejscu wbicia wykałaczki.', null),
    (v_id, 3, 'Panierować w jajku i bułce tartej, smażyć na sklarowanym maśle.', null),
    (v_id, 4, 'Do tłuszczu ze smażenia wlać wino i śmietanę, dodać sól i pieprz. Gotować. Mieszając, dodawać po kawałku zimne masło. Powstałym sosem polać zawijasy.', null);

-- Zupa Dal (Dhal) - 209 kcal/porcja, 3 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa Dal (Dhal)', '🍲', 3, 50,
        'sredni', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_Dal_(Dhal)')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Marchew', 210, 41, 0.9, 9.6, 0.2, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Pietruszka korzeń', 160, 75, 2.9, 17, 0.8, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pietruszka korzeń' limit 1)),
    (v_id, 'Pomidory', 400, 18, 0.9, 3.9, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Bulion warzywny', 10, 4, 0.2, 0.6, 0.1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Soczewica czerwona', 63.3, 352, 24.6, 63, 1.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Soczewica czerwona' limit 1)),
    (v_id, 'Mleko kokosowe', 60, 197, 2, 2.8, 21.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko kokosowe' limit 1)),
    (v_id, 'Curry', 2, 325, 12.7, 55.8, 13.8, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Curry' limit 1)),
    (v_id, 'Papryka czerwona', 5, 31, 1, 6, 0.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Papryka czerwona' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Ugotować wywar z marchewki, pietruszki i kostki wywaru (ok. 20 minut).', 20),
    (v_id, 1, 'Zmiksować.', null),
    (v_id, 2, 'Dodać karton pomidorów w kawałkach, soczewicę, przyprawy, mleko kokosowe.', null),
    (v_id, 3, 'Dodać przyprawy.', null),
    (v_id, 4, 'Gotować jeszcze 15 minut.', 15);

-- Zupa jagodowa - 328 kcal/porcja, 11 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa jagodowa', '🍲', 11, 30,
        'sredni', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_jagodowa')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Jagody', 3000, 57, 0.7, 14.5, 0.3, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Jagody' limit 1)),
    (v_id, 'Cynamon', 0.5, 247, 4, 80.6, 1.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Goździki', 0.3, 274, 6, 65.5, 13, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Goździki' limit 1)),
    (v_id, 'Wino białe wytrawne', 480, 82, 0.1, 2.6, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Cukier', 370, 400, 0, 100, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Mąka pszenna', 5, 364, 10.3, 76.3, 1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kubek wybranych, dużych jagód odstawić do późniejszego wykorzystania.', null),
    (v_id, 1, 'Resztę jagód zalać wodą i zagotować.', null),
    (v_id, 2, 'Rozgnieść i przecedzić przez sito; odstawić na chwilę, aby cząstki jagód opadły na dno, i zlać klarowny „sok” do drugiego garnka.', null),
    (v_id, 3, 'Do „soku” dodać cukier, przyprawy i wino (w winie można rozrobić pół łyżki mąki) i zagotować.', null),
    (v_id, 4, 'Dodać kubek wcześniej wybranych jagód, gotować jeszcze przez chwilę.', null),
    (v_id, 5, 'Podawać schłodzoną.', null);

-- Zupa jarzynowa - 107 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa jarzynowa', '🍲', 5, 20,
        'sredni', array['zupa', 'warzywa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_jarzynowa')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Bulion warzywny', 500, 4, 0.2, 0.6, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Włoszczyzna', 400, 45, 1.3, 9.8, 0.3, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Włoszczyzna' limit 1)),
    (v_id, 'Marchew', 140, 41, 0.9, 9.6, 0.2, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Marchew' limit 1)),
    (v_id, 'Fasola biała sucha', 50, 333, 21.4, 60.3, 1.6, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Fasola biała sucha' limit 1)),
    (v_id, 'Ziemniaki', 100, 77, 2, 17.5, 0.1, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ziemniaki' limit 1)),
    (v_id, 'Koncentrat pomidorowy', 5, 82, 4.3, 18.9, 0.5, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Koncentrat pomidorowy' limit 1)),
    (v_id, 'Śmietana 18%', 5, 184, 2.6, 3.6, 18, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Mąka pszenna', 1.5, 364, 10.3, 76.3, 1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Olej rzepakowy', 2, 884, 0, 0, 100, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Warzywa oczyścić, umyć i pokroić.', null),
    (v_id, 1, 'Zalać wywarem, posolić i zagotować.', null),
    (v_id, 2, 'Ziemniaki pokroić w kostkę i wrzucić do gotującej się zupy.', null),
    (v_id, 3, 'Koncentrat pomidorowy wymieszać ze śmietaną i mąką, podprawić zupę i zagotować. Podprawić do smaku przyprawami i tłuszczem.', null);

-- Zupa kremowa z dyni - 159 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa kremowa z dyni', '🍲', 7, 45,
        'sredni', array['zupa', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_kremowa_z_dyni')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Dynia', 1500, 26, 1, 6.5, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Dynia' limit 1)),
    (v_id, 'Pomarańcze', 400, 47, 0.9, 11.8, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomarańcze' limit 1)),
    (v_id, 'Cebula', 100, 40, 1.1, 9.3, 0.1, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Imbir świeży', 30, 80, 1.8, 17.8, 0.8, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Imbir świeży' limit 1)),
    (v_id, 'Masło', 30, 735, 0.7, 0.7, 82, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Olej rzepakowy', 20, 884, 0, 0, 100, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Olej rzepakowy' limit 1)),
    (v_id, 'Cynamon', 2.5, 247, 4, 80.6, 1.2, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Bulion warzywny', 500, 4, 0.2, 0.6, 0.1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1)),
    (v_id, 'Śmietana 18%', 20, 184, 2.6, 3.6, 18, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Groszek zielony', 10, 81, 5.4, 14.5, 0.4, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Groszek zielony' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Przekroić dynię na ćwiartki i usunąć nasiona oraz włóknisty miąższ ze środka. Pozostały, twardy miąższ pokroić w plastry, obrać skórkę, a następnie pokroić plastry w kostkę.', null),
    (v_id, 1, 'Dynię i imbir zetrzeć na tarce z dużymi oczkami, cebulę pokroić.', null),
    (v_id, 2, 'Startą dynię, imbir, pokrojoną cebulę wraz z masłem i olejem dusić do całkowitej miękkości. Powinna się rozpadać.', null),
    (v_id, 3, 'Dodać wywar (można go zrobić rozpuszczając kostkę rosołową), sok z pomarańczy i dusić jeszcze przez kilka minut.', null),
    (v_id, 4, 'Dodać cynamon, sól, pieprz i dusić przez kolejne 10–15 minut.', 13),
    (v_id, 5, 'Zmiksować, dodać śmietanę.', null),
    (v_id, 6, 'Podawać z grzankami albo groszkiem ptysiowym.', null);

-- Zupa serowa zapiekana - 665 kcal/porcja, 4 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa serowa zapiekana', '🍲', 4, 25,
        'sredni', array['zupa', 'nabiał', 'wegetariańskie']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_serowa_zapiekana')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Bulion warzywny', 20, 4, 0.2, 0.6, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Cebula', 200, 40, 1.1, 9.3, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cebula' limit 1)),
    (v_id, 'Masło', 60, 735, 0.7, 0.7, 82, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 10, 364, 10.3, 76.3, 1, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Mleko 3,2%', 500, 61, 3.3, 4.7, 3.2, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mleko 3,2%' limit 1)),
    (v_id, 'Ser żółty', 500, 358, 25, 1.3, 28, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Ser żółty' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Kostki rosołowe zalać litrem wrzątku.', null),
    (v_id, 1, 'Cebulę obrać, pokroić w kostkę i zeszklić na maśle. Dodać mąkę i wszystko smażyć przez około 2 minuty. Podczas smażenia stopniowo dolewać rosół. Gotować 10 minut, często mieszając.', 2),
    (v_id, 2, 'Wlać mleko, doprawić solą i pieprzem, połączyć z serem.', null),
    (v_id, 3, 'Wstawić do średnio nagrzanego piekarnika i zapiekać 15 minut.', 15);

-- Zupa wiśniowa - 316 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa wiśniowa', '🍲', 7, 25,
        'latwy', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_wi%C5%9Bniowa')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Wiśnie', 2000, 50, 1, 12.2, 0.3, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wiśnie' limit 1)),
    (v_id, 'Cynamon', 0.5, 247, 4, 80.6, 1.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Goździki', 0.3, 274, 6, 65.5, 13, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Goździki' limit 1)),
    (v_id, 'Cukier', 250, 400, 0, 100, 0, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Wino białe wytrawne', 240, 82, 0.1, 2.6, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1)),
    (v_id, 'Mąka pszenna', 3, 364, 10.3, 76.3, 1, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Utłuc wiśnie (bez ogonków, z pestkami).', null),
    (v_id, 1, 'Dodać przyprawy i odstawić na pół godziny.', null),
    (v_id, 2, 'Przetrzeć przez sito, dodać cukier, wino i 1 l wody.', null),
    (v_id, 3, 'Zagotować.', null),
    (v_id, 4, 'Na koniec można zaprawić łyżeczką mąki kartoflanej.', null);

-- Zupa z jabłek lub gruszek - 394 kcal/porcja, 8 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa z jabłek lub gruszek', '🍲', 8, 25,
        'latwy', array['zupa', 'deser']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_z_jab%C5%82ek_lub_gruszek')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Gruszki', 2000, 57, 0.4, 15.2, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Gruszki' limit 1)),
    (v_id, 'Cynamon', 2.5, 247, 4, 80.6, 1.2, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Cukier', 250, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Śmietana 18%', 500, 184, 2.6, 3.6, 18, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 18%' limit 1)),
    (v_id, 'Rodzynki', 30, 299, 3.1, 79.2, 0.5, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Rodzynki' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Jabłka lub gruszki pokroić na ćwiartki i usunąć gniazda nasienne.', null),
    (v_id, 1, 'Zalać wodą i gotować, aż będą miękkie.', null),
    (v_id, 2, 'Przetrzeć przez durszlak (skórki zostaną w durszlaku).', null),
    (v_id, 3, 'Dodać cukier (jabłka mogą potrzebować trochę więcej, a gruszki trochę mniej), cynamon, ewentualnie rodzynki, zaprawić kwaśną śmietaną.', null),
    (v_id, 4, 'Zagotować.', null);

-- Zupa ze szparagów - 202 kcal/porcja, 5 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa ze szparagów', '🍲', 5, 30,
        'sredni', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_ze_szparag%C3%B3w')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Szparagi', 500, 20, 2.2, 3.9, 0.1, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Szparagi' limit 1)),
    (v_id, 'Bulion warzywny', 750, 4, 0.2, 0.6, 0.1, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Bulion warzywny' limit 1)),
    (v_id, 'Cukier', 10, 400, 0, 100, 0, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Pomidory', 250, 18, 0.9, 3.9, 0.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pomidory' limit 1)),
    (v_id, 'Natka pietruszki', 30, 36, 3, 6.3, 0.8, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Natka pietruszki' limit 1)),
    (v_id, 'Cytryna', 5, 29, 1.1, 9.3, 0.3, 5,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cytryna' limit 1)),
    (v_id, 'Masło', 50, 735, 0.7, 0.7, 82, 6,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Masło' limit 1)),
    (v_id, 'Mąka pszenna', 30, 364, 10.3, 76.3, 1, 7,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Mąka pszenna' limit 1)),
    (v_id, 'Śmietana 30%', 100, 292, 2.3, 3.2, 30, 8,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śmietana 30%' limit 1)),
    (v_id, 'Gałka muszkatołowa', 2, 525, 5.8, 49.3, 36.3, 9,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Gałka muszkatołowa' limit 1)),
    (v_id, 'Sól', 2, 0, 0, 0, 0, 10,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Sól' limit 1)),
    (v_id, 'Pieprz czarny', 2, 251, 10.4, 63.9, 3.3, 11,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Pieprz czarny' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Szparagi umyć i obrać. Skórki gotować w rosole przez 10 minut z łyżką cukru. Odcedzić.', 10),
    (v_id, 1, 'Szparagi pokroić na skośne kawałki i obgotować w rosole.', null),
    (v_id, 2, 'Pomidory sparzyć, obrać ze skórki, pokroić w ćwiartki, pestki usunąć. Miąższ pokroić w kostkę, wymieszać z posiekaną natką, sokiem z cytryny i resztą cukru.', null),
    (v_id, 3, 'Z mąki i masła zrobić zasmażkę, połączyć z zupą i gotować pod przykryciem 5 minut.', 5),
    (v_id, 4, 'Śmietanę wlać do zupy, uważając, by się nie zwarzyła.', null);

-- Zupa śliwkowa - 303 kcal/porcja, 7 porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', 'Zupa śliwkowa', '🍲', 7, 25,
        'latwy', array['zupa']::text[], true,
        'CC BY-SA 4.0', 'Wikibooks - Książka kucharska', 'https://pl.wikibooks.org/wiki/Ksi%C4%85%C5%BCka_kucharska%2FZupa_%C5%9Bliwkowa')
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
    (v_id, 'Śliwki', 2000, 46, 0.7, 11.4, 0.3, 0,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Śliwki' limit 1)),
    (v_id, 'Cukier', 250, 400, 0, 100, 0, 1,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cukier' limit 1)),
    (v_id, 'Goździki', 0.3, 274, 6, 65.5, 13, 2,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Goździki' limit 1)),
    (v_id, 'Cynamon', 0.5, 247, 4, 80.6, 1.2, 3,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Cynamon' limit 1)),
    (v_id, 'Wino białe wytrawne', 240, 82, 0.1, 2.6, 0, 4,
     (select id from public.foods where user_id is null and source = 'curated' and name = 'Wino białe wytrawne' limit 1));

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
    (v_id, 0, 'Śliwki umyć i wypestkować.', null),
    (v_id, 1, 'Ułożyć śliwki w garnku i zalać wodą, tak aby ledwie je przykrywała.', null),
    (v_id, 2, 'Gotować, często mieszając, aż będą miękkie.', null),
    (v_id, 3, 'Przetrzeć przez sito lub durszlak.', null),
    (v_id, 4, 'Dodać cukier, przyprawy, wino i pół litra wody, zagotować.', null);

end $$;

-- ------------------------------------------------------------
-- Sprawdzenie: czy katalog wszedł i czy liczby mają sens
-- ------------------------------------------------------------

do $$
declare
  v_przepisy int;
  v_bez_krokow int;
  v_dziwne int;
begin
  select count(*) into v_przepisy from public.recipes where user_id is null;
  if v_przepisy <> 97 then
    raise exception 'Migracja 0051: przepisów jest %, miało być 97', v_przepisy;
  end if;

  select count(*) into v_bez_krokow
    from public.recipes r
   where r.user_id is null
     and (not exists (select 1 from public.recipe_steps s where s.recipe_id = r.id)
          or not exists (select 1 from public.recipe_items i where i.recipe_id = r.id));
  if v_bez_krokow > 0 then
    raise exception 'Migracja 0051: % przepisów bez kroków lub bez składników', v_bez_krokow;
  end if;

  -- Ta sama bramka, co w generatorze - tym razem po stronie bazy, na danych,
  -- które naprawdę wylądowały w tabelach.
  select count(*) into v_dziwne
    from public.v_recipe_totals
   where user_id is null
     and (kcal_100g < 20 or kcal_100g > 600
          or kcal / greatest(servings, 1) < 80
          or kcal / greatest(servings, 1) > 1500);
  if v_dziwne > 0 then
    raise exception 'Migracja 0051: % przepisów z niemożliwą kalorycznością', v_dziwne;
  end if;
end $$;
