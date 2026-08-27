import Link from "next/link";
import { Button, Card, Chip, Stat } from "@/components/ui";
import { MacroSummary } from "@/components/diet/MacroSummary";
import { QuickLog } from "@/components/QuickLog";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITY_ICON,
  ACTIVITY_LABEL,
  DEFAULT_WATER_GOAL_ML,
  bodyPart,
  dueLabel,
  habitDueOn,
  waterLabel,
} from "@/lib/constants";
import { painStatus } from "@/lib/viz";
import { addDaysISO, duration, longDate, num, todayISO, volume as fmtVolume } from "@/lib/format";
import type { Habit, Injury, PeriodSummary } from "@/lib/database.types";

export const metadata = { title: "Dziś" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();

  const [
    { data: profile },
    { data: sessions },
    { data: nutrition },
    { data: activities },
    { data: weights },
    { data: pain },
    { data: injuries },
    { data: habits },
    { data: habitLogs },
    { data: waterToday },
    { data: dueTodos },
    { data: weekSummary },
    { data: activePlan },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("started_at", { ascending: false }),
    supabase
      .from("v_daily_nutrition")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase.from("activities").select("*").eq("user_id", user.id).eq("date", today),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("pain_logs")
      .select("injury_id, level")
      .eq("user_id", user.id)
      .eq("date", today),
    supabase
      .from("injuries")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "healed")
      .order("order_index"),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("order_index"),
    supabase.from("habit_logs").select("habit_id, count").eq("user_id", user.id).eq("date", today),
    supabase.from("water_logs").select("ml").eq("user_id", user.id).eq("date", today),
    supabase
      .from("todos")
      .select("id, title, due_date, priority")
      .eq("user_id", user.id)
      .is("done_at", null)
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date")
      .limit(5),
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -6), p_to: today }),
    supabase.from("plans").select("name").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);

  const summary = weekSummary as PeriodSummary | null;
  const openSession = (sessions ?? []).find((s) => !s.finished_at);
  const lastWeight = weights?.[0]?.weight_kg ?? null;
  const trackedInjuries = ((injuries ?? []) as Injury[]).filter((i) => i.track_pain);
  const painToday = new Map((pain ?? []).map((p) => [p.injury_id, p.level]));
  const ratedToday = trackedInjuries.filter((i) => painToday.has(i.id));
  const unratedToday = trackedInjuries.filter((i) => !painToday.has(i.id));

  const habitCounts = new Map((habitLogs ?? []).map((l) => [l.habit_id, l.count]));
  const habitsToday = ((habits ?? []) as Habit[]).filter((h) => habitDueOn(h.days_of_week, today));
  const habitsDone = habitsToday.filter(
    (h) => (habitCounts.get(h.id) ?? 0) >= h.target_per_day,
  ).length;

  const waterMl = (waterToday ?? []).reduce((sum, w) => sum + w.ml, 0);
  const waterGoal = profile?.daily_water_ml ?? DEFAULT_WATER_GOAL_ML;
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterMl / waterGoal) * 100)) : 0;
  const greeting = profile?.display_name ? `Cześć, ${profile.display_name}` : "Cześć";

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold leading-tight">{greeting}</h1>
        <p className="text-[13px] capitalize text-muted">{longDate(today)}</p>
      </header>

      {/* --- Trening --- */}
      <Card
        title="Trening"
        action={
          (sessions ?? []).length > 0 ? (
            <Chip tone={openSession ? "accent" : "success"}>
              {openSession ? "w trakcie" : "zrobiony"}
            </Chip>
          ) : null
        }
      >
        {openSession ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] font-semibold">{openSession.day_label ?? "Trening"}</p>
            <Link href={`/trening/${openSession.id}`}>
              <Button variant="primary" size="lg" block>
                Wróć do treningu
              </Button>
            </Link>
          </div>
        ) : (sessions ?? []).length > 0 ? (
          <div className="flex flex-col gap-3">
            {(sessions ?? []).map((s) => (
              <Link key={s.id} href={`/trening/${s.id}`} className="flex items-center gap-2">
                <span className="flex-1 text-[15px] font-medium">{s.day_label ?? "Trening"}</span>
                <span className="text-[13px] text-muted">{duration(s.duration_min)}</span>
              </Link>
            ))}
            <Link href="/trening">
              <Button variant="secondary" block>
                Dorzuć jeszcze jeden
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              {activePlan ? `Plan: ${activePlan.name}` : "Nie masz jeszcze aktywnego planu."}
            </p>
            <Link href={activePlan ? "/trening" : "/plan"}>
              <Button variant="primary" size="lg" block>
                {activePlan ? "Zacznij trening" : "Wybierz plan"}
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* --- Dieta --- */}
      <Card
        title="Dieta"
        action={
          <Link href="/dieta" className="text-[13px] font-medium text-accent">
            Dziennik
          </Link>
        }
      >
        <MacroSummary
          compact
          totals={{
            kcal: nutrition?.kcal ?? 0,
            protein: nutrition?.protein_g ?? 0,
            carbs: nutrition?.carbs_g ?? 0,
            fat: nutrition?.fat_g ?? 0,
          }}
          goals={{
            kcal: profile?.daily_kcal ?? null,
            protein: profile?.daily_protein_g ?? null,
            carbs: profile?.daily_carbs_g ?? null,
            fat: profile?.daily_fat_g ?? null,
          }}
        />
      </Card>

      {/* --- Zadania z terminem na dziś lub zaległe --- */}
      {(dueTodos ?? []).length > 0 && (
        <Card
          title="Zadania na teraz"
          subtitle={`${(dueTodos ?? []).length} z terminem`}
          action={
            <Link href="/zadania" className="text-[13px] font-medium text-accent">
              Wszystkie
            </Link>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {(dueTodos ?? []).map((todo) => {
              const due = dueLabel(todo.due_date, today);
              return (
                <li key={todo.id} className="flex items-center gap-2 text-[14px]">
                  <span aria-hidden className="text-faint">
                    ☐
                  </span>
                  <span className="min-w-0 flex-1 truncate">{todo.title}</span>
                  {due && (
                    <span
                      className={due.overdue ? "text-[12px] font-semibold text-danger" : "text-[12px] text-muted"}
                    >
                      {due.text}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* --- Nawyki na dziś --- */}
      {habitsToday.length > 0 && (
        <Card
          title="Nawyki na dziś"
          subtitle={`${habitsDone} z ${habitsToday.length} zrobione`}
          action={
            <Link href="/nawyki" className="text-[13px] font-medium text-accent">
              Odhacz
            </Link>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {habitsToday.map((habit) => {
              const done = (habitCounts.get(habit.id) ?? 0) >= habit.target_per_day;
              return (
                <Chip key={habit.id} tone={done ? "success" : "neutral"}>
                  <span aria-hidden>{done ? "✓" : habit.icon}</span>
                  {habit.name}
                </Chip>
              );
            })}
          </div>
        </Card>
      )}

      {/* --- Nawodnienie --- */}
      <Card
        title="Nawodnienie"
        subtitle={
          waterMl >= waterGoal
            ? "Cel osiągnięty 💧"
            : `Zostało ${waterLabel(Math.max(0, waterGoal - waterMl))}`
        }
        action={
          <Link href="/dieta" className="text-[13px] font-medium text-accent">
            Dopisz
          </Link>
        }
      >
        <div className="flex items-baseline justify-between">
          <span className="tabular text-[20px] font-bold">{waterLabel(waterMl)}</span>
          <span className="text-[13px] text-muted">z {waterLabel(waterGoal)}</span>
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={waterPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Postęp nawodnienia"
        >
          <div
            className={waterPct >= 100 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-info"}
            style={{ width: `${waterPct}%` }}
          />
        </div>
      </Card>

      {/* --- Kontuzje bez dzisiejszej oceny --- */}
      {unratedToday.length > 0 && (
        <Card
          title="Jak się dziś trzymają?"
          subtitle={`${unratedToday.length} ${
            unratedToday.length === 1 ? "kontuzja czeka" : "kontuzje czekają"
          } na ocenę`}
          action={
            <Link href="/kontuzje" className="text-[13px] font-medium text-accent">
              Zarządzaj
            </Link>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {unratedToday.map((injury) => (
              <Chip key={injury.id}>
                <span aria-hidden>{bodyPart(injury.body_part).icon}</span>
                {injury.name}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {/* --- Szybkie wpisy --- */}
      <div className="flex flex-col gap-2">
        <QuickLog
          userId={user.id}
          lastWeightKg={lastWeight}
          injuries={trackedInjuries}
          painToday={Object.fromEntries(painToday)}
        />
        {(lastWeight != null || ratedToday.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {lastWeight != null && <Chip>Ostatnia waga: {num(lastWeight, 1)} kg</Chip>}
            {ratedToday.map((injury) => {
              const level = painToday.get(injury.id) as number;
              const status = painStatus(level);
              return (
                <Chip key={injury.id}>
                  <span aria-hidden style={{ color: status.color }}>
                    {status.icon}
                  </span>
                  {injury.name}: {level}/10
                </Chip>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Aktywności --- */}
      <Card
        title="Aktywności dziś"
        action={
          <Link href="/aktywnosci" className="text-[13px] font-medium text-accent">
            Wszystkie
          </Link>
        }
      >
        {(activities ?? []).length === 0 ? (
          <p className="text-[13px] text-muted">Nic dziś poza siłownią.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(activities ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-[14px]">
                <span aria-hidden>{ACTIVITY_ICON[a.type]}</span>
                <span className="flex-1 truncate">
                  {a.type === "other" && a.custom_type ? a.custom_type : ACTIVITY_LABEL[a.type]}
                </span>
                <span className="tabular text-[13px] text-muted">
                  {duration(a.duration_min)}
                  {a.kcal ? ` · ${a.kcal} kcal` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --- Ostatnie 7 dni --- */}
      {summary && (
        <Card
          title="Ostatnie 7 dni"
          action={
            <Link href="/progres" className="text-[13px] font-medium text-accent">
              Wykresy
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Treningi" value={summary.workouts} sub={`${summary.sets} serii`} />
            <Stat label="Objętość" value={fmtVolume(summary.volume_kg)} tone="accent" />
            <Stat label="Średnio kcal" value={summary.avg_kcal || "–"} />
            <Stat
              label="Aktywności"
              value={summary.activities}
              sub={summary.activity_minutes ? `${summary.activity_minutes} min` : undefined}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
