import type { PodocenaKlucz } from "@/lib/ai/wygladSchema";

/**
 * Liczenie dla modułu "Wygląd": konflikty składników, delty między skanami
 * i zestawienia z dziennikiem.
 *
 * Wszystko tutaj, nie w modelu. Konflikt retinoidu z kwasami to reguła, a nie
 * opinia - model, który raz na dziesięć razy o niej zapomni, jest gorszy niż
 * dziesięć linijek kodu, które nie zapominają nigdy.
 */

/* ------------------------------ Składniki --------------------------------- */

export type SkladnikGrupa = "retinoid" | "aha_bha" | "witamina_c" | "nadtlenek_benzoilu" | "spf";

/*
 * Nazwy handlowe i INCI sprowadzone do grup. Lista jest celowo krótka -
 * obejmuje to, co faktycznie ze sobą koliduje, a nie cały słownik kosmetyczny.
 */
const SYNONIMY: Array<[SkladnikGrupa, string[]]> = [
  ["retinoid", ["retinol", "retinal", "retinaldehyd", "tretinoina", "tretynoina", "adapalen", "retinoid", "granactive"]],
  ["aha_bha", ["aha", "bha", "pha", "kwas glikolowy", "kwas migdalowy", "kwas salicylowy", "kwas mlekowy", "kwas azelainowy"]],
  ["witamina_c", ["witamina c", "kwas askorbinowy", "ascorbic", "askorbinian", "thd ascorbate"]],
  ["nadtlenek_benzoilu", ["nadtlenek benzoilu", "benzoyl", "bpo"]],
  ["spf", ["spf", "filtr", "sunscreen", "uv"]],
];

/** Rozpoznanie grupy po dowolnym z zapisów, jakie ludzie wpisują z opakowania. */
export function grupaSkladnika(tekst: string): SkladnikGrupa | null {
  const t = tekst.toLowerCase().trim();
  for (const [grupa, slowa] of SYNONIMY) {
    if (slowa.some((s) => t.includes(s))) return grupa;
  }
  return null;
}

export type Produkt = {
  id: string;
  nazwa: string;
  skladniki_aktywne: string[];
  pora: "rano" | "wieczor" | "dowolnie";
};

export type Konflikt = {
  waga: "ostrzezenie" | "uwaga";
  tytul: string;
  opis: string;
  produkty: string[];
};

/**
 * Konflikty w zestawie produktów.
 *
 * "Wieczór" i "dowolnie" traktujemy jako jedną porę, bo produkt bez wskazanej
 * pory najczęściej ląduje właśnie wieczorem - a ostrzeżenie, które się nie
 * pojawi, jest warte tyle co żadne.
 */
export function konflikty(produkty: Produkt[]): Konflikt[] {
  const wynik: Konflikt[] = [];

  const grupyO = (pory: Produkt["pora"][]) => {
    const mapa = new Map<SkladnikGrupa, string[]>();
    for (const p of produkty) {
      if (!pory.includes(p.pora)) continue;
      for (const s of p.skladniki_aktywne) {
        const g = grupaSkladnika(s);
        if (!g) continue;
        mapa.set(g, [...(mapa.get(g) ?? []), p.nazwa]);
      }
    }
    return mapa;
  };

  const wieczor = grupyO(["wieczor", "dowolnie"]);
  const rano = grupyO(["rano", "dowolnie"]);
  const wszystkie = grupyO(["rano", "wieczor", "dowolnie"]);

  const para = (
    m: Map<SkladnikGrupa, string[]>,
    a: SkladnikGrupa,
    b: SkladnikGrupa,
    k: Omit<Konflikt, "produkty">,
  ) => {
    if (m.has(a) && m.has(b)) {
      wynik.push({ ...k, produkty: [...new Set([...(m.get(a) ?? []), ...(m.get(b) ?? [])])] });
    }
  };

  para(wieczor, "retinoid", "aha_bha", {
    waga: "ostrzezenie",
    tytul: "Retinoid i kwasy tego samego wieczoru",
    opis:
      "Razem podrażniają skórę mocniej, niż każde z osobna daje efektu. Rozdziel je na różne dni - na przykład retinoid w poniedziałki, środy i piątki, kwasy we wtorki.",
  });

  para(wieczor, "retinoid", "witamina_c", {
    waga: "uwaga",
    tytul: "Retinoid i witamina C razem",
    opis:
      "Nie jest to niebezpieczne, ale bez sensu: obie substancje lubią inne warunki. Witamina C rano, retinoid wieczorem - wtedy obie pracują.",
  });

  para(wieczor, "retinoid", "nadtlenek_benzoilu", {
    waga: "ostrzezenie",
    tytul: "Retinoid i nadtlenek benzoilu naraz",
    opis:
      "Nadtlenek benzoilu rozkłada część retinoidów. Stosuj o różnych porach dnia albo w różne dni. (Adapalen jest tu wyjątkiem - jego można łączyć.)",
  });

  if (wszystkie.has("retinoid") && !rano.has("spf")) {
    wynik.push({
      waga: "ostrzezenie",
      tytul: "Retinoid bez filtru rano",
      opis:
        "Retinoid uwrażliwia skórę na słońce. Bez filtru robi więcej szkody niż pożytku - to nie jest opcja dodatkowa, tylko część kuracji.",
      produkty: wszystkie.get("retinoid") ?? [],
    });
  }

  return wynik;
}

