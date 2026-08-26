"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Ustawienie zapamiętane w localStorage.
 *
 * localStorage to zewnętrzne źródło prawdy, więc czytamy je przez
 * useSyncExternalStore zamiast synchronizować efektem — dzięki temu nie ma
 * kaskadowych renderów, a serwerowy render dostaje wartość domyślną (ta sama,
 * co pierwszy render w przeglądarce, więc hydracja się zgadza).
 */

const EVENT = "grind:local-setting";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLocalNumber(
  key: string,
  fallback: number,
): [number, (value: number) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const raw = Number(window.localStorage.getItem(key));
      return Number.isFinite(raw) && raw > 0 ? raw : fallback;
    },
    () => fallback,
  );

  const set = useCallback(
    (next: number) => {
      window.localStorage.setItem(key, String(next));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
