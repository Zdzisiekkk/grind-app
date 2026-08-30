import { addDaysISO, todayISO } from "./format";

/**
 * Okno wpisywania wstecz.
 *
 * Tydzień, bo tyle mniej więcej pamięta się rzetelnie. Dalej wstecz człowiek
 * już nie odtwarza dnia, tylko go zgaduje - a zgadywanie w dzienniku zdrowia
 * jest gorsze niż dziura, bo dziurę widać, a zmyślony wpis wygląda jak dane.
 *
 * Druga sprawa: passy i rekordy liczą się z historii. Dopisanie dnia sprzed
 * pół roku po cichu przepisałoby rekord, którego nikt już nie pamięta.
 */
export const DNI_WSTECZ = 7;

/** Najstarszy dzień, który wolno jeszcze dopisać. */
export function najstarszaData(dzis: string = todayISO()): string {
  return addDaysISO(dzis, -DNI_WSTECZ);
}

/** Czy wpis z tą datą wolno zapisać: nie z przyszłości i nie sprzed okna. */
export function dataWOknie(iso: string, dzis: string = todayISO()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= najstarszaData(dzis) && iso <= dzis;
}

/**
 * Data z adresu (?d=) przycięta do okna.
 *
 * Cokolwiek dziwnego w adresie - brak parametru, śmieci, data z przyszłości,
 * data sprzed okna - kończy się dzisiaj. Ekran ma się otworzyć zawsze, a nie
 * wywalić dlatego, że ktoś pomajstrował przy adresie.
 */
export function dataZAdresu(d: string | undefined, dzis: string = todayISO()): string {
  return d && dataWOknie(d, dzis) ? d : dzis;
}

/**
 * Znacznik czasu dla wpisu z datą wsteczną.
 *
 * Tabele z kolumną timestamptz (wpadki w nałogach, odhaczone zadania) muszą
 * dostać godzinę, a nie samą datę. Dla dzisiaj bierzemy teraz, dla dnia
 * wstecz - południe. Południe, bo przy każdej strefie czasowej wypada w tym
 * samym dniu kalendarzowym, więc wpis nie przeskoczy na sąsiednią dobę.
 */
export function znacznikDnia(iso: string, dzis: string = todayISO()): string {
  if (iso === dzis) return new Date().toISOString();
  return new Date(`${iso}T12:00:00`).toISOString();
}
