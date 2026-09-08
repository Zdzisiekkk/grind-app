/**
 * Liczby i etykiety modułu finansowego.
 *
 * Reguły liczenia trzymamy tutaj, a nie w komponentach, z tego samego powodu
 * co przy wyniku snu: te same liczby pokazuje ekran Kasy i pulpit, a dwie
 * kopie wzoru to prosta droga do dwóch różnych odpowiedzi na to samo pytanie.
 */

import type { KategoriaWydatku } from "@/lib/database.types";

export const KATEGORIE_WYDATKOW: ReadonlyArray<{
  value: KategoriaWydatku;
  label: string;
  icon: string;
}> = [
  { value: "jedzenie", label: "Jedzenie na mieście", icon: "🍔" },
  { value: "zakupy", label: "Zakupy", icon: "🛍️" },
  { value: "rozrywka", label: "Rozrywka", icon: "🎬" },
  { value: "transport", label: "Transport", icon: "🚕" },
  { value: "zdrowie", label: "Zdrowie", icon: "💊" },
  { value: "prezenty", label: "Prezenty", icon: "🎁" },
  { value: "subskrypcje", label: "Subskrypcje", icon: "📺" },
  { value: "inne", label: "Inne", icon: "💸" },
];

export function kategoriaWydatku(value: string) {
  return (
    KATEGORIE_WYDATKOW.find((k) => k.value === value) ??
    KATEGORIE_WYDATKOW[KATEGORIE_WYDATKOW.length - 1]
  );
}

/**
 * Kwota po polsku: "12 400 zł", "1 250,50 zł".
 *
 * Grosze pokazujemy tylko wtedy, gdy są niezerowe. Przy majątku "12 400 zł"
 * czyta się jednym rzutem oka, a "12 400,00 zł" to dwa znaki szumu w miejscu,
 * w którym i tak nikt nie liczy co do grosza.
 */
export function zl(kwota: number | null | undefined, zawszeGrosze = false): string {
  if (kwota == null || !Number.isFinite(kwota)) return "-";
  const grosze = zawszeGrosze || Math.round(kwota * 100) % 100 !== 0;
  return (
    kwota.toLocaleString("pl-PL", {
      minimumFractionDigits: grosze ? 2 : 0,
      maximumFractionDigits: grosze ? 2 : 0,
    }) + " zł"
  );
}

/** Zmiana ze znakiem: "+1 200 zł", "-340 zł". Zero bez znaku. */
export function zmiana(kwota: number | null | undefined): string {
  if (kwota == null || !Number.isFinite(kwota)) return "-";
  if (kwota === 0) return zl(0);
  return (kwota > 0 ? "+" : "") + zl(kwota);
}

/**
 * Ile miesięcy przeżycia dają płynne środki.
 *
 * Świadomie BEZ inwestycji: akcji nie sprzedaje się w dniu, w którym psuje
 * się pralka, a poduszka ma odpowiadać na pytanie "ile wytrzymam bez
 * przychodu", nie "ile jestem wart".
 */
export function miesiaceProzycia(
  plynne: number | null | undefined,
  kosztyMiesieczne: number | null | undefined,
): number | null {
  if (plynne == null || kosztyMiesieczne == null || kosztyMiesieczne <= 0) return null;
  return Math.round((plynne / kosztyMiesieczne) * 10) / 10;
}

/** Jak blisko celu poduszki, 0-100. */
export function poduszkaProcent(
  miesiace: number | null,
  cel: number,
): number | null {
  if (miesiace == null || cel <= 0) return null;
  return Math.min(100, Math.round((miesiace / cel) * 100));
}

/**
 * Ile z miesięcznego budżetu wypada na dzień, żeby wyrobić się do końca.
 *
 * Liczone od dziś do końca miesiąca, a nie ze średniej z całego miesiąca -
 * człowiek, który przepalił połowę w tydzień, ma wiedzieć, ile mu realnie
 * zostało na dzień, a nie ile "powinien był" wydawać.
 */
export function dziennieDoKonca(
  zostalo: number | null,
  dzisiaj = new Date(),
): number | null {
  if (zostalo == null) return null;
  const wMiesiacu = new Date(dzisiaj.getFullYear(), dzisiaj.getMonth() + 1, 0).getDate();
  const doKonca = Math.max(1, wMiesiacu - dzisiaj.getDate() + 1);
  return Math.max(0, Math.round((zostalo / doKonca) * 100) / 100);
}

/**
 * Ocena stanu poduszki - do koloru i jednego zdania na ekranie.
 *
 * Progi nie są wyssane z palca: poniżej miesiąca każda awaria jest kryzysem,
 * trzy miesiące to minimum spokoju przy stabilnej pracy, sześć to standard
 * przy niepewnym dochodzie.
 */
export function stanPoduszki(miesiace: number | null): {
  tone: "danger" | "warn" | "accent" | "success";
  label: string;
} {
  if (miesiace == null) return { tone: "accent", label: "Podaj koszty miesięczne" };
  if (miesiace < 1) return { tone: "danger", label: "Poniżej miesiąca" };
  if (miesiace < 3) return { tone: "warn", label: "Na dorobku" };
  if (miesiace < 6) return { tone: "accent", label: "Bezpiecznie" };
  return { tone: "success", label: "Spokojnie" };
}
