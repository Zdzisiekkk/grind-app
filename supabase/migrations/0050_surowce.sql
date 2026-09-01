-- ============================================================
-- 0050: surowce - podstawy kuchni w wyszukiwarce jedzenia
--
-- Open Food Facts to baza produktów Z KODEM KRESKOWYM. Nie ma w niej mąki
-- z worka, jajka ze skrzynki ani marchewki - a to jest to, z czego składa się
-- gotowanie. Wyszukiwarka zwracała na "mąka" przypadkowe mieszanki do naleśników
-- w opakowaniu, bo tylko takie mają kod.
--
-- Ta lista zamyka dziurę i przy okazji jest słownikiem, z którego liczą się
-- makra przepisów z katalogu (migracja 0051). Jedno źródło liczb dla obu rzeczy:
-- gdyby przepis liczył się z innych wartości niż te, które widzisz
-- w wyszukiwarce, ta sama marchewka miałaby dwie różne kaloryczności.
--
-- Wartości przeciętne dla surowca w stanie, w jakim trafia do garnka: mięso
-- surowe, kasza sucha, warzywa świeże.
--
-- Plik powstaje ze skryptu (npm run import:przepisy) ze słownika
-- scripts/dane/surowce.mjs - poprawki nanoś tam, nie tutaj.
-- ============================================================

/*
 * Idempotencja przez sprawdzenie, nie przez ON CONFLICT - dokładnie ta sama
 * pułapka, co przy 52 daniach w migracji 0023: w foods nie ma więzu
 * unikalności na nazwie, więc konflikt nigdy nie zachodzi, a każde ponowne
 * uruchomienie migracji dokłada komplet duplikatów.
 */
do $$
begin
if exists (
  select 1 from public.foods
   where user_id is null and source = 'curated' and kind = 'product'
) then
  raise notice 'Surowce już są - pomijam.';
  return;
end if;

insert into public.foods
  (user_id, source, kind, name, kcal_100g, protein_100g, carbs_100g, fat_100g,
   serving_size_g, serving_label)
