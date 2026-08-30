"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Sheet,
  Stat,
  Textarea,
} from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { SleepScoreRing } from "@/components/sleep/SleepScoreRing";
import { SleepChart, SleepScoreChart } from "@/components/charts/LazyCharts";
import { BEDTIME_PRESETS, SLEEP_FACTORS, WAKE_PRESETS, sleepFactor } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { addDaysISO, humanDate, plural, shortDate } from "@/lib/format";
import { DNI_WSTECZ, najstarszaData } from "@/lib/wstecz";
import {
  ENERGY_LABELS,
  QUALITY_LABELS,
  SLEEP_LEGEND,
  type SleepNight,
  type SleepScore,
  bedtimeAxis,
  factorInsights,
  medianBedtime,
  minToTime,
  scoreNight,
  sleepBand,
  sleepDuration,
  timeToMin,
} from "@/lib/sleep";

/** Noc razem z policzonym wynikiem - liczymy raz, używamy w kilku miejscach. */
export type ScoredNight = { night: SleepNight; score: SleepScore };

const EMPTY = {
  date: "",
  bedtime: "23:00",
  wake_time: "07:00",
  fell_asleep_min: 15,
  awakenings: 0,
  awake_min: 0,
  quality: 3,
  morning_energy: 3 as number | null,
  /*
   * Drzemki osobno, nie jedną sumą. Trzy po 20 minut i jedna godzinna dają
   * tę samą liczbę minut, ale nie to samo dla organizmu - a skoro wchodzą
   * do wyniku nocy, muszą dać się rozróżnić.
   */
  naps: [] as Array<{ minutes: number; start: string | null }>,
  factors: [] as string[],
  note: "",
};

type Draft = typeof EMPTY;

