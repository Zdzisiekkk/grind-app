"use client";

import { useSyncExternalStore } from "react";

/**
 * Kolory wykresów.
 *
 * Wartości pochodzą z przewalidowanej palety (sprawdzone walidatorem na
 * powierzchniach tej aplikacji: pasmo jasności, próg nasycenia, rozróżnialność
 * przy daltonizmie i kontrast >= 3:1 — w obu motywach).
 *
 * Nie są brane z CSS-owych zmiennych, bo var() nie działa w atrybutach
 * prezentacyjnych SVG, których używa recharts.
 */

export const VIZ = {
  light: {
    surface: "#ffffff",
    grid: "#dde3ea",
    axis: "#5d6875",
    text: "#10141a",
    textMuted: "#5d6875",
    series1: "#eb6834",
    series2: "#2a78d6",
  },
  dark: {
    surface: "#14181f",
    grid: "#2a313d",
    axis: "#98a3b3",
    text: "#e9edf3",
    textMuted: "#98a3b3",
    series1: "#d95926",
    series2: "#3987e5",
  },
} as const;

/** Paleta statusów — stała w obu motywach, zawsze z etykietą obok koloru. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export type VizColors = { [K in keyof (typeof VIZ)["light"]]: string };

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToTheme(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Motyw systemowy czytamy przez useSyncExternalStore — matchMedia to zewnętrzne
 * źródło prawdy, więc nie synchronizujemy go efektem i stanem.
 * Na serwerze zakładamy jasny motyw (taki sam jak pierwszy render w przeglądarce).
 */
export function useVizColors(): VizColors {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );

  return dark ? VIZ.dark : VIZ.light;
}

/** Kubełki bólu kolana: to stan, nie wielkość — stąd paleta statusów i opis słowny. */
export function painStatus(level: number): { color: string; label: string; icon: string } {
  if (level <= 2) return { color: STATUS.good, label: "brak / minimalny", icon: "●" };
  if (level <= 4) return { color: STATUS.warning, label: "łagodny", icon: "▲" };
  if (level <= 7) return { color: STATUS.serious, label: "wyraźny", icon: "◆" };
  return { color: STATUS.critical, label: "mocny", icon: "■" };
}

export const PAIN_LEGEND = [
  { range: "0–2", ...painStatus(0) },
  { range: "3–4", ...painStatus(3) },
  { range: "5–7", ...painStatus(5) },
  { range: "8–10", ...painStatus(9) },
];
