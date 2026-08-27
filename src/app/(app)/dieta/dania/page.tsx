import { RecipesScreen } from "@/components/diet/RecipesScreen";
import { createClient } from "@/lib/supabase/server";
import type { RecipeItem, RecipeTotals } from "@/lib/database.types";

export const metadata = { title: "Moje dania" };

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: recipes }, { data: items }] = await Promise.all([
    supabase.from("v_recipe_totals").select("*").order("name"),
    supabase.from("recipe_items").select("*").eq("user_id", user.id).order("order_index"),
  ]);

  // Grupujemy po stronie serwera — komponent dostaje gotowe listy zamiast
  // filtrować wszystko przy każdym otwarciu przepisu.
  const byRecipe: Record<string, RecipeItem[]> = {};
  for (const item of (items ?? []) as RecipeItem[]) {
    (byRecipe[item.recipe_id] ??= []).push(item);
  }

  return (
    <RecipesScreen
      userId={user.id}
      recipes={(recipes ?? []) as RecipeTotals[]}
      items={byRecipe}
    />
  );
}