values
  (null, 'curated', 'product', 'Mąka pszenna', 364, 10.3, 76.3, 1, null, null),
  (null, 'curated', 'product', 'Mąka żytnia', 349, 8.2, 75.9, 1.4, null, null),
  (null, 'curated', 'product', 'Mąka ziemniaczana', 343, 0.5, 83.1, 0.1, null, null),
  (null, 'curated', 'product', 'Mąka kukurydziana', 361, 6.9, 76.8, 3.9, null, null),
  (null, 'curated', 'product', 'Bułka tarta', 383, 12.5, 71, 4.7, null, null),
  (null, 'curated', 'product', 'Kasza gryczana', 336, 12.6, 69.3, 2.6, null, null),
  (null, 'curated', 'product', 'Kasza jęczmienna', 345, 8, 74, 1.4, null, null),
  (null, 'curated', 'product', 'Kasza jaglana', 346, 10.5, 71.6, 3.3, null, null),
  (null, 'curated', 'product', 'Kasza manna', 360, 9.8, 76, 1.2, null, null),
  (null, 'curated', 'product', 'Ryż biały', 344, 6.7, 78.9, 0.7, null, null),
  (null, 'curated', 'product', 'Ryż brązowy', 331, 6.8, 71.1, 2.7, null, null),
  (null, 'curated', 'product', 'Makaron', 363, 12.5, 71.5, 1.8, null, null),
  (null, 'curated', 'product', 'Płatki owsiane', 366, 11.9, 60, 7.2, null, null),
  (null, 'curated', 'product', 'Chleb pszenny', 265, 8.5, 49, 3.2, null, null),
  (null, 'curated', 'product', 'Chleb żytni razowy', 223, 6.1, 43, 1.7, null, null),
  (null, 'curated', 'product', 'Bułka pszenna', 279, 8.6, 55, 2.6, 60, 'sztuka'),
  (null, 'curated', 'product', 'Mleko 3,2%', 61, 3.3, 4.7, 3.2, null, null),
  (null, 'curated', 'product', 'Mleko 2%', 51, 3.3, 4.8, 2, null, null),
  (null, 'curated', 'product', 'Mleko zagęszczone słodzone', 321, 7.9, 55, 8.7, null, null),
  (null, 'curated', 'product', 'Śmietana 18%', 184, 2.6, 3.6, 18, null, null),
  (null, 'curated', 'product', 'Śmietana 30%', 292, 2.3, 3.2, 30, null, null),
  (null, 'curated', 'product', 'Śmietanka 12%', 127, 2.9, 4, 12, null, null),
  (null, 'curated', 'product', 'Jogurt naturalny', 61, 3.5, 4.7, 3.3, null, null),
  (null, 'curated', 'product', 'Kefir', 51, 3.3, 4.1, 2, null, null),
  (null, 'curated', 'product', 'Maślanka', 40, 3.3, 4.7, 0.9, null, null),
  (null, 'curated', 'product', 'Masło', 735, 0.7, 0.7, 82, null, null),
  (null, 'curated', 'product', 'Margaryna', 717, 0.2, 0.7, 80, null, null),
  (null, 'curated', 'product', 'Twaróg półtłusty', 133, 18.7, 3.7, 4.7, null, null),
  (null, 'curated', 'product', 'Ser żółty', 358, 25, 1.3, 28, null, null),
  (null, 'curated', 'product', 'Ser feta', 264, 14.2, 4.1, 21.3, null, null),
  (null, 'curated', 'product', 'Ser mozzarella', 280, 22, 2.2, 20, null, null),
  (null, 'curated', 'product', 'Ser parmezan', 392, 35.8, 3.2, 25.8, null, null),
  (null, 'curated', 'product', 'Ser brie', 334, 20.8, 0.5, 27.7, null, null),
  (null, 'curated', 'product', 'Serek śmietankowy', 253, 6.2, 4.1, 23.4, null, null),
  (null, 'curated', 'product', 'Jajko kurze', 143, 12.6, 0.7, 9.5, 55, 'sztuka'),
  (null, 'curated', 'product', 'Żółtko jaja', 322, 15.9, 3.6, 26.5, 18, 'sztuka'),
  (null, 'curated', 'product', 'Białko jaja', 52, 10.9, 0.7, 0.2, 33, 'sztuka'),
  (null, 'curated', 'product', 'Olej rzepakowy', 884, 0, 0, 100, null, null),
  (null, 'curated', 'product', 'Oliwa z oliwek', 884, 0, 0, 100, null, null),
  (null, 'curated', 'product', 'Smalec', 900, 0, 0, 100, null, null),
  (null, 'curated', 'product', 'Pierś z kurczaka', 110, 21.5, 0, 2.6, 180, 'sztuka'),
  (null, 'curated', 'product', 'Udko z kurczaka', 168, 17.5, 0, 11, 130, 'sztuka'),
  (null, 'curated', 'product', 'Kurczak cały', 160, 18.6, 0, 9.5, null, null),
  (null, 'curated', 'product', 'Wątróbka drobiowa', 128, 19, 1.4, 4.8, null, null),
  (null, 'curated', 'product', 'Kaczka', 236, 18.3, 0, 18, null, null),
  (null, 'curated', 'product', 'Gęś', 305, 15.9, 0, 27, null, null),
  (null, 'curated', 'product', 'Indyk pierś', 105, 22.6, 0, 1.3, null, null),
  (null, 'curated', 'product', 'Schab wieprzowy', 152, 21, 0, 7.4, null, null),
  (null, 'curated', 'product', 'Łopatka wieprzowa', 214, 17.6, 0, 16, null, null),
  (null, 'curated', 'product', 'Boczek surowy', 393, 12.6, 0, 37.5, null, null),
  (null, 'curated', 'product', 'Mięso mielone wieprzowo-wołowe', 240, 17, 0, 19, null, null),
  (null, 'curated', 'product', 'Wołowina', 175, 20.5, 0, 10, null, null),
  (null, 'curated', 'product', 'Mielona wołowina', 187, 20, 0, 12, null, null),
  (null, 'curated', 'product', 'Cielęcina', 131, 20.4, 0, 5.5, null, null),
  (null, 'curated', 'product', 'Kiełbasa', 298, 15, 1.5, 26, null, null),
  (null, 'curated', 'product', 'Szynka', 108, 18.5, 1.2, 3.3, null, null),
  (null, 'curated', 'product', 'Szynka parmeńska', 268, 27, 0.4, 17.5, null, null),
  (null, 'curated', 'product', 'Łosoś', 208, 20, 0, 13, null, null),
  (null, 'curated', 'product', 'Śledź solony', 217, 17, 0, 16.5, null, null),
  (null, 'curated', 'product', 'Dorsz', 82, 17.8, 0, 0.7, null, null),
  (null, 'curated', 'product', 'Makrela wędzona', 305, 20.7, 0, 24, null, null),
  (null, 'curated', 'product', 'Sum', 143, 16.4, 0, 8.5, null, null),
  (null, 'curated', 'product', 'Karmazyn', 94, 19, 0, 1.6, null, null),
  (null, 'curated', 'product', 'Pstrąg', 119, 19.9, 0, 4.3, null, null),
  (null, 'curated', 'product', 'Tuńczyk w sosie własnym', 116, 25.5, 0, 1, null, null),
  (null, 'curated', 'product', 'Krewetki', 99, 20.9, 0.2, 1.7, null, null),
  (null, 'curated', 'product', 'Cebula', 40, 1.1, 9.3, 0.1, 100, 'sztuka'),
  (null, 'curated', 'product', 'Czosnek', 149, 6.4, 33.1, 0.5, null, null),
  (null, 'curated', 'product', 'Marchew', 41, 0.9, 9.6, 0.2, 70, 'sztuka'),
  (null, 'curated', 'product', 'Ziemniaki', 77, 2, 17.5, 0.1, 150, 'sztuka'),
  (null, 'curated', 'product', 'Pietruszka korzeń', 75, 2.9, 17, 0.8, 80, 'sztuka'),
  (null, 'curated', 'product', 'Natka pietruszki', 36, 3, 6.3, 0.8, null, null),
  (null, 'curated', 'product', 'Seler korzeniowy', 42, 1.5, 9.2, 0.3, 400, 'sztuka'),
  (null, 'curated', 'product', 'Seler naciowy', 16, 0.7, 3, 0.2, null, null),
  (null, 'curated', 'product', 'Por', 61, 1.5, 14.2, 0.3, 150, 'sztuka'),
  (null, 'curated', 'product', 'Kapusta biała', 25, 1.3, 5.8, 0.1, null, null),
  (null, 'curated', 'product', 'Kapusta kiszona', 19, 0.9, 4.3, 0.1, null, null),
  (null, 'curated', 'product', 'Kapusta czerwona', 31, 1.4, 7.4, 0.2, null, null),
  (null, 'curated', 'product', 'Pomidory', 18, 0.9, 3.9, 0.2, 120, 'sztuka'),
  (null, 'curated', 'product', 'Pomidory z puszki', 32, 1.6, 5.3, 0.3, null, null),
  (null, 'curated', 'product', 'Koncentrat pomidorowy', 82, 4.3, 18.9, 0.5, null, null),
  (null, 'curated', 'product', 'Ogórek świeży', 15, 0.7, 3.6, 0.1, 300, 'sztuka'),
  (null, 'curated', 'product', 'Ogórki kiszone', 12, 0.6, 2.2, 0.1, 60, 'sztuka'),
  (null, 'curated', 'product', 'Papryka czerwona', 31, 1, 6, 0.3, 150, 'sztuka'),
  (null, 'curated', 'product', 'Papryczka chili', 40, 1.9, 8.8, 0.4, 15, 'sztuka'),
  (null, 'curated', 'product', 'Bakłażan', 25, 1, 5.9, 0.2, 300, 'sztuka'),
  (null, 'curated', 'product', 'Cukinia', 17, 1.2, 3.1, 0.3, 300, 'sztuka'),
  (null, 'curated', 'product', 'Dynia', 26, 1, 6.5, 0.1, null, null),
  (null, 'curated', 'product', 'Brokuły', 34, 2.8, 6.6, 0.4, 400, 'sztuka'),
  (null, 'curated', 'product', 'Kalafior', 25, 1.9, 5, 0.3, 700, 'sztuka'),
  (null, 'curated', 'product', 'Szpinak', 23, 2.9, 3.6, 0.4, null, null),
  (null, 'curated', 'product', 'Sałata', 15, 1.4, 2.9, 0.2, 250, 'sztuka'),
  (null, 'curated', 'product', 'Pieczarki', 22, 3.1, 3.3, 0.3, null, null),
  (null, 'curated', 'product', 'Grzyby suszone', 296, 27.6, 44, 3, null, null),
  (null, 'curated', 'product', 'Buraki', 43, 1.6, 9.6, 0.2, 150, 'sztuka'),
  (null, 'curated', 'product', 'Fasola szparagowa', 31, 1.8, 7.1, 0.1, null, null),
  (null, 'curated', 'product', 'Fasola biała sucha', 333, 21.4, 60.3, 1.6, null, null),
  (null, 'curated', 'product', 'Groszek zielony', 81, 5.4, 14.5, 0.4, null, null),
  (null, 'curated', 'product', 'Soczewica czerwona', 352, 24.6, 63, 1.1, null, null),
  (null, 'curated', 'product', 'Ciecierzyca', 364, 19.3, 60.6, 6, null, null),
  (null, 'curated', 'product', 'Szparagi', 20, 2.2, 3.9, 0.1, null, null),
  (null, 'curated', 'product', 'Rzodkiewka', 16, 0.7, 3.4, 0.1, 15, 'sztuka'),
  (null, 'curated', 'product', 'Kukurydza konserwowa', 86, 3.2, 19, 1.2, null, null),
  (null, 'curated', 'product', 'Oliwki', 145, 1, 3.8, 15.3, null, null),
  (null, 'curated', 'product', 'Awokado', 160, 2, 8.5, 14.7, 200, 'sztuka'),
  (null, 'curated', 'product', 'Szczypiorek', 30, 3.3, 4.4, 0.7, null, null),
  (null, 'curated', 'product', 'Koperek', 43, 3.5, 7, 1.1, null, null),
  (null, 'curated', 'product', 'Jabłka', 52, 0.3, 13.8, 0.2, 150, 'sztuka'),
  (null, 'curated', 'product', 'Gruszki', 57, 0.4, 15.2, 0.1, 170, 'sztuka'),
  (null, 'curated', 'product', 'Banany', 89, 1.1, 22.8, 0.3, 120, 'sztuka'),
  (null, 'curated', 'product', 'Cytryna', 29, 1.1, 9.3, 0.3, 100, 'sztuka'),
  (null, 'curated', 'product', 'Pomarańcze', 47, 0.9, 11.8, 0.1, 200, 'sztuka'),
  (null, 'curated', 'product', 'Truskawki', 32, 0.7, 7.7, 0.3, null, null),
  (null, 'curated', 'product', 'Śliwki', 46, 0.7, 11.4, 0.3, 40, 'sztuka'),
  (null, 'curated', 'product', 'Wiśnie', 50, 1, 12.2, 0.3, null, null),
  (null, 'curated', 'product', 'Czereśnie', 63, 1.1, 16, 0.2, null, null),
  (null, 'curated', 'product', 'Jagody', 57, 0.7, 14.5, 0.3, null, null),
  (null, 'curated', 'product', 'Maliny', 52, 1.2, 11.9, 0.7, null, null),
  (null, 'curated', 'product', 'Rodzynki', 299, 3.1, 79.2, 0.5, null, null),
  (null, 'curated', 'product', 'Ananas', 50, 0.5, 13.1, 0.1, null, null),
  (null, 'curated', 'product', 'Brzoskwinie', 39, 0.9, 9.5, 0.3, 150, 'sztuka'),
  (null, 'curated', 'product', 'Orzechy włoskie', 654, 15.2, 13.7, 65.2, null, null),
  (null, 'curated', 'product', 'Migdały', 579, 21.2, 21.6, 49.9, null, null),
  (null, 'curated', 'product', 'Orzeszki ziemne', 567, 25.8, 16.1, 49.2, null, null),
  (null, 'curated', 'product', 'Wiórki kokosowe', 660, 6.9, 23.7, 64.5, null, null),
  (null, 'curated', 'product', 'Mak', 525, 17.9, 28.1, 41.6, null, null),
  (null, 'curated', 'product', 'Sezam', 573, 17.7, 23.4, 49.7, null, null),
  (null, 'curated', 'product', 'Słonecznik łuskany', 584, 20.8, 20, 51.5, null, null),
  (null, 'curated', 'product', 'Cukier', 400, 0, 100, 0, null, null),
  (null, 'curated', 'product', 'Cukier puder', 400, 0, 100, 0, null, null),
  (null, 'curated', 'product', 'Cukier wanilinowy', 400, 0, 100, 0, null, null),
  (null, 'curated', 'product', 'Miód', 322, 0.3, 79.5, 0, null, null),
  (null, 'curated', 'product', 'Czekolada gorzka', 546, 7.8, 45.9, 35.4, null, null),
  (null, 'curated', 'product', 'Czekolada mleczna', 535, 7.6, 59.4, 29.7, null, null),
  (null, 'curated', 'product', 'Kakao', 228, 19.6, 57.9, 13.7, null, null),
  (null, 'curated', 'product', 'Dżem', 250, 0.4, 62, 0.1, null, null),
  (null, 'curated', 'product', 'Budyń w proszku', 355, 0.5, 87, 0.3, null, null),
  (null, 'curated', 'product', 'Galaretka w proszku', 380, 7, 87, 0, null, null),
  (null, 'curated', 'product', 'Herbatniki', 458, 6.8, 74, 15, 8, 'sztuka'),
  (null, 'curated', 'product', 'Proszek do pieczenia', 97, 0, 23, 0, null, null),
  (null, 'curated', 'product', 'Drożdże świeże', 105, 12, 12, 1.5, null, null),
  (null, 'curated', 'product', 'Drożdże suszone', 325, 40.4, 38.2, 7.6, null, null),
  (null, 'curated', 'product', 'Żelatyna', 335, 84, 0, 0.1, null, null),
  (null, 'curated', 'product', 'Sól', 0, 0, 0, 0, null, null),
  (null, 'curated', 'product', 'Pieprz czarny', 251, 10.4, 63.9, 3.3, null, null),
  (null, 'curated', 'product', 'Papryka słodka mielona', 282, 14.1, 54, 12.9, null, null),
  (null, 'curated', 'product', 'Majeranek', 271, 12.7, 60.6, 7, null, null),
  (null, 'curated', 'product', 'Bazylia', 233, 14.4, 47.8, 4, null, null),
  (null, 'curated', 'product', 'Oregano', 265, 9, 68.9, 4.3, null, null),
  (null, 'curated', 'product', 'Kminek', 375, 17.8, 44.2, 22.3, null, null),
  (null, 'curated', 'product', 'Cynamon', 247, 4, 80.6, 1.2, null, null),
  (null, 'curated', 'product', 'Liść laurowy', 313, 7.6, 75, 8.4, null, null),
  (null, 'curated', 'product', 'Ziele angielskie', 263, 6.1, 72.1, 8.7, null, null),
  (null, 'curated', 'product', 'Curry', 325, 12.7, 55.8, 13.8, null, null),
  (null, 'curated', 'product', 'Gałka muszkatołowa', 525, 5.8, 49.3, 36.3, null, null),
  (null, 'curated', 'product', 'Ocet', 18, 0, 0.4, 0, null, null),
  (null, 'curated', 'product', 'Musztarda', 66, 4.4, 5.8, 3.4, null, null),
  (null, 'curated', 'product', 'Majonez', 680, 1.1, 2.4, 74, null, null),
  (null, 'curated', 'product', 'Ketchup', 102, 1.7, 24, 0.1, null, null),
  (null, 'curated', 'product', 'Sos sojowy', 53, 8.1, 4.9, 0.6, null, null),
  (null, 'curated', 'product', 'Bulion warzywny', 4, 0.2, 0.6, 0.1, null, null),
  (null, 'curated', 'product', 'Woda', 0, 0, 0, 0, null, null),
  (null, 'curated', 'product', 'Mleko kokosowe', 197, 2, 2.8, 21.3, null, null),
  (null, 'curated', 'product', 'Sok jabłkowy', 46, 0.1, 11.3, 0.1, null, null),
  (null, 'curated', 'product', 'Włoszczyzna', 45, 1.3, 9.8, 0.3, null, null),
  (null, 'curated', 'product', 'Sok z cytryny', 22, 0.4, 6.9, 0.2, null, null),
  (null, 'curated', 'product', 'Soda oczyszczona', 0, 0, 0, 0, null, null),
  (null, 'curated', 'product', 'Goździki', 274, 6, 65.5, 13, null, null),
  (null, 'curated', 'product', 'Gorczyca', 508, 26.1, 28.1, 36.2, null, null),
  (null, 'curated', 'product', 'Imbir świeży', 80, 1.8, 17.8, 0.8, null, null),
  (null, 'curated', 'product', 'Ekstrakt waniliowy', 288, 0.1, 12.7, 0.1, null, null),
  (null, 'curated', 'product', 'Syrop klonowy', 260, 0, 67, 0.1, null, null),
  (null, 'curated', 'product', 'Słonina', 812, 2.9, 0, 88.7, null, null),
  (null, 'curated', 'product', 'Jarmuż', 49, 4.3, 8.8, 0.9, null, null),
  (null, 'curated', 'product', 'Kalarepa', 27, 1.7, 6.2, 0.1, 200, 'sztuka'),
  (null, 'curated', 'product', 'Kiwi', 61, 1.1, 14.7, 0.5, 75, 'sztuka'),
  (null, 'curated', 'product', 'Wino białe wytrawne', 82, 0.1, 2.6, 0, null, null),
  (null, 'curated', 'product', 'Przyprawa do zup', 150, 10, 20, 3, null, null),
  (null, 'curated', 'product', 'Jarzyny mrożone', 45, 2.5, 8, 0.3, null, null),
  (null, 'curated', 'product', 'Dymka', 32, 1.8, 7.3, 0.2, null, null),
  (null, 'curated', 'product', 'Rzeżucha', 32, 2.6, 5.5, 0.7, null, null),
  (null, 'curated', 'product', 'Sardele', 210, 20.4, 0, 14, null, null),
  (null, 'curated', 'product', 'Szałwia', 315, 10.6, 60.7, 12.8, null, null),
  (null, 'curated', 'product', 'Sos beszamelowy', 120, 3.4, 8, 8, null, null),
  (null, 'curated', 'product', 'Piwo jasne', 43, 0.5, 3.6, 0, null, null),
  (null, 'curated', 'product', 'Krem karmelowy', 450, 3, 60, 22, null, null),
  (null, 'curated', 'product', 'Sos tabasco', 21, 1.3, 1.8, 0.8, null, null);
end $$;

do $$
declare v_ile int;
begin
  select count(*) into v_ile from public.foods
   where user_id is null and source = 'curated' and kind = 'product';
  if v_ile <> 187 then
    raise exception 'Migracja 0050: surowców jest %, miało być 187', v_ile;
  end if;

  -- Ta sama bramka rozsądku, co w generatorze. Surowiec o 2000 kcal na 100 g
  -- popsułby liczenie każdemu, kto go doda.
  if exists (
    select 1 from public.foods
     where user_id is null and source = 'curated' and kind = 'product'
       and (kcal_100g > 950 or kcal_100g < 0)
  ) then
    raise exception 'Migracja 0050: surowiec z niemożliwą kalorycznością';
  end if;
end $$;
