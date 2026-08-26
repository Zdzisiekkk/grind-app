"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Chip } from "@/components/ui";
import { MacroSummary } from "@/components/diet/MacroSummary";
import { AddFoodSheet } from "@/components/diet/AddFoodSheet";
import { WaterTracker } from "@/components/diet/WaterTracker";
import { DateNav } from "@/components/DateNav";
import type { MealEntry, MealType } from "@/lib/database.types";
import { MEAL_TYPES } from "@/lib/constants";
import { sumMacros } from "@/lib/diet";
import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/format";

export type EntryWithMeal = MealEntry & { meal_type: MealType };

export function DietScreen({
  userId,
  date,
  initialEntries,
  goals,
  water,
}: {
  userId: string;
  date: string;
  initialEntries: EntryWithMeal[];
  goals: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
  water: {
    entries: { id: string; ml: number; created_at: string }[];
    goalMl: number;
    portionMl: number;
  };
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [adding, setAdding] = useState<MealType | null>(null);

  const totals = useMemo(() => sumMacros(entries), [entries]);

  async function removeEntry(id: string) {
    const backup = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await createClient().from("meal_entries").delete().eq("id", id);
    if (error) setEntries(backup);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Dieta</h1>
        <DateNav date={date} basePath="/dieta" />
      </header>

      <Card>
        <MacroSummary totals={totals} goals={goals} />
      </Card>

      <WaterTracker
        userId={userId}
        date={date}
        entries={water.entries}
        goalMl={water.goalMl}
        portionMl={water.portionMl}
      />

      {MEAL_TYPES.map((meal) => {
        const mealEntries = entries.filter((e) => e.meal_type === meal.value);
        const mealTotals = sumMacros(mealEntries);

        return (
          <Card
            key={meal.value}
            padded={false}
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden>{meal.icon}</span>
                {meal.label}
              </span>
            }
            action={
              mealEntries.length ? (
                <Chip tone="neutral">{num(mealTotals.kcal, 0)} kcal</Chip>
              ) : null
            }
            className="overflow-hidden"
          >
            {mealEntries.length > 0 && (
              <ul className="divide-y divide-border border-t border-border">
                {mealEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{entry.food_name}</span>
                      <span className="tabular block text-[12px] text-muted">
                        {num(entry.grams, 0)} g · B {num(entry.protein, 1)} · W {num(entry.carbs, 1)} · T{" "}
                        {num(entry.fat, 1)}
                      </span>
                    </span>
                    <span className="tabular text-[14px] font-semibold">{num(entry.kcal, 0)}</span>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      aria-label={`Usuń ${entry.food_name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border p-3">
              <Button variant="secondary" block onClick={() => setAdding(meal.value)}>
                + Dodaj produkt
              </Button>
            </div>
          </Card>
        );
      })}

      {adding && (
        <AddFoodSheet
          open
          onClose={() => setAdding(null)}
          userId={userId}
          date={date}
          mealType={adding}
          onAdded={(entry) => {
            setEntries((prev) => [...prev, { ...entry, meal_type: adding }]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
