/**
 * Generator migracji z katalogiem przepisów i tabelą surowców.
 *
 * Uruchomienie (lokalnie, gdy zmienia się słownik albo wybór przepisów):
 *   npm run import:przepisy
 *
 * Skrypt NIE pisze do bazy. Wypluwa dwa pliki SQL do supabase/migrations,
 * które potem idą tą samą drogą, co każda inna migracja - i tak samo widać
 * je w diffie. Import prosto do produkcji znaczyłby dane, których nikt nie
 * przejrzał przed wgraniem.
 *
 * ŹRÓDŁO: polska Książka kucharska z Wikibooks, licencja CC BY-SA 4.0.
 * Wymaga podania autora i licencji - obie wartości lądują przy każdym
 * przepisie, a ekran je pokazuje. Lista wybranych stron leży w
 * scripts/dane/przepisy-wybor.json, żeby wynik dało się odtworzyć.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsujStronę } from "./dane/parser-przepisow.mjs";
import { SUROWCE } from "./dane/surowce.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WYBOR = path.join(ROOT, "scripts/dane/przepisy-wybor.json");
const CACHE = path.join(ROOT, "scripts/dane/.wikibooks-cache.json");
const API = "https://pl.wikibooks.org/w/api.php";

/* Wikimedia odrzuca żądania bez nagłówka mówiącego, kto pyta. */
const UA = "grind-app/1.0 (import katalogu przepisow; https://github.com/)";

const LICENCJA = "CC BY-SA 4.0";
const AUTOR = "Wikibooks - Książka kucharska";

/**
 * Typowa porcja dla grupy dania, w gramach.
 *
 * Wikibooks prawie nigdy nie mówi, na ile porcji jest przepis, a bez tego
 * "1 porcja" w dzienniku nie ma sensu. Dzielimy więc masę całości przez
 * rozsądną porcję - przybliżenie, ale przybliżenie jawne i takie samo
 * dla wszystkich dań tego samego rodzaju.
 */
const PORCJA_G = {
  zupy: 350, mieso: 300, ryby: 300, maka: 300,
  warzywa: 250, jajka: 200, slodkie: 120, inne: 250,
};

/** Kategorie z Wikibooks na etykiety, które da się pokazać w filtrze. */
const TAGI = {
  "Zupy": "zupa",
  "Mięsa": "mięso",
  "Drób": "drób",
  "Wołowina": "wołowina",
  "Wieprzowina": "wieprzowina",
  "Ryby i owoce morza": "ryba",
  "Kluski i makarony": "makaron",
  "Naleśniki": "naleśniki",
  "Pizze i zapiekanki": "zapiekanka",
  "Warzywa": "warzywa",
  "Sałatki i surówki": "sałatka",
  "Ziemniaki": "ziemniaki",
  "Kapusta": "kapusta",
  "Grzyby": "grzyby",
  "Jajka": "jajka",
  "Nabiał": "nabiał",
  "Przystawki": "przystawka",
  "Desery": "deser",
  "Ciasta": "ciasto",
  "Ciastka (wypieki)": "ciasto",
  "Ciasta deserowe (wypieki)": "ciasto",
  "Kuchnia wegetariańska": "wegetariańskie",
  "Kuchnia wegańska": "wegańskie",
  "Potrawy niskokaloryczne": "lekkie",
  "Bez gotowania": "bez gotowania",
  "Kuchnia polska": "kuchnia polska",
  "Kuchnia włoska": "kuchnia włoska",
  "Kuchnia francuska": "kuchnia francuska",
  "Kuchnia śląska": "kuchnia polska",
  "Torty": "ciasto",
  "Desery mleczne": "deser",
  "Desery zestalane na zimno": "deser",
  "Potrawy wigilijne": "wigilia",
  "Kasza": "kasze",
  "Ryż": "kasze",
  "Ryż i kasza": "kasze",
  "Kuchnia amerykańska": "kuchnia amerykańska",
  "Kuchnia litewska": "kuchnia litewska",
  "Kuchnia grecka": "kuchnia grecka",
  "Cielęcina": "mięso",
  "Pieczywo": "pieczywo",
  "Chleby": "pieczywo",
};

/**
 * Ikona z treści dania, a nie z grupy, w której je znalazłem.
 *
 * Grupa mówi, skąd przepis został wzięty do wyboru; talerz na liście ma
 * mówić, co to jest. Lasagne trafiła do puli jako "inne" i dostawała
 * ikonę zastępczą, choć na liście ma być makaronem.
 */
const IKONA_Z_TAGU = [
  ["zupa", "🍲"], ["makaron", "🍝"], ["ciasto", "🍰"], ["deser", "🍰"],
  ["ryba", "🐟"], ["drób", "🍗"], ["wieprzowina", "🍖"], ["wołowina", "🥩"],
  ["mięso", "🍖"], ["naleśniki", "🥞"], ["zapiekanka", "🧀"], ["jajka", "🥚"],
  ["sałatka", "🥗"], ["kasze", "🌾"], ["pieczywo", "🍞"], ["warzywa", "🥗"],
];

