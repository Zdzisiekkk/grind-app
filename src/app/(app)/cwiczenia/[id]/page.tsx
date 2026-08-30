import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip, EmptyState, Stat } from "@/components/ui";
import { ExerciseHistoryChart } from "@/components/ExerciseHistoryChart";
import { formatSet } from "@/components/training/formatSet";
import { createClient } from "@/lib/supabase/server";
import { METRIC_FIELDS } from "@/lib/constants";
import { e1rm, humanDate, num, sets as setsLabel } from "@/lib/format";
import type { CatalogExercise, WorkoutLog } from "@/lib/database.types";
import type { StrengthPoint } from "@/components/charts/Charts";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("exercise_catalog").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Ćwiczenie" };
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercise } = await supabase
    .from("exercise_catalog")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!exercise) notFound();
  const ex = exercise as CatalogExercise;

  const { data: logRows } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("catalog_exercise_id", id)
    .eq("is_warmup", false)
    .order("date", { ascending: false })
    .order("set_number")
    .limit(300);

  const logs = (logRows ?? []) as WorkoutLog[];

  // Najcięższa seria z każdego dnia - to samo, co pokazuje wykres w Postępach.
  const byDate = new Map<string, StrengthPoint>();
  for (const log of logs) {
    const weight = log.weight_kg ?? 0;
    const current = byDate.get(log.date);
    const estimated = e1rm(weight, log.reps ?? 0);
    if (!current || weight > (current.weight ?? 0)) {
      byDate.set(log.date, {
        date: log.date,
        weight,
        reps: log.reps,
        e1rm: Math.max(estimated, current?.e1rm ?? 0),
      });
    }
  }
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const best = logs.reduce<WorkoutLog | null>(
    (top, log) => ((log.weight_kg ?? 0) > (top?.weight_kg ?? 0) ? log : top),
    null,
  );

  // Ostatnie trzy dni treningowe z tym ćwiczeniem
  const recentDates = [...new Set(logs.map((l) => l.date))].slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/cwiczenia" className="text-[13px] font-medium text-accent">
        ← Katalog
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-tight">{ex.name}</h1>
        {ex.name_en && ex.name_en !== ex.name && (
          <p className="text-[13px] text-faint">{ex.name_en}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {ex.muscle_group && <Chip tone="accent">{ex.muscle_group}</Chip>}
          {ex.equipment.map((e) => (
            <Chip key={e}>{e}</Chip>
          ))}
          <Chip tone="info">{METRIC_FIELDS[ex.metric].hint}</Chip>
        </div>
      </header>

      {ex.image_url && (
        <figure className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface-2">
          {/*
            Kadr o stałych proporcjach rezerwuje miejsce, zanim zdjęcie
            dojdzie. Ilustracje z wgera mają różne wymiary, więc nie podajemy
            ich w atrybutach - object-contain wpisuje każdą w to samo pole,
            bez przycinania i bez skoku układu.
          */}
          <div className="aspect-[4/3] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ex.image_url}
              alt={`Ilustracja: ${ex.name}`}
              className="size-full object-contain"
            />
          </div>
          {ex.license && (
            <figcaption className="px-3 py-2 text-[11px] text-faint">
              {ex.license_author ? `Autor: ${ex.license_author}. ` : ""}
              Licencja: {ex.license}
              {ex.license_url && (
                <>
                  {" · "}
                  <a href={ex.license_url} target="_blank" rel="noreferrer" className="underline">
                    źródło
                  </a>
                </>
              )}
            </figcaption>
          )}
        </figure>
      )}

      {ex.description && (
        <Card title="Jak wykonać">
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{ex.description}</p>
        </Card>
      )}

      {ex.cues.length > 0 && (
        <Card title="Na co zwrócić uwagę">
          <ul className="flex flex-col gap-2">
            {ex.cues.map((cue) => (
              <li key={cue} className="flex gap-2 text-[14px]">
                <span aria-hidden className="text-success">
                  ✓
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {ex.mistakes.length > 0 && (
        <Card title="Typowe błędy">
          <ul className="flex flex-col gap-2">
            {ex.mistakes.map((mistake) => (
              <li key={mistake} className="flex gap-2 text-[14px]">
                <span aria-hidden className="text-danger">
                  ✕
                </span>
                <span>{mistake}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(ex.muscles.length > 0 || ex.muscles_secondary.length > 0) && (
        <Card title="Pracujące mięśnie">
          <div className="flex flex-col gap-2">
            {ex.muscles.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-faint">Główne</p>
                <div className="flex flex-wrap gap-1.5">
                  {ex.muscles.map((m) => (
                    <Chip key={m} tone="accent">
                      {m}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {ex.muscles_secondary.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-faint">
                  Pomocnicze
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ex.muscles_secondary.map((m) => (
                    <Chip key={m}>{m}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Twoja historia">
        {logs.length === 0 ? (
          <EmptyState
            icon="📈"
            title="Jeszcze tego nie robiłeś"
            description="Po pierwszym zapisanym treningu zobaczysz tu wykres i rekordy."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Rekord"
                value={best?.weight_kg ? `${num(best.weight_kg, 2)} kg` : "-"}
                sub={best?.reps ? `× ${best.reps}` : undefined}
                tone="accent"
              />
              <Stat label="Łącznie" value={setsLabel(logs.length)} />
            </div>

            <ExerciseHistoryChart data={points} />

            <div className="flex flex-col gap-2">
              {recentDates.map((date) => {
                const daySets = logs.filter((l) => l.date === date).sort((a, b) => a.set_number - b.set_number);
                return (
                  <div key={date} className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="text-[12px] font-medium text-faint">{humanDate(date)}</p>
                    <p className="tabular text-[14px]">
                      {daySets.map((s) => formatSet(s, ex.metric)).join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
