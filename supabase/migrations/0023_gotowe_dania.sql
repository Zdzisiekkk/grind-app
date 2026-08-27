-- ============================================================
-- Grind — Migracja 0023: gotowe dania, nie tylko produkty
--
-- Open Food Facts to baza PRODUKTÓW z kodem kreskowym. Nie ma w niej
-- schabowego, bigosu ani rosołu — a to jest dokładnie to, co ludzie jedzą
-- na obiad. Wyszukiwarka zwracała wtedy przypadkowe „dania gotowe" w słoiku
-- albo nic, i trzeba było rozbijać obiad na mięso, ziemniaki i surówkę.
--
-- Dokładamy więc kuratorowaną listę popularnych dań z wartościami na 100 g
-- oraz typową porcją, żeby wpisanie obiadu było jednym tapnięciem.
-- Wartości są przeciętne — talerz u babci będzie inny — i widok mówi o tym
-- wprost, zamiast udawać precyzję.
-- ============================================================

-- 'curated' dołącza do dozwolonych źródeł obok 'off' i 'custom'.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods
  add constraint foods_source_check
  check (source in ('off', 'custom', 'curated'));

/** Produkt (z opakowania) czy gotowe danie (z talerza). */
alter table public.foods
  add column if not exists kind text not null default 'product'
  check (kind in ('product', 'dish'));

create index if not exists foods_kind_idx on public.foods (kind, lower(name));

-- Produkty własne i te z OFF zostają produktami; poniższe wpisy to dania.
insert into public.foods
  (user_id, source, kind, name, kcal_100g, protein_100g, carbs_100g, fat_100g,
   serving_size_g, serving_label)
