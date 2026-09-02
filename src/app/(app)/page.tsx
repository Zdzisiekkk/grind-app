import Link from "next/link";
import { Button, Card, Chip, Stat } from "@/components/ui";
import { MacroSummary } from "@/components/diet/MacroSummary";
import { HealthCard } from "@/components/health/HealthCard";
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
import { DEFAULT_WORKOUTS_PER_WEEK, healthScore } from "@/lib/health";
import {
  DEFAULT_SLEEP_GOAL_MIN,
  medianBedtime,
  napsFromView,
  scoreNight,
  sleepBand,
  sleepDuration,
  timeToMin,
  type SleepNight,
} from "@/lib/sleep";
import { addDaysISO, duration, humanDate, longDate, num, todayISO, volume as fmtVolume } from "@/lib/format";
import { POZIOM_LABEL, czas, porcja, udzialWCelu } from "@/lib/przepisy";
import { HISTORY_DAYS } from "@/lib/nawyki";
import { ogolnaPassa } from "@/lib/passa";
import { postepDoNastepnego, poziomZXp, progPoziomu, tytulPoziomu } from "@/lib/xp";
import { dayWord } from "@/lib/vices";
import type { Habit, HabitLog, Injury, PeriodSummary, RecipeTotals } from "@/lib/database.types";

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
    { data: prevSummary },
    { data: sleepRows },
    { data: coachProposals },
    { data: activePlan },
    { data: ostatniSkan },
    { data: przepisyDnia },
    { data: habitLogsHistoria },
    { data: posilkiHistoria },
    { data: xpWiersze },
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
    // Poprzedni taki sam tydzień - tylko po to, żeby przy wyniku dało się
    // pokazać kierunek zmiany. Bez tego liczba nic nie mówi.
    supabase.rpc("period_summary", { p_from: addDaysISO(today, -13), p_to: addDaysISO(today, -7) }),
    // 21 dni: 7 wchodzi do wyniku, reszta wyznacza "Twoją zwykłą porę snu".
    supabase
      .from("v_sleep")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -20))
      .order("date", { ascending: false }),
    supabase
      .from("coach_proposals")
      .select("id, title, kind")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("plans").select("name").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    // Wygląd: sam wynik i data. Kafelek ma powiedzieć "kiedy ostatnio" -
    // reszta raportu i tak nie zmieści się na pulpicie.
    supabase
      .from("wyglad_skany")
      .select("id, utworzono, ocena_ogolna")
      .eq("user_id", user.id)
      .not("ocena_ogolna", "is", null)
      .order("utworzono", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Przepis dnia. Funkcja zwraca gotowy wiersz widoku, więc kafelek kosztuje
    // jedno zapytanie, a nie dwa - patrz migracja 0049.
    supabase.rpc("przepis_dnia"),
    // Passa ogólna (src/lib/passa.ts) - to samo okno co passa nawyków.
    supabase
      .from("habit_logs")
      .select("habit_id, date, count")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -HISTORY_DAYS)),
    supabase
      .from("meals")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(today, -HISTORY_DAYS)),
    // XP nalicza baza wyzwalaczami (0057) - tu tylko suma do levelu.
    supabase.from("xp_zdarzenia").select("xp").eq("user_id", user.id),
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

  const byHabitHistoria = new Map<string, Map<string, number>>();
  for (const log of (habitLogsHistoria ?? []) as Pick<HabitLog, "habit_id" | "date" | "count">[]) {
    const map = byHabitHistoria.get(log.habit_id) ?? new Map<string, number>();
    map.set(log.date, log.count);
    byHabitHistoria.set(log.habit_id, map);
  }
  const dietaZalogowana = new Set((posilkiHistoria ?? []).map((m) => m.date));
  const passa = ogolnaPassa((habits ?? []) as Habit[], byHabitHistoria, dietaZalogowana, today);

  const xp = (xpWiersze ?? []).reduce((sum, w) => sum + w.xp, 0);
  const poziom = poziomZXp(xp);

  const waterMl = (waterToday ?? []).reduce((sum, w) => sum + w.ml, 0);
  const waterGoal = profile?.daily_water_ml ?? DEFAULT_WATER_GOAL_ML;
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterMl / waterGoal) * 100)) : 0;
  const greeting = profile?.display_name ? `Cześć, ${profile.display_name}` : "Cześć";

  /*
   * Przepis dnia. Funkcja zwraca zbiór, więc bierzemy pierwszy wiersz -
   * pusty znaczy, że katalogu jeszcze nie ma w bazie (migracja 0051)
   * i kafelek po prostu się nie pokazuje.
   */
  const przepisDnia = ((przepisyDnia ?? []) as RecipeTotals[])[0] ?? null;
  const porcjaDnia = przepisDnia ? porcja(przepisDnia) : null;
  const udzialDnia = przepisDnia ? udzialWCelu(przepisDnia, profile?.daily_kcal ?? null) : null;

  /* ------------------------------- Sen i forma ------------------------------ */

  const sleepGoal = profile?.sleep_goal_min ?? DEFAULT_SLEEP_GOAL_MIN;
  const nights: SleepNight[] = (sleepRows ?? []).map((r) => ({
    date: r.date,
    bedtime: r.bedtime,
    wake_time: r.wake_time,
    sleep_min: r.sleep_min,
    time_in_bed_min: r.time_in_bed_min,
    fell_asleep_min: r.fell_asleep_min,
    awakenings: r.awakenings,
    awake_min: r.awake_min,
    quality: r.quality,
    morning_energy: r.morning_energy,
    nap_min: r.nap_min,
    naps: napsFromView(r.naps),
    factors: r.factors,
    note: r.note,
  }));

  const bedtimeReference = timeToMin(profile?.sleep_target_bedtime) ?? medianBedtime(nights);
  const scoredNights = nights.map((night) => ({
    night,
    score: scoreNight(night, { goalMin: sleepGoal, referenceBedtime: bedtimeReference }).total,
  }));

  const lastNight = scoredNights[0] ?? null;
  const sleptToday = lastNight?.night.date === today;
  const weekFrom = addDaysISO(today, -6);
  const weekNightScores = scoredNights.filter((n) => n.night.date >= weekFrom).map((n) => n.score);

  const goals = {
    kcal: profile?.daily_kcal ?? null,
    waterMl: waterGoal,
    workoutsPerWeek: profile?.weekly_workouts ?? DEFAULT_WORKOUTS_PER_WEEK,
  };

  const health = summary ? healthScore({ summary, sleepScores: weekNightScores, goals }) : null;

  // Ten sam rachunek dla poprzedniego tygodnia - sam wynik bez kierunku
  // niewiele mówi, a "+6 pkt" już tak.
  const prevHealth = prevSummary
    ? healthScore({
        summary: prevSummary as PeriodSummary,
        sleepScores: scoredNights
          .filter(
            (n) =>
              n.night.date >= addDaysISO(today, -13) && n.night.date <= addDaysISO(today, -7),
          )
          .map((n) => n.score),
        goals,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold leading-tight">{greeting}</h1>
        <p className="text-[13px] capitalize text-muted">{longDate(today)}</p>
        {passa > 0 && (
          <p className="mt-1 text-[13px] font-medium text-accent">
            🔥 {passa} {dayWord(passa)} z rzędu - nawyki i dziennik diety w komplecie
          </p>
        )}
        {xp > 0 && (
          <div className="mt-1.5">
            <p className="text-[13px] font-medium">
              ⭐ Poziom {poziom} · {tytulPoziomu(poziom)}
              <span className="text-faint"> · {xp} / {progPoziomu(poziom + 1)} XP</span>
            </p>
            <div
              className="mt-1 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Postęp do następnego poziomu"
              aria-valuenow={Math.round(postepDoNastepnego(xp) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(postepDoNastepnego(xp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* --- Propozycje trenera czekające na decyzję --- */}
      {(coachProposals ?? []).length > 0 && (
        <Card
          title="Trener czeka na decyzję"
          subtitle={`${(coachProposals ?? []).length} ${
            (coachProposals ?? []).length === 1 ? "propozycja" : "propozycje"
          } do zatwierdzenia lub odrzucenia`}
          action={
            <Link href="/trener" className="text-[13px] font-medium text-accent">
              Zobacz
            </Link>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {(coachProposals ?? []).map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-[14px]">
                <span aria-hidden>{p.kind === "diet_kcal" ? "🍽️" : p.kind === "training" ? "🏋️" : "👁️"}</span>
                <span className="min-w-0 flex-1">{p.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --- Health Score --- */}
      {health && <HealthCard result={health} previous={prevHealth?.total ?? null} />}

      {/* --- Wygląd --- */}
      <Card
        title="Wygląd"
        action={
          ostatniSkan ? <Chip tone="accent">{ostatniSkan.ocena_ogolna} / 100</Chip> : null
        }
      >
        {ostatniSkan ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              Ostatni skan {humanDate(String(ostatniSkan.utworzono).slice(0, 10))}
            </p>
            <Link href="/wyglad">
              <Button variant="secondary">Otwórz</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">
              Skan twarzy pokazuje, co da się poprawić pielęgnacją, postawą i snem - i co z tego
              faktycznie się zmienia.
            </p>
            <Link href="/wyglad">
              <Button variant="secondary" block>
                Zrób pierwszy skan
              </Button>
            </Link>
          </div>
        )}
      </Card>

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

      {/* --- Przepis dnia --- */}
      {przepisDnia && (
        <Card
          title="Przepis dnia"
          subtitle={[czas(przepisDnia.czas_min), przepisDnia.poziom && POZIOM_LABEL[przepisDnia.poziom]]
            .filter(Boolean)
            .join(" · ")}
          action={
            <Link href="/dieta/dania" className="text-[13px] font-medium text-accent">
              Katalog
            </Link>
          }
        >
          <Link
            href={`/dieta/dania?przepis=${przepisDnia.recipe_id}`}
            className="flex items-center gap-3"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl">
              {przepisDnia.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight">
                {przepisDnia.name}
              </span>
              <span className="tabular block text-[12px] text-muted">
                {num(porcjaDnia!.kcal, 0)} kcal w porcji · {num(porcjaDnia!.bialko, 0)} g białka
                {udzialDnia != null ? ` · ${Math.round(udzialDnia * 100)}% dziennego celu` : ""}
              </span>
            </span>
            <span className="text-faint" aria-hidden>
              ›
            </span>
          </Link>
        </Card>
      )}

      {/* --- Sen --- */}
      <Card
        title="Sen"
        subtitle={sleptToday ? "Dzisiejsza noc" : "Ostatnia zapisana noc"}
        action={
          <Link href="/sen" className="text-[13px] font-medium text-accent">
            {sleptToday ? "Szczegóły" : "Zapisz"}
          </Link>
        }
      >
        {lastNight ? (
          <div className="flex items-center gap-3">
            <span
              className="tabular flex size-12 shrink-0 items-center justify-center rounded-xl text-[17px] font-bold"
              style={{
                background: `${sleepBand(lastNight.score).color}22`,
                color: sleepBand(lastNight.score).color,
              }}
            >
              {lastNight.score}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">
                {sleepDuration(lastNight.night.sleep_min)}
              </p>
              <p className="text-[13px] text-muted">
                {lastNight.night.bedtime.slice(0, 5)} → {lastNight.night.wake_time.slice(0, 5)} ·{" "}
                {sleepBand(lastNight.score).label}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            Zapisz, o której się położyłeś i o której wstałeś - to dwa tapnięcia,
            a daje najcięższy filar Health Score.
          </p>
        )}
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
            <Stat label="Średnio kcal" value={summary.avg_kcal || "-"} />
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
