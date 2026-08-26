import { CatalogScreen } from "@/components/CatalogScreen";
import { createClient } from "@/lib/supabase/server";
import type { CatalogExercise } from "@/lib/database.types";

export const metadata = { title: "Katalog ćwiczeń" };

export default async function CwiczeniaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: items }, { data: groups }] = await Promise.all([
    supabase.from("exercise_catalog").select("*").order("name").limit(100),
    supabase.from("exercise_catalog").select("muscle_group").not("muscle_group", "is", null),
  ]);

  const muscleGroups = [
    ...new Set((groups ?? []).map((g) => g.muscle_group).filter((g): g is string => Boolean(g))),
  ].sort((a, b) => a.localeCompare(b, "pl"));

  return (
    <CatalogScreen
      userId={user.id}
      muscleGroups={muscleGroups}
      initialItems={(items ?? []) as CatalogExercise[]}
    />
  );
}
