import Link from "next/link";
import { Button, Card, Chip, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { startSession } from "./actions";
import { DAY_TYPE_ICON, DAY_TYPE_LABEL } from "@/lib/constants";
import { humanDate, sets as setsLabel, todayISO, volume } from "@/lib/format";
import type { Phase, WorkoutDay } from "@/lib/database.types";

export const metadata = { title: "Trening" };

export default async function TreningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  let phases: Phase[] = [];
  let days: WorkoutDay[] = [];
  let exerciseCounts = new Map<string, number>();

  if (plan) {
    const { data: phaseRows } = await supabase
      .from("phases")
      .select("*")
      .eq("plan_id", plan.id)
      .order("order_index");
    phases = phaseRows ?? [];

    if (phases.length) {
      const { data: dayRows } = await supabase
        .from("workout_days")
        .select("*")
        .in("phase_id", phases.map((p) => p.id))
        .order("order_index");
      days = dayRows ?? [];

      if (days.length) {
        const { data: exRows } = await supabase
          .from("workout_exercises")
          .select("id, workout_day_id")
          .in("workout_day_id", days.map((d) => d.id));
        exerciseCounts = (exRows ?? []).reduce((map, row) => {
          map.set(row.workout_day_id, (map.get(row.workout_day_id) ?? 0) + 1);
          return map;
        }, new Map<string, number>());
      }
    }
  }

  const { data: recentSessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(8);

  const sessions = recentSessions ?? [];
  const openSession = sessions.find((s) => !s.finished_at && s.date === todayISO());

  const { data: recentVolume } = await supabase
    .from("v_daily_volume")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(8);
  const volumeByDate = new Map((recentVolume ?? []).map((v) => [v.date, v]));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Trening</h1>
        {plan ? (
          <p className="text-[13px] text-muted">
            Plan: <span className="font-medium text-text">{plan.name}</span>
          </p>
        ) : null}
      </header>

      {openSession && (
        <Card className="border-accent/50 bg-accent-soft/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-accent">Trening w toku</p>
              <p className="truncate text-[15px] font-semibold">
                {openSession.day_label ?? "Bez planu"}
              </p>
            </div>
            <Link href={`/trening/${openSession.id}`}>
              <Button variant="primary">Wróć</Button>
            </Link>
          </div>
        </Card>
      )}

      {!plan ? (
        <Card>
          <EmptyState
            icon="📋"
            title="Nie masz jeszcze aktywnego planu"
            description="Skopiuj gotowy szablon, ułóż plan sam albo poproś o niego AI-trenera."
            action={
              <Link href="/plan">
                <Button variant="primary">Wybierz plan</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        phases.map((phase) => {
          const phaseDays = days.filter((d) => d.phase_id === phase.id);
          if (!phaseDays.length) return null;
          return (
            <section key={phase.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-[15px] font-semibold">{phase.name}</h2>
                {phase.frequency && <span className="text-[12px] text-faint">{phase.frequency}</span>}
              </div>
              {phase.description && (
                <p className="px-1 text-[12px] text-muted">{phase.description}</p>
              )}

              <div className="flex flex-col gap-2">
                {phaseDays.map((day) => (
                  <form key={day.id} action={startSession}>
                    <input type="hidden" name="dayId" value={day.id} />
                    <input type="hidden" name="dayLabel" value={day.name} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-border bg-surface px-3 py-3.5 text-left shadow-[var(--shadow)] active:scale-[0.99]"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                        {DAY_TYPE_ICON[day.day_type]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold leading-tight">
                          {day.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          {exerciseCounts.get(day.id) ?? 0} ćwiczeń · {DAY_TYPE_LABEL[day.day_type]}
                          {day.tracks_pain && " · ocena bólu"}
                        </span>
                      </span>
                      <span className="text-accent" aria-hidden>
                        ▸
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </section>
          );
        })
      )}

      <form action={startSession}>
        <input type="hidden" name="dayLabel" value="Trening bez planu" />
        <Button type="submit" variant="secondary" block>
          + Trening bez planu
        </Button>
      </form>

      <Card title="Ostatnie treningi" padded={false}>
        {sessions.length === 0 ? (
          <EmptyState icon="🗒️" title="Jeszcze nic tu nie ma" description="Twój pierwszy trening pojawi się na tej liście." />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => {
              const v = volumeByDate.get(s.date);
              return (
                <li key={s.id}>
                  <Link href={`/trening/${s.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {s.day_label ?? "Trening"}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {humanDate(s.date)}
                        {v ? ` · ${setsLabel(v.sets)} · ${volume(v.volume_kg)}` : ""}
                      </span>
                    </span>
                    {!s.finished_at && <Chip tone="accent">w trakcie</Chip>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
