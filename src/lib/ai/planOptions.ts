/**
 * Opcje formularza planu — świadomie BEZ zoda.
 *
 * Arkusz „Ułóż plan" jest komponentem klienckim i potrzebuje z tego pliku
 * dwóch drobiazgów: listy sprzętu i etykiet stażu. Gdy leżały obok schematów
 * zod, do telefonu jechała cała biblioteka walidacji (≈290 kB) tylko po to,
 * żeby narysować dziesięć checkboksów. Schematy zostają na serwerze,
 * w planSchema.ts, i biorą wartości stąd — więc nie ma dwóch źródeł prawdy.
 */

export const EQUIPMENT_OPTIONS = [
  "sztanga",
  "hantle",
  "kettlebell",
  "maszyny",
  "wyciąg",
  "drążek",
  "gumy oporowe",
  "piłka lekarska",
  "rower / ergometr",
  "tylko masa ciała",
] as const;

/** Wartości stażu — tej samej listy używa schemat po stronie serwera. */
export const EXPERIENCE_VALUES = ["beginner", "intermediate", "advanced"] as const;

export type Experience = (typeof EXPERIENCE_VALUES)[number];

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: "początkujący",
  intermediate: "średniozaawansowany",
  advanced: "zaawansowany",
};
