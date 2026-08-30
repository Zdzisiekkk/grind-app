import type { MealEntry, RecipeItem, RecipeTotals } from "@/lib/database.types";

/**
 * Przepis zachowuje się jak zwykły produkt.
 *
 * Dzięki temu dodanie własnego dania do posiłku idzie DOKŁADNIE tą samą drogą
 * co dodanie czegokolwiek innego - bez osobnej ścieżki zapisu, osobnych błędów
 * i osobnego kodu do utrzymania. W dzienniku pojawia się jedna pozycja
 * ("Owsianka moja 350 g"), a nie cztery linijki składników.
 */
export function recipeAsFood(totals: RecipeTotals) {
  return {
    id: totals.recipe_id,
    name: totals.name,
    kcal_100g: Number(totals.kcal_100g),
    protein_100g: Number(totals.protein_100g),
    carbs_100g: Number(totals.carbs_100g),
    fat_100g: Number(totals.fat_100g),
  };
}

/** Ile gramów waży jedna porcja. Null, gdy przepis jest jeszcze pusty. */
export function portionGrams(totals: RecipeTotals): number | null {
  const total = Number(totals.total_g);
  const servings = Number(totals.servings) || 1;
  if (total <= 0) return null;
  return Math.round(total / servings);
}

/**
 * Składniki przepisu z wpisów posiłku.
 *
 * Makra kopiujemy z wpisu, a nie z produktu w bazie: wpis pamięta, ile miał
 * kalorii W CHWILI zjedzenia, i to jest wartość, którą chcemy zamrozić
 * w przepisie.
 */
export function itemsFromEntries(
  entries: MealEntry[],
): Omit<RecipeItem, "id" | "user_id" | "recipe_id" | "created_at">[] {
  return entries.map((entry, index) => ({
    food_id: entry.food_id,
    name: entry.food_name,
    grams: Number(entry.grams),
    kcal_100g: Number(entry.kcal_100g),
    protein_100g: Number(entry.protein_100g),
    carbs_100g: Number(entry.carbs_100g),
    fat_100g: Number(entry.fat_100g),
    order_index: index,
  }));
}
