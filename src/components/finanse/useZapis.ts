"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Zapis z arkusza: blokada przycisku, komunikat błędu, odświeżenie danych.
 *
 * Każdy arkusz Kasy robił to samo na cztery sposoby, a różnice sprowadzały
 * się do tego, który z nich zapominał odblokować przycisk po błędzie.
 *
 * `PromiseLike`, nie `Promise`: builder Supabase jest "thenable" i dopiero
 * await zamienia go w wynik - typowanie na Promise odrzucałoby wywołania
 * bez sztucznego owijania każdego w async.
 */
export function useZapis() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function zapisz(
    co: () => PromiseLike<{ error: { message: string } | null }>,
    poUdanym?: () => void,
  ) {
    setBusy(true);
    setError(null);
    const { error } = await co();
    setBusy(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return false;
    }
    poUdanym?.();
    router.refresh();
    return true;
  }

  return { busy, error, setError, zapisz };
}

/** Ludzie wpisują przecinek, bo tak wygląda kwota po polsku. */
export function liczba(t: string): number {
  const n = Number(t.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}
