import { NextResponse } from "next/server";
import { AiPlanSchema } from "@/lib/ai/planSchema";
import { createClient } from "@/lib/supabase/server";

/**
 * Zapisuje wcześniej wygenerowany plan do bazy.
 * Treść bierzemy z ai_plan_requests, a nie z ciała żądania — dzięki temu klient
 * nie może podmienić planu na coś, czego model nie zwrócił.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { requestId?: string } | null;
  if (!body?.requestId) {
    return NextResponse.json({ error: "Brak identyfikatora wygenerowanego planu." }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("ai_plan_requests")
    .select("id, output, plan_id")
    .eq("id", body.requestId)
    .maybeSingle();

  if (!row?.output) {
    return NextResponse.json({ error: "Nie znaleziono wygenerowanego planu." }, { status: 404 });
  }
  if (row.plan_id) {
    return NextResponse.json({ planId: row.plan_id, alreadySaved: true });
  }

  const parsed = AiPlanSchema.safeParse(row.output);
  if (!parsed.success) {
    return NextResponse.json({ error: "Wygenerowany plan ma nieprawidłowy format." }, { status: 422 });
  }
  const draft = parsed.data;

  // Mapowanie slugów na realne ćwiczenia z katalogu
  const slugs = [
    ...new Set(
      draft.phases.flatMap((p) =>
        p.days.flatMap((d) => d.exercises.map((e) => e.slug).filter(Boolean)),
      ),
    ),
  ];

  const catalog = new Map<string, { id: string; muscle_group: string | null }>();
  if (slugs.length) {
    const { data } = await supabase
      .from("exercise_catalog")
      .select("id, slug, muscle_group")
      .in("slug", slugs);
    for (const row of data ?? []) {
      if (row.slug) catalog.set(row.slug, { id: row.id, muscle_group: row.muscle_group });
    }
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert({
      user_id: user.id,
      name: draft.name,
      description: [draft.description, draft.coach_notes].filter(Boolean).join("\n\n"),
      goal: draft.goal,
      source: "ai",
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return NextResponse.json(
      { error: `Nie udało się zapisać planu: ${planError?.message}` },
      { status: 500 },
    );
  }

  for (const [phaseIndex, phase] of draft.phases.entries()) {
    const { data: phaseRow, error: phaseError } = await supabase
      .from("phases")
      .insert({
        plan_id: plan.id,
        name: phase.name,
        description: phase.description || null,
        frequency: phase.frequency || null,
        order_index: phaseIndex + 1,
      })
      .select("id")
      .single();

    if (phaseError || !phaseRow) continue;

    for (const [dayIndex, day] of phase.days.entries()) {
      const { data: dayRow, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          phase_id: phaseRow.id,
          name: day.name,
          short_label: day.short_label?.slice(0, 4) || null,
          description: day.description || null,
          day_type: day.day_type,
          tracks_knee_pain: day.tracks_knee_pain,
          order_index: dayIndex + 1,
        })
        .select("id")
        .single();

      if (dayError || !dayRow) continue;

      const exercises = day.exercises.map((exercise, index) => {
        const match = exercise.slug ? catalog.get(exercise.slug) : undefined;
        return {
          workout_day_id: dayRow.id,
          catalog_exercise_id: match?.id ?? null,
          // Nazwę zapisujemy zawsze, gdy nie ma dopasowania w katalogu.
          name_override: match ? null : exercise.name,
          muscle_group: match?.muscle_group ?? null,
          target_sets: exercise.target_sets,
          target_reps: exercise.target_reps || null,
          target_note: exercise.target_note || null,
          technique_notes: exercise.technique_notes || null,
          rest_seconds: exercise.rest_seconds,
          order_index: index + 1,
        };
      });

      if (exercises.length) await supabase.from("workout_exercises").insert(exercises);
    }
  }

  await supabase.from("ai_plan_requests").update({ plan_id: plan.id }).eq("id", row.id);
  await supabase.rpc("set_active_plan", { p_plan_id: plan.id });

  return NextResponse.json({ planId: plan.id });
}
