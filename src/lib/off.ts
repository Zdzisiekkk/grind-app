/**
 * Open Food Facts — wyszukiwarka produktów.
 * Używamy polskiej instancji (pl.openfoodfacts.org), bo zwraca krajowe marki
 * na pierwszych miejscach. API jest darmowe i publiczne, wymaga tylko
 * opisowego nagłówka User-Agent.
 */

const OFF_BASE = "https://pl.openfoodfacts.org";
const USER_AGENT = "Grind/1.0 (osobista aplikacja treningowa; https://github.com)";

const FIELDS = [
  "code",
  "product_name",
  "product_name_pl",
  "brands",
  "quantity",
  "serving_size",
  "nutriments",
  "image_small_url",
  "image_front_small_url",
].join(",");

export type OffProduct = {
  off_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugar_100g: number | null;
  salt_100g: number | null;
  serving_size_g: number | null;
  serving_label: string | null;
};

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** „250 g”, „1 portion (250 g)”, „1 opakowanie (30 g)” → { grams: 250, label: "porcja" } */
export function parseServing(raw: unknown): { grams: number | null; label: string | null } {
  if (typeof raw !== "string" || !raw.trim()) return { grams: null, label: null };

  const text = raw.trim();
  const inParens = text.match(/\(([^)]*?)\)/);
  const gramsMatch = (inParens?.[1] ?? text).match(/([\d.,]+)\s*(g|ml)\b/i);
  const grams = gramsMatch ? toNumber(gramsMatch[1]) : null;

  const labelMatch = text.match(/^\s*([\d.,]+)?\s*([\p{L}\s]+?)\s*(?:\(|$)/u);
  const rawLabel = labelMatch?.[2]?.trim();
  const label =
    rawLabel && !/^(g|ml)$/i.test(rawLabel)
      ? rawLabel.replace(/^portion$/i, "porcja").replace(/^package$/i, "opakowanie")
      : grams
        ? "porcja"
        : null;

  return { grams: grams && grams > 0 && grams <= 5000 ? grams : null, label };
}

type OffRaw = {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  brands?: string;
  serving_size?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, unknown>;
};

function normalize(raw: OffRaw): OffProduct | null {
  const code = raw.code?.trim();
  const name = (raw.product_name_pl || raw.product_name || "").trim();
  const n = raw.nutriments ?? {};

  // Bez kodu, nazwy albo kalorii produkt jest bezużyteczny w dzienniku.
  let kcal = toNumber(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = toNumber(n["energy_100g"]);
    kcal = kj !== null ? Math.round(kj / 4.184) : null;
  }
  if (!code || !name || kcal === null || kcal < 0 || kcal > 950) return null;

  const serving = parseServing(raw.serving_size);

  return {
    off_id: code,
    name,
    brand: raw.brands?.split(",")[0]?.trim() || null,
    image_url: raw.image_small_url || raw.image_front_small_url || null,
    kcal_100g: Math.round(kcal * 10) / 10,
    protein_100g: toNumber(n["proteins_100g"]) ?? 0,
    carbs_100g: toNumber(n["carbohydrates_100g"]) ?? 0,
    fat_100g: toNumber(n["fat_100g"]) ?? 0,
    fiber_100g: toNumber(n["fiber_100g"]),
    sugar_100g: toNumber(n["sugars_100g"]),
    salt_100g: toNumber(n["salt_100g"]),
    serving_size_g: serving.grams,
    serving_label: serving.label,
  };
}

export async function searchOff(query: string, limit = 20): Promise<OffProduct[]> {
  const url = new URL(`${OFF_BASE}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(50, limit * 2)));
  url.searchParams.set("fields", FIELDS);

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Wyniki wyszukiwania zmieniają się rzadko — godzina cache oszczędza OFF i przyspiesza apkę.
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`Open Food Facts odpowiedział ${response.status}`);

  const data = (await response.json()) as { products?: OffRaw[] };
  const seen = new Set<string>();
  const out: OffProduct[] = [];

  for (const raw of data.products ?? []) {
    const product = normalize(raw);
    if (!product || seen.has(product.off_id)) continue;
    seen.add(product.off_id);
    out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}
