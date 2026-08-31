import { z } from "zod";
import { EXPERIENCE_VALUES } from "@/lib/ai/planOptions";
import { liczba, przytnij, zListy } from "@/lib/ai/limity";

/**
 * Kształt planu, jakiego oczekujemy od modelu.
 * Ten sam schemat wymusza format odpowiedzi (structured outputs) i waliduje
 * wynik przed zapisem do bazy - nie ufamy odpowiedzi na słowo.
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
  name: z.string().describe('Nazwa dnia, np. "Dzień A - góra ciała".'),
  short_label: z.string().describe('Skrót do 4 znaków, np. "A".'),
  description: z.string().describe("Jedno zdanie o celu tego dnia."),
  day_type: z.enum(["gym", "conditioning", "mobility", "mma", "other"]),
  tracks_pain: z
    .boolean()
    .describe("true dla dni obciążających miejsce zgłoszonej kontuzji - wtedy apka poprosi po treningu o ocenę bólu."),
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
  description: z.string().describe("2-3 zdania: dla kogo i na czym polega."),
  goal: z.string().describe("Cel planu w jednym zdaniu."),
  coach_notes: z
    .string()
    .describe("Uwagi trenerskie: progresja, na co uważać, kiedy zwiększać ciężar. Kilka zdań."),
  phases: z.array(AiPhaseSchema).min(1).max(3),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

/* ------------------------------------------------------------------
 * Schemat dla modelu i sprowadzanie planu do limitów
 *
 * Powód w src/lib/ai/limity.ts. Tutaj stawka jest wyższa niż gdzie indziej:
 * plan idzie prosto do bazy, więc dzień bez ćwiczeń albo seria "0" nie jest
 * kosmetyczną usterką, tylko planem, którego nie da się wykonać.
 * ------------------------------------------------------------------ */

export const TYPY_DNIA = ["gym", "conditioning", "mobility", "mma", "other"] as const;
export type TypDnia = (typeof TYPY_DNIA)[number];

const AiExerciseWire = z.object({
  slug: z.string().describe("Slug ćwiczenia z podanego katalogu. Pusty string, jeśli go tam nie ma."),
  name: z.string().describe("Nazwa ćwiczenia po polsku."),
  target_sets: z.number().describe("Liczba serii, 1-12."),
  target_reps: z.string().describe('Powtórzenia jako tekst, np. "6-8", "10/stronę", "40s".'),
  target_note: z.string().describe('Krótka adnotacja albo pusty string, np. "opcjonalnie".'),
  technique_notes: z.string().describe("Jedna wskazówka techniczna albo pusty string."),
  rest_seconds: z.number().describe("Przerwa między seriami w sekundach, 0-600."),
});

const AiDayWire = z.object({
  name: z.string().describe('Nazwa dnia, np. "Dzień A - góra ciała".'),
  short_label: z.string().describe('Skrót do 4 znaków, np. "A".'),
  description: z.string().describe("Jedno zdanie o celu tego dnia."),
  day_type: z.string().describe(`Dokładnie jeden z: ${TYPY_DNIA.join(", ")}.`),
  tracks_pain: z.boolean().describe("true dla dni obciążających miejsce zgłoszonej kontuzji."),
  exercises: z.array(AiExerciseWire).describe("Od 1 do 12 ćwiczeń."),
});

const AiPhaseWire = z.object({
  name: z.string(),
  description: z.string(),
  frequency: z.string().describe('np. "3x/tydzień".'),
  days: z.array(AiDayWire).describe("Od 1 do 8 dni."),
});

export const AiPlanWireSchema = z.object({
  name: z.string().describe("Krótka nazwa planu po polsku."),
  description: z.string().describe("2-3 zdania: dla kogo i na czym polega."),
  goal: z.string().describe("Cel planu w jednym zdaniu."),
  coach_notes: z.string().describe("Uwagi trenerskie: progresja, na co uważać. Kilka zdań."),
  phases: z.array(AiPhaseWire).describe("Od 1 do 3 faz."),
});

export type AiPlanWire = z.infer<typeof AiPlanWireSchema>;

/**
 * Plan sprowadzony do tego, co da się zapisać i wykonać.
 *
 * Ćwiczenie bez nazwy, dzień bez ćwiczeń i faza bez dni wypadają - nie da się
 * ich pokazać ani wykonać, a w bazie zostawiłyby puste gałęzie. Reszta jest
 * dociskana do zakresów: serie 1-12, przerwa 0-600 s.
 */
export function normalizujPlan(surowy: AiPlanWire): AiPlan {
  const phases = (surowy.phases ?? [])
    .map((f) => ({
      name: przytnij(f.name ?? "", 80),
      description: przytnij(f.description ?? "", 500),
      frequency: przytnij(f.frequency ?? "", 40),
      days: (f.days ?? [])
        .map((d) => ({
          name: przytnij(d.name ?? "", 80),
          // Cztery znaki, bo tyle mieści kafelek dnia w planie.
          short_label: przytnij(d.short_label ?? "", 4),
          description: przytnij(d.description ?? "", 300),
          day_type: zListy<TypDnia>(d.day_type ?? "", TYPY_DNIA, "other"),
          tracks_pain: Boolean(d.tracks_pain),
          exercises: (d.exercises ?? [])
            .map((c) => ({
              slug: przytnij(c.slug ?? "", 80),
              name: przytnij(c.name ?? "", 120),
              target_sets: liczba(c.target_sets, 1, 12),
              target_reps: przytnij(c.target_reps ?? "", 40),
              target_note: przytnij(c.target_note ?? "", 80),
              technique_notes: przytnij(c.technique_notes ?? "", 300),
              rest_seconds: liczba(c.rest_seconds, 0, 600),
            }))
            .filter((c) => c.name.length > 0)
            .slice(0, 12),
        }))
        .filter((d) => d.name.length > 0 && d.exercises.length > 0)
        .slice(0, 8),
    }))
    .filter((f) => f.days.length > 0)
    .slice(0, 3);

  return {
    name: przytnij(surowy.name ?? "", 80),
    description: przytnij(surowy.description ?? "", 500),
    goal: przytnij(surowy.goal ?? "", 200),
    coach_notes: przytnij(surowy.coach_notes ?? "", 1500),
    phases,
  };
}


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
