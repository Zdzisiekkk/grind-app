"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, Chip, Field, Input, Stat } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { clsx } from "@/lib/clsx";
import { finishOnboarding, skipOnboarding, type OnboardingInput } from "@/app/start/actions";
import {
  ACTIVITY_LEVELS,
  GOALS,
  nutritionTargets,
  type ActivityLevel,
  type Goal,
  type Sex,
} from "@/lib/nutrition";
import {
  matchPlans,
  suggestActivity,
  type Equipment,
  type Experience,
  type TemplatePlan,
} from "@/lib/onboarding";

const EXPERIENCES: { value: Experience; label: string; hint: string; icon: string }[] = [
  { value: "beginner", label: "Zaczynam", hint: "Pierwszy rok albo powrót po przerwie", icon: "🌱" },
  { value: "intermediate", label: "Coś już umiem", hint: "Trenuję regularnie od roku lub dłużej", icon: "💪" },
  { value: "advanced", label: "Mam przebieg", hint: "Kilka lat, znam swoje ciężary", icon: "🔥" },
];

const EQUIPMENT: { value: Equipment; label: string; hint: string; icon: string }[] = [
  { value: "gym", label: "Siłownia", hint: "Sztanga, maszyny, wyciągi", icon: "🏋️" },
  { value: "minimal", label: "Hantle i drążek", hint: "Domowy kącik albo garaż", icon: "🏠" },
  { value: "home", label: "Nic nie mam", hint: "Podłoga, krzesło, masa ciała", icon: "🧘" },
];

const SEXES: { value: Sex; label: string }[] = [
  { value: "m", label: "Mężczyzna" },
  { value: "f", label: "Kobieta" },
  { value: "other", label: "Nie podaję" },
];

const STEPS = ["Cel", "Staż", "Sprzęt", "Ty", "Plan"] as const;

