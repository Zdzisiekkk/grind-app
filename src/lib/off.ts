/**
 * Open Food Facts — wyszukiwarka produktów.
 *
 * OFF wystawia dwa różne API i żadne samo nie wystarcza:
 *
 *  • search.openfoodfacts.org — szybkie (ok. 0,1 s), ale indeks trzyma tylko
 *    kod, nazwę i wartości odżywcze. Bez marki, zdjęcia i wielkości porcji.
 *  • /cgi/search.pl — pełne dane, ale bywa skrajnie wolne (widziane 38 s przy
 *    jednym zapytaniu) i pod obciążeniem odpowiada 503.
 *
 * Dlatego: szukamy w szybkim indeksie, a szczegóły dociągamy równolegle po
 * kodach z endpointu pojedynczego produktu. Gdyby szybkie API padło,
 * wracamy do starego. Wzbogacanie jest „best effort" — brak marki czy zdjęcia
 * nie blokuje dodania produktu do dziennika, bo kalorie i makro już mamy.
 */

const OFF_SEARCH = "https://search.openfoodfacts.org";
const OFF_BASE = "https://pl.openfoodfacts.org";
const OFF_WORLD = "https://world.openfoodfacts.org";
const USER_AGENT = "Grind/1.0 (osobista aplikacja treningowa; https://github.com)";

/** Krótkie limity: lepiej pokazać część wyników niż kazać czekać w nieskończoność. */
const SEARCH_TIMEOUT_MS = 6_000;
const DETAIL_TIMEOUT_MS = 3_000;
/** Ile najlepszych trafień wzbogacamy o markę, zdjęcie i porcję. */
const ENRICH_LIMIT = 12;

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

type OffFetchInit = { timeoutMs: number; revalidate: number };

async function offFetch(url: string | URL, { timeoutMs, revalidate }: OffFetchInit) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Wyniki zmieniają się rzadko — cache oszczędza OFF i przyspiesza apkę.
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Szybki indeks: kod, nazwa, makro. Wystarcza, żeby wpisać produkt do dziennika. */
async function searchFast(query: string, limit: number): Promise<OffRaw[]> {
  const url = new URL(`${OFF_SEARCH}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(Math.min(50, limit * 2)));
  url.searchParams.set("fields", "code,product_name,product_name_pl,nutriments");

  const response = await offFetch(url, { timeoutMs: SEARCH_TIMEOUT_MS, revalidate: 3600 });
  if (!response.ok) throw new Error(`wyszukiwarka odpowiedziała ${response.status}`);

  const data = (await response.json()) as { hits?: OffRaw[] };
  return data.hits ?? [];
}

/** Stare API — pełne dane, ale wolne. Używane tylko, gdy szybkie zawiedzie. */
async function searchLegacy(query: string, limit: number): Promise<OffRaw[]> {
  const url = new URL(`${OFF_BASE}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(50, limit * 2)));
  url.searchParams.set("fields", FIELDS);

  const response = await offFetch(url, { timeoutMs: SEARCH_TIMEOUT_MS, revalidate: 3600 });
  if (!response.ok) throw new Error(`Open Food Facts odpowiedział ${response.status}`);

  const data = (await response.json()) as { products?: OffRaw[] };
  return data.products ?? [];
}

/** Marka, zdjęcie i wielkość porcji — dociągane po kodzie, równolegle. */
async function fetchDetails(code: string): Promise<OffRaw | null> {
  try {
    const url = new URL(`${OFF_WORLD}/api/v2/product/${encodeURIComponent(code)}.json`);
    url.searchParams.set("fields", FIELDS);
    const response = await offFetch(url, { timeoutMs: DETAIL_TIMEOUT_MS, revalidate: 86_400 });
    if (!response.ok) return null;
    const data = (await response.json()) as { product?: OffRaw };
    return data.product ?? null;
  } catch {
    return null;
  }
}

export async function searchOff(query: string, limit = 20): Promise<OffProduct[]> {
  let hits: OffRaw[];
  try {
    hits = await searchFast(query, limit);
    // Pusty wynik z szybkiego indeksu bywa fałszywy przy nietypowych frazach —
    // wtedy warto spytać starego API, zanim powiemy „nic nie znaleziono".
    if (hits.length === 0) hits = await searchLegacy(query, limit);
  } catch {
    hits = await searchLegacy(query, limit);
  }

  const seen = new Set<string>();
  const base: OffProduct[] = [];
  for (const raw of hits) {
    const product = normalize(raw);
    if (!product || seen.has(product.off_id)) continue;
    seen.add(product.off_id);
    base.push(product);
    if (base.length >= limit) break;
  }

  // Wzbogacanie tylko tam, gdzie czegoś brakuje, i tylko dla czołówki listy.
  const toEnrich = base
    .slice(0, ENRICH_LIMIT)
    .filter((p) => !p.brand || !p.image_url || p.serving_size_g === null);

  if (toEnrich.length === 0) return base;

  const details = await Promise.all(toEnrich.map((p) => fetchDetails(p.off_id)));
  const byCode = new Map<string, OffRaw>();
  details.forEach((d, i) => {
    if (d) byCode.set(toEnrich[i].off_id, d);
  });

  return base.map((product) => {
    const detail = byCode.get(product.off_id);
    if (!detail) return product;
    const serving = parseServing(detail.serving_size);
    return {
      ...product,
      name: (detail.product_name_pl || detail.product_name || product.name).trim(),
      brand: product.brand ?? (detail.brands?.split(",")[0]?.trim() || null),
      image_url:
        product.image_url ?? (detail.image_small_url || detail.image_front_small_url || null),
      serving_size_g: product.serving_size_g ?? serving.grams,
      serving_label: product.serving_label ?? serving.label,
    };
  });
}
