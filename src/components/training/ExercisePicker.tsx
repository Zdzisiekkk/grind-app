"use client";

import { useEffect, useState } from "react";
import { EmptyState, Input, Spinner } from "@/components/ui";
import type { CatalogExercise } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

/** Wyszukiwarka po katalogu ćwiczeń — globalnym i własnym. */
export function ExercisePicker({ onPick }: { onPick: (exercise: CatalogExercise) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      let request = supabase.from("exercise_catalog").select("*").order("name").limit(40);
      const q = query.trim();
      if (q) request = request.or(`name.ilike.%${q}%,name_en.ilike.%${q}%,muscle_group.ilike.%${q}%`);

      const { data } = await request;
      if (!cancelled) {
        setResults((data ?? []) as CatalogExercise[]);
        setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj ćwiczenia…"
      />

      {loading ? (
        <div className="flex justify-center py-8 text-muted">
          <Spinner />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nic nie znaleziono"
          description="Spróbuj innej nazwy albo dodaj własne ćwiczenie w katalogu."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onPick(ex)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
              >
                {ex.image_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ex.image_thumb_url}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-lg bg-surface-2 object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    🏋️
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{ex.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {[ex.muscle_group, ex.equipment.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
