import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Food, MealType } from "@/lib/database.types";
import type { OffProduct } from "@/lib/off";

type Client = SupabaseClient<Database>;

/** Zwraca id posiłku danego typu w danym dniu, tworząc go przy pierwszym produkcie. */
export async function ensureMeal(
  supabase: Client,
  userId: string,
  date: string,
  mealType: MealType,
): Promise<string> {
  const existing = await supabase
    .from("meals")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("meal_type", mealType)
    .maybeSingle();

  if (existing.data) return existing.data.id;

  const { data, error } = await supabase
    .from("meals")
    .insert({ user_id: userId, date, meal_type: mealType })
    .select("id")
    .single();

  if (error) throw new Error(`Nie udało się utworzyć posiłku: ${error.message}`);
  return data.id;
}

/**
 * Zapisuje produkt z Open Food Facts do wspólnego cache'u (user_id = NULL),
 * żeby kolejne wyszukiwanie tego samego kodu było natychmiastowe i offline-owe.
 */
export async function cacheOffProduct(supabase: Client, product: OffProduct): Promise<Food> {
  const { data, error } = await supabase
    .from("foods")
    .upsert(
      {
        user_id: null,
        source: "off",
        off_id: product.off_id,
        name: product.name,
        brand: product.brand,
        image_url: product.image_url,
        kcal_100g: product.kcal_100g,
        protein_100g: product.protein_100g,
        carbs_100g: product.carbs_100g,
        fat_100g: product.fat_100g,
        fiber_100g: product.fiber_100g,
        sugar_100g: product.sugar_100g,
        salt_100g: product.salt_100g,
        serving_size_g: product.serving_size_g,
        serving_label: product.serving_label,
      },
      { onConflict: "off_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`Nie udało się zapisać produktu: ${error.message}`);
  return data as Food;
}

/** Dodaje produkt do posiłku. Makra są kopiowane „na sztywno” — późniejsza
 *  korekta produktu w bazie nie zmieni tego, co już zjadłeś. */
export async function addMealEntry(
  supabase: Client,
  params: {
    userId: string;
    mealId: string;
    food: Pick<Food, "id" | "name" | "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g">;
    grams: number;
  },
) {
  const { data, error } = await supabase
    .from("meal_entries")
    .insert({
      user_id: params.userId,
      meal_id: params.mealId,
      food_id: params.food.id,
      food_name: params.food.name,
      grams: params.grams,
      kcal_100g: params.food.kcal_100g,
      protein_100g: params.food.protein_100g,
      carbs_100g: params.food.carbs_100g,
      fat_100g: params.food.fat_100g,
    })
    .select()
    .single();

  if (error) throw new Error(`Nie udało się dodać produktu: ${error.message}`);
  return data;
}

export type MacroTotals = { kcal: number; protein: number; carbs: number; fat: number };

export function sumMacros(entries: { kcal: number; protein: number; carbs: number; fat: number }[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, e) => ({
      kcal: acc.kcal + Number(e.kcal),
      protein: acc.protein + Number(e.protein),
      carbs: acc.carbs + Number(e.carbs),
      fat: acc.fat + Number(e.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