values
-- --- Obiady ---
(null, 'curated', 'dish', 'Kotlet schabowy smażony',      290, 20.0, 12.0, 18.0, 150, 'kotlet'),
(null, 'curated', 'dish', 'Kotlet mielony',               250, 16.0, 10.0, 16.0, 120, 'kotlet'),
(null, 'curated', 'dish', 'Kotlet z kurczaka panierowany',260, 19.0, 14.0, 14.0, 150, 'kotlet'),
(null, 'curated', 'dish', 'Pierś z kurczaka grillowana',  165, 31.0,  0.0,  3.6, 150, 'porcja'),
(null, 'curated', 'dish', 'Łosoś pieczony',               200, 22.0,  0.0, 12.0, 150, 'porcja'),
(null, 'curated', 'dish', 'Gulasz wołowy',                150, 14.0,  6.0,  8.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Bigos',                         95,  6.0,  6.0,  5.0, 300, 'porcja'),
(null, 'curated', 'dish', 'Gołąbki',                      120,  7.0, 10.0,  6.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Leczo',                         80,  4.0,  7.0,  4.0, 300, 'porcja'),
(null, 'curated', 'dish', 'Fasolka po bretońsku',         100,  5.0, 12.0,  3.0, 300, 'porcja'),
(null, 'curated', 'dish', 'Spaghetti bolognese',          150,  8.0, 18.0,  5.0, 350, 'porcja'),
(null, 'curated', 'dish', 'Makaron ze śmietaną i serem',  200,  8.0, 24.0,  8.0, 300, 'porcja'),
(null, 'curated', 'dish', 'Ryż z kurczakiem i warzywami', 130, 10.0, 15.0,  3.0, 350, 'porcja'),

-- --- Mączne ---
(null, 'curated', 'dish', 'Pierogi ruskie',               210,  6.0, 30.0,  7.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Pierogi z mięsem',             230,  9.0, 28.0,  9.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Pyzy z mięsem',                200,  8.0, 30.0,  6.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Krokiety z kapustą',           240,  7.0, 30.0, 10.0, 150, 'sztuka'),
(null, 'curated', 'dish', 'Placki ziemniaczane',          190,  4.0, 25.0,  8.0, 200, 'porcja'),
(null, 'curated', 'dish', 'Naleśniki z serem',            200,  8.0, 26.0,  7.0, 200, 'porcja'),
(null, 'curated', 'dish', 'Racuchy',                      260,  5.0, 38.0, 10.0, 150, 'porcja'),

-- --- Zupy ---
(null, 'curated', 'dish', 'Rosół z makaronem',             45,  3.0,  5.0,  1.5, 350, 'talerz'),
(null, 'curated', 'dish', 'Żurek',                         60,  3.0,  6.0,  3.0, 350, 'talerz'),
(null, 'curated', 'dish', 'Barszcz czerwony',              35,  1.0,  6.0,  0.5, 350, 'talerz'),
(null, 'curated', 'dish', 'Zupa pomidorowa z ryżem',        60,  2.0,  9.0,  2.0, 350, 'talerz'),
(null, 'curated', 'dish', 'Zupa ogórkowa',                  45,  2.0,  5.0,  2.0, 350, 'talerz'),
(null, 'curated', 'dish', 'Krem z dyni',                    55,  1.5,  7.0,  2.5, 350, 'talerz'),

-- --- Na mieście ---
(null, 'curated', 'dish', 'Pizza margherita',             250, 11.0, 30.0,  9.0, 400, 'cała 30 cm'),
(null, 'curated', 'dish', 'Pizza pepperoni',              280, 12.0, 29.0, 12.0, 400, 'cała 30 cm'),
(null, 'curated', 'dish', 'Kebab w bułce',                215, 13.0, 20.0,  9.0, 350, 'sztuka'),
(null, 'curated', 'dish', 'Burger wołowy',                250, 14.0, 20.0, 12.0, 220, 'sztuka'),
(null, 'curated', 'dish', 'Frytki',                       310,  3.5, 40.0, 15.0, 150, 'średnie'),
(null, 'curated', 'dish', 'Sushi — zestaw',               145,  6.0, 25.0,  2.0, 300, 'zestaw'),
(null, 'curated', 'dish', 'Zapiekanka',                   230,  8.0, 28.0,  9.0, 200, 'sztuka'),

-- --- Śniadania ---
(null, 'curated', 'dish', 'Jajecznica na maśle',          200, 13.0,  1.5, 16.0, 150, 'porcja'),
(null, 'curated', 'dish', 'Omlet z warzywami',            155, 12.0,  3.0, 11.0, 200, 'porcja'),
(null, 'curated', 'dish', 'Owsianka na mleku',             90,  4.0, 13.0,  2.5, 300, 'miska'),
(null, 'curated', 'dish', 'Kanapka z szynką i serem',     250, 14.0, 26.0, 10.0, 120, 'sztuka'),
(null, 'curated', 'dish', 'Tost z serem',                 290, 13.0, 30.0, 13.0, 100, 'sztuka'),
(null, 'curated', 'dish', 'Kanapka z masłem orzechowym',  330, 12.0, 33.0, 16.0, 120, 'sztuka'),

-- --- Dodatki ---
(null, 'curated', 'dish', 'Ziemniaki gotowane',            80,  2.0, 17.0,  0.1, 200, 'porcja'),
(null, 'curated', 'dish', 'Ryż biały gotowany',           130,  2.7, 28.0,  0.3, 150, 'porcja'),
(null, 'curated', 'dish', 'Kasza gryczana gotowana',      110,  4.0, 21.0,  1.0, 150, 'porcja'),
(null, 'curated', 'dish', 'Makaron gotowany',             130,  5.0, 25.0,  1.0, 150, 'porcja'),
(null, 'curated', 'dish', 'Surówka z marchewki',           90,  1.0, 10.0,  5.0, 100, 'porcja'),
(null, 'curated', 'dish', 'Sałatka grecka',               105,  4.0,  5.0,  8.0, 250, 'porcja'),
(null, 'curated', 'dish', 'Sałatka cezar z kurczakiem',   160, 12.0,  6.0, 10.0, 300, 'porcja'),
(null, 'curated', 'dish', 'Mizeria',                       60,  1.5,  4.0,  4.0, 150, 'porcja'),

-- --- Słodkie i sport ---
(null, 'curated', 'dish', 'Sernik',                       320,  8.0, 30.0, 18.0, 120, 'kawałek'),
(null, 'curated', 'dish', 'Szarlotka',                    250,  3.0, 38.0, 10.0, 120, 'kawałek'),
(null, 'curated', 'dish', 'Odżywka białkowa na wodzie',    60, 12.0,  2.0,  0.5, 300, 'shaker'),
(null, 'curated', 'dish', 'Baton proteinowy',             350, 30.0, 35.0, 10.0,  60, 'sztuka'),
(null, 'curated', 'dish', 'Koktajl owocowy z bananem',     85,  2.0, 17.0,  1.0, 300, 'szklanka')

on conflict do nothing;
