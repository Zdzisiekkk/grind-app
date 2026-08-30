/**
 * Szacowanie zapotrzebowania kalorycznego.
 *
 * To jest PUNKT STARTOWY, nie wyrocznia. Każdy wzór na zapotrzebowanie ma
 * rozrzut rzędu ±10 %, bo nie zna Twojej genetyki, pracy zawodowej ani tego,
 * ile naprawdę się ruszasz poza treningiem. Prawdziwą odpowiedź daje dopiero
 * waga z dwóch tygodni przy trzymanych kaloriach - i to dlatego aplikacja
 * pilnuje jednego i drugiego.
 *
 * Wzór: Mifflin-St Jeor. Wybrany, bo przy zwykłych ludziach myli się mniej
 * niż starszy Harris-Benedict, a do liczenia nie potrzebuje pomiaru tkanki
 * tłuszczowej, którego i tak nikt nie ma pod ręką.
 */

export type Sex = "m" | "f" | "other";
export type Goal = "cut" | "maintain" | "bulk";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "athlete";

export const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  label: string;
  hint: string;
  factor: number;
}[] = [
  { value: "sedentary", label: "Siedzący", hint: "Praca przy biurku, bez treningów", factor: 1.2 },
  { value: "light", label: "Lekko aktywny", hint: "1-2 treningi w tygodniu", factor: 1.375 },
  { value: "moderate", label: "Aktywny", hint: "3-4 treningi w tygodniu", factor: 1.55 },
  { value: "high", label: "Bardzo aktywny", hint: "5-6 treningów albo praca fizyczna", factor: 1.725 },
  { value: "athlete", label: "Wyczynowo", hint: "Dwa treningi dziennie, obóz", factor: 1.9 },
];

export const GOALS: { value: Goal; label: string; hint: string; icon: string }[] = [
  { value: "cut", label: "Redukcja", hint: "Schudnąć, zachowując mięśnie", icon: "📉" },
  { value: "maintain", label: "Utrzymanie", hint: "Trzymać wagę, poprawiać formę", icon: "⚖️" },
  { value: "bulk", label: "Masa", hint: "Przybrać, głównie mięśni", icon: "📈" },
];

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.value === level)?.factor ?? 1.55;
}

/** Podstawowa przemiana materii - ile spalasz, leżąc cały dzień. */
export function bmr({
  weightKg,
  heightCm,
  age,
  sex,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // Wzór ma dwie wersje. Przy "inna / nie podaję" bierzemy średnią z obu -
  // to uczciwsze niż ciche przypisanie do jednej płci.
  if (sex === "m") return base + 5;
  if (sex === "f") return base - 161;
  return base - 78;
}

export type NutritionTargets = {
  bmr: number;
  /** Całkowite zapotrzebowanie z uwzględnieniem aktywności. */
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Czego spodziewać się na wadze - do pokazania człowiekowi. */
  expectation: string;
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Cele dzienne.
 *
 * Deficyt 20 % zamiast popularnych "minus 500 kcal", bo pięćset kalorii to
 * zupełnie co innego przy 1800, a co innego przy 3200 kcal. Nadwyżka jest
 * celowo mała (10 %) - szybszy przyrost to głównie tłuszcz.
 *
 * Białko liczymy od masy ciała: 2,0 g/kg na redukcji (chroni mięśnie przy
 * deficycie), 1,8 g/kg poza nią. Tłuszcz nie schodzi poniżej 0,8 g/kg, bo
 * niżej zaczynają cierpieć hormony. Reszta to węglowodany - one napędzają
 * trening, więc dostają to, co zostanie.
 */
export function nutritionTargets({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: Goal;
}): NutritionTargets {
  const base = bmr({ weightKg, heightCm, age, sex });
  const tdee = base * activityFactor(activity);

  const kcal = Math.round(
    goal === "cut" ? tdee * 0.8 : goal === "bulk" ? tdee * 1.1 : tdee,
  );

  const protein = Math.round(weightKg * (goal === "cut" ? 2.0 : 1.8));
  const fat = Math.max(
    Math.round(weightKg * 0.8),
    Math.round((kcal * 0.25) / KCAL_PER_G.fat),
  );
  const carbs = Math.max(
    0,
    Math.round(
      (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs,
    ),
  );

  const expectation =
    goal === "cut"
      ? "Około 0,5 kg tygodniowo. Szybciej znaczy zwykle mniej mięśni."
      : goal === "bulk"
        ? "Około 0,25 kg tygodniowo. Szybciej to głównie tłuszcz."
        : "Waga ma stać w miejscu - wahania w ciągu doby to woda, nie tłuszcz.";

  return { bmr: Math.round(base), tdee: Math.round(tdee), kcal, protein, carbs, fat, expectation };
}

/**
 * Czy plan po dwóch tygodniach działa.
 *
 * Ta funkcja jest powodem, dla którego w ogóle liczymy cele: wzór daje pierwszy
 * strzał, a dopiero porównanie z wagą mówi, o ile go poprawić. Dokładnie tego
 * użyje później AI-trener w filarze "dieta kontra waga".
 */
export function verdictOnPace({
  goal,
  weeklyChangeKg,
}: {
  goal: Goal;
  weeklyChangeKg: number;
}): { onTrack: boolean; message: string; suggestKcal: number } {
  const round = (n: number) => Math.round(n / 25) * 25;

  if (goal === "cut") {
    if (weeklyChangeKg > -0.2)
      return {
        onTrack: false,
        message: "Waga prawie nie schodzi - zapotrzebowanie było przeszacowane.",
        suggestKcal: -round(200),
      };
    if (weeklyChangeKg < -1.0)
      return {
        onTrack: false,
        message: "Schodzisz za szybko. Przy takim tempie tracisz też mięśnie.",
        suggestKcal: round(200),
      };
    return { onTrack: true, message: "Tempo w sam raz - nic nie zmieniaj.", suggestKcal: 0 };
  }

  if (goal === "bulk") {
    if (weeklyChangeKg < 0.1)
      return {
        onTrack: false,
        message: "Waga stoi - nadwyżka jest za mała albo jesz mniej, niż zapisujesz.",
        suggestKcal: round(200),
      };
    if (weeklyChangeKg > 0.5)
      return {
        onTrack: false,
        message: "Przybierasz za szybko, to głównie tłuszcz.",
        suggestKcal: -round(200),
      };
    return { onTrack: true, message: "Tempo w sam raz - nic nie zmieniaj.", suggestKcal: 0 };
  }

  if (Math.abs(weeklyChangeKg) <= 0.3)
    return { onTrack: true, message: "Waga trzyma się stabilnie.", suggestKcal: 0 };

  return {
    onTrack: false,
    message:
      weeklyChangeKg > 0 ? "Waga rośnie, choć miała stać." : "Waga spada, choć miała stać.",
    suggestKcal: weeklyChangeKg > 0 ? -round(150) : round(150),
  };
}