/* --------------------------------- Delty ---------------------------------- */

export type Skan = {
  id: string;
  utworzono: string;
  ocena_ogolna: number | null;
  oceny: Partial<Record<PodocenaKlucz, number>> | null;
  jakosc_ok: boolean | null;
};

export type Delta = { klucz: PodocenaKlucz | "ogolna"; od: number; do: number; zmiana: number };

/**
 * Zmiana między pierwszym a ostatnim skanem.
 *
 * Skany z dopiskiem "złe zdjęcie" pomijamy w liczeniu. Przepalona klatka
 * potrafi zbić ocenę skóry o kilkanaście punktów i pokazać spadek tam, gdzie
 * zmieniło się wyłącznie oświetlenie w łazience.
 */
export function delty(skany: Skan[]): Delta[] {
  const dobre = skany.filter((s) => s.jakosc_ok !== false).sort((a, b) => a.utworzono.localeCompare(b.utworzono));
  if (dobre.length < 2) return [];

  const pierwszy = dobre[0];
  const ostatni = dobre[dobre.length - 1];
  const wynik: Delta[] = [];

  if (pierwszy.ocena_ogolna != null && ostatni.ocena_ogolna != null) {
    wynik.push({
      klucz: "ogolna",
      od: pierwszy.ocena_ogolna,
      do: ostatni.ocena_ogolna,
      zmiana: ostatni.ocena_ogolna - pierwszy.ocena_ogolna,
    });
  }

  for (const klucz of Object.keys(ostatni.oceny ?? {}) as PodocenaKlucz[]) {
    const od = pierwszy.oceny?.[klucz];
    const doo = ostatni.oceny?.[klucz];
    if (typeof od === "number" && typeof doo === "number") {
      wynik.push({ klucz, od, do: doo, zmiana: doo - od });
    }
  }

  return wynik.sort((a, b) => Math.abs(b.zmiana) - Math.abs(a.zmiana));
}

/** Różnica względem poprzedniego skanu - to jest liczba pokazywana na pierwszym planie. */
export function deltaOdPoprzedniego(skany: Skan[]): { zmiana: number; data: string } | null {
  const posortowane = [...skany].sort((a, b) => b.utworzono.localeCompare(a.utworzono));
  const [teraz, poprzedni] = posortowane;
  if (!teraz?.ocena_ogolna || !poprzedni?.ocena_ogolna) return null;
  return { zmiana: teraz.ocena_ogolna - poprzedni.ocena_ogolna, data: poprzedni.utworzono };
}

/* ------------------------------- Adherencja -------------------------------- */

/**
 * Ile procent dni z ostatnich 30 rutyna została odhaczona.
 *
 * Pokazywane obok wyniku, bo to ona najczęściej tłumaczy brak postępu.
 * Bez tej liczby "nic się nie zmieniło" i "nie robiłem tego" wyglądają
 * na ekranie identycznie.
 */
