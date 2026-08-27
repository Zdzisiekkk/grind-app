/*
 * Moduł WSPÓŁDZIELONY — bez dyrektywy "use client" i bez hooków.
 *
 * Kolory i progi statusów czyta zarówno serwer (pulpit koloruje ikonkę oceny
 * bólu przy renderze), jak i klient (wykresy). Gdyby ten plik był oznaczony
 * jako kliencki, każdy jego eksport stałby się referencją klienta i wywołanie
 * painStatus() na serwerze wysypywałoby stronę błędem „Attempted to call
 * painStatus() from the server". Hook czytający motyw systemowy mieszka
 * dlatego osobno, w useVizColors.ts.
 */

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
