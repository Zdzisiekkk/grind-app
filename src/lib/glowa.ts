/**
 * Zakładka "Głowa": nastrój, stres, sesje wyciszenia i dziennik.
 *
 * Jedyny filar zdrowia, którego Grind wcześniej nie śledził - a który
 * najmocniej ciągnie za sobą resztę: po złym tygodniu w głowie pierwszy
 * odpada trening, drugi sen, trzecia dieta.
 *
 * Wszystko tu jest liczone kodem, nie modelem. Zestawienie nastroju ze snem
 * to średnia z dwóch grup dni, a nie interpretacja - i ekran mówi o nim
 * "idzie w parze", nigdy "powoduje".
 */

export type Poziom = 1 | 2 | 3 | 4 | 5;

export const NASTROJ: ReadonlyArray<{ v: Poziom; ikona: string; etykieta: string }> = [
  { v: 1, ikona: "😣", etykieta: "Źle" },
  { v: 2, ikona: "😕", etykieta: "Słabo" },
  { v: 3, ikona: "😐", etykieta: "Tak sobie" },
  { v: 4, ikona: "🙂", etykieta: "Dobrze" },
  { v: 5, ikona: "😄", etykieta: "Świetnie" },
];

export const STRES: ReadonlyArray<{ v: Poziom; etykieta: string }> = [
  { v: 1, etykieta: "Spokój" },
  { v: 2, etykieta: "Lekki" },
  { v: 3, etykieta: "Umiarkowany" },
  { v: 4, etykieta: "Duży" },
  { v: 5, etykieta: "Bardzo duży" },
];

/**
 * Co wpłynęło na dzień. Zamknięta lista - ta sama stoi w bazie (0079).
 * Wolny tekst zamieniłby się w dziesięć wersji "praca" i zestawienie
 * czynników przestałoby cokolwiek liczyć.
 */
export const CZYNNIKI = [
  { id: "sen", ikona: "😴", etykieta: "Sen" },
  { id: "praca", ikona: "💼", etykieta: "Praca / nauka" },
  { id: "ludzie", ikona: "👥", etykieta: "Ludzie" },
  { id: "trening", ikona: "🏋️", etykieta: "Trening" },
  { id: "zdrowie", ikona: "🤒", etykieta: "Zdrowie" },
  { id: "pieniadze", ikona: "💸", etykieta: "Pieniądze" },
  { id: "jedzenie", ikona: "🍽️", etykieta: "Jedzenie" },
  { id: "ekran", ikona: "📱", etykieta: "Telefon" },
  { id: "pogoda", ikona: "🌦️", etykieta: "Pogoda" },
] as const;

export type Czynnik = (typeof CZYNNIKI)[number]["id"];

export const RODZAJE_SESJI = [
  { id: "medytacja", ikona: "🧘", etykieta: "Medytacja" },
  { id: "oddech", ikona: "🌬️", etykieta: "Oddech" },
  { id: "cisza", ikona: "🌳", etykieta: "Spacer bez telefonu" },
] as const;

export type RodzajSesji = (typeof RODZAJE_SESJI)[number]["id"];

export function nastrojIkona(v: number): string {
  return NASTROJ.find((n) => n.v === v)?.ikona ?? "•";
}

export function srednia(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function przesun(iso: string, dni: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dni);
  return d.toISOString().slice(0, 10);
}

export type DzienGlowy = { data: string; nastroj: number; stres: number; czynniki: string[] };

/**
 * Ostatnie 7 dni wobec 7 poprzednich.
 *
 * Tydzień, a nie dzień, bo pojedynczy zły dzień nic nie znaczy - a strzałka
 * w dół po jednym kiepskim wtorku uczy tylko tego, żeby nie wpisywać złych dni.
 */
export function trendTygodnia(
  dni: DzienGlowy[],
  dzis: string,
): { nastroj: number | null; nastrojPrzed: number | null; stres: number | null; stresPrzed: number | null } {
  const od = przesun(dzis, -6);
  const odPrzed = przesun(dzis, -13);
  const teraz = dni.filter((d) => d.data >= od && d.data <= dzis);
  const przed = dni.filter((d) => d.data >= odPrzed && d.data < od);
  return {
    nastroj: srednia(teraz.map((d) => d.nastroj)),
    nastrojPrzed: srednia(przed.map((d) => d.nastroj)),
    stres: srednia(teraz.map((d) => d.stres)),
    stresPrzed: srednia(przed.map((d) => d.stres)),
  };
}

/** Próg "dobrze przespanej nocy" - ten sam, co domyślny cel snu w aplikacji. */
export const DOBRY_SEN_MIN = 7 * 60;

/**
 * Nastrój po dobrze przespanych nocach wobec nastroju po krótkich.
 *
 * Noc i dzień łączymy po dacie: `v_sleep.date` to dzień, w którym się
 * wstało, więc to dokładnie ten dzień, którego nastrój ta noc mogła ruszyć.
 * Każda grupa musi mieć co najmniej trzy dni - przy dwóch porównanie jest
 * rzutem monetą.
 */
export function nastrojASen(
  dni: DzienGlowy[],
  noce: Array<{ date: string; sleep_min: number | null }>,
): { poDobrych: number; poKrotkich: number; dniDobrych: number; dniKrotkich: number } | null {
  const sen = new Map(noce.filter((n) => n.sleep_min != null).map((n) => [n.date, n.sleep_min as number]));
  const dobre: number[] = [];
  const krotkie: number[] = [];
  for (const d of dni) {
    const min = sen.get(d.data);
    if (min == null) continue;
    (min >= DOBRY_SEN_MIN ? dobre : krotkie).push(d.nastroj);
  }
  if (dobre.length < 3 || krotkie.length < 3) return null;
  return {
    poDobrych: srednia(dobre) as number,
    poKrotkich: srednia(krotkie) as number,
    dniDobrych: dobre.length,
    dniKrotkich: krotkie.length,
  };
}

/**
 * Czynniki, które najczęściej pojawiają się w słabe dni (nastrój 1-2).
 *
 * Liczymy udział, nie samą liczbę: "praca" zaznaczana codziennie będzie
 * też najczęstsza w złe dni i nic z tego nie wynika. Ważne jest, czy
 * w złe dni pojawia się CZĘŚCIEJ niż zwykle.
 */
export function czynnikiZlychDni(
  dni: DzienGlowy[],
): Array<{ id: string; wZle: number; ogolnie: number; razy: number }> {
  const zle = dni.filter((d) => d.nastroj <= 2);
  if (zle.length < 3 || dni.length < 7) return [];
  const udzial = (lista: DzienGlowy[], id: string) =>
    lista.filter((d) => d.czynniki.includes(id)).length / lista.length;

  return CZYNNIKI.map((c) => ({
    id: c.id,
    wZle: udzial(zle, c.id),
    ogolnie: udzial(dni, c.id),
    razy: zle.filter((d) => d.czynniki.includes(c.id)).length,
  }))
    .filter((c) => c.razy >= 2 && c.wZle >= c.ogolnie + 0.2)
    .sort((a, b) => b.wZle - b.ogolnie - (a.wZle - a.ogolnie))
    .slice(0, 3);
}

/** Ile dni z rzędu (do dziś albo do wczoraj) jest wpis nastroju. */
export function passaWpisow(daty: Set<string>, dzis: string): number {
  let dzien = daty.has(dzis) ? dzis : przesun(dzis, -1);
  let n = 0;
  while (daty.has(dzien)) {
    n++;
    dzien = przesun(dzien, -1);
  }
  return n;
}
