import Link from "next/link";
import { Card, Chip, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_ICON, ACTIVITY_LABEL } from "@/lib/constants";
import { painStatus } from "@/lib/viz";
import { duration, longDate, monthName, num, todayISO } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export const metadata = { title: "Kalendarz" };

const WEEKDAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Wszystkie dni miesiąca + puste pola na początku, żeby siatka zaczynała się w poniedziałek. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];
}

export default async function KalendarzPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d! : todayISO();
  const [year, month] = selected.split("-").map(Number);

  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [sessions, nutrition, activities, pain, weights, logs] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, date, day_label, duration_min, finished_at")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("v_daily_nutrition")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("pain_logs")
      .select("date, level, note, injury_id")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("v_daily_volume")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", selected)
      .maybeSingle(),
  ]);

  const sessionDates = new Set((sessions.data ?? []).map((s) => s.date));
  const activityDates = new Set((activities.data ?? []).map((a) => a.date));
  const foodDates = new Set((nutrition.data ?? []).map((n) => n.date));

  const daySessions = (sessions.data ?? []).filter((s) => s.date === selected);
  const dayActivities = (activities.data ?? []).filter((a) => a.date === selected);
  const dayNutrition = (nutrition.data ?? []).find((n) => n.date === selected);
  // Nazwy kontuzji dociągamy osobno - ręcznie pisane typy nie opisują relacji,
  // a jedno dodatkowe zapytanie jest tańsze niż walka ze złączeniem.
  const injuryNames = new Map(
    ((await supabase.from("injuries").select("id, name").eq("user_id", user.id)).data ?? []).map(
      (i) => [i.id, i.name],
    ),
  );
  const dayPain = (pain.data ?? []).filter((p) => p.date === selected);
  const dayWeight = (weights.data ?? []).find((w) => w.date === selected);
  const dayVolume = logs.data;

  const prevMonth = month === 1 ? `${year - 1}-12-01` : `${year}-${pad(month - 1)}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  const isEmpty =
    !daySessions.length && !dayActivities.length && !dayNutrition && !dayPain.length && !dayWeight;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Kalendarz</h1>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href={`/kalendarz?d=${prevMonth}`}
            aria-label="Poprzedni miesiąc"
            className="flex size-9 items-center justify-center rounded-lg bg-surface-2"
          >
            ‹
          </Link>
          <span className="text-[15px] font-semibold capitalize">{monthName(selected)}</span>
          <Link
            href={`/kalendarz?d=${nextMonth}`}
            aria-label="Następny miesiąc"
            className="flex size-9 items-center justify-center rounded-lg bg-surface-2"
          >
            ›
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="pb-1 text-[11px] font-medium text-faint">
              {w}
            </span>
          ))}

          {monthGrid(year, month).map((date, i) =>
            date === null ? (
              <span key={`empty-${i}`} />
            ) : (
              <Link
                key={date}
                href={`/kalendarz?d=${date}`}
                className={clsx(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-[13px]",
                  date === selected
                    ? "bg-accent font-bold text-[var(--accent-fg)]"
                    : date === todayISO()
                      ? "bg-surface-3 font-semibold"
                      : "bg-surface-2",
                )}
              >
                <span className="tabular">{Number(date.slice(-2))}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                  {sessionDates.has(date) && (
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                  {activityDates.has(date) && (
                    <span className="size-1.5 rounded-full bg-[var(--info)]" />
                  )}
                  {foodDates.has(date) && (
                    <span className="size-1.5 rounded-full bg-[var(--success)]" />
                  )}
                </span>
              </Link>
            ),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden /> trening
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--info)]" aria-hidden /> aktywność
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden /> dieta
          </span>
        </div>
      </Card>

      <Card title={<span className="capitalize">{longDate(selected)}</span>}>
        {isEmpty ? (
          <EmptyState icon="🗓️" title="Nic tego dnia" description="Brak treningu, posiłków i aktywności." />
        ) : (
          <div className="flex flex-col gap-4">
            {daySessions.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
                  Trening
                </h3>
                <ul className="flex flex-col gap-1">
                  {daySessions.map((s) => (
                    <li key={s.id}>
                      <Link href={`/trening/${s.id}`} className="flex items-center gap-2 text-[14px]">
                        <span aria-hidden>🏋️</span>
                        <span className="flex-1 truncate">{s.day_label ?? "Trening"}</span>
                        {!s.finished_at ? (
                          <Chip tone="accent">w trakcie</Chip>
                        ) : (
                          <span className="text-[13px] text-muted">{duration(s.duration_min)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {dayVolume && (
                  <p className="tabular mt-1 text-[12px] text-muted">
                    {dayVolume.sets} serii · {num(dayVolume.volume_kg, 0)} kg objętości
                  </p>
                )}
              </section>
            )}

            {dayNutrition && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
                  Dieta
                </h3>
                <Link href={`/dieta?d=${selected}`} className="tabular text-[14px]">
                  {num(dayNutrition.kcal, 0)} kcal · B {num(dayNutrition.protein_g, 0)} · W{" "}
                  {num(dayNutrition.carbs_g, 0)} · T {num(dayNutrition.fat_g, 0)}
                </Link>
              </section>
            )}

            {dayActivities.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
                  Aktywności
                </h3>
                <ul className="flex flex-col gap-1">
                  {dayActivities.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[14px]">
                      <span aria-hidden>{ACTIVITY_ICON[a.type]}</span>
                      <span className="flex-1 truncate">
                        {a.type === "other" && a.custom_type ? a.custom_type : ACTIVITY_LABEL[a.type]}
                      </span>
                      <span className="tabular text-[13px] text-muted">
                        {duration(a.duration_min)}
                        {a.distance_km ? ` · ${num(a.distance_km, 2)} km` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(dayPain.length > 0 || dayWeight) && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
                  Pomiary
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {dayWeight && <Chip>⚖️ {num(dayWeight.weight_kg, 1)} kg</Chip>}
                  {dayPain.map((p) => (
                    <Chip key={p.injury_id}>
                      <span aria-hidden style={{ color: painStatus(p.level).color }}>
                        {painStatus(p.level).icon}
                      </span>
                      {injuryNames.get(p.injury_id) ?? "Ból"} {p.level}/10 · {painStatus(p.level).label}
                    </Chip>
                  ))}
                </div>
                {dayPain.map((p) =>
                  p.note ? (
                    <p key={`${p.injury_id}-note`} className="mt-1 text-[12px] text-muted">
                      <span className="font-medium">{injuryNames.get(p.injury_id)}:</span> {p.note}
                    </p>
                  ) : null,
                )}
              </section>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