export function SleepScreen({
  userId,
  nights,
  today,
  goalMin,
  targetBedtime,
}: {
  userId: string;
  /** Od najnowszej. */
  nights: SleepNight[];
  today: string;
  goalMin: number;
  targetBedtime: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7" | "30">("7");

  /**
   * Punkt odniesienia regularności: godzina z profilu, a jeśli jej nie ma -
   * mediana ostatnich czternastu nocy. Mediana zamiast średniej, bo jedna
   * impreza nie ma prawa przesunąć "Twojej zwykłej pory".
   */
  const reference = useMemo(
    () => timeToMin(targetBedtime) ?? medianBedtime(nights.slice(0, 14)),
    [targetBedtime, nights],
  );

  const scored: ScoredNight[] = useMemo(
    () => nights.map((night) => ({ night, score: scoreNight(night, { goalMin, referenceBedtime: reference }) })),
    [nights, goalMin, reference],
  );

  const days = range === "7" ? 7 : 30;
  const window = useMemo(() => {
    const from = addDaysISO(today, -(days - 1));
    return scored.filter((s) => s.night.date >= from);
  }, [scored, today, days]);

  const last = scored[0] ?? null;
  const lastIsToday = last?.night.date === today;

  const avgScore = window.length
    ? Math.round(window.reduce((s, x) => s + x.score.total, 0) / window.length)
    : null;
  const avgSleep = window.length
    ? Math.round(window.reduce((s, x) => s + x.night.sleep_min, 0) / window.length)
    : null;

  // Dług snu: ile godzin brakuje do celu w całym oknie. Nadmiar z jednej nocy
  // nie spłaca braku z innej - niedospane godziny się nie zwracają.
  const debtMin = window.reduce((s, x) => s + Math.max(0, goalMin - x.night.sleep_min), 0);

  // Rozrzut pory snu: różnica między najwcześniejszym a najpóźniejszym
  // położeniem się w oknie. Mniej niż godzina to bardzo równy rytm.
  const spread = useMemo(() => {
    const axes = window
      .map((x) => timeToMin(x.night.bedtime))
      .filter((v): v is number => v != null)
      .map(bedtimeAxis);
    if (axes.length < 2) return null;
    return Math.max(...axes) - Math.min(...axes);
  }, [window]);

  const insights = useMemo(
    () => factorInsights(scored.map((s) => ({ night: s.night, score: s.score.total }))),
    [scored],
  );

  const chartData = useMemo(
    () =>
      [...window]
        .reverse()
        .map((x) => ({ date: x.night.date, minutes: x.night.sleep_min, score: x.score.total })),
    [window],
  );

  function openFor(dateISO: string) {
    const existing = nights.find((n) => n.date === dateISO);
    setEditingDate(existing ? dateISO : null);
    setDraft(
      existing
        ? {
            date: dateISO,
            bedtime: existing.bedtime.slice(0, 5),
            wake_time: existing.wake_time.slice(0, 5),
            fell_asleep_min: existing.fell_asleep_min,
            awakenings: existing.awakenings,
            awake_min: existing.awake_min,
            quality: existing.quality,
            morning_energy: existing.morning_energy,
            naps: (existing.naps ?? []).map((n) => ({
              minutes: n.minutes,
              start: n.start == null ? null : minToTime(n.start),
            })),
            factors: existing.factors,
            note: existing.note ?? "",
          }
        : {
            ...EMPTY,
            date: dateISO,
            // Podpowiadamy Twoje zwykłe godziny, żeby typowa noc była
            // jednym tapnięciem w "Zapisz".
            bedtime: reference != null ? minToTime(reference) : EMPTY.bedtime,
            wake_time: last?.night.wake_time.slice(0, 5) ?? EMPTY.wake_time,
          },
    );
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("sleep_logs").upsert(
      {
        user_id: userId,
        date: draft.date,
        bedtime: draft.bedtime,
        wake_time: draft.wake_time,
        fell_asleep_min: draft.fell_asleep_min,
        awakenings: draft.awakenings,
        awake_min: draft.awake_min,
        quality: draft.quality,
        morning_energy: draft.morning_energy,
        factors: draft.factors,
        note: draft.note.trim() || null,
      },
      { onConflict: "user_id,date" },
    );

    if (error) {
      setSaving(false);
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }

    /*
     * Drzemki: kasujemy dzień i wpisujemy od nowa.
     *
     * Drzemek jest kilka, nie kilkaset, więc porównywanie ich po jednej
     * kosztowałoby więcej kodu niż daje. Ważniejsze, że po edycji w bazie
     * zostaje dokładnie to, co widać na ekranie - bez sierot po skasowanym
     * wierszu.
     */
    await supabase.from("sleep_naps").delete().eq("user_id", userId).eq("date", draft.date);

    if (draft.naps.length > 0) {
      const { error: napError } = await supabase.from("sleep_naps").insert(
        draft.naps.map((n) => ({
          user_id: userId,
          date: draft.date,
          minutes: n.minutes,
          start_time: n.start,
        })),
      );
      if (napError) {
        setSaving(false);
        setError(`Noc zapisana, ale drzemki nie: ${napError.message}`);
        return;
      }
    }

    setSaving(false);
    navigator.vibrate?.(12);
    setFormOpen(false);
    router.refresh();
  }

  async function remove(dateISO: string) {
    if (!confirm("Usunąć wpis o tej nocy?")) return;
    const { error } = await supabase
      .from("sleep_logs")
      .delete()
      .eq("user_id", userId)
      .eq("date", dateISO);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else {
      setFormOpen(false);
      router.refresh();
    }
  }

  function toggleFactor(key: string) {
    setDraft((d) => ({
      ...d,
      factors: d.factors.includes(key)
        ? d.factors.filter((f) => f !== key)
        : [...d.factors, key],
    }));
  }

  // Podgląd wyniku w formularzu - liczony z tego, co masz wpisane w tej chwili.
  const preview = useMemo(() => previewScore(draft, goalMin, reference), [draft, goalMin, reference]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Sen</h1>
          <p className="text-[13px] text-muted">
            Cel: {sleepDuration(goalMin)}
            {reference != null && ` · zwykle kładziesz się ${minToTime(reference)}`}
          </p>
        </div>
        <Button variant="primary" onClick={() => openFor(today)}>
          {lastIsToday ? "Popraw" : "+ Noc"}
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {/* --- Ostatnia noc --- */}
      {last ? (
        <Card
          title={lastIsToday ? "Dzisiejsza noc" : `Ostatnia noc · ${humanDate(last.night.date)}`}
          action={
            <button
              type="button"
              onClick={() => openFor(last.night.date)}
              className="text-[13px] font-medium text-accent"
            >
              Edytuj
            </button>
          }
        >
          <div className="flex items-center gap-4">
            <SleepScoreRing score={last.score.total} size={84} />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-tight">
                {sleepDuration(last.night.sleep_min)}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {last.night.bedtime.slice(0, 5)} → {last.night.wake_time.slice(0, 5)}
                {last.night.awakenings > 0 &&
                  ` · ${last.night.awakenings}× ${plural(last.night.awakenings, "pobudka", "pobudki", "pobudek")}`}
              </p>
              <p
                className="mt-1 flex items-center gap-1 text-[13px] font-semibold"
                style={{ color: sleepBand(last.score.total).color }}
              >
                <span aria-hidden>{sleepBand(last.score.total).icon}</span>
                {sleepBand(last.score.total).label}
              </p>
            </div>
          </div>

          <ScoreBreakdown score={last.score} className="mt-4" />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="🌙"
            title="Jeszcze nic o Twoim śnie"
            description="Wpisz, o której się położyłeś i o której wstałeś. Reszta pól jest opcjonalna - wynik policzy się i tak."
            action={
              <Button variant="primary" onClick={() => openFor(today)}>
                Zapisz pierwszą noc
              </Button>
            }
          />
        </Card>
      )}

      {nights.length > 0 && (
        <>
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 dni" },
              { value: "30", label: "30 dni" },
            ]}
          />

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Średni sen"
              value={avgSleep != null ? sleepDuration(avgSleep) : "-"}
              sub={`${window.length} ${plural(window.length, "noc", "noce", "nocy")} z ${days}`}
            />
            <Stat
              label="Średni wynik"
              value={avgScore ?? "-"}
              sub={avgScore != null ? sleepBand(avgScore).label : undefined}
              tone={avgScore != null && avgScore >= 80 ? "success" : undefined}
            />
            <Stat
              label="Dług snu"
              value={debtMin > 0 ? sleepDuration(debtMin) : "brak"}
              sub={debtMin > 0 ? "poniżej celu w tym okresie" : "trzymasz cel"}
              tone={debtMin >= 300 ? "danger" : undefined}
            />
            <Stat
              label="Rozrzut pory snu"
              value={spread != null ? sleepDuration(spread) : "-"}
              sub={
                spread == null
                  ? "potrzeba dwóch nocy"
                  : spread <= 60
                    ? "bardzo równy rytm"
                    : spread <= 120
                      ? "do wyrównania"
                      : "rytm mocno skacze"
              }
            />
          </div>

          <Card title="Długość snu" subtitle="Kolor słupka to ocena całej nocy">
            <SleepChart data={chartData} goalMin={goalMin} />
          </Card>

          <Card title="Sleep score" subtitle="Jak zmienia się ocena nocy">
            <SleepScoreChart data={chartData} />
          </Card>

          {insights.length > 0 && (
            <Card
              title="Co widać w Twoich danych"
              subtitle="Porównanie średnich, nie dowód przyczynowości"
            >
              <ul className="flex flex-col gap-2">
                {insights.slice(0, 4).map((ins) => {
                  const f = sleepFactor(ins.key);
                  const worse = ins.delta < 0;
                  return (
                    <li key={ins.key} className="flex items-center gap-2.5">
                      <span className="text-[18px]" aria-hidden>
                        {f.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium leading-tight">{f.label}</span>
                        <span className="block text-[12px] text-muted">
                          {ins.nightsWith} {plural(ins.nightsWith, "noc", "noce", "nocy")} ·{" "}
                          {ins.avgWith} pkt kontra {ins.avgWithout}
                        </span>
                      </span>
                      <Chip tone={worse ? "danger" : "success"}>
                        {worse ? "−" : "+"}
                        {Math.abs(ins.delta)} pkt
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title="Historia" padded={false}>
            <ul className="divide-y divide-border">
              {scored.slice(0, 30).map((x) => {
                const band = sleepBand(x.score.total);
                return (
                  <li key={x.night.date}>
                    <button
                      type="button"
                      onClick={() => openFor(x.night.date)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                    >
                      <span
                        className="tabular flex size-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold"
                        style={{ background: `${band.color}22`, color: band.color }}
                      >
                        {x.score.total}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium capitalize leading-tight">
                          {humanDate(x.night.date)}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {x.night.bedtime.slice(0, 5)} → {x.night.wake_time.slice(0, 5)} ·{" "}
                          {sleepDuration(x.night.sleep_min)}
                        </span>
                      </span>
                      <span className="text-[16px]" aria-hidden title={`Ocena ${x.night.quality}/5`}>
                        {QUALITY_LABELS[x.night.quality - 1]?.icon}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1">
            {SLEEP_LEGEND.map((l) => (
              <li key={l.range} className="flex items-center gap-1 text-[11px] text-muted">
                <span aria-hidden style={{ color: l.color }}>
                  {l.icon}
                </span>
                {l.range} · {l.label}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ------------------------------ Formularz ------------------------------ */}
      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingDate ? `Noc · ${shortDate(editingDate)}` : "Jak Ci się spało?"}
        footer={
          <div className="flex gap-2">
            {editingDate && (
              <Button variant="danger" onClick={() => remove(editingDate)}>
                Usuń
              </Button>
            )}
            <Button variant="primary" size="lg" block loading={saving} onClick={save}>
              Zapisz noc
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Podgląd wyniku aktualizuje się przy każdej zmianie - widać od razu,
              co dana odpowiedź robi z oceną. */}
          <div className="flex items-center gap-4 rounded-xl bg-surface-2 p-3">
            <SleepScoreRing score={preview.total} size={64} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-tight">
                {sleepDuration(previewSleepMin(draft))}
              </p>
              <p className="text-[12px] text-muted">
                Podgląd wyniku · {sleepBand(preview.total).label}
              </p>
            </div>
          </div>

          {/* Sen ma pole daty od początku, więc dopisanie wstecz nie potrzebuje
              przełącznika dnia - wystarczyło zamknąć je w oknie DNI_WSTECZ
              i pokazać, kiedy noc przestaje być dzisiejsza. */}
          <Field
            label="Data poranka"
            hint={
              draft.date === today
                ? "Noc z wtorku na środę zapisz jako środę."
                : `Zapisujesz noc z poranka ${humanDate(draft.date)}. Cofnąć możesz się o ${DNI_WSTECZ} dni.`
            }
          >
            <Input
              type="date"
              value={draft.date}
              min={najstarszaData(today)}
              max={today}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              className={clsx(draft.date !== today && "border-warn text-warn")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Poszedłem spać">
              <Input
                type="time"
                value={draft.bedtime}
                onChange={(e) => setDraft({ ...draft, bedtime: e.target.value })}
              />
            </Field>
            <Field label="Wstałem">
              <Input
                type="time"
                value={draft.wake_time}
                onChange={(e) => setDraft({ ...draft, wake_time: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TimePresets
              values={BEDTIME_PRESETS}
              current={draft.bedtime}
              onPick={(v) => setDraft({ ...draft, bedtime: v })}
              ariaLabel="Typowe godziny położenia się"
            />
            <TimePresets
              values={WAKE_PRESETS}
              current={draft.wake_time}
              onPick={(v) => setDraft({ ...draft, wake_time: v })}
              ariaLabel="Typowe godziny pobudki"
            />
          </div>

          <Field label="Jak Ci się spało?">
            <FacePicker
              options={QUALITY_LABELS}
              value={draft.quality}
              onChange={(v) => setDraft({ ...draft, quality: v })}
            />
          </Field>

          <Field label="Jak się obudziłeś?" hint="Można przespać osiem godzin i wstać rozbitym.">
            <FacePicker
              options={ENERGY_LABELS}
              value={draft.morning_energy}
              onChange={(v) =>
                setDraft({ ...draft, morning_energy: draft.morning_energy === v ? null : v })
              }
            />
          </Field>

          <Field label="Ile razy budziłeś się w nocy">
            <NumberStepper
              ariaLabel="Liczba pobudek"
              value={draft.awakenings}
              onChange={(v) => setDraft({ ...draft, awakenings: Math.max(0, v ?? 0) })}
              step={1}
              min={0}
              max={30}
            />
          </Field>

          {draft.awakenings > 0 && (
            <Field label="Ile łącznie nie spałeś" hint="Szacunek wystarczy.">
              <NumberStepper
                ariaLabel="Minuty na jawie w nocy"
                value={draft.awake_min}
                onChange={(v) => setDraft({ ...draft, awake_min: Math.max(0, v ?? 0) })}
                step={5}
                min={0}
                max={600}
                suffix="min"
              />
            </Field>
          )}

          <Field label="Ile zajęło zaśnięcie">
            <NumberStepper
              ariaLabel="Minuty do zaśnięcia"
              value={draft.fell_asleep_min}
              onChange={(v) => setDraft({ ...draft, fell_asleep_min: Math.max(0, v ?? 0) })}
              step={5}
              min={0}
              max={600}
              suffix="min"
            />
          </Field>

          {/*
            Każda drzemka osobno.
            Godzina jest opcjonalna, bo nie każdy ją pamięta - a bez niej
            drzemka i tak się liczy, tylko bez kary za późną porę.
          */}
          <Field
            label="Drzemki w ciągu dnia (opcjonalnie)"
            hint="Osobno każdą. Trzy po 20 minut to co innego niż jedna godzinna."
          >
            <div className="flex flex-col gap-2">
              {draft.naps.map((nap, i) => (
                <div key={i} className="flex items-center gap-2">
                  <NumberStepper
                    ariaLabel={`Minuty drzemki ${i + 1}`}
                    value={nap.minutes}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        naps: draft.naps.map((n, j) =>
                          j === i ? { ...n, minutes: Math.min(600, Math.max(1, v ?? 1)) } : n,
                        ),
                      })
                    }
                    step={5}
                    min={1}
                    max={600}
                    suffix="min"
                  />
                  <Input
                    type="time"
                    aria-label={`Godzina drzemki ${i + 1}`}
                    className="w-[110px]"
                    value={nap.start ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        naps: draft.naps.map((n, j) =>
                          j === i ? { ...n, start: e.target.value || null } : n,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Usuń drzemkę ${i + 1}`}
                    className="px-2 text-[13px] text-danger"
                    onClick={() =>
                      setDraft({ ...draft, naps: draft.naps.filter((_, j) => j !== i) })
                    }
                  >
                    Usuń
                  </button>
                </div>
              ))}

              <Button
                variant="ghost"
                onClick={() =>
                  setDraft({ ...draft, naps: [...draft.naps, { minutes: 20, start: null }] })
                }
              >
                {draft.naps.length === 0 ? "Dodaj drzemkę" : "Dodaj kolejną"}
              </Button>
            </div>
          </Field>

          <Field
            label="Co mogło wpłynąć na tę noc"
            hint="Po kilku tygodniach apka pokaże, które z tych rzeczy realnie zbijają Twój wynik."
          >
            <div className="flex flex-wrap gap-1.5">
              {SLEEP_FACTORS.map((f) => {
                const on = draft.factors.includes(f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleFactor(f.value)}
                    aria-pressed={on}
                    className={clsx(
                      "inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors",
                      on
                        ? f.helps
                          ? "bg-[var(--success-soft)] text-success ring-1 ring-success/40"
                          : "bg-[var(--warn-soft)] text-warn ring-1 ring-warn/40"
                        : "bg-surface-2 text-muted",
                    )}
                  >
                    <span aria-hidden>{f.icon}</span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notatka (opcjonalnie)">
            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="np. budziłem się przez ból barku"
              rows={2}
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------ Części ekranu ------------------------------ */

/**
 * Rozbicie wyniku na składowe. Liczba punktów stoi obok paska, bo to ona
 * niesie informację - pasek tylko ją wzmacnia.
 */
export function ScoreBreakdown({ score, className }: { score: SleepScore; className?: string }) {
  // Wagi są przeskalowane do 100 pkt po odjęciu składowych bez danych,
  // więc mianownik liczymy z tego samego dzielnika co punkty.
  const available = score.parts.reduce((sum, p) => sum + p.max, 0);
  const scale = available > 0 ? 100 / available : 0;

  return (
    <ul className={clsx("flex flex-col gap-2", className)}>
      {score.parts.map((part) => (
        <li key={part.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{part.label}</span>
            <span className="tabular text-[12px] text-muted">
              {part.points}/{Math.round(part.max * scale)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round(part.ratio * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-faint">{part.hint}</p>
        </li>
      ))}
      {score.skipped.includes("regularity") && (
        <li className="text-[11px] text-faint">
          Regularność doliczy się, gdy uzbiera się kilka nocy - albo gdy ustawisz
          docelową porę snu w profilu.
        </li>
      )}
    </ul>
  );
}

function TimePresets({
  values,
  current,
  onPick,
  ariaLabel,
}: {
  values: readonly string[];
  current: string;
  onPick: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={ariaLabel}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          aria-pressed={current === v}
          className={clsx(
            "tabular min-h-8 rounded-lg px-2 text-[12px] font-semibold transition-colors",
            current === v ? "bg-accent text-[var(--accent-fg)]" : "bg-surface-2 text-muted",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Pięć buziek zamiast suwaka - jedno tapnięcie, bez celowania. */
function FacePicker({
  options,
  value,
  onChange,
}: {
  options: readonly { value: number; icon: string; label: string }[];
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          aria-label={o.label}
          className={clsx(
            "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl transition-transform active:scale-95",
            value === o.value ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
          )}
        >
          <span className="text-[22px] leading-none" aria-hidden>
            {o.icon}
          </span>
          <span className="text-[10px] leading-tight text-muted">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Pomocnicze ------------------------------- */

function previewSleepMin(draft: Draft): number {
  const bed = timeToMin(draft.bedtime) ?? 0;
  const wake = timeToMin(draft.wake_time) ?? 0;
  const inBed = (wake - bed + 1440) % 1440;
  return Math.max(0, inBed - draft.fell_asleep_min - draft.awake_min);
}

function previewScore(draft: Draft, goalMin: number, reference: number | null): SleepScore {
  const night: SleepNight = {
    date: draft.date,
    bedtime: draft.bedtime,
    wake_time: draft.wake_time,
    sleep_min: previewSleepMin(draft),
    time_in_bed_min: previewSleepMin(draft) + draft.fell_asleep_min + draft.awake_min,
    fell_asleep_min: draft.fell_asleep_min,
    awakenings: draft.awakenings,
    awake_min: draft.awake_min,
    quality: draft.quality,
    morning_energy: draft.morning_energy,
    nap_min: draft.naps.reduce((sum, n) => sum + n.minutes, 0),
    naps: draft.naps.map((n) => ({ minutes: n.minutes, start: timeToMin(n.start) })),
    factors: draft.factors,
    note: draft.note,
  };
  return scoreNight(night, { goalMin, referenceBedtime: reference });
}
