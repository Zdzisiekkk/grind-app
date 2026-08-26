import { notFound } from "next/navigation";
import { PlanEditor, type EditorPhase } from "@/components/plan/PlanEditor";
import { createClient } from "@/lib/supabase/server";
import type { Phase, Plan, WorkoutDay, WorkoutExercise } from "@/lib/database.types";

export const metadata = { title: "Plan" };

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) notFound();

  const { data: phaseRows } = await supabase
    .from("phases")
    .select("*")
    .eq("plan_id", planId)
    .order("order_index");
  const phases = (phaseRows ?? []) as Phase[];

  let days: WorkoutDay[] = [];
  let exercises: WorkoutExercise[] = [];
  const names = new Map<string, string>();

  if (phases.length) {
    const { data: dayRows } = await supabase
      .from("workout_days")
      .select("*")
      .in("phase_id", phases.map((p) => p.id))
      .order("order_index");
    days = (dayRows ?? []) as WorkoutDay[];

    if (days.length) {
      const { data: exRows } = await supabase
        .from("workout_exercises")
        .select("*")
        .in("workout_day_id", days.map((d) => d.id))
        .order("order_index");
      exercises = (exRows ?? []) as WorkoutExercise[];

      const catalogIds = [
        ...new Set(exercises.map((e) => e.catalog_exercise_id).filter((id): id is string => Boolean(id))),
      ];
      if (catalogIds.length) {
        const { data: catalog } = await supabase
          .from("exercise_catalog")
          .select("id, name")
          .in("id", catalogIds);
        for (const item of catalog ?? []) names.set(item.id, item.name);
      }
    }
  }

  const editorPhases: EditorPhase[] = phases.map((phase) => ({
    ...phase,
    days: days
      .filter((d) => d.phase_id === phase.id)
      .map((day) => ({
        ...day,
        exercises: exercises
          .filter((e) => e.workout_day_id === day.id)
          .map((e) => ({
            ...e,
            display_name:
              e.name_override ??
              (e.catalog_exercise_id ? names.get(e.catalog_exercise_id) : null) ??
              "Ćwiczenie",
          })),
      })),
  }));

  return (
    <PlanEditor
      plan={plan as Plan}
      initialPhases={editorPhases}
      canEdit={plan.user_id === user.id}
    />
  );
}