export function StartWizard({ plans, email }: { plans: TemplatePlan[]; email: string | null }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState<Goal>("maintain");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<Equipment>("gym");
  const [sex, setSex] = useState<Sex>("m");
  const [birthYear, setBirthYear] = useState<number | null>(1998);
  const [heightCm, setHeightCm] = useState<number | null>(180);
  const [weightKg, setWeightKg] = useState<number | null>(80);
  const [activityTouched, setActivityTouched] = useState<ActivityLevel | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  // Poziom aktywności podpowiadamy z liczby treningów, dopóki nikt go nie
  // ruszył. Wyliczamy to w trakcie renderu, żeby nie synchronizować stanu
  // efektem — inaczej wybór użytkownika mrugałby przy każdej zmianie dni.
  const activity: ActivityLevel = activityTouched ?? suggestActivity(daysPerWeek);

  const matches = useMemo(
    () => matchPlans(plans, { goal, experience, daysPerWeek, equipment }),
    [plans, goal, experience, daysPerWeek, equipment],
  );

  const chosenId = planId ?? matches[0]?.plan.id ?? null;

  const targets = useMemo(() => {
    if (!birthYear || !heightCm || !weightKg) return null;
    return nutritionTargets({
      weightKg,
      heightCm,
      age: new Date().getFullYear() - birthYear,
      sex,
      activity,
      goal,
    });
  }, [weightKg, heightCm, birthYear, sex, activity, goal]);

  const dataComplete = Boolean(birthYear && heightCm && weightKg);

  function submit() {
    if (!dataComplete) return;
    setError(null);

    const input: OnboardingInput = {
      goal,
      experience,
      daysPerWeek,
      equipment,
      activity,
      sex,
      birthYear: birthYear as number,
      heightCm: heightCm as number,
      weightKg: weightKg as number,
      planId: chosenId,
    };

    startTransition(async () => {
      try {
        await finishOnboarding(input);
      } catch (e) {
        // redirect() z akcji serwerowej rzuca celowo — to nie jest błąd.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
        setError(e instanceof Error ? e.message : "Coś poszło nie tak.");
      }
    });
  }

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Zaczynamy</h1>
            <p className="text-[13px] text-muted">
              Pięć pytań i masz gotowy plan oraz policzone kalorie.
            </p>
          </div>
          <form action={skipOnboarding}>
            <button type="submit" className="shrink-0 text-[13px] font-medium text-faint underline">
              Pomiń
            </button>
          </form>
        </div>

        <ol className="flex gap-1" aria-label="Postęp kreatora">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <div
                className={clsx(
                  "h-1 rounded-full transition-colors",
                  i <= step ? "bg-accent" : "bg-surface-2",
                )}
              />
              <span
                className={clsx(
                  "mt-1 block text-[10px] font-medium",
                  i === step ? "text-accent" : "text-faint",
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="flex-1">
        {step === 0 && (
          <Section title="Co chcesz osiągnąć?" hint="Od tego zależą kalorie, nie sam trening.">
            <Choices
              options={GOALS}
              value={goal}
              onChange={(v) => setGoal(v as Goal)}
            />
          </Section>
        )}

        {step === 1 && (
          <Section title="Ile już trenujesz?" hint="Chodzi o staż, nie o to, jak się czujesz.">
            <Choices
              options={EXPERIENCES}
              value={experience}
              onChange={(v) => setExperience(v as Experience)}
            />
            <Field
              label="Ile dni w tygodniu realnie dasz radę"
              hint="Lepiej wpisać uczciwe trzy niż ambitne sześć. Plan dobierze się pod tę liczbę, a Health Score będzie ją traktował jako komplet."
              className="mt-5"
            >
              <NumberStepper
                ariaLabel="Dni treningowe w tygodniu"
                value={daysPerWeek}
                onChange={(v) => setDaysPerWeek(Math.max(1, Math.min(7, v ?? 3)))}
                step={1}
                min={1}
                max={7}
                size="lg"
              />
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section title="Gdzie trenujesz?" hint="To jedyna odpowiedź, która twardo odsiewa plany.">
            <Choices
              options={EQUIPMENT}
              value={equipment}
              onChange={(v) => setEquipment(v as Equipment)}
            />
          </Section>
        )}

        {step === 3 && (
          <Section
            title="Kilka liczb o Tobie"
            hint="Potrzebne wyłącznie do policzenia zapotrzebowania. Zostają na Twoim koncie."
          >
            <div className="flex flex-col gap-4">
              <Field label="Płeć">
                <div className="grid grid-cols-3 gap-1.5">
                  {SEXES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSex(s.value)}
                      aria-pressed={sex === s.value}
                      className={clsx(
                        "min-h-11 rounded-xl text-[13px] font-semibold transition-colors",
                        sex === s.value ? "bg-accent text-[var(--accent-fg)]" : "bg-surface-2 text-muted",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-2">
                <Field label="Rok urodzenia">
                  <Input
                    inputMode="numeric"
                    value={birthYear ?? ""}
                    onChange={(e) => setBirthYear(Number(e.target.value) || null)}
                    placeholder="1998"
                  />
                </Field>
                <Field label="Wzrost (cm)">
                  <Input
                    inputMode="numeric"
                    value={heightCm ?? ""}
                    onChange={(e) => setHeightCm(Number(e.target.value) || null)}
                    placeholder="180"
                  />
                </Field>
                <Field label="Waga (kg)">
                  <Input
                    inputMode="decimal"
                    value={weightKg ?? ""}
                    onChange={(e) => setWeightKg(Number(e.target.value.replace(",", ".")) || null)}
                    placeholder="80"
                  />
                </Field>
              </div>

              <Field
                label="Jak wygląda Twój dzień poza treningiem"
                hint="Podpowiedź wzięliśmy z liczby treningów — popraw, jeśli pracujesz fizycznie albo siedzisz cały dzień."
              >
                <div className="flex flex-col gap-1.5">
                  {ACTIVITY_LEVELS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setActivityTouched(a.value)}
                      aria-pressed={activity === a.value}
                      className={clsx(
                        "flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-[14px] transition-colors",
                        activity === a.value ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
                      )}
                    >
                      <span className="font-semibold">{a.label}</span>
                      <span className="text-[12px] text-muted">{a.hint}</span>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Section>
        )}

        {step === 4 && (
          <Section title="Tak to wygląda" hint="Wszystko da się później zmienić w profilu.">
            <div className="flex flex-col gap-4">
              {matches.length === 0 ? (
                <Alert tone="warn">
                  Przy takim zestawie nie mam gotowego planu. Wejdziesz bez niego — plan wybierzesz
                  albo ułożysz sam w zakładce „Plany”.
                </Alert>
              ) : (
                <div className="flex flex-col gap-2">
                  {matches.slice(0, 3).map((m, i) => (
                    <button
                      key={m.plan.id}
                      type="button"
                      onClick={() => setPlanId(m.plan.id)}
                      aria-pressed={chosenId === m.plan.id}
                      className={clsx(
                        "rounded-[var(--radius)] border p-4 text-left transition-colors",
                        chosenId === m.plan.id
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-surface",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[15px] font-bold leading-tight">{m.plan.name}</span>
                        {i === 0 && <Chip tone="accent">nasza propozycja</Chip>}
                      </div>
                      <p className="mt-1 text-[13px] leading-snug text-muted">{m.plan.description}</p>
                      <p className="mt-1.5 text-[12px] text-faint">{m.why}</p>
                    </button>
                  ))}
                </div>
              )}

              {targets && (
                <Card title="Twoje cele dzienne" subtitle={targets.expectation}>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Kalorie" value={targets.kcal} tone="accent" sub="kcal" />
                    <Stat label="Białko" value={`${targets.protein} g`} />
                    <Stat label="Węglowodany" value={`${targets.carbs} g`} />
                    <Stat label="Tłuszcz" value={`${targets.fat} g`} />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-faint">
                    To wyliczenie ze wzoru, nie pomiar — każdy taki wzór myli się o jakieś 10 %.
                    Prawdziwą odpowiedź da waga po dwóch tygodniach i wtedy poprawimy cel.
                  </p>
                </Card>
              )}
            </div>
          </Section>
        )}
      </div>

      <footer className="flex gap-2 pb-2">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
            Wstecz
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button variant="primary" size="lg" block onClick={() => setStep(step + 1)}>
            Dalej
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            block
            loading={pending}
            disabled={!dataComplete}
            onClick={submit}
          >
            {dataComplete ? "Zaczynamy" : "Uzupełnij liczby"}
          </Button>
        )}
      </footer>

      {email && <p className="pb-2 text-center text-[11px] text-faint">Konto: {email}</p>}
    </div>
  );
}

/* -------------------------------- Kawałki --------------------------------- */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[19px] font-bold leading-tight">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-[13px] text-muted">{hint}</p>}
      {children}
    </section>
  );
}

/** Duże kafle wyboru — jeden kciuk, żadnego celowania. */
function Choices({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string; hint: string; icon: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            "flex min-h-16 items-center gap-3 rounded-[var(--radius)] border px-4 text-left transition-colors",
            value === o.value ? "border-accent bg-accent-soft" : "border-border bg-surface",
          )}
        >
          <span className="text-2xl" aria-hidden>
            {o.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">{o.label}</span>
            <span className="block text-[13px] text-muted">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