/* ---------------------------------------------------------------- */

async function pobierzStrony(tytuły) {
  if (existsSync(CACHE)) {
    const zapisane = JSON.parse(readFileSync(CACHE, "utf8"));
    if (tytuły.every((t) => zapisane[t])) {
      console.log(`📄 Treść z pamięci podręcznej (${tytuły.length} stron).`);
      return zapisane;
    }
  }
  const wynik = {};
  for (let i = 0; i < tytuły.length; i += 20) {
    const paczka = tytuły.slice(i, i + 20);
    const url =
      `${API}?action=query&prop=revisions&rvprop=content&rvslots=main&formatversion=2&format=json` +
      `&titles=${encodeURIComponent(paczka.join("|"))}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Wikibooks odpowiedziało ${res.status}`);
    const dane = await res.json();
    for (const p of dane.query.pages) {
      if (p.revisions) wynik[p.title] = p.revisions[0].slots.main.content;
    }
    process.stdout.write(`\r⬇️  pobrano ${Object.keys(wynik).length}/${tytuły.length}`);
  }
  process.stdout.write("\n");
  writeFileSync(CACHE, JSON.stringify(wynik));
  return wynik;
}

/** Napis do SQL - pojedyncze apostrofy podwajamy, reszta idzie jak leci. */
function sql(v) {
  if (v == null) return "null";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `array[${v.map((x) => sql(x)).join(", ")}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Czas przygotowania z kroków.
 *
 * Kroki z minutnikiem podają swój czas wprost. Reszcie doliczamy pięć minut,
 * bo posiekanie cebuli też trwa - suma samych czasów pieczenia dawałaby
 * "danie w 25 minut" przy godzinie roboty.
 */
function czasZKroków(kroki) {
  const suma = kroki.reduce((acc, k) => acc + (k.minuty ?? 5), 0);
  return Math.max(5, Math.round(suma / 5) * 5);
}

function poziom(skladniki, kroki) {
  if (kroki.length <= 5 && skladniki.length <= 7) return "latwy";
  if (kroki.length >= 9 || skladniki.length >= 13) return "trudny";
  return "sredni";
}

/* ---------------------------------------------------------------- */

const wybor = JSON.parse(readFileSync(WYBOR, "utf8"));
const strony = await pobierzStrony(wybor.map((w) => w.tytul));

const gotowe = [];
const odrzucone = [];

for (const w of wybor) {
  const wikitekst = strony[w.tytul];
  if (!wikitekst) {
    odrzucone.push([w.tytul, "brak treści"]);
    continue;
  }
  const p = parsujStronę(w.tytul, wikitekst);
  const skladniki = p.skladniki.filter((s) => s.gramy != null && s.gramy > 0);
  const pominięte = p.skladniki.length - skladniki.length;

  if (skladniki.length < 3) { odrzucone.push([p.nazwa, "mniej niż 3 policzalne składniki"]); continue; }
  if (p.kroki.length < 3) { odrzucone.push([p.nazwa, "mniej niż 3 kroki"]); continue; }
  if (pominięte > 2) { odrzucone.push([p.nazwa, `${pominięte} nierozpoznanych składników`]); continue; }

  const masa = skladniki.reduce((a, s) => a + s.gramy, 0);
  const kcal = skladniki.reduce((a, s) => a + (s.gramy * s.surowiec.k) / 100, 0);
  const kcal100 = (kcal / masa) * 100;
  const porcje = Math.min(12, Math.max(1, Math.round(masa / PORCJA_G[w.grupa])));
  const kcalPorcji = kcal / porcje;

  /*
   * Bramka rozsądku. Danie o 900 kcal na 100 g albo porcja na 2000 kcal
   * znaczy błąd w słowniku, nie egzotyczny przepis - i lepiej, żeby taki
   * przepis nie wszedł, niż żeby ktoś liczył według niego dietę.
   */
  if (kcal100 < 20 || kcal100 > 600) {
    odrzucone.push([p.nazwa, `${Math.round(kcal100)} kcal/100 g poza zakresem`]);
    continue;
  }
  if (kcalPorcji < 80 || kcalPorcji > 1500) {
    odrzucone.push([p.nazwa, `porcja ${Math.round(kcalPorcji)} kcal poza zakresem`]);
    continue;
  }
  if (masa < 100 || masa > 8000) {
    odrzucone.push([p.nazwa, `masa całości ${Math.round(masa)} g poza zakresem`]);
    continue;
  }

  const tagi = [...new Set(p.kategorie.map((k) => TAGI[k]).filter(Boolean))].slice(0, 6);
  const ikona = IKONA_Z_TAGU.find(([t]) => tagi.includes(t))?.[1] ?? w.ikona;

  gotowe.push({
    nazwa: p.nazwa,
    ikona,
    porcje,
    tagi,
    czas: czasZKroków(p.kroki),
    poziom: poziom(skladniki, p.kroki),
    // Wystarczy jeden składnik z miary domowej, żeby całość była szacunkiem.
    orientacyjne: skladniki.some((s) => !s.dokładne),
    url: `https://pl.wikibooks.org/wiki/${encodeURIComponent(w.tytul.replace(/ /g, "_"))}`,
    skladniki: skladniki.map((s, i) => ({
      nazwa: s.surowiec.n, gramy: s.gramy, kolejność: i,
      k: s.surowiec.k, b: s.surowiec.b, w: s.surowiec.w, t: s.surowiec.t,
    })),
    kroki: p.kroki.map((k, i) => ({ ...k, kolejność: i })),
    masa, kcal100, kcalPorcji,
  });
}

