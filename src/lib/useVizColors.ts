"use client";

import { useSyncExternalStore } from "react";
import { VIZ, type VizColors } from "@/lib/viz";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToTheme(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Motyw systemowy czytamy przez useSyncExternalStore - matchMedia to zewnętrzne
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
