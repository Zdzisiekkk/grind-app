"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Input, Sheet, Stat } from "@/components/ui";
import { TrybGotowania } from "@/components/diet/TrybGotowania";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { num } from "@/lib/format";
import { POZIOM_LABEL, czas, filtruj, porcja, tagiZListy, udzialWCelu } from "@/lib/przepisy";
import type { RecipeItem, RecipeStep, RecipeTotals } from "@/lib/database.types";

/**
 * Katalog przepisów - do czytania i do gotowania, nie do edycji.
 *
 * Składników i kroków NIE ściągamy razem z listą. Katalog to blisko tysiąc
 * składników i pół tysiąca kroków; wczytywanie ich przy każdym wejściu
 * w zakładkę byłoby megabajtem na coś, z czego otwiera się jedną pozycję.
 * Lista wchodzi jednym zapytaniem, szczegóły dopiero po tapnięciu.
 */
export function KatalogPrzepisow({
  katalog,
  celKcal,
  otworz,
}: {
  katalog: RecipeTotals[];
  /** Dzienny cel kaloryczny z profilu - do "jedna trzecia dnia". */
  celKcal: number | null;
  /** Przepis do otwarcia od razu - wejście z widżetu "przepis dnia". */
  otworz?: string;
}) {
  const [fraza, setFraza] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  /*
   * Przepis dnia otwiera się od razu przy wejściu z widżetu.
   *
   * Stan początkowy, a nie efekt: adres jest znany już przy pierwszym
   * renderowaniu, więc dokładanie do tego efektu znaczyłoby jedno renderowanie
   * z pustym ekranem i dopiero potem otwarty arkusz - czyli mignięcie.
   */
  const [wybrany, setWybrany] = useState<RecipeTotals | null>(
    () => (otworz ? katalog.find((x) => x.recipe_id === otworz) ?? null : null),
  );

  const tagi = useMemo(() => tagiZListy(katalog, 12), [katalog]);
  const widoczne = useMemo(() => filtruj(katalog, { fraza, tag }), [katalog, fraza, tag]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={fraza}
        onChange={(e) => setFraza(e.target.value)}
        placeholder="Szukaj: zupa, kurczak, wegetariańskie..."
        aria-label="Szukaj w katalogu przepisów"
      />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={() => setTag(null)}>
          <Chip tone={tag === null ? "accent" : undefined}>wszystkie</Chip>
        </button>
        {tagi.map((t) => (
          <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)}>
            <Chip tone={tag === t ? "accent" : undefined}>{t}</Chip>
          </button>
        ))}
      </div>

      {widoczne.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔎"
            title="Nic takiego tu nie ma"
            description="Spróbuj innego słowa albo zdejmij filtr. W katalogu jest blisko sto przepisów."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {widoczne.map((r) => {
            const p = porcja(r);
            const udzial = udzialWCelu(r, celKcal);
            return (
              <Card key={r.recipe_id}>
                <button
                  type="button"
                  onClick={() => setWybrany(r)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl">
                    {r.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold leading-tight">
                      {r.name}
                    </span>
                    <span className="tabular block text-[12px] text-muted">
                      {num(p.kcal, 0)} kcal/porcja · {num(p.bialko, 0)} g białka ·{" "}
                      {czas(r.czas_min)}
                      {udzial != null && udzial <= 1 ? ` · ${Math.round(udzial * 100)}% dnia` : ""}
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

      <PrzepisSheet recipe={wybrany} onClose={() => setWybrany(null)} celKcal={celKcal} />
    </div>
  );
}

/* --------------------------- Podgląd przepisu ---------------------------- */

function PrzepisSheet({
  recipe,
  celKcal,
  onClose,
}: {
  recipe: RecipeTotals | null;
  celKcal: number | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  /*
   * Wczytane składniki i kroki trzymamy RAZEM z identyfikatorem przepisu,
   * któremu odpowiadają. Dzięki temu "czy już wczytane" jest wyliczane
   * z danych, a nie trzymane w osobnym stanie, który trzeba by zerować
   * przy każdej zmianie przepisu - i który przy szybkim przełączaniu
   * pokazywałby składniki poprzedniego dania.
   */
  const [dane, setDane] = useState<{
    id: string;
    items: RecipeItem[];
    steps: RecipeStep[];
  } | null>(null);
  const [kopia, setKopia] = useState<{ id: string; blad?: string; ok?: boolean } | null>(null);
  const [gotuje, setGotuje] = useState(false);
  const [kopiuje, setKopiuje] = useState(false);

  const id = recipe?.recipe_id;

  useEffect(() => {
    if (!id) return;
    let porzucone = false;
    (async () => {
      const [{ data: skladniki }, { data: kroki }] = await Promise.all([
        supabase.from("recipe_items").select("*").eq("recipe_id", id).order("order_index"),
        supabase.from("recipe_steps").select("*").eq("recipe_id", id).order("order_index"),
      ]);
      if (porzucone) return;
      setDane({
        id,
        items: (skladniki ?? []) as RecipeItem[],
        steps: (kroki ?? []) as RecipeStep[],
      });
    })();
    return () => {
      porzucone = true;
    };
  }, [id, supabase]);

  async function skopiuj() {
    if (!id) return;
    setKopiuje(true);
    setKopia(null);
    const { error } = await supabase.rpc("skopiuj_przepis", { p_recipe_id: id });
    setKopiuje(false);
    if (error) {
      setKopia({ id, blad: `Nie udało się skopiować: ${error.message}` });
      return;
    }
    setKopia({ id, ok: true });
    router.refresh();
  }

  if (!recipe) return null;

  const wczytywanie = dane?.id !== recipe.recipe_id;
  const items = wczytywanie ? [] : dane.items;
  const steps = wczytywanie ? [] : dane.steps;
  const blad = kopia?.id === recipe.recipe_id ? kopia.blad : null;
  const skopiowany = kopia?.id === recipe.recipe_id && kopia.ok === true;

  const p = porcja(recipe);
  const udzial = udzialWCelu(recipe, celKcal);

  if (gotuje && steps.length > 0) {
    return (
      <TrybGotowania
        recipe={recipe}
        items={items}
        steps={steps}
        onClose={() => setGotuje(false)}
      />
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={recipe.name}
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={wczytywanie || steps.length === 0}
          onClick={() => setGotuje(true)}
        >
          {wczytywanie ? "Wczytuję..." : `Gotuj krok po kroku (${steps.length})`}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {recipe.czas_min && <Chip>⏱ {czas(recipe.czas_min)}</Chip>}
          {recipe.poziom && <Chip>{POZIOM_LABEL[recipe.poziom]}</Chip>}
          {recipe.tagi.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Jedna porcja"
            value={`${num(p.kcal, 0)} kcal`}
            sub={udzial != null ? `${Math.round(udzial * 100)}% dziennego celu` : `${p.gramy} g`}
            tone="accent"
          />
          <Stat
            label="W porcji"
            value={`${num(p.bialko, 0)} g białka`}
            sub={`W ${num(p.wegle, 0)} · T ${num(p.tluszcz, 0)}`}
          />
        </div>

        {recipe.makra_orientacyjne && (
          <p className="text-[12px] text-warn">
            Makra orientacyjne. Oryginalny przepis podaje miary domowe w rodzaju dwóch
            łyżek oleju, więc gramatura jest przeliczona, a nie zważona.
          </p>
        )}

        {blad && <Alert>{blad}</Alert>}
        {skopiowany && (
          <Alert tone="success">
            Skopiowane do twoich dań - tam możesz zmienić gramaturę pod siebie.
          </Alert>
        )}

        <Card title="Składniki" subtitle={`na ${num(recipe.servings, 0)} porcji`} padded={false}>
          {wczytywanie ? (
            <p className="px-4 py-4 text-[13px] text-muted">Wczytuję...</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[14px]">{i.name}</span>
                  <span className="tabular shrink-0 text-[13px] text-muted">
                    {num(i.grams, 0)} g
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Wykonanie" padded={false}>
          <ol className="divide-y divide-border border-t border-border">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 px-4 py-3">
                <span
                  className={clsx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    "bg-surface-2 text-[12px] font-semibold text-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-relaxed">
                  {s.tekst}
                  {s.minuty && (
                    <span className="ml-1 text-[12px] text-accent">({s.minuty} min)</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Button variant="secondary" block loading={kopiuje} onClick={skopiuj}>
          Skopiuj do moich dań
        </Button>

        {/*
          Atrybucja nie jest ozdobą - licencja CC BY-SA wymaga podania źródła
          i autora przy każdym wykorzystaniu treści.
        */}
        {recipe.license && (
          <p className="text-[11px] text-faint">
            Źródło:{" "}
            {recipe.license_url ? (
              <a
                href={recipe.license_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {recipe.license_author}
              </a>
            ) : (
              recipe.license_author
            )}
            , licencja {recipe.license}. Gramatura i wartości odżywcze policzone w Grindzie.
          </p>
        )}
      </div>
    </Sheet>
  );
}
