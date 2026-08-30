/**
 * Import katalogu ćwiczeń z wger.de do tabeli exercise_catalog.
 *
 * wger to otwarty projekt fitness (AGPL); opisy i zdjęcia ćwiczeń są na licencji
 * CC-BY-SA, dlatego zapisujemy przy każdym rekordzie autora, licencję i link do
 * źródła - aplikacja pokazuje je pod ilustracją.
 *
 * Uruchomienie (jednorazowo, lokalnie):
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run import:wger
 *
 * Skrypt używa klucza service_role, bo wpisuje ćwiczenia globalne (user_id = NULL),
 * czego RLS słusznie zabrania zwykłym użytkownikom. Klucz zostaje na Twoim
 * komputerze - nie trafia do Vercela.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Prosty odczyt .env.local - bez dodatkowej zależności
function loadEnv() {
  try {
    for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // brak pliku .env.local to nie błąd - zmienne mogą przyjść z powłoki
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.env.WGER_DRY_RUN === "1";

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "\n❌ Brakuje zmiennych.\n" +
      "   Potrzebne: NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY\n" +
      "   (Supabase → Project Settings → API → service_role).\n" +
      "   Dopisz je do .env.local albo podaj przed komendą.\n" +
      "   Podgląd bez zapisu do bazy: WGER_DRY_RUN=1 npm run import:wger\n",
  );
  process.exit(1);
}

const WGER = "https://wger.de/api/v2";
const LANG_PL = 14;
const LANG_EN = 2;
const LIMIT = Number(process.env.WGER_LIMIT || 900);

/** Kategorie wger są po angielsku - mapujemy na nazwy używane w reszcie aplikacji. */
const CATEGORY_PL = {
  Abs: "Core",
  Arms: "Ramiona",
  Back: "Plecy",
  Calves: "Nogi",
  Chest: "Klatka piersiowa",
  Legs: "Nogi",
  Shoulders: "Barki",
  Cardio: "Kondycja",
};

const MUSCLE_PL = {
  "Anterior deltoid": "przód barków",
  "Biceps brachii": "biceps",
  "Biceps femoris": "dwugłowy uda",
  "Brachialis": "ramienny",
  "Gastrocnemius": "łydki",
  "Gluteus maximus": "pośladki",
  "Latissimus dorsi": "najszerszy grzbietu",
  "Obliquus externus abdominis": "skośne brzucha",
  "Pectoralis major": "klatka piersiowa",
  "Quadriceps femoris": "czworogłowy uda",
  "Rectus abdominis": "proste brzucha",
  "Serratus anterior": "zębaty przedni",
  "Soleus": "płaszczkowaty",
  "Trapezius": "czworoboczny",
  "Triceps brachii": "triceps",
};

const EQUIPMENT_PL = {
  Barbell: "sztanga",
  "SZ-Bar": "sztanga łamana",
  Dumbbell: "hantle",
  "Gym mat": "mata",
  "Incline bench": "ławka skośna",
  "Swiss Ball": "piłka gimnastyczna",
  "Pull-up bar": "drążek",
  "none (bodyweight exercise)": "masa ciała",
  Bench: "ławka",
  "Kettlebell": "kettlebell",
  "Resistance band": "guma oporowa",
};

const translate = (dict, value) => dict[value] ?? value;

/** Zamienia HTML z wger na czysty tekst - w bazie trzymamy zwykły tekst. */
function stripHtml(html) {
  if (!html) return null;
  const text = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text || null;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function fetchAll(endpoint, params = {}) {
  const out = [];
  let url = new URL(`${WGER}/${endpoint}/`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "100");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  while (url && out.length < LIMIT) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Grind/1.0 (exercise catalog import)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`wger ${endpoint} → HTTP ${res.status}`);

    const json = await res.json();
    out.push(...(json.results ?? []));
    url = json.next ? new URL(json.next) : null;
    process.stdout.write(`\r   pobrano ${out.length} pozycji z /${endpoint}...`);
  }
  process.stdout.write("\n");
  return out.slice(0, LIMIT);
}

console.log("📥 Pobieram dane z wger.de...");

const [exercises, images] = await Promise.all([
  fetchAll("exerciseinfo"),
  fetchAll("exerciseimage", { is_main: "True" }),
]);

