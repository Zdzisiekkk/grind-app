"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Sheet,
  Stat,
} from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { createClient } from "@/lib/supabase/client";
import { portionGrams } from "@/lib/recipes";
import { num } from "@/lib/format";
import type { Food, RecipeItem, RecipeTotals } from "@/lib/database.types";

/**
 * Zarządzanie własnymi daniami.
 *
 * Większość przepisów powstaje w dzienniku („zapisz jako danie"), bo tam
 * składniki są już zważone. Ten ekran jest do poprawek i do ułożenia czegoś
 * od zera — dlatego wygląda jak lista do edycji, a nie jak kreator.
 */
export function RecipesScreen({
  userId,
  recipes,
  items,
}: {
  userId: string;
  recipes: RecipeTotals[];
  /** Składniki wszystkich przepisów, pogrupowane po stronie serwera. */
  items: Record<string, RecipeItem[]>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState<RecipeTotals | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createRecipe() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase
      .from("recipes")
      .insert({ user_id: userId, name: newName.trim() });

    setBusy(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Masz już danie o tej nazwie."
          : `Nie udało się utworzyć: ${error.message}`,
      );
      return;
    }
    setCreating(false);
    setNewName("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Moje dania</h1>
          <p className="text-[13px] text-muted">
            Rzeczy, które gotujesz regularnie — dodawane jednym tapnięciem.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Danie
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {recipes.length === 0 ? (
        <Card>
          <EmptyState
            icon="🍲"
            title="Nie masz jeszcze własnych dań"
            description="Najprościej: wpisz posiłek w dzienniku, a potem kliknij przy nim „Zapisz jako danie”. Składniki są już wtedy zważone."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Ułóż od zera
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {recipes.map((recipe) => {
            const portion = portionGrams(recipe);
            return (
              <Card key={recipe.recipe_id}>
                <button
                  type="button"
                  onClick={() => setOpen(recipe)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                    {recipe.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold leading-tight">
                      {recipe.name}
                    </span>
                    <span className="tabular block text-[12px] text-muted">
                      {recipe.items} składników · {num(recipe.total_g, 0)} g ·{" "}
                      {num(recipe.kcal, 0)} kcal
                      {portion && Number(recipe.servings) > 1
                        ? ` · porcja ${portion} g`
                        : ""}
                    </span>
                  </span>
                  <span className="text-faint" aria-hidden>
                    ›
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <RecipeSheet
        recipe={open}
        items={open ? (items[open.recipe_id] ?? []) : []}
        userId={userId}
        onClose={() => setOpen(null)}
        onChanged={() => router.refresh()}
      />

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Nowe danie"
        footer={
          <Button
            variant="primary"
            size="lg"
            block
            loading={busy}
            disabled={!newName.trim()}
            onClick={createRecipe}
          >
            Utwórz
          </Button>
        }
      >
        <Field label="Nazwa" hint="Składniki dodasz w następnym kroku.">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="np. Owsianka moja"
            autoFocus
          />
        </Field>
      </Sheet>
    </div>
  );
}

/* ------------------------------ Edycja dania ------------------------------- */

function RecipeSheet({
  recipe,
  items,
  userId,
  onClose,
  onChanged,
}: {
  recipe: RecipeTotals | null;
  items: RecipeItem[];
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const [servings, setServings] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(phrase: string) {
    setQuery(phrase);
    if (phrase.trim().length < 2) {
      setFound([]);
      return;
    }
    const { data } = await supabase.rpc("szukaj_produktow", {
      p_fraza: phrase.trim(),
      p_limit: 15,
    });
    setFound((data ?? []) as Food[]);
  }

  async function addItem() {
    if (!recipe || !picked || !grams) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.from("recipe_items").insert({
      user_id: userId,
      recipe_id: recipe.recipe_id,
      food_id: picked.id,
      name: picked.name,
      grams,
      kcal_100g: picked.kcal_100g,
      protein_100g: picked.protein_100g,
      carbs_100g: picked.carbs_100g,
      fat_100g: picked.fat_100g,
      order_index: items.length,
    });

    setBusy(false);
    if (error) {
      setError(`Nie udało się dodać: ${error.message}`);
      return;
    }
    setPicked(null);
    setQuery("");
    setFound([]);
    setGrams(100);
    onChanged();
  }

  async function removeItem(id: string) {
    await supabase.from("recipe_items").delete().eq("id", id);
    onChanged();
  }

  async function saveServings() {
    if (!recipe || !servings) return;
    await supabase.from("recipes").update({ servings }).eq("id", recipe.recipe_id);
    setServings(null);
    onChanged();
  }

  async function removeRecipe() {
    if (!recipe) return;
    if (!confirm(`Usunąć danie „${recipe.name}"? Wpisy w dzienniku zostaną.`)) return;
    await supabase.from("recipes").delete().eq("id", recipe.recipe_id);
    onClose();
    onChanged();
  }

  const portion = recipe ? portionGrams(recipe) : null;

  return (
    <Sheet open={Boolean(recipe)} onClose={onClose} title={recipe?.name ?? ""}>
      {recipe && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Całość" value={`${num(recipe.total_g, 0)} g`} sub={`${num(recipe.kcal, 0)} kcal`} />
            <Stat
              label="Jedna porcja"
              value={portion ? `${portion} g` : "–"}
              sub={
                portion
                  ? `${num((Number(recipe.kcal) / Number(recipe.servings)) || 0, 0)} kcal`
                  : "dodaj składniki"
              }
              tone="accent"
            />
          </div>

          <p className="tabular text-[12px] text-muted">
            Na 100 g: {num(recipe.kcal_100g, 0)} kcal · B {num(recipe.protein_100g, 1)} · W{" "}
            {num(recipe.carbs_100g, 1)} · T {num(recipe.fat_100g, 1)}
          </p>

          {error && <Alert>{error}</Alert>}

          {/* --- Składniki --- */}
          <Card title="Składniki" padded={false}>
            {items.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-muted">
                Pusto. Dodaj pierwszy składnik poniżej.
              </p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{item.name}</span>
                      <span className="tabular block text-[12px] text-muted">
                        {num(item.grams, 0)} g ·{" "}
                        {num((Number(item.grams) * Number(item.kcal_100g)) / 100, 0)} kcal
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Usuń ${item.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* --- Dodawanie składnika --- */}
          <Card title="Dodaj składnik">
            <div className="flex flex-col gap-3">
              {picked ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {picked.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicked(null)}
                      className="text-[13px] text-accent"
                    >
                      zmień
                    </button>
                  </div>
                  <NumberStepper
                    ariaLabel="Gramatura składnika"
                    value={grams}
                    onChange={setGrams}
                    step={10}
                    min={1}
                    max={5000}
                    suffix="g"
                  />
                  <Button variant="primary" block loading={busy} onClick={addItem}>
                    Dodaj do dania
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    placeholder="Szukaj produktu…"
                    aria-label="Szukaj produktu do dania"
                  />
                  {found.length > 0 && (
                    <ul className="flex flex-col divide-y divide-border">
                      {found.map((food) => (
                        <li key={food.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPicked(food);
                              setGrams(food.serving_size_g ?? 100);
                            }}
                            className="flex w-full items-center gap-2 py-2 text-left"
                          >
                            <span className="min-w-0 flex-1 truncate text-[14px]">{food.name}</span>
                            <span className="tabular shrink-0 text-[12px] text-muted">
                              {num(food.kcal_100g, 0)} kcal
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-faint">
                    Szukamy wśród produktów, których już używałeś, i wśród gotowych dań. Nowy
                    produkt dodasz z dziennika.
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* --- Porcje --- */}
          <Card title="Na ile porcji" subtitle={`Teraz: ${num(recipe.servings, 0)}`}>
            <div className="flex flex-col gap-3">
              <NumberStepper
                ariaLabel="Liczba porcji"
                value={servings ?? Number(recipe.servings)}
                onChange={setServings}
                step={1}
                min={1}
                max={20}
              />
              {servings != null && servings !== Number(recipe.servings) && (
                <Button variant="secondary" block onClick={saveServings}>
                  Zapisz zmianę
                </Button>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Chip>{recipe.items} składników</Chip>
            <Button variant="danger" onClick={removeRecipe}>
              Usuń danie
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
