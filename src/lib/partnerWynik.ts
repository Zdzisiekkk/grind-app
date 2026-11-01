/*
 * Wynik dnia pary: z surowych wierszy partner_tydzien() liczy procent dnia
 * każdej osoby, serię "razem" i tygodniowy pojedynek.
 *
 * Dzień jest "zaliczony", gdy osoba zrobiła co najmniej 60% tego, co miała
 * do zrobienia. Próg nie jest 100%, bo dzień bez treningu (odpoczynek) nie
 * może zrywać serii komuś, kto zjadł, odhaczył nawyki i skin care.
 */
import type { PartnerTydzienWiersz } from "./database.types";

export const PROG_ZALICZENIA = 0.6;

export type DzienOsoby = {
  data: string;
  /** 0..1 */
  wynik: number;
  zaliczony: boolean;
  /** Punkty do pojedynku: do 4 dziennie. */
  punkty: number;
};

/** Ile z dnia zrobione: jedzenie i trening po 1, nawyki i skin care ułamkiem, o ile w ogóle są. */
export function wynikDnia(w: PartnerTydzienWiersz): { wynik: number; punkty: number } {
  let mozliwe = 2;
  let zrobione = (w.jedzenie ? 1 : 0) + (w.trening ? 1 : 0);
  if (w.nawyki_n > 0) {
    mozliwe += 1;
    zrobione += w.nawyki_ok / w.nawyki_n;
  }
  if (w.skin_n > 0) {
    mozliwe += 1;
    zrobione += w.skin_ok / w.skin_n;
  }
  return { wynik: zrobione / mozliwe, punkty: Math.round(zrobione * 10) / 10 };
}

export function dniOsoby(wiersze: PartnerTydzienWiersz[], kto: "ja" | "on"): DzienOsoby[] {
  return wiersze
    .filter((w) => w.kto === kto)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((w) => {
      const { wynik, punkty } = wynikDnia(w);
      return { data: w.data, wynik, zaliczony: wynik >= PROG_ZALICZENIA, punkty };
    });
}

/**
 * Seria dni, w których zaliczyli oboje, liczona od dziś wstecz. Dzisiejszy
 * niedokończony dzień nie zrywa serii: liczymy wtedy od wczoraj.
 */
export function seriaRazem(ja: DzienOsoby[], on: DzienOsoby[], dzis: string): number {
  const onPo = new Map(on.map((d) => [d.data, d]));
  const dni = [...ja].sort((a, b) => b.data.localeCompare(a.data));
  let seria = 0;
  for (const d of dni) {
    if (d.data > dzis) continue;
    const razem = d.zaliczony && !!onPo.get(d.data)?.zaliczony;
    if (razem) seria++;
    else if (d.data === dzis) continue;
    else break;
  }
  return seria;
}

/** Punkty z ostatnich 7 dni do dziś włącznie. */
export function punktyTygodnia(dni: DzienOsoby[], dzis: string): number {
  const posortowane = dni.filter((d) => d.data <= dzis).sort((a, b) => b.data.localeCompare(a.data));
  const suma = posortowane.slice(0, 7).reduce((s, d) => s + d.punkty, 0);
  return Math.round(suma * 10) / 10;
}
