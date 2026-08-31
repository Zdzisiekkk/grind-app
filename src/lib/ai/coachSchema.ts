import { z } from "zod";
import { liczba, przytnij, zListy } from "@/lib/ai/limity";

/**
 * Kształt odpowiedzi trenera.
 *
 * Model NIE liczy tu niczego - trend wagi i stagnację wykrywa kod
 * (src/lib/ai/analysis.ts) i podaje mu gotowe liczby. Zadaniem modelu jest
 * wytłumaczyć je po ludzku i zaproponować jedną konkretną zmianę.
 *
 * Stąd twardy limit trzech propozycji: lista dziesięciu rzeczy do poprawy
 * to lista, której nikt nie wykona.
 */
export const CoachProposalSchema = z.object({
  kind: z
    .enum(["diet_kcal", "training", "note"])
    .describe(
      "diet_kcal - proponujesz nowy dzienny cel kaloryczny; training - rada treningowa bez automatycznej zmiany; note - sama obserwacja",
    ),
  title: z.string().max(80).describe("Krótkie zdanie, które użytkownik zobaczy jako nagłówek"),
  rationale: z
    .string()
    .max(600)
    .describe(
      "Dlaczego. Powołujesz się na konkretne liczby z podanych faktów. Bez motywacyjnych ogólników.",
    ),
  daily_kcal: z
    .number()
    .int()
    .min(1200)
    .max(6000)
    .nullable()
    .describe("Nowy cel kaloryczny - wypełniasz WYŁĄCZNIE przy kind = diet_kcal, inaczej null"),
});

export const CoachAnalysisSchema = z.object({
  summary: z
    .string()
    .max(400)
    .describe("Dwa-trzy zdania podsumowania okresu. Konkretnie, po polsku, bez komplementów."),
  proposals: z.array(CoachProposalSchema).max(3),
});

export type CoachAnalysis = z.infer<typeof CoachAnalysisSchema>;

/* ------------------------------------------------------------------
 * Schemat dla modelu i sprowadzanie odpowiedzi do limitów
 *
 * Powód w src/lib/ai/limity.ts: ograniczenia powyżej nie wiążą modelu, ale
 * wywracają całą odpowiedź przy walidacji. Trener bez tego przepadał, gdy
 * uzasadnienie wyszło na 610 znaków zamiast 600.
 * ------------------------------------------------------------------ */

export const RODZAJE_PROPOZYCJI = ["diet_kcal", "training", "note"] as const;
export type RodzajPropozycji = (typeof RODZAJE_PROPOZYCJI)[number];

const CoachProposalWire = z.object({
  kind: z
    .string()
    .describe(
      "diet_kcal - proponujesz nowy dzienny cel kaloryczny; training - rada treningowa bez automatycznej zmiany; note - sama obserwacja. Dokładnie jeden z tych trzech napisów.",
    ),
  title: z.string().describe("Krótkie zdanie, nagłówek dla użytkownika. Do 80 znaków."),
  rationale: z
    .string()
    .describe(
      "Dlaczego. Powołujesz się na konkretne liczby z podanych faktów, bez ogólników. Do 600 znaków.",
    ),
  daily_kcal: z
    .number()
    .nullable()
    .describe("Nowy cel kaloryczny 1200-6000 - WYŁĄCZNIE przy kind = diet_kcal, inaczej null"),
});

export const CoachAnalysisWireSchema = z.object({
  summary: z.string().describe("Dwa-trzy zdania podsumowania okresu, do 400 znaków. Po polsku."),
  proposals: z.array(CoachProposalWire).describe("Najwyżej trzy propozycje."),
});

export type CoachAnalysisWire = z.infer<typeof CoachAnalysisWireSchema>;

/**
 * Odpowiedź trenera sprowadzona do kontraktu ekranu.
 *
 * Jedna reguła jest tu ważniejsza od przycinania tekstu: propozycja zmiany
 * kalorii BEZ sensownej liczby przestaje być propozycją zmiany kalorii.
 * Inaczej ekran pokazałby przycisk "zastosuj", który nie ma czego zastosować.
 */
export function normalizujTrenera(surowa: CoachAnalysisWire): CoachAnalysis {
  const proposals = (surowa.proposals ?? [])
    .map((p) => {
      const kind = zListy<RodzajPropozycji>(p.kind ?? "", RODZAJE_PROPOZYCJI, "note");
      const kcal =
        p.daily_kcal == null || !Number.isFinite(p.daily_kcal)
          ? null
          : liczba(p.daily_kcal, 1200, 6000);

      return {
        kind: kind === "diet_kcal" && kcal === null ? ("note" as const) : kind,
        title: przytnij(p.title ?? "", 80),
        rationale: przytnij(p.rationale ?? "", 600),
        // Liczba tylko tam, gdzie znaczy zmianę celu. Przy radzie treningowej
        // byłaby ozdobą, którą ktoś kiedyś weźmie za zalecenie.
        daily_kcal: kind === "diet_kcal" ? kcal : null,
      };
    })
    .filter((p) => p.title.length > 0)
    .slice(0, 3);

  return { summary: przytnij(surowa.summary ?? "", 400), proposals };
}
