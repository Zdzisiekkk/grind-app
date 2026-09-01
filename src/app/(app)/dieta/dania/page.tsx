import { RecipesScreen } from "@/components/diet/RecipesScreen";
import { createClient } from "@/lib/supabase/server";
import type { RecipeItem, RecipeTotals } from "@/lib/database.types";

export const metadata = { title: "Dania i przepisy" };

export default async function RecipesPage({
  searchParams,
}: {
  /** ?przepis=<id> - wejście prosto z widżetu "przepis dnia". */
  searchParams: Promise<{ przepis?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { przepis } = await searchParams;

  /*
   * Trzy zapytania zamiast jednego "select *" z widoku.
   *
   * Po migracji 0049 v_recipe_totals zwraca też katalog (user_id is null),
   * więc bez rozdzielenia własne dania wymieszałyby się ze stoma cudzymi.
   * Składniki pobieramy tylko dla własnych - katalogowe wczytuje się dopiero
   * po otwarciu przepisu, bo to blisko tysiąc wierszy.
   */
  const [{ data: recipes }, { data: katalog }, { data: items }, { data: profile }] =
    await Promise.all([
      supabase.from("v_recipe_totals").select("*").eq("user_id", user.id).order("name"),
      supabase.from("v_recipe_totals").select("*").is("user_id", null).gt("items", 0).order("name"),
      supabase.from("recipe_items").select("*").eq("user_id", user.id).order("order_index"),
      supabase.from("profiles").select("daily_kcal").eq("id", user.id).maybeSingle(),
    ]);

  // Grupujemy po stronie serwera - komponent dostaje gotowe listy zamiast
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
      katalog={(katalog ?? []) as RecipeTotals[]}
      celKcal={profile?.daily_kcal ?? null}
      otworz={przepis}
    />
  );
}
