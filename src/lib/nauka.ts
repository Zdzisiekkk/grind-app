/**
 * Zakładka "Nauka": przedmioty, sesje i powtórki.
 *
 * Książki śledzą czytanie. Nauka śledzi postęp w konkretnej umiejętności -
 * języku, przedmiocie na studiach, kursie - i to w dwóch walutach: czasie
 * (sesje z tygodniowym celem) i pamięci (powtórki).
 */

export const RODZAJE_TEMATOW = [
  { id: "jezyk", ikona: "🗣️", etykieta: "Język" },
  { id: "studia", ikona: "🎓", etykieta: "Studia" },
  { id: "kurs", ikona: "💻", etykieta: "Kurs" },
  { id: "umiejetnosc", ikona: "🛠️", etykieta: "Umiejętność" },
  { id: "inne", ikona: "📘", etykieta: "Inne" },
] as const;

export type RodzajTematu = (typeof RODZAJE_TEMATOW)[number]["id"];

/* ------------------------------- Powtórki --------------------------------- */

/**
 * Odstępy między powtórkami, w dniach, dla kolejnych etapów.
 *
 * Klasyczny rozkład powtórek rozłożonych w czasie: każde udane przypomnienie
 * mniej więcej podwaja czas do następnego. Pięć udanych powtórek pod rząd
 * to dwa miesiące pamiętania - wtedy rzecz uznajemy za opanowaną i znika
 * z listy, zamiast wisieć na niej do końca świata.
 */
export const INTERWALY_DNI = [1, 3, 7, 14, 30, 60] as const;

/** Etap, na którym powtórka jest opanowana i nie wraca. Ten sam w bazie (0079). */
export const ETAP_OPANOWANE = INTERWALY_DNI.length;

function przesun(iso: string, dni: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dni);
  return d.toISOString().slice(0, 10);
}

/**
 * Stan powtórki po odpowiedzi.
 *
 * "Pamiętam" przesuwa o etap w górę. "Nie pamiętam" cofa na sam początek,
 * a nie o jeden etap - rzecz zapomniana po miesiącu nie jest "prawie
 * opanowana", tylko trzeba ją odbudować od jutra.
 */
export function poPowtorce(
  etap: number,
  dzis: string,
  pamietam: boolean,
): { etap: number; nastepna: string | null } {
  if (!pamietam) return { etap: 0, nastepna: przesun(dzis, INTERWALY_DNI[0]) };
  const nowy = Math.min(ETAP_OPANOWANE, Math.max(0, etap) + 1);
  if (nowy >= ETAP_OPANOWANE) return { etap: ETAP_OPANOWANE, nastepna: null };
  return { etap: nowy, nastepna: przesun(dzis, INTERWALY_DNI[nowy]) };
}

/** Pierwsza powtórka nowej rzeczy - jutro. */
export function pierwszaPowtorka(dzis: string): string {
  return przesun(dzis, INTERWALY_DNI[0]);
}

/** Powtórki na dziś, łącznie z zaległymi. */
export function doPowtorki<T extends { nastepna: string | null; etap: number }>(
  powtorki: T[],
  dzis: string,
): T[] {
  return powtorki
    .filter((p) => p.etap < ETAP_OPANOWANE && p.nastepna != null && p.nastepna <= dzis)
    .sort((a, b) => (a.nastepna ?? "").localeCompare(b.nastepna ?? ""));
}

/* ------------------------------ Czas nauki -------------------------------- */

/** Poniedziałek tygodnia, w którym leży dany dzień. */
export function poczatekTygodnia(dzis: string): string {
  const d = new Date(dzis + "T00:00:00Z");
  const dzienTyg = (d.getUTCDay() + 6) % 7; // 0 = poniedziałek
  return przesun(dzis, -dzienTyg);
}

/**
 * Minuty w bieżącym tygodniu na temat.
 *
 * Tydzień kalendarzowy, a nie ostatnie siedem dni: cel "3 godziny
 * tygodniowo" ktoś planuje od poniedziałku. Przy oknie ruchomym w niedzielę
 * wieczorem cel sam by się "odnawiał" o godziny z zeszłego poniedziałku.
 */
export function minutyWTygodniu(
  sesje: Array<{ data: string; minuty: number; temat_id: string }>,
  dzis: string,
): Map<string, number> {
  const od = poczatekTygodnia(dzis);
  const wynik = new Map<string, number>();
  for (const s of sesje) {
    if (s.data < od || s.data > dzis) continue;
    wynik.set(s.temat_id, (wynik.get(s.temat_id) ?? 0) + s.minuty);
  }
  return wynik;
}

/** Dni z rzędu z choć jedną sesją - do dziś, a jeśli dziś jeszcze nic, do wczoraj. */
export function passaNauki(daty: Set<string>, dzis: string): number {
  let dzien = daty.has(dzis) ? dzis : przesun(dzis, -1);
  let n = 0;
  while (daty.has(dzien)) {
    n++;
    dzien = przesun(dzien, -1);
  }
  return n;
}

/** "45 min", "1 h", "2 h 15 min". */
export function minuty(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (h === 0) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
