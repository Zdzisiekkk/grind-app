"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Ustawienie zapamiętane w localStorage.
 *
 * localStorage to zewnętrzne źródło prawdy, więc czytamy je przez
 * useSyncExternalStore zamiast synchronizować efektem - dzięki temu nie ma
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

/**
 * To samo dla przełącznika wł./wył. - np. czy sekcja jest rozwinięta.
 *
 * Serwer i pierwszy render w przeglądarce dostają `fallback`, więc hydracja
 * się zgadza; zapamiętany wybór dochodzi w pierwszym przebiegu po niej.
 */
export function useLocalBoolean(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw === "1";
    },
    () => fallback,
  );

  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, next ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