export function adherencja(dniOdhaczone: string[], odDaty: string, doDaty: string): number {
  const dni = new Set(dniOdhaczone);
  const start = new Date(odDaty + "T00:00:00Z").getTime();
  const koniec = new Date(doDaty + "T00:00:00Z").getTime();
  const wszystkich = Math.floor((koniec - start) / 86_400_000) + 1;
  if (wszystkich <= 0) return 0;

  let zrobione = 0;
  for (let i = 0; i < wszystkich; i++) {
    const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    if (dni.has(d)) zrobione++;
  }
  return Math.round((zrobione / wszystkich) * 100);
}

/* ------------------------------- Zestawienia ------------------------------- */

export type Zestawienie = {
  tytul: string;
  opis: string;
  /** Siła związku, -1..1. Do pokazania jako słowo, nigdy jako dowód. */
  r: number;
  punktow: number;
};

/** Współczynnik korelacji Pearsona. Zwraca null, gdy nie ma czego liczyć. */
function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;

  const sx = xs.slice(0, n);
  const sy = ys.slice(0, n);
  const mx = sx.reduce((a, b) => a + b, 0) / n;
  const my = sy.reduce((a, b) => a + b, 0) / n;

  let licznik = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    licznik += (sx[i] - mx) * (sy[i] - my);
    vx += (sx[i] - mx) ** 2;
    vy += (sy[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return licznik / Math.sqrt(vx * vy);
}

function slowoOSile(r: number): string {
  const a = Math.abs(r);
  if (a < 0.3) return "ledwie widoczny";
  if (a < 0.6) return "umiarkowany";
  return "wyraźny";
}

/**
 * Zestawienia skanów z dziennikiem - sen, alkohol, waga.
 *
 * Świadomie NIE nazywamy tego przyczyną. Przy pięciu skanach w roku każdy taki
 * związek może być przypadkiem, a moduł, który mówi "alkohol psuje ci skórę"
 * na podstawie czterech punktów, kłamie z pewną siebie miną.
 */
export function zestawienia(input: {
  skany: Array<{ utworzono: string; oceny: Partial<Record<PodocenaKlucz, number>> | null }>;
  /** Średni sen w minutach w tygodniu poprzedzającym każdy skan. */
  senPrzedSkanem: Array<number | null>;
  /** Dni bez wpadki w nałogu w tygodniu przed skanem. */
  czysteDniPrzedSkanem: Array<number | null>;
  /** Waga w dniu skanu. */
  wagaPrzySkanie: Array<number | null>;
}): Zestawienie[] {
  const { skany, senPrzedSkanem, czysteDniPrzedSkanem, wagaPrzySkanie } = input;
  const wynik: Zestawienie[] = [];

  const zbierz = (klucz: PodocenaKlucz, druga: Array<number | null>) => {
    const xs: number[] = [];
    const ys: number[] = [];
    skany.forEach((s, i) => {
      const ocena = s.oceny?.[klucz];
      const d = druga[i];
      if (typeof ocena === "number" && typeof d === "number") {
        xs.push(d);
        ys.push(ocena);
      }
    });
    return { xs, ys };
  };

  const dodaj = (
    klucz: PodocenaKlucz,
    druga: Array<number | null>,
    tytul: string,
    zdanie: (kierunek: string, sila: string) => string,
  ) => {
    const { xs, ys } = zbierz(klucz, druga);
    const r = pearson(xs, ys);
    if (r === null) return;
    wynik.push({
      tytul,
      opis: zdanie(r > 0 ? "wyżej" : "niżej", slowoOSile(r)),
      r,
      punktow: xs.length,
    });
  };

  dodaj("skora", senPrzedSkanem, "Sen a skóra", (kierunek, sila) =>
    `Po tygodniach z dłuższym snem ocena skóry wypadała ${kierunek}. Związek ${sila}.`,
  );
  dodaj("skora", czysteDniPrzedSkanem, "Czyste dni a skóra", (kierunek, sila) =>
    `Po tygodniach z większą liczbą czystych dni ocena skóry wypadała ${kierunek}. Związek ${sila}.`,
  );
  dodaj("definicja_zuchwy", wagaPrzySkanie, "Waga a linia żuchwy", (kierunek, sila) =>
    `Przy wyższej wadze ocena linii żuchwy wypadała ${kierunek}. Związek ${sila}.`,
  );

  return wynik.filter((z) => z.punktow >= 3);
}