const imageByExercise = new Map();
for (const img of images) {
  if (!imageByExercise.has(img.exercise)) imageByExercise.set(img.exercise, img);
}

const rows = [];
const usedSlugs = new Set();

for (const ex of exercises) {
  const translations = ex.translations ?? [];
  const pl = translations.find((t) => t.language === LANG_PL && t.name?.trim());
  const en = translations.find((t) => t.language === LANG_EN && t.name?.trim());
  const primary = pl ?? en;
  if (!primary?.name) continue;

  // Slug musi być unikalny w obrębie katalogu globalnego
  let slug = `wger-${slugify(primary.name)}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${ex.id}`;
  usedSlugs.add(slug);

  const image = imageByExercise.get(ex.id);
  const category = ex.category?.name;

  rows.push({
    user_id: null,
    is_public: true,
    source: "wger",
    source_id: String(ex.id),
    slug,
    name: primary.name.trim(),
    name_en: en?.name?.trim() ?? null,
    aliases: (primary.aliases ?? []).map((a) => a.alias ?? a).filter(Boolean),
    description: stripHtml(primary.description),
    category: category ? translate(CATEGORY_PL, category) : null,
    muscle_group: ex.muscles?.[0]
      ? translate(MUSCLE_PL, ex.muscles[0].name)
      : category
        ? translate(CATEGORY_PL, category)
        : null,
    muscles: (ex.muscles ?? []).map((m) => translate(MUSCLE_PL, m.name)),
    muscles_secondary: (ex.muscles_secondary ?? []).map((m) => translate(MUSCLE_PL, m.name)),
    equipment: (ex.equipment ?? []).map((e) => translate(EQUIPMENT_PL, e.name)),
    image_url: image?.image ?? null,
    image_thumb_url: image?.thumbnails?.small ?? image?.image ?? null,
    muscle_image_urls: (ex.muscles ?? []).map((m) => m.image_url_main).filter(Boolean),
    metric: category === "Cardio" ? "time" : "weight_reps",
    license: primary.license_title || "CC-BY-SA",
    license_author: primary.license_author || null,
    license_url: primary.license_object_url || `https://wger.de/en/exercise/${ex.id}/view/`,
  });
}

console.log(`\n🔎 Przygotowano ${rows.length} ćwiczeń (${imageByExercise.size} ze zdjęciem).`);

if (DRY_RUN) {
  console.log("\n🧪 Tryb podglądu (WGER_DRY_RUN=1) - nic nie zapisuję. Przykładowe rekordy:\n");
  for (const row of rows.slice(0, 5)) {
    console.log(`• ${row.name}`);
    console.log(`  slug: ${row.slug}`);
    console.log(`  partia: ${row.muscle_group ?? "-"} | sprzęt: ${row.equipment.join(", ") || "-"}`);
    console.log(`  zdjęcie: ${row.image_thumb_url ? "tak" : "brak"} | licencja: ${row.license}`);
    console.log(`  opis: ${(row.description ?? "brak").slice(0, 110).replace(/\n/g, " ")}...\n`);
  }
  const withImages = rows.filter((r) => r.image_thumb_url).length;
  const withDescription = rows.filter((r) => r.description).length;
  console.log(`Podsumowanie: ${rows.length} ćwiczeń, ${withImages} ze zdjęciem, ${withDescription} z opisem.`);
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

let inserted = 0;
for (let i = 0; i < rows.length; i += 100) {
  const batch = rows.slice(i, i + 100);
  const { error } = await supabase
    .from("exercise_catalog")
    .upsert(batch, { onConflict: "source,source_id" });

  if (error) {
    console.error(`\n❌ Partia ${i / 100 + 1}: ${error.message}`);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`\r   zapisano ${inserted}/${rows.length}...`);
}

const { count } = await supabase
  .from("exercise_catalog")
  .select("id", { count: "exact", head: true })
  .is("user_id", null);

console.log(`\n\n✅ Gotowe. Katalog globalny liczy teraz ${count} ćwiczeń.`);
console.log("   Ćwiczenia z wger są oznaczone licencją i autorem - atrybucja pokazuje się w aplikacji.");