/* ------------------------- migracja 0050 ------------------------- */

const surowceSql = SUROWCE.map(
  (s) => `  (null, 'curated', 'product', ${sql(s.n)}, ${sql(s.k)}, ${sql(s.b)}, ` +
         `${sql(s.w)}, ${sql(s.t)}, ${sql(s.s ?? null)}, ${sql(s.s ? "sztuka" : null)})`,
).join(",\n");

const mig0050 = `-- ============================================================
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
${surowceSql};
end $$;

do $$
declare v_ile int;
begin
  select count(*) into v_ile from public.foods
   where user_id is null and source = 'curated' and kind = 'product';
  if v_ile <> ${SUROWCE.length} then
    raise exception 'Migracja 0050: surowców jest %, miało być ${SUROWCE.length}', v_ile;
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
`;

/* ------------------------- migracja 0051 ------------------------- */

const bloki = gotowe.map((r) => {
  const skl = r.skladniki.map(
    (s) => `    (v_id, ${sql(s.nazwa)}, ${sql(s.gramy)}, ${sql(s.k)}, ${sql(s.b)}, ` +
           `${sql(s.w)}, ${sql(s.t)}, ${s.kolejność},\n     (select id from public.foods ` +
           `where user_id is null and source = 'curated' and name = ${sql(s.nazwa)} limit 1))`,
  ).join(",\n");
  const kroki = r.kroki.map(
    (k) => `    (v_id, ${k.kolejność}, ${sql(k.tekst)}, ${sql(k.minuty)})`,
  ).join(",\n");

  return `-- ${r.nazwa} - ${Math.round(r.kcalPorcji)} kcal/porcja, ${r.porcje} porc.
insert into public.recipes
  (user_id, source, name, icon, servings, czas_min, poziom, tagi,
   makra_orientacyjne, license, license_author, license_url)
values (null, 'katalog', ${sql(r.nazwa)}, ${sql(r.ikona)}, ${r.porcje}, ${r.czas},
        ${sql(r.poziom)}, ${sql(r.tagi)}, ${sql(r.orientacyjne)},
        ${sql(LICENCJA)}, ${sql(AUTOR)}, ${sql(r.url)})
returning id into v_id;

insert into public.recipe_items
  (recipe_id, name, grams, kcal_100g, protein_100g, carbs_100g, fat_100g, order_index, food_id)
values
${skl};

insert into public.recipe_steps (recipe_id, order_index, tekst, minuty)
values
${kroki};
`;
}).join("\n");

const mig0051 = `-- ============================================================
-- 0051: ${gotowe.length} przepisów z krokami wykonania
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

${bloki}
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
  if v_przepisy <> ${gotowe.length} then
    raise exception 'Migracja 0051: przepisów jest %, miało być ${gotowe.length}', v_przepisy;
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
`;

writeFileSync(path.join(ROOT, "supabase/migrations/0050_surowce.sql"), mig0050);
writeFileSync(path.join(ROOT, "supabase/migrations/0051_przepisy_katalog.sql"), mig0051);

/* --------------------------- raport ------------------------------ */

const orientacyjnych = gotowe.filter((r) => r.orientacyjne).length;
const zMinutnikiem = gotowe.reduce((a, r) => a + r.kroki.filter((k) => k.minuty).length, 0);

console.log(`\n✅ Zapisano dwie migracje.`);
console.log(`   surowców:  ${SUROWCE.length}`);
console.log(`   przepisów: ${gotowe.length} (odrzuconych: ${odrzucone.length})`);
console.log(`   z makrami orientacyjnymi: ${orientacyjnych}`);
console.log(`   kroków z minutnikiem: ${zMinutnikiem}`);
const kcal = gotowe.map((r) => Math.round(r.kcalPorcji)).sort((a, b) => a - b);
console.log(`   kcal na porcję: min ${kcal[0]}, mediana ${kcal[Math.floor(kcal.length / 2)]}, max ${kcal.at(-1)}`);
if (odrzucone.length) {
  console.log("\n⚠️  Odrzucone:");
  for (const [n, p] of odrzucone) console.log(`   ${n} - ${p}`);
}
