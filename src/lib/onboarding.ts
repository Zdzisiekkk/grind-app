/**
 * Dobieranie planu do odpowiedzi z kreatora.
 *
 * Zasada jest jedna: sprzęt to warunek twardy, reszta to preferencja.
 * Podanie komuś bez siłowni planu ze sztangą nie jest „prawie trafione" —
 * jest bezużyteczne. Liczba dni i poziom mogą się nie zgadzać idealnie,
 * bo plan da się przerobić po skopiowaniu.
 */

import type { ActivityLevel } from "@/lib/nutrition";

export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "gym" | "minimal" | "home";

export type TemplatePlan = {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  days_per_week: number | null;
  level: Experience | null;
  equipment: Equipment | null;
  tags: string[];
};

export type Answers = {
  goal: "cut" | "maintain" | "bulk";
  experience: Experience;
  daysPerWeek: number;
  equipment: Equipment;
};

/** Czego wymaga plan kontra to, co człowiek ma pod ręką. */
const CAN_USE: Record<Equipment, Equipment[]> = {
  home: ["home"],
  minimal: ["home", "minimal"],
  gym: ["home", "minimal", "gym"],
};

const LEVEL_ORDER: Experience[] = ["beginner", "intermediate", "advanced"];

export type Match = { plan: TemplatePlan; score: number; why: string };

/**
 * Plany posortowane od najlepiej pasującego. Pierwszy jest propozycją,
 * reszta zostaje widoczna — nikt nie lubi, gdy aplikacja decyduje za niego
 * bez pokazania alternatyw.
 */
export function matchPlans(plans: TemplatePlan[], answers: Answers): Match[] {
  const usable = CAN_USE[answers.equipment];

  return plans
    .filter((p) => p.equipment != null && usable.includes(p.equipment))
    .map((plan) => {
      const dayGap = Math.abs((plan.days_per_week ?? 3) - answers.daysPerWeek);
      const levelGap = Math.abs(
        LEVEL_ORDER.indexOf(plan.level ?? "beginner") - LEVEL_ORDER.indexOf(answers.experience),
      );

      // Dni ważą więcej niż poziom: plan, na który nie masz czasu, jest gorszy
      // niż plan odrobinę za łatwy albo za trudny.
      let score = 100 - dayGap * 20 - levelGap * 12;

      // Cel podbija tylko delikatnie — sam plan treningowy rzadko decyduje
      // o tym, czy chudniesz. Robi to dieta.
      if (answers.goal === "cut" && plan.tags.includes("fatloss")) score += 8;
      if (answers.goal === "bulk" && plan.tags.includes("muscle")) score += 8;

      // Plan rehabilitacyjny nie może wyskoczyć jako domyślny komuś, kto nic
      // nie mówił o kontuzji — trafia tam tylko świadomie, z listy.
      if (plan.tags.includes("rehab")) score -= 40;

      const why =
        dayGap === 0
          ? `Dokładnie ${answers.daysPerWeek} dni w tygodniu`
          : `${plan.days_per_week} dni w tygodniu zamiast ${answers.daysPerWeek}`;

      return { plan, score, why };
    })
    .sort((a, b) => b.score - a.score || a.plan.name.localeCompare(b.plan.name, "pl"));
}

/**
 * Poziom aktywności podpowiadany z liczby treningów.
 *
 * To tylko wartość startowa — w kroku o sobie można ją zmienić, bo praca
 * fizyczna potrafi znaczyć więcej niż cztery wejścia na siłownię.
 */
export function suggestActivity(daysPerWeek: number): ActivityLevel {
  if (daysPerWeek <= 1) return "sedentary";
  if (daysPerWeek <= 2) return "light";
  if (daysPerWeek <= 4) return "moderate";
  if (daysPerWeek <= 6) return "high";
  return "athlete";
}
