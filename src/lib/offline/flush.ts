/**
 * Wysyłka kolejki po powrocie sieci.
 *
 * Kolejność ma znaczenie: seria numer 2 nie może dolecieć przed numerem 1,
 * a usunięcie nie może wyprzedzić wstawienia. Dlatego wysyłamy jeden po
 * drugim i przy pierwszym błędzie sieci przerywamy - reszta poczeka.
 */

import { allQueued, bumpAttempts, dropQueued, notify, type QueuedMutation } from "@/lib/offline/queue";
import { createClient } from "@/lib/supabase/client";

/** Po tylu nieudanych podejściach uznajemy, że dalsze próby nic nie dadzą. */
const MAX_ATTEMPTS = 5;
const REJECTED_KEY = "grind:offline-rejected";

export type FlushResult = { sent: number; rejected: number; pending: number };

let running = false;

/** Zapisy, których baza nie przyjęła - pokazujemy je człowiekowi, nie chowamy. */
export type Rejection = { table: string; status: number; message: string; at: number };

export function readRejections(): Rejection[] {
  try {
    return JSON.parse(window.localStorage.getItem(REJECTED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearRejections(): void {
  try {
    window.localStorage.removeItem(REJECTED_KEY);
  } catch {
    /* prywatne okno - trudno */
  }
  notify();
}

function rememberRejection(item: QueuedMutation, status: number, message: string): void {
  try {
    const list = [...readRejections(), { table: item.table, status, message, at: Date.now() }];
    window.localStorage.setItem(REJECTED_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* prywatne okno - trudno */
  }
}

export async function flushQueue(): Promise<FlushResult> {
  const idle: FlushResult = { sent: 0, rejected: 0, pending: 0 };
  if (running) return idle;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return idle;

  running = true;
  let sent = 0;
  let rejected = 0;

  try {
    const items = await allQueued();
    if (items.length === 0) return idle;

    // Token z kolejki jest nieświeży - bierzemy aktualny, inaczej wszystko
    // odbiłoby się od RLS z błędem 401.
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (!session) return { sent: 0, rejected: 0, pending: items.length };

    for (const item of items) {
      const headers = { ...item.headers, Authorization: `Bearer ${session.access_token}` };

      let response: Response;
      try {
        response = await fetch(item.url, { method: item.method, headers, body: item.body });
      } catch {
        // Sieć znów padła. Przerywamy, żeby nie pomieszać kolejności.
        await bumpAttempts(item);
        break;
      }

      if (response.ok) {
        await dropQueued(item.id as number);
        sent++;
        continue;
      }

      // 409 przy wstawieniu z własnym identyfikatorem znaczy, że wiersz już
      // tam jest - pierwsze podejście doleciało, zgubiła się tylko odpowiedź.
      // To jest sukces, nie błąd.
      if (response.status === 409) {
        await dropQueued(item.id as number);
        sent++;
        continue;
      }

      if (response.status >= 500 && item.attempts < MAX_ATTEMPTS) {
        // Problem po stronie serwera - spróbujemy jeszcze raz później.
        await bumpAttempts(item);
        break;
      }

      // Baza odrzuciła zapis (walidacja, RLS, wyczerpane próby). Powtarzanie
      // zablokowałoby kolejkę na zawsze, więc wyrzucamy i mówimy o tym wprost.
      const message = await response.text().catch(() => "");
      rememberRejection(item, response.status, message.slice(0, 200));
      await dropQueued(item.id as number);
      rejected++;
    }
  } finally {
    running = false;
    notify();
  }

  const pending = (await allQueued()).length;
  return { sent, rejected, pending };
}
