"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Chip, EmptyState, Field, Input, SegmentedControl, Sheet, Spinner } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { BarcodeSheet } from "@/components/diet/BarcodeSheet";
import { addMealEntry, cacheOffProduct, ensureMeal } from "@/lib/diet";
import type { Food, MealEntry, MealType, RecipeTotals } from "@/lib/database.types";
import { portionGrams, recipeAsFood } from "@/lib/recipes";
import type { OffProduct } from "@/lib/off";
import { MEAL_LABEL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/format";

/** Poniżej dwóch znaków nie ma sensu pytać Open Food Facts. */
const MIN_QUERY = 2;
const EMPTY_OFF: OffProduct[] = [];

type Candidate =
  | { kind: "food"; food: Food }
  | { kind: "off"; product: OffProduct };

function candidateName(c: Candidate) {
  return c.kind === "food" ? c.food.name : c.product.name;
}
function candidateBrand(c: Candidate) {
  return c.kind === "food" ? c.food.brand : c.product.brand;
}
function candidateMacros(c: Candidate) {
  const s = c.kind === "food" ? c.food : c.product;
  return {
    kcal_100g: Number(s.kcal_100g),
    protein_100g: Number(s.protein_100g),
    carbs_100g: Number(s.carbs_100g),
    fat_100g: Number(s.fat_100g),
    serving_size_g: s.serving_size_g ? Number(s.serving_size_g) : null,
    serving_label: s.serving_label,
    image: c.kind === "food" ? c.food.image_url : c.product.image_url,
  };
}

export function AddFoodSheet({
  open,
  onClose,
  userId,
  date,
  mealType,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  date: string;
  mealType: MealType;
  onAdded: (entry: MealEntry) => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"search" | "dishes" | "custom">("search");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState<Food[]>([]);
  const [offRaw, setOffRaw] = useState<OffProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dishes, setDishes] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<RecipeTotals[]>([]);
  const [skanerOtwarty, setSkanerOtwarty] = useState(false);

  /*
   * Gotowe dania.
   *
   * Open Food Facts to baza produktów z kodem kreskowym — nie ma w niej
   * schabowego ani rosołu, a to jest to, co ludzie jedzą na obiad. Dlatego
   * osobna, kuratorowana lista, którą da się przejrzeć bez wpisywania.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("foods")
        .select("*")
        .eq("kind", "dish")
        .is("user_id", null)
        .order("name")
        .limit(200);
      if (!cancelled) setDishes((data ?? []) as Food[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Własne dania — te wracają codziennie, więc idą na samą górę zakładki.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("v_recipe_totals")
        .select("*")
        .gt("items", 0)
        .order("name");
      if (!cancelled) setRecipes((data ?? []) as RecipeTotals[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Lokalne produkty (własne + wcześniej zapisany cache OFF) — szybkie, działa od razu.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let req = supabase.from("foods").select("*").order("updated_at", { ascending: false }).limit(25);
      if (query.trim()) req = req.ilike("name", `%${query.trim()}%`);
      const { data } = await req;
      if (!cancelled) setMine((data ?? []) as Food[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query, supabase]);

  // Open Food Facts — z opóźnieniem, żeby nie strzelać przy każdej literze.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < MIN_QUERY) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (cancelled) return;
        setOffRaw(json.results ?? []);
        setOffError(json.error ?? null);
      } catch {
        if (!cancelled) setOffError("Brak połączenia z bazą produktów.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open]);

  // Wyniki należą do ostatniego zapytania — przy zbyt krótkiej frazie po prostu
  // ich nie pokazujemy, zamiast czyścić stan efektem.
  const offResults = query.trim().length < MIN_QUERY ? EMPTY_OFF : offRaw;

  const knownOffIds = useMemo(() => new Set(mine.map((f) => f.off_id).filter(Boolean)), [mine]);
  const freshOff = offResults.filter((p) => !knownOffIds.has(p.off_id));

  return (
    <Sheet open={open} onClose={onClose} title={`Dodaj do: ${MEAL_LABEL[mealType]}`}>
      {picked ? (
        <PortionStep
          candidate={picked}
          onBack={() => setPicked(null)}
          onConfirm={async (grams) => {
            setError(null);
            try {
              const food =
                picked.kind === "food" ? picked.food : await cacheOffProduct(supabase, picked.product);
              const mealId = await ensureMeal(supabase, userId, date, mealType);
              const entry = await addMealEntry(supabase, { userId, mealId, food, grams });
              onAdded(entry as MealEntry);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          error={error}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "search", label: "Szukaj" },
              { value: "dishes", label: "Dania" },
              { value: "custom", label: "Własne" },
            ]}
          />

          {tab === "dishes" ? (
            <DishList
              dishes={dishes}
              recipes={recipes}
              query={query}
              onQuery={setQuery}
              onPick={(food) => setPicked({ kind: "food", food })}
            />
          ) : tab === "custom" ? (
            <CustomFoodForm
              userId={userId}
              onCreated={(food) => setPicked({ kind: "food", food })}
            />
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="np. twaróg, ryż, pierś z kurczaka…"
                />
                {/*
                  Kod kreskowy obok wyszukiwarki, a nie w osobnej zakładce.
                  Przy produkcie z opakowania to jest szybsza droga do tego
                  samego celu, więc ma być widoczna dokładnie tam, gdzie
                  człowiek i tak zaczyna szukać.
                */}
                <Button
                  variant="secondary"
                  onClick={() => setSkanerOtwarty(true)}
                  aria-label="Skanuj kod kreskowy"
                >
                  Kod
                </Button>
              </div>

              {mine.length > 0 && (
                <section>
                  <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-faint">
                    {query.trim() ? "Moje produkty" : "Ostatnio używane"}
                  </h3>
                  <ul className="flex flex-col">
                    {mine.map((food) => (
                      <FoodRow
                        key={food.id}
                        candidate={{ kind: "food", food }}
                        onPick={setPicked}
                        badge={food.source === "custom" ? "własny" : undefined}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {searching && (
                <div className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted">
                  <Spinner /> szukam w Open Food Facts…
                </div>
              )}

              {offError && <Alert tone="warn">{offError}</Alert>}

              {freshOff.length > 0 && (
                <section>
                  <h3 className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-faint">
                    Open Food Facts
                  </h3>
                  <ul className="flex flex-col">
                    {freshOff.map((product) => (
                      <FoodRow
                        key={product.off_id}
                        candidate={{ kind: "off", product }}
                        onPick={setPicked}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {!searching && query.trim().length >= 2 && !freshOff.length && !mine.length && (
                <EmptyState
                  icon="🔍"
                  title="Nie znaleziono produktu"
                  description="Dodaj go ręcznie w zakładce „Własny produkt” — zostanie u Ciebie na stałe."
                />
              )}
            </>
          )}
        </div>
      )}

      <BarcodeSheet
        key={skanerOtwarty ? "skaner-otwarty" : "skaner-zamkniety"}
        open={skanerOtwarty}
        onClose={() => setSkanerOtwarty(false)}
        onZnaleziono={(co) => {
          setPicked(co);
          setSkanerOtwarty(false);
        }}
      />
    </Sheet>
  );
}

function FoodRow({
  candidate,
  onPick,
  badge,
}: {
  candidate: Candidate;
  onPick: (c: Candidate) => void;
  badge?: string;
}) {
  const m = candidateMacros(candidate);
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(candidate)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2"
      >
        {m.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.image}
            alt=""
            loading="lazy"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg bg-surface-2 object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">🍎</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{candidateName(candidate)}</span>
          <span className="tabular block truncate text-[12px] text-muted">
            {candidateBrand(candidate) ? `${candidateBrand(candidate)} · ` : ""}
            {num(m.kcal_100g, 0)} kcal · B {num(m.protein_100g, 1)} · W {num(m.carbs_100g, 1)} · T{" "}
            {num(m.fat_100g, 1)} / 100 g
          </span>
        </span>
        {badge && <Chip>{badge}</Chip>}
      </button>
    </li>
  );
}

function PortionStep({
  candidate,
  onBack,
  onConfirm,
  error,
}: {
  candidate: Candidate;
  onBack: () => void;
  onConfirm: (grams: number) => Promise<void>;
  error: string | null;
}) {
  const m = candidateMacros(candidate);
  const [grams, setGrams] = useState<number | null>(m.serving_size_g ?? 100);
  const [saving, setSaving] = useState(false);

  const factor = (grams ?? 0) / 100;
  const quick = [
    ...(m.serving_size_g
      ? [{ label: `${m.serving_label ?? "porcja"} (${num(m.serving_size_g, 0)} g)`, value: m.serving_size_g }]
      : []),
    { label: "50 g", value: 50 },
    { label: "100 g", value: 100 },
    { label: "150 g", value: 150 },
    { label: "200 g", value: 200 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-[13px] font-medium text-accent">
        ← inny produkt
      </button>

      <div>
        <h3 className="text-[16px] font-semibold leading-tight">{candidateName(candidate)}</h3>
        {candidateBrand(candidate) && (
          <p className="text-[13px] text-muted">{candidateBrand(candidate)}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setGrams(q.value)}
            className="min-h-9 rounded-lg bg-surface-2 px-3 text-[13px] font-semibold text-muted"
          >
            {q.label}
          </button>
        ))}
      </div>

      <Field label="Gramatura">
        <NumberStepper
          ariaLabel="Gramatura"
          value={grams}
          onChange={setGrams}
          step={10}
          max={20000}
          suffix="g"
          size="lg"
        />
      </Field>

      <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
        {[
          { label: "kcal", value: m.kcal_100g * factor, decimals: 0 },
          { label: "białko", value: m.protein_100g * factor, decimals: 1 },
          { label: "węgle", value: m.carbs_100g * factor, decimals: 1 },
          { label: "tłuszcz", value: m.fat_100g * factor, decimals: 1 },
        ].map((s) => (
          <div key={s.label}>
            <div className="tabular text-[17px] font-bold">{num(s.value, s.decimals)}</div>
            <div className="text-[11px] text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      <Button
        variant="primary"
        size="lg"
        block
        loading={saving}
        disabled={!grams}
        onClick={async () => {
          if (!grams) return;
          setSaving(true);
          await onConfirm(grams);
          setSaving(false);
        }}
      >
        Dodaj do posiłku
      </Button>
    </div>
  );
}

function CustomFoodForm({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (food: Food) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    serving: "",
    servingLabel: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const numOr = (v: string, fallback = 0) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("foods")
      .insert({
        user_id: userId,
        source: "custom",
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        kcal_100g: numOr(form.kcal),
        protein_100g: numOr(form.protein),
        carbs_100g: numOr(form.carbs),
        fat_100g: numOr(form.fat),
        serving_size_g: form.serving ? numOr(form.serving) : null,
        serving_label: form.servingLabel.trim() || null,
      })
      .select()
      .single();

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    onCreated(data as Food);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Nazwa">
        <Input required value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="np. Owsianka babci" />
      </Field>
      <Field label="Marka (opcjonalnie)">
        <Input value={form.brand} onChange={(e) => upd({ brand: e.target.value })} />
      </Field>

      <p className="text-[12px] font-medium text-faint">Wartości na 100 g</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="kcal">
          <Input required inputMode="decimal" value={form.kcal} onChange={(e) => upd({ kcal: e.target.value })} />
        </Field>
        <Field label="Białko (g)">
          <Input inputMode="decimal" value={form.protein} onChange={(e) => upd({ protein: e.target.value })} />
        </Field>
        <Field label="Węglowodany (g)">
          <Input inputMode="decimal" value={form.carbs} onChange={(e) => upd({ carbs: e.target.value })} />
        </Field>
        <Field label="Tłuszcz (g)">
          <Input inputMode="decimal" value={form.fat} onChange={(e) => upd({ fat: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Porcja (g)" hint="np. 30">
          <Input inputMode="decimal" value={form.serving} onChange={(e) => upd({ serving: e.target.value })} />
        </Field>
        <Field label="Nazwa porcji" hint="np. łyżka">
          <Input value={form.servingLabel} onChange={(e) => upd({ servingLabel: e.target.value })} />
        </Field>
      </div>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" variant="primary" size="lg" block loading={saving}>
        Zapisz i wybierz gramaturę
      </Button>
    </form>
  );
}

/* --------------------------------- Dania ---------------------------------- */

/**
 * Przeglądarka gotowych dań.
 *
 * Świadomie BEZ wymogu wpisywania: obiad wybiera się wzrokiem z listy, a nie
 * przez zgadywanie, jak dana potrawa nazywa się w bazie. Pole tekstowe jest
 * dla tych, którzy wiedzą, czego szukają.
 */
function DishList({
  dishes,
  recipes,
  query,
  onQuery,
  onPick,
}: {
  dishes: Food[];
  recipes: RecipeTotals[];
  query: string;
  onQuery: (value: string) => void;
  onPick: (food: Food) => void;
}) {
  const phrase = query.trim().toLowerCase();
  const shown = phrase ? dishes.filter((d) => d.name.toLowerCase().includes(phrase)) : dishes;
  const mine = phrase
    ? recipes.filter((r) => r.name.toLowerCase().includes(phrase))
    : recipes;

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Filtruj dania…"
        aria-label="Filtruj dania"
      />

      {/* Własne dania idą pierwsze — to one wracają codziennie. */}
      {mine.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Moje dania
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {mine.map((recipe) => {
              const portion = portionGrams(recipe);
              return (
                <li key={recipe.recipe_id}>
                  <button
                    type="button"
                    onClick={() =>
                      onPick({
                        ...(recipeAsFood(recipe) as unknown as Food),
                        serving_size_g: portion,
                        serving_label: "porcja",
                      } as Food)
                    }
                    className="flex w-full items-center gap-3 py-2.5 text-left active:bg-surface-2"
                  >
                    <span aria-hidden className="text-lg">
                      {recipe.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium leading-tight">
                        {recipe.name}
                      </span>
                      <span className="tabular block text-[12px] text-muted">
                        {Math.round(Number(recipe.kcal_100g))} kcal / 100 g
                        {portion ? ` · porcja ${portion} g` : ""} · {recipe.items} składników
                      </span>
                    </span>
                    <span className="text-faint" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mine.length > 0 && dishes.length > 0 && (
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Popularne dania
        </h3>
      )}

      {shown.length === 0 && mine.length === 0 ? (
        <EmptyState
          icon="🍲"
          title="Nie ma takiego dania"
          description="Zapisz posiłek jako własne danie w dzienniku albo wpisz go raz jako własny produkt — następnym razem znajdziesz go od ręki."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((dish) => (
            <li key={dish.id}>
              <button
                type="button"
                onClick={() => onPick(dish)}
                className="flex w-full items-center gap-3 py-2.5 text-left active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-tight">
                    {dish.name}
                  </span>
                  <span className="tabular block text-[12px] text-muted">
                    {Math.round(Number(dish.kcal_100g))} kcal / 100 g
                    {dish.serving_size_g
                      ? ` · ${dish.serving_label ?? "porcja"} ${Math.round(Number(dish.serving_size_g))} g`
                      : ""}
                  </span>
                </span>
                <span className="text-faint" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        Wartości są przeciętne — talerz u babci będzie inny niż w barze. Traktuj je jako
        przybliżenie, a nie pomiar. Jeśli gotujesz coś regularnie, wpisz to raz jako własny
        produkt z prawdziwymi wartościami.
      </p>
    </div>
  );
}
