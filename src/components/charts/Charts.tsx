"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { PAIN_LEGEND, STATUS, painStatus, type VizColors } from "@/lib/viz";
import { useVizColors } from "@/lib/useVizColors";
import { num, shortDate } from "@/lib/format";
import { SLEEP_LEGEND, sleepBand, sleepDuration } from "@/lib/sleep";
import { EmptyState } from "@/components/ui";

const AXIS_FONT = 11;

/* ------------------------------- Podpowiedź ------------------------------- */

type TooltipRow = { label: string; value: string };

type TooltipRows = (payload: Record<string, unknown>) => TooltipRow[];

/**
 * Jeden komponent podpowiedzi dla wszystkich wykresów. Recharts klonuje element
 * podany w `content` i sam dokłada `active` / `payload` / `label`, więc wiersze
 * i kolory podajemy zwykłymi propsami.
 */
function ChartTooltip({
  colors,
  rows,
  active,
  payload,
  label,
}: {
  colors: VizColors;
  rows: TooltipRows;
  active?: boolean;
  payload?: { payload: Record<string, unknown> }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-[12px] shadow-lg"
      style={{ background: colors.surface, borderColor: colors.grid, color: colors.text }}
    >
      <div className="mb-1 font-semibold">
        {typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDate(label) : label}
      </div>
      {rows(point).map((r) => (
        <div key={r.label} className="tabular flex justify-between gap-3">
          <span style={{ color: colors.textMuted }}>{r.label}</span>
          <span className="font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Ramka ---------------------------------- */

function ChartFrame({
  height = 200,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  height?: number;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  if (isEmpty) {
    return <EmptyState icon="📉" title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------- Progres siłowy ------------------------------- */

export type StrengthPoint = { date: string; weight: number | null; e1rm: number | null; reps: number | null };

export function StrengthChart({
  data,
  mode,
}: {
  data: StrengthPoint[];
  /** „weight” = najcięższa seria dnia, „e1rm” = szacowany rekord na 1 powtórzenie */
  mode: "weight" | "e1rm";
}) {
  const c = useVizColors();
  const key = mode === "weight" ? "weight" : "e1rm";

  const tipRows: TooltipRows = (p) => [
    { label: "Ciężar", value: `${num(Number(p.weight), 2)} kg` },
    ...(p.reps ? [{ label: "Powtórzenia", value: String(p.reps) }] : []),
    ...(p.e1rm ? [{ label: "Szac. 1RM", value: `${num(Number(p.e1rm), 1)} kg` }] : []),
  ];

  return (
    <ChartFrame
      isEmpty={data.length < 1}
      emptyTitle="Brak danych do wykresu"
      emptyDescription="Zapisz kilka serii tego ćwiczenia, a zobaczysz tu progres w czasie."
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={48}
          domain={["dataMin - 5", "dataMax + 5"]}
          unit=" kg"
        />
        <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey={key}
          stroke={c.series1}
          strokeWidth={2}
          dot={{ r: 4, fill: c.series1, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.series1, stroke: c.surface, strokeWidth: 2 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/* ------------------------------ Waga ciała -------------------------------- */

export function BodyWeightChart({ data }: { data: { date: string; weight: number }[] }) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => [{ label: "Waga", value: `${num(Number(p.weight), 1)} kg` }];

  return (
    <ChartFrame
      isEmpty={data.length < 1}
      emptyTitle="Brak pomiarów wagi"
      emptyDescription="Dodaj wagę w profilu — wystarczy raz na kilka dni, żeby zobaczyć trend."
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={48}
          domain={["dataMin - 1", "dataMax + 1"]}
          unit=" kg"
        />
        <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke={c.series1}
          strokeWidth={2}
          dot={{ r: 3.5, fill: c.series1, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.series1, stroke: c.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/* -------------------------------- Ból ------------------------------------- */

/**
 * Ból to stan (dobrze → krytycznie), nie zwykła wielkość, więc słupki noszą
 * kolory palety statusów — zawsze z legendą opisową obok, nigdy sam kolor.
 */
export function PainChart({ data }: { data: { date: string; level: number }[] }) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => {
    const level = Number(p.level);
    return [
      { label: "Poziom", value: `${level}/10` },
      { label: "Ocena", value: painStatus(level).label },
    ];
  };

  return (
    <div className="flex flex-col gap-2">
      <ChartFrame
        isEmpty={data.length < 1}
        emptyTitle="Brak ocen bólu"
        emptyDescription="Po treningu apka poprosi Cię o ocenę w skali 0–10."
      >
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -28 }} barCategoryGap="20%">
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
          />
          <ReferenceLine
            y={3}
            stroke={c.axis}
            strokeDasharray="4 4"
            label={{ value: "próg uwagi", position: "insideTopRight", fill: c.textMuted, fontSize: 10 }}
          />
          <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ fill: c.grid, fillOpacity: 0.35 }} />
          <Bar dataKey="level" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.date}
                fill={painStatus(d.level).color}
                stroke={c.surface}
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>

      {data.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {PAIN_LEGEND.map((l) => (
            <li key={l.range} className="flex items-center gap-1 text-[11px] text-muted">
              <span aria-hidden style={{ color: l.color }}>
                {l.icon}
              </span>
              {l.range} · {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------- Objętość treningowa --------------------------- */

export function VolumeChart({
  data,
}: {
  data: { label: string; volume: number; sets: number; workouts: number }[];
}) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => [
    { label: "Objętość", value: `${num(Number(p.volume), 0)} kg` },
    { label: "Serie", value: String(p.sets) },
    { label: "Treningi", value: String(p.workouts) },
  ];

  return (
    <ChartFrame
      isEmpty={data.every((d) => d.volume === 0)}
      emptyTitle="Brak objętości do pokazania"
      emptyDescription="Objętość to ciężar × powtórzenia ze wszystkich serii w tygodniu."
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }} barCategoryGap="18%">
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => (v >= 1000 ? `${num(v / 1000, 1)} t` : String(v))}
        />
        <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ fill: c.grid, fillOpacity: 0.35 }} />
        <Bar
          dataKey="volume"
          fill={c.series1}
          radius={[4, 4, 0, 0]}
          stroke={c.surface}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartFrame>
  );
}

/* ---------------------------------- Sen ----------------------------------- */

export type SleepPoint = { date: string; minutes: number; score: number };

/**
 * Długość snu. Słupek to wielkość (ile godzin), ale jego kolor to stan
 * (ocena całej nocy) — dlatego bierze go z palety statusów, a nie z serii,
 * i zawsze idzie w parze z legendą opisową pod wykresem.
 */
export function SleepChart({ data, goalMin }: { data: SleepPoint[]; goalMin: number }) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => [
    { label: "Sen", value: sleepDuration(Number(p.minutes)) },
    { label: "Wynik", value: `${p.score} / 100` },
    { label: "Ocena", value: sleepBand(Number(p.score)).label },
  ];

  return (
    <div className="flex flex-col gap-2">
      <ChartFrame
        isEmpty={data.length < 1}
        emptyTitle="Brak zapisanych nocy"
        emptyDescription="Wystarczy godzina położenia się i pobudki — resztę pól możesz pominąć."
      >
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }} barCategoryGap="20%">
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, (max: number) => Math.max(600, Math.ceil(max / 60) * 60)]}
            tickFormatter={(v: number) => `${Math.round(v / 60)} h`}
          />
          <ReferenceLine
            y={goalMin}
            stroke={c.axis}
            strokeDasharray="4 4"
            label={{ value: "cel", position: "insideTopRight", fill: c.textMuted, fontSize: 10 }}
          />
          <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ fill: c.grid, fillOpacity: 0.35 }} />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.date} fill={sleepBand(d.score).color} stroke={c.surface} strokeWidth={2} />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>

      {data.length > 0 && (
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
      )}
    </div>
  );
}

/** Sam wynik w czasie — jedna seria, więc bez legendy: tytuł karty ją nazywa. */
export function SleepScoreChart({ data }: { data: SleepPoint[] }) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => [
    { label: "Wynik", value: `${p.score} / 100` },
    { label: "Ocena", value: sleepBand(Number(p.score)).label },
  ];

  return (
    <ChartFrame
      height={180}
      isEmpty={data.length < 2}
      emptyTitle="Za mało nocy na trend"
      emptyDescription="Trend pojawi się po drugiej zapisanej nocy."
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
        />
        <ReferenceLine
          y={80}
          stroke={c.axis}
          strokeDasharray="4 4"
          label={{ value: "świetna noc", position: "insideTopRight", fill: c.textMuted, fontSize: 10 }}
        />
        <Tooltip content={<ChartTooltip colors={c} rows={tipRows} />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={c.series2}
          strokeWidth={2}
          dot={{ r: 3.5, fill: c.series2, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.series2, stroke: c.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/* --------------------------------- Nałogi --------------------------------- */

export type VicePoint = {
  /** Etykieta tygodnia, np. „12–18 sie". */
  label: string;
  /** Ile dni w tym tygodniu było czystych. */
  clean: number;
  /** Ile było wpadek. */
  lapses: number;
  /** Ile razy chęć została przeczekana. */
  urges: number;
};

/**
 * Czyste dni tydzień po tygodniu.
 *
 * Słupek mówi, ile dni się utrzymało; kolor mówi, czy w tym tygodniu była
 * wpadka — dwie różne informacje, dwa różne kanały, więc nie trzeba czytać
 * liczb, żeby zobaczyć, gdzie coś się posypało. Pokonane chęci są w podpowiedzi,
 * bo to jedyna liczba w tej zakładce, która rośnie od porażek: żeby ją
 * powiększyć, trzeba było najpierw poczuć, że się chce.
 */
export function ViceChart({ data }: { data: VicePoint[] }) {
  const c = useVizColors();

  const tipRows: TooltipRows = (p) => {
    const rows: TooltipRow[] = [
      { label: "Czyste dni", value: `${p.clean}/7` },
      { label: "Wpadki", value: String(p.lapses) },
    ];
    if (Number(p.urges) > 0) rows.push({ label: "Przeczekane chęci", value: String(p.urges) });
    return rows;
  };

  return (
    <div className="flex flex-col gap-2">
      <ChartFrame
        isEmpty={data.length === 0}
        emptyTitle="Brak nałogów do pokazania"
        emptyDescription="Dodaj nałóg w zakładce „Nawyki i nałogi”, a tutaj zobaczysz, jak wyglądały kolejne tygodnie."
      >
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -28 }} barCategoryGap="20%">
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: c.axis, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, 7]}
            ticks={[0, 1, 3, 5, 7]}
          />
          <Tooltip
            content={<ChartTooltip colors={c} rows={tipRows} />}
            cursor={{ fill: c.grid, fillOpacity: 0.35 }}
          />
          <Bar dataKey="clean" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={d.lapses > 0 ? STATUS.critical : STATUS.good}
                stroke={c.surface}
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>

      {data.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          <li className="flex items-center gap-1 text-[11px] text-muted">
            <span aria-hidden style={{ color: STATUS.good }}>●</span> tydzień bez wpadki
          </li>
          <li className="flex items-center gap-1 text-[11px] text-muted">
            <span aria-hidden style={{ color: STATUS.critical }}>■</span> tydzień z wpadką
          </li>
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- Wygląd ---------------------------------- */

export type LooksPoint = {
  date: string;
  ogolna: number | null;
  podocena: number | null;
  /** Skan z kiepskiego zdjęcia — rysowany pustym punktem, żeby nie mylił. */
  pewny: boolean;
};

/**
 * Ocena wyglądu w czasie.
 *
 * Dwie serie: ogólna i jedna wybrana podocena. Skany, przy których model sam
 * powiedział, że zdjęcie było za słabe, dostają pusty środek punktu — inaczej
 * spadek spowodowany przepaloną klatką wyglądałby na pogorszenie skóry.
 */
export function LooksChart({
  data,
  podocenaLabel,
}: {
  data: LooksPoint[];
  podocenaLabel: string | null;
}) {
  const c = useVizColors();
  const tipRows: TooltipRows = (p) => [
    { label: "Ocena ogólna", value: p.ogolna == null ? "—" : `${p.ogolna} / 100` },
    ...(podocenaLabel
      ? [{ label: podocenaLabel, value: p.podocena == null ? "—" : `${p.podocena} / 100` }]
      : []),
    ...(p.pewny ? [] : [{ label: "Uwaga", value: "słabe zdjęcie" }]),
  ];

  return (
    <ChartFrame
      isEmpty={data.length < 2}
      emptyTitle="Za mało skanów"
      emptyDescription="Wykres pojawi się po drugim skanie — jeden punkt nie pokazuje żadnej zmiany."
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={36}
          domain={[0, 100]}
        />
        <Tooltip
          content={<ChartTooltip colors={c} rows={tipRows} />}
          cursor={{ stroke: c.axis, strokeWidth: 1 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: c.axis }} />
        <Line
          name="Ocena ogólna"
          type="monotone"
          dataKey="ogolna"
          stroke={c.series1}
          strokeWidth={2}
          connectNulls
          dot={(props) => {
            const { cx, cy, payload, index } = props as {
              cx: number;
              cy: number;
              payload: LooksPoint;
              index: number;
            };
            if (cx == null || cy == null) return <g key={index} />;
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={payload.pewny ? c.series1 : c.surface}
                stroke={c.series1}
                strokeWidth={2}
              />
            );
          }}
          isAnimationActive={false}
        />
        {podocenaLabel && (
          <Line
            name={podocenaLabel}
            type="monotone"
            dataKey="podocena"
            stroke={c.series2}
            strokeWidth={2}
            strokeDasharray="4 3"
            connectNulls
            dot={{ r: 3, fill: c.series2, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ChartFrame>
  );
}
