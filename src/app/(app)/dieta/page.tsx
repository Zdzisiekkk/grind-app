import { DietScreen, type EntryWithMeal } from "@/components/diet/DietScreen";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { MealEntry, MealType } from "@/lib/database.types";

export const metadata = { title: "Dieta" };

export default async function DietaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : todayISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: meals }] = await Promise.all([
    supabase
      .from("profiles")
      .select("daily_kcal, daily_protein_g, daily_carbs_g, daily_fat_g")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("meals").select("id, meal_type").eq("user_id", user.id).eq("date", date),
  ]);

  const mealTypeById = new Map<string, MealType>((meals ?? []).map((m) => [m.id, m.meal_type]));

  let entries: EntryWithMeal[] = [];
  if (mealTypeById.size) {
    const { data } = await supabase
      .from("meal_entries")
      .select("*")
      .in("meal_id", [...mealTypeById.keys()])
      .order("created_at");

    entries = ((data ?? []) as MealEntry[]).map((e) => ({
      ...e,
      meal_type: mealTypeById.get(e.meal_id) ?? "snack",
    }));
  }

  return (
    <DietScreen
      userId={user.id}
      date={date}
      initialEntries={entries}
      goals={{
        kcal: profile?.daily_kcal ?? null,
        protein: profile?.daily_protein_g ?? null,
        carbs: profile?.daily_carbs_g ?? null,
        fat: profile?.daily_fat_g ?? null,
      }}
    />
  );
}
