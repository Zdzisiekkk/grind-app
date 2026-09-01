import type { RecipeTotals } from "@/lib/database.types";

/**
 * Liczenie i filtrowanie przepisów.
 *
 * Ekran katalogu robi to samo, co każda lista w tej aplikacji: filtruje po
 * stronie przeglądarki. Katalog ma niecałe sto pozycji i wchodzi jednym
 * zapytaniem - odpytywanie bazy po każdej literze byłoby setką zapytań
 * na jedno wyszukanie i sekundą opóźnienia na tapnięcie.
 */

export const POZIOM_LABEL: Record<string, string> = {
  latwy: "łatwy",
  sredni: "średni",
  trudny: "trudny",
};

/** Makra jednej porcji. Przepis bez składników zwraca zera, nie NaN. */
export function porcja(totals: RecipeTotals) {
  const porcje = Math.max(1, Number(totals.servings) || 1);
  return {
    gramy: Math.round(Number(totals.total_g) / porcje),
    kcal: Number(totals.kcal) / porcje,
    bialko: Number(totals.protein_g) / porcje,
    wegle: Number(totals.carbs_g) / porcje,
    tluszcz: Number(totals.fat_g) / porcje,
  };
}

/** Bez ogonków i wielkości liter - do szukania, nie do pokazywania. */
function uprosc(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e").replace(/ł/g, "l")
    .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/[źż]/g, "z");
}

export type FiltrPrzepisow = {
  fraza?: string;
  tag?: string | null;
  /** Górna granica czasu w minutach; null = bez ograniczenia. */
  doMinut?: number | null;
};

/**
 * Filtr listy przepisów.
 *
 * Fraza szuka w nazwie i w etykietach, bo "wegetariańskie" jest etykietą,
 * a nie słowem w nazwie - a wpisze je ktoś tak samo jak "zupa".
 */
export function filtruj(lista: RecipeTotals[], f: FiltrPrzepisow): RecipeTotals[] {
  const fraza = uprosc((f.fraza ?? "").trim());
  return lista.filter((r) => {
    if (f.tag && !r.tagi.includes(f.tag)) return false;
    if (f.doMinut != null && (r.czas_min ?? 0) > f.doMinut) return false;
    if (!fraza) return true;
    const worek = uprosc(`${r.name} ${r.tagi.join(" ")}`);
    return fraza.split(/\s+/).every((slowo) => worek.includes(slowo));
  });
}

/** Etykiety z listy przepisów, od najczęstszej - do pasków filtrów. */
export function tagiZListy(lista: RecipeTotals[], ile = 10): string[] {
  const licznik = new Map<string, number>();
  for (const r of lista) {
    for (const t of r.tagi) licznik.set(t, (licznik.get(t) ?? 0) + 1);
  }
  return [...licznik.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .slice(0, ile)
    .map(([t]) => t);
}

/**
 * Jak porcja ma się do dziennego celu.
 *
 * Zwraca udział w celu (0-1) albo null, gdy celu nie ma. Ekran pokazuje
 * z tego "jedna trzecia dnia", bo sama liczba kalorii nikomu nic nie mówi,
 * dopóki nie wie, ile ma na cały dzień.
 */
export function udzialWCelu(totals: RecipeTotals, celKcal: number | null): number | null {
  if (!celKcal || celKcal <= 0) return null;
  return porcja(totals).kcal / celKcal;
}

/** "1 h 20 min", "45 min" - czas przy przepisie. */
export function czas(minuty: number | null | undefined): string {
  if (!minuty || minuty <= 0) return "-";
  if (minuty < 60) return `${minuty} min`;
  const h = Math.floor(minuty / 60);
  const m = minuty % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Ile trwa minutnik kroku, w sekundach.
 *
 * Kroki dłuższe niż dwie godziny to marynowanie i wyrastanie ciasta.
 * Odliczanie ich na ekranie telefonu nie ma sensu - nikt nie stoi dwie
 * godziny nad wyświetlaczem - więc minutnika tam nie pokazujemy.
 */
export const MAKS_MINUTNIK_MIN = 120;

export function sekundyMinutnika(minuty: number | null): number | null {
  if (!minuty || minuty <= 0 || minuty > MAKS_MINUTNIK_MIN) return null;
  return minuty * 60;
}
