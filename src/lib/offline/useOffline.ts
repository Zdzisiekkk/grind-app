"use client";

import { useCallback, useSyncExternalStore } from "react";
import { queueLength, subscribeToQueue } from "@/lib/offline/queue";

/**
 * Stan połączenia.
 *
 * navigator.onLine to zewnętrzne źródło prawdy, więc czytamy je przez
 * useSyncExternalStore, a nie efektem i stanem. Na serwerze zakładamy „online",
 * bo taki jest pierwszy render w przeglądarce — inaczej baner mrugałby przy
 * każdym wejściu.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Ile zapisów czeka w kolejce.
 *
 * IndexedDB jest asynchroniczne, a useSyncExternalStore wymaga wartości
 * natychmiast — dlatego trzymamy ostatni odczyt w module i odświeżamy go po
 * każdym powiadomieniu z kolejki.
 */
let cachedCount = 0;

export function usePendingCount(): number {
  const subscribe = useCallback((onChange: () => void) => {
    let alive = true;

    const refresh = () => {
      queueLength().then((n) => {
        if (!alive || n === cachedCount) return;
        cachedCount = n;
        onChange();
      });
    };

    refresh();
    const unsubscribe = subscribeToQueue(refresh);
    window.addEventListener("online", refresh);

    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener("online", refresh);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => cachedCount,
    () => 0,
  );
}
