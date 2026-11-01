import type { PartnerKontekst } from "@/lib/database.types";

export type RodzajWiadomosci = "szturch" | "reakcja" | "wiadomosc";

export type Wyslij = (
  rodzaj: RodzajWiadomosci,
  kontekst: PartnerKontekst,
  tresc?: string,
  emoji?: string,
) => void;

export const SKROTY_WIADOMOSCI = [
  "Dasz radę! 🔥",
  "Dziś trening razem? 💪",
  "Pamiętaj o wodzie 💧",
  "Zjedz coś porządnego 🍳",
  "Skin care czeka ✨",
  "Świetna robota! 👏",
] as const;
