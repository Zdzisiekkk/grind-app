"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet, Spinner, Textarea } from "@/components/ui";
import type { CatalogExercise } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";

export function CatalogScreen({
  userId,
  muscleGroups,
  initialItems,
}: {
  userId: string;
  muscleGroups: string[];
  initialItems: CatalogExercise[];
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();

      let request = supabase.from("exercise_catalog").select("*").order("name").limit(100);
      const q = query.trim();
      if (q) request = request.or(`name.ilike.%${q}%,name_en.ilike.%${q}%`);
      if (muscle) request = request.eq("muscle_group", muscle);
      if (onlyMine) request = request.eq("user_id", userId);

      const { data } = await request;
      if (!cancelled) {
        setItems((data ?? []) as CatalogExercise[]);
        setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, muscle, onlyMine, userId]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Katalog ćwiczeń</h1>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          + Własne
        </Button>
      </header>

      <div className="flex flex-col gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj ćwiczenia…"
        />
        <div className="flex gap-2">
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value)} className="flex-1">
            <option value="">Wszystkie partie</option>
            {muscleGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            className={clsx(
              "min-h-11 shrink-0 rounded-xl px-3 text-[13px] font-semibold",
              onlyMine ? "bg-accent text-[var(--accent-fg)]" : "bg-surface-2 text-muted",
            )}
          >
            Moje
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔍"
            title="Nic nie znaleziono"
            description="Zmień filtry albo dodaj własne ćwiczenie."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((ex) => (
            <li key={ex.id}>
              <Link
                href={`/cwiczenia/${ex.id}`}
                className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-surface p-3"
              >
                {ex.image_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.image_thumb_url}
                    alt=""
                    loading="lazy"
                    className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover"
                  />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                    🏋️
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight">
                    {ex.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {[ex.muscle_group, ex.equipment.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {ex.user_id && <Chip>moje</Chip>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Własne ćwiczenie">
        <CustomExerciseForm
          userId={userId}
          onCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setAddOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function CustomExerciseForm({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (exercise: CatalogExercise) => void;
}) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<CatalogExercise["metric"]>("weight_reps");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data, error } = await createClient()
      .from("exercise_catalog")
      .insert({
        user_id: userId,
        source: "user",
        name: name.trim(),
        muscle_group: muscleGroup.trim() || null,
        equipment: equipment
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        description: description.trim() || null,
        metric,
      })
      .select()
      .single();

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated(data as CatalogExercise);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Nazwa">
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Partia mięśniowa">
        <Input value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="np. Plecy" />
      </Field>
      <Field label="Sprzęt" hint="po przecinku">
        <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="hantle, ławka" />
      </Field>
      <Field label="Jak zapisujesz wynik">
        <Select value={metric} onChange={(e) => setMetric(e.target.value as CatalogExercise["metric"])}>
          <option value="weight_reps">ciężar × powtórzenia</option>
          <option value="reps">powtórzenia</option>
          <option value="time">czas</option>
          <option value="distance">ciężar i dystans</option>
          <option value="rounds">rundy</option>
        </Select>
      </Field>
      <Field label="Opis techniki">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" block loading={saving}>
        Dodaj do katalogu
      </Button>
    </form>
  );
}
