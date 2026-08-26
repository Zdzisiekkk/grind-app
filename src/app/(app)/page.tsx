import Link from "next/link";
import { Button, Card, Chip, Stat } from "@/components/ui";
import { MacroSummary } from "@/components/diet/MacroSummary";
import { QuickLog } from "@/components/QuickLog";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_ICON, ACTIVITY_LABEL } from "@/lib/constants";
import { painStatus } from "@/lib/viz";
import { addDaysISO, duration, longDate, num, todayISO, volume as fmtVolume } from "@/lib/format";
import type { PeriodSummary } from "@/lib/database.types";

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
    supabase.from("knee_pain_logs").select("level, side").eq("user_id", user.id).eq("date", today),
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -6), p_to: today }),
    supabase.from("plans").select("name").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);

  const summary = weekSummary as PeriodSummary | null;
  const openSession = (sessions ?? []).find((s) => !s.finished_at);
  const lastWeight = weights?.[0]?.weight_kg ?? null;
  const todayPain = pain?.[0];
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

      {/* --- Szybkie wpisy --- */}
      <div className="flex flex-col gap-2">
        <QuickLog userId={user.id} lastWeightKg={lastWeight} />
        {(lastWeight != null || todayPain) && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {lastWeight != null && <Chip>Ostatnia waga: {num(lastWeight, 1)} kg</Chip>}
            {todayPain && (
              <Chip>
                <span aria-hidden style={{ color: painStatus(todayPain.level).color }}>
                  {painStatus(todayPain.level).icon}
                </span>
                Kolano dziś: {todayPain.level}/10 · {painStatus(todayPain.level).label}
              </Chip>
            )}
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
