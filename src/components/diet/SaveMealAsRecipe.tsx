"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Sheet } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { createClient } from "@/lib/supabase/client";
import { itemsFromEntries } from "@/lib/recipes";
import { num } from "@/lib/format";
import type { MealEntry } from "@/lib/database.types";

const ICONS = ["🍲", "🥣", "🍛", "🥗", "🍝", "🥪", "🍳", "🥤", "🍰", "🥩"] as const;

/**
 * "Zapisz jako moje danie" - zamienia to, co masz już wpisane, w przepis.
 *
 * To jest tańsza droga do własnego dania niż układanie go od zera: i tak
 * właśnie zważyłeś składniki, więc szkoda tej pracy. Ułożenie przepisu
 * ręcznie zostaje możliwe, ale rzadziej potrzebne.
 */
export function SaveMealAsRecipe({
  userId,
  mealLabel,
  entries,
}: {
  userId: string;
  mealLabel: string;
  entries: MealEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [servings, setServings] = useState<number | null>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalG = entries.reduce((sum, e) => sum + Number(e.grams), 0);
  const totalKcal = entries.reduce((sum, e) => sum + Number(e.kcal), 0);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        user_id: userId,
        name: name.trim(),
        icon,
        servings: servings && servings > 0 ? servings : 1,
      })
      .select("id")
      .single();

    if (recipeError) {
      setSaving(false);
      setError(
        recipeError.code === "23505"
          ? "Masz już danie o tej nazwie. Wybierz inną."
          : `Nie udało się zapisać: ${recipeError.message}`,
      );
      return;
    }

    const { error: itemsError } = await supabase.from("recipe_items").insert(
      itemsFromEntries(entries).map((item) => ({
        ...item,
        user_id: userId,
        recipe_id: recipe.id,
      })),
    );

    setSaving(false);
    if (itemsError) {
      setError(`Nie udało się zapisać składników: ${itemsError.message}`);
      return;
    }

    setOpen(false);
    setName("");
    router.refresh();
  }

  if (entries.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(mealLabel);
          setOpen(true);
        }}
        className="text-[13px] font-medium text-accent"
      >
        Zapisz jako danie
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Zapisz jako moje danie"
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            loading={saving}
            disabled={!name.trim()}
            onClick={save}
          >
            Zapisz danie
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Zapiszemy {entries.length}{" "}
            {entries.length === 1 ? "składnik" : "składników"} o łącznej wadze{" "}
            <span className="font-semibold text-text">{num(totalG, 0)} g</span> i{" "}
            <span className="font-semibold text-text">{num(totalKcal, 0)} kcal</span>. Następnym
            razem dodasz to jednym tapnięciem.
          </p>

          <Field label="Nazwa dania">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Owsianka moja"
              autoFocus
            />
          </Field>

          <Field label="Ikona">
            <div className="grid grid-cols-10 gap-1.5">
              {ICONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  aria-pressed={icon === option}
                  aria-label={`Ikona ${option}`}
                  className={
                    icon === option
                      ? "flex min-h-10 items-center justify-center rounded-xl bg-accent-soft text-[18px] ring-2 ring-accent"
                      : "flex min-h-10 items-center justify-center rounded-xl bg-surface-2 text-[18px]"
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Na ile porcji"
            hint="Ugotowałeś na trzy dni? Wpisz 3, a apka policzy jedną porcję."
          >
            <NumberStepper
              ariaLabel="Liczba porcji"
              value={servings}
              onChange={setServings}
              step={1}
              min={1}
              max={20}
            />
          </Field>

          {error && <Alert>{error}</Alert>}
        </div>
      </Sheet>
    </>
  );
}
