import { z } from "zod";

/**
 * Kształt odpowiedzi trenera.
 *
 * Model NIE liczy tu niczego — trend wagi i stagnację wykrywa kod
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
      "diet_kcal — proponujesz nowy dzienny cel kaloryczny; training — rada treningowa bez automatycznej zmiany; note — sama obserwacja",
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
    .describe("Nowy cel kaloryczny — wypełniasz WYŁĄCZNIE przy kind = diet_kcal, inaczej null"),
});

export const CoachAnalysisSchema = z.object({
  summary: z
    .string()
    .max(400)
    .describe("Dwa–trzy zdania podsumowania okresu. Konkretnie, po polsku, bez komplementów."),
  proposals: z.array(CoachProposalSchema).max(3),
});

export type CoachAnalysis = z.infer<typeof CoachAnalysisSchema>;
