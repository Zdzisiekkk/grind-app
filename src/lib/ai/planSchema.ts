import { z } from "zod";
import { EXPERIENCE_VALUES } from "@/lib/ai/planOptions";

/**
 * Kształt planu, jakiego oczekujemy od modelu.
 * Ten sam schemat wymusza format odpowiedzi (structured outputs) i waliduje
 * wynik przed zapisem do bazy — nie ufamy odpowiedzi na słowo.
 */

export const AiExerciseSchema = z.object({
  slug: z
    .string()
    .describe("Slug ćwiczenia z podanego katalogu. Pusty string, jeśli ćwiczenia nie ma w katalogu."),
  name: z.string().describe("Nazwa ćwiczenia po polsku."),
  target_sets: z.number().int().min(1).max(12),
  target_reps: z
    .string()
    .describe('Powtórzenia jako tekst, np. "6-8", "10/stronę", "40s", "15-20 min".'),
  target_note: z.string().describe('Krótka adnotacja albo pusty string, np. "opcjonalnie".'),
  technique_notes: z
    .string()
    .describe("Jedna wskazówka techniczna dla tego ćwiczenia w tym dniu, albo pusty string."),
  rest_seconds: z.number().int().min(0).max(600).describe("Przerwa między seriami w sekundach."),
});

export const AiDaySchema = z.object({
  name: z.string().describe('Nazwa dnia, np. "Dzień A — góra ciała".'),
  short_label: z.string().describe('Skrót do 4 znaków, np. "A".'),
  description: z.string().describe("Jedno zdanie o celu tego dnia."),
  day_type: z.enum(["gym", "conditioning", "mobility", "mma", "other"]),
  tracks_pain: z
    .boolean()
    .describe("true dla dni obciążających miejsce zgłoszonej kontuzji — wtedy apka poprosi po treningu o ocenę bólu."),
  exercises: z.array(AiExerciseSchema).min(1).max(12),
});

export const AiPhaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  frequency: z.string().describe('np. "3x/tydzień".'),
  days: z.array(AiDaySchema).min(1).max(8),
});

export const AiPlanSchema = z.object({
  name: z.string().describe("Krótka nazwa planu po polsku."),
  description: z.string().describe("2–3 zdania: dla kogo i na czym polega."),
  goal: z.string().describe("Cel planu w jednym zdaniu."),
  coach_notes: z
    .string()
    .describe("Uwagi trenerskie: progresja, na co uważać, kiedy zwiększać ciężar. Kilka zdań."),
  phases: z.array(AiPhaseSchema).min(1).max(3),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

export const PlanRequestSchema = z.object({
  goal: z.string().min(3).max(500),
  days_per_week: z.number().int().min(1).max(7),
  experience: z.enum(EXPERIENCE_VALUES),
  session_minutes: z.number().int().min(15).max(180),
  equipment: z.array(z.string()).max(20),
  limitations: z.string().max(1000),
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/**
 * Stałe formularza mieszkają w planOptions.ts (bez zoda), żeby przeglądarka
 * mogła je wziąć, nie ciągnąc za sobą całej walidacji. Serwer i tak importuje
 * ten plik, więc wystawiamy je dalej.
 */
export { EQUIPMENT_OPTIONS, EXPERIENCE_LABEL, EXPERIENCE_VALUES } from "@/lib/ai/planOptions";
export type { Experience } from "@/lib/ai/planOptions";
