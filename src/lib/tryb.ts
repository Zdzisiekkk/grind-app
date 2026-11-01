import type { TrybKonta } from "./database.types";

/*
 * Tryb uproszczony: kalorie, treningi, skin care i nawyki - plus ekran pary.
 *
 * Lista dozwolonych ścieżek jest jedna, tutaj, a bramka stoi w layoucie
 * aplikacji. Ukrycie linków w nawigacji to tylko wygoda; ktoś, kto zna adres
 * /finanse, i tak musi na niego nie trafić.
 */

/** Prefiksy ekranów dostępnych w trybie uproszczonym. */
const DOZWOLONE_PREFIKSY = [
  "/trening",
  "/plan",
  "/cwiczenia",
  "/dieta",
  "/nawyki",
  "/skincare",
  "/partner",
  "/progres",
  "/profil",
  "/pomoc",
  "/wiecej",
  "/subskrypcja",
  "/admin",
] as const;

/** Podstrony, które w trybie uproszczonym zostają zamknięte mimo dozwolonego prefiksu. */
const ZAMKNIETE_PODSTRONY = ["/nawyki/nalogi", "/nawyki/ksiazki"] as const;

const pasuje = (sciezka: string, prefiks: string) =>
  sciezka === prefiks || sciezka.startsWith(`${prefiks}/`);

export function sciezkaDozwolona(tryb: TrybKonta, sciezka: string): boolean {
  if (tryb === "pelny") return true;
  if (sciezka === "/") return true;
  if (ZAMKNIETE_PODSTRONY.some((p) => pasuje(sciezka, p))) return false;
  return DOZWOLONE_PREFIKSY.some((p) => pasuje(sciezka, p));
}
