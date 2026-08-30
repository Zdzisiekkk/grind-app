"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import type { Activity, ActivityType } from "@/lib/database.types";
import { ACTIVITY_ICON, ACTIVITY_LABEL, ACTIVITY_MET, ACTIVITY_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { duration as fmtDuration, humanDate, num, todayISO } from "@/lib/format";

export function ActivitiesScreen({
  userId,
  initialActivities,
  bodyWeightKg,
}: {
  userId: string;
  initialActivities: Activity[];
  bodyWeightKg: number | null;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  async function remove(id: string) {
    const backup = activities;
    setActivities((prev) => prev.filter((a) => a.id !== id));
    const { error } = await createClient().from("activities").delete().eq("id", id);
    if (error) setActivities(backup);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Aktywności</h1>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + Dodaj
        </Button>
      </header>

      {activities.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏃"
            title="Brak aktywności"
            description="Bieganie, rower, pływanie, sparingi - wszystko, co robisz poza siłownią."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((a) => (
            <li key={a.id}>
              <Card padded={false}>
                <div className="flex items-center gap-3 p-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                    {ACTIVITY_ICON[a.type]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(a);
                      setOpen(true);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[15px] font-semibold leading-tight">
                      {a.type === "other" && a.custom_type ? a.custom_type : ACTIVITY_LABEL[a.type]}
                    </span>
                    <span className="tabular mt-0.5 block truncate text-[12px] text-muted">
                      {humanDate(a.date)}
                      {a.duration_min ? ` · ${fmtDuration(a.duration_min)}` : ""}
                      {a.distance_km ? ` · ${num(a.distance_km, 2)} km` : ""}
                      {a.kcal ? ` · ${a.kcal} kcal` : ""}
                    </span>
                    {a.notes && <span className="mt-1 block truncate text-[12px] text-faint">{a.notes}</span>}
                  </button>
                  {a.source === "strava" && <Chip tone="accent">Strava</Chip>}
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    aria-label="Usuń aktywność"
                    className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edytuj aktywność" : "Nowa aktywność"}
      >
        <ActivityForm
          userId={userId}
          activity={editing}
          bodyWeightKg={bodyWeightKg}
          onSaved={(saved) => {
            setActivities((prev) => {
              const without = prev.filter((a) => a.id !== saved.id);
              return [saved, ...without].sort((a, b) => b.date.localeCompare(a.date));
            });
            setOpen(false);
            router.refresh();
          }}
        />
      </Sheet>
    </div>
  );
}

function ActivityForm({
  userId,
  activity,
  bodyWeightKg,
  onSaved,
}: {
  userId: string;
  activity: Activity | null;
  bodyWeightKg: number | null;
  onSaved: (activity: Activity) => void;
}) {
  const [type, setType] = useState<ActivityType>(activity?.type ?? "running");
  const [customType, setCustomType] = useState(activity?.custom_type ?? "");
  const [date, setDate] = useState(activity?.date ?? todayISO());
  const [durationMin, setDurationMin] = useState(activity?.duration_min?.toString() ?? "");
  const [distanceKm, setDistanceKm] = useState(activity?.distance_km?.toString() ?? "");
  const [kcal, setKcal] = useState(activity?.kcal?.toString() ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = ACTIVITY_TYPES.find((t) => t.value === type);

  /** Szacunek z MET i masy ciała: kcal ≈ MET × kg × godziny. */
  const estimate = (() => {
    const minutes = Number(durationMin);
    if (!bodyWeightKg || !minutes) return null;
    return Math.round(ACTIVITY_MET[type] * bodyWeightKg * (minutes / 60));
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      user_id: userId,
      type,
      custom_type: type === "other" ? customType.trim() || null : null,
      date,
      duration_min: durationMin ? Number(durationMin) : null,
      distance_km: distanceKm ? Number(distanceKm.replace(",", ".")) : null,
      kcal: kcal ? Number(kcal) : estimate,
      notes: notes.trim() || null,
      source: "manual" as const,
    };

    const query = activity
      ? supabase.from("activities").update(payload).eq("id", activity.id).select().single()
      : supabase.from("activities").insert(payload).select().single();

    const { data, error } = await query;
    setSaving(false);

    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    onSaved(data as Activity);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Rodzaj">
        <Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </Select>
      </Field>

      {type === "other" && (
        <Field label="Nazwa aktywności">
          <Input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="np. wspinaczka na ściance"
          />
        </Field>
      )}

      <Field label="Data">
        <Input type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Czas (min)">
          <Input inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="45" />
        </Field>
        {meta?.hasDistance && (
          <Field label="Dystans (km)">
            <Input inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="8,5" />
          </Field>
        )}
      </div>

      <Field
        label="Kalorie"
        hint={
          estimate
            ? `Puste pole = zapiszemy szacunek ${estimate} kcal (MET ${ACTIVITY_MET[type]} × ${num(bodyWeightKg, 1)} kg).`
            : "Dodaj wagę ciała w profilu, żeby apka sama szacowała kalorie."
        }
      >
        <Input
          inputMode="numeric"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder={estimate ? String(estimate) : "np. 450"}
        />
      </Field>

      <Field label="Notatki">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Jak poszło?" />
      </Field>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" variant="primary" size="lg" block loading={saving}>
        {activity ? "Zapisz zmiany" : "Dodaj aktywność"}
      </Button>
    </form>
  );
}
