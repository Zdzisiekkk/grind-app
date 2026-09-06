/**
 * Przypomnienie o elektrolitach.
 *
 * Aplikacja cały dzień popycha do picia i liczy każdą szklankę. Im lepiej
 * ktoś realizuje cel nawodnienia, tym więcej sodu, potasu i magnezu wypłukuje -
 * a o tym nie mówi mu nic. To luka, którą sama stworzyła.
 *
 * Stąd reguła: nie alarm o stałej godzinie, tylko reakcja na powód. Kto wypił
 * półtora litra, nie zobaczy tego przypomnienia nigdy; kto wypił cztery -
 * zobaczy raz.
 *
 * Świadomie NIE podajemy dawek ani preparatów. To dziennik treningowy,
 * nie porada medyczna - ma przypomnieć, że warto o tym pomyśleć, a nie
 * mówić komuś, ile sodu ma dziś zjeść.
 */

/**
 * Domyślny próg dziennego picia, po którym warto o tym wspomnieć.
 *
 * Trzy litry to mniej więcej granica, powyżej której samo jedzenie przestaje
 * wystarczać do uzupełnienia strat u przeciętnie jedzącej osoby. Poniżej tej
 * wartości przypomnienie byłoby szumem - a szum uczy wyłączać powiadomienia.
 */
export const DOMYSLNY_PROG_ML = 3000;

export type UstawieniaElektrolitow = {
  wlaczone: boolean;
  /** null = użyj DOMYSLNY_PROG_ML. */
  progMl: number | null;
};

/**
 * Czy pokazać dziś przypomnienie o elektrolitach.
 *
 * Osobno od treści, bo o tym, CZY przypominać, decydują też rzeczy spoza tego
 * pliku (zgoda na powiadomienia, czy już dziś poszło) - a to, co ma być
 * napisane, zależy wyłącznie od liczby mililitrów.
 */
export function czyPrzypomniec(wypiteMl: number, ustawienia: UstawieniaElektrolitow): boolean {
  if (!ustawienia.wlaczone) return false;

  const prog = ustawienia.progMl ?? DOMYSLNY_PROG_ML;
  if (prog <= 0) return false;

  return wypiteMl >= prog;
}

/**
 * Treść przypomnienia.
 *
 * Podaje ile wypite, bo to jest cała argumentacja: człowiek ma zobaczyć
 * powód, a nie samo polecenie. Litry zamiast mililitrów - "3,2 l" czyta się
 * jednym rzutem oka, "3200 ml" trzeba przeliczyć.
 */
export function trescElektrolitow(wypiteMl: number): string {
  const litry = (wypiteMl / 1000).toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `Wypite dziś: ${litry} l. Przy takiej ilości warto uzupełnić elektrolity.`;
}
