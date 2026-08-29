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
 *
 * Idzie przez funkcję w bazie, a nie przez zwykły zapis do tabeli. Cache jest
 * wspólny dla wszystkich, więc bezpośredni UPDATE znaczyłby, że jedna osoba
 * może wpisać mleku 9000 kcal i popsuć liczenie każdemu. Funkcja umie tylko
 * DOPISAĆ brakujący produkt; istniejącego nie rusza (migracja 0029).
 */
export async function cacheOffProduct(supabase: Client, product: OffProduct): Promise<Food> {
  const { data, error } = await supabase.rpc("cache_off_product", {
    p_off_id: product.off_id,
    p_name: product.name,
    p_brand: product.brand,
    p_image_url: product.image_url,
    p_kcal_100g: product.kcal_100g,
    p_protein_100g: product.protein_100g,
    p_carbs_100g: product.carbs_100g,
    p_fat_100g: product.fat_100g,
    p_fiber_100g: product.fiber_100g,
    p_sugar_100g: product.sugar_100g,
    p_salt_100g: product.salt_100g,
    p_serving_size_g: product.serving_size_g,
    p_serving_label: product.serving_label,
  });

  if (error) throw new Error(`Nie udało się zapisać produktu: ${error.message}`);
  return data as unknown as Food;
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

/**
 * Zapis pozycji policzonych z opisu.
 *
 * Bez `food_id` i bez zakładania wierszy w `foods`. „Dwa jajka sadzone"
 * z wczorajszego śniadania nie są produktem, do którego ktoś wróci — są
 * jednorazowym wpisem. Zakładanie dla nich produktu zaśmiecałoby wyszukiwarkę
 * setkami jednorazowych pozycji, a `meal_entries` i tak trzyma pełny snapshot
 * wartości, więc wpis jest kompletny sam z siebie.
 *
 * Kolumna `food_id` jest nullowalna od pierwszej migracji (`on delete set
 * null`), więc dziennik od początku umie żyć z wpisem bez produktu.
 */
export async function addOpisaneEntries(
  supabase: Client,
  params: {
    userId: string;
    mealId: string;
    skladniki: Array<{
      nazwa: string;
      gramatura: number;
      kcal_100g: number;
      bialko_100g: number;
      wegle_100g: number;
      tluszcz_100g: number;
    }>;
  },
) {
  const wiersze = params.skladniki.map((s) => ({
    user_id: params.userId,
    meal_id: params.mealId,
    food_id: null,
    food_name: s.nazwa,
    grams: s.gramatura,
    kcal_100g: s.kcal_100g,
    protein_100g: s.bialko_100g,
    carbs_100g: s.wegle_100g,
    fat_100g: s.tluszcz_100g,
  }));

  const { data, error } = await supabase.from("meal_entries").insert(wiersze).select();

  if (error) throw new Error(`Nie udało się dodać posiłku: ${error.message}`);
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
