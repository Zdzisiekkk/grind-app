/**
 * Levele z punktów doświadczenia.
 *
 * XP przyznaje wyłącznie baza (wyzwalacze z migracji 0057) - tu jest tylko
 * matematyka do pokazania. Formuła poziomu MUSI być identyczna z
 * public.xp_poziom() w bazie; test test-xp porównuje obie na siatce wartości.
 *
 * Krzywa: próg levelu n to 100 * n^1.5 XP łącznie - pierwsze levele wpadają
 * w kilka dni (zaczep), późniejsze wymagają tygodni (prestiż).
 */

export function poziomZXp(xp: number): number {
  if (!Number.isFinite(xp) || xp < 100) return 0;
  return Math.floor(Math.pow(xp / 100, 2 / 3) + 1e-9);
}

/** Najmniejsze łączne XP, które daje dany level. */
export function progPoziomu(poziom: number): number {
  if (poziom <= 0) return 0;
  let prog = Math.ceil(100 * Math.pow(poziom, 1.5) - 1e-9);
  // Korekta o błąd zmiennoprzecinkowy: próg ma być pierwszą wartością,
  // dla której poziomZXp odpowiada tym levelem.
  while (poziomZXp(prog) < poziom) prog += 1;
  while (prog > 0 && poziomZXp(prog - 1) >= poziom) prog -= 1;
  return prog;
}

/** Postęp do następnego levelu, 0..1 - do paska na pulpicie. */
export function postepDoNastepnego(xp: number): number {
  const poziom = poziomZXp(xp);
  const od = progPoziomu(poziom);
  const doProgu = progPoziomu(poziom + 1);
  if (doProgu <= od) return 0;
  return Math.min(1, Math.max(0, (xp - od) / (doProgu - od)));
}

/**
 * Tytuł rośnie z levelem. Ostatni osiągnięty próg, nie interpolacja -
 * "Zawodnik" na levelu 6 to wciąż "Zawodnik", aż wpadnie 8.
 */
const TYTULY: ReadonlyArray<readonly [number, string]> = [
  [0, "Świeżak"],
  [1, "Nowicjusz"],
  [3, "Regularny"],
  [5, "Zawodnik"],
  [8, "Wojownik"],
  [12, "Weteran"],
  [16, "Maszyna"],
  [20, "Tytan"],
  [30, "Legenda"],
];

export function tytulPoziomu(poziom: number): string {
  let tytul = TYTULY[0][1];
  for (const [prog, nazwa] of TYTULY) {
    if (poziom >= prog) tytul = nazwa;
  }
  return tytul;
}
