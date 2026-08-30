/**
 * `fetch` podstawiany klientowi Supabase w przeglądarce.
 *
 * Siedzi na najniższym poziomie, przez co WSZYSTKIE ekrany zapisują offline
 * bez jednej linijki zmian u siebie. Decyzje o tym, co wolno odłożyć i jak
 * ostemplować wiersz, mieszkają w rest.ts - tam da się je przetestować.
 */

import { enqueue, type QueuedMutation } from "@/lib/offline/queue";
import {
  isQueueableWrite,
  isUpsertPrefer,
  tableFromUrl,
  wantsRepresentation,
  withLocalIds,
} from "@/lib/offline/rest";

/** Odpowiedź, którą dostaje ekran, gdy zapis poszedł do kolejki. */
function acceptedResponse(rows: unknown[], wantsBody: boolean): Response {
  return new Response(wantsBody ? JSON.stringify(rows) : null, {
    status: wantsBody ? 201 : 204,
    headers: {
      "Content-Type": "application/json",
      // Własny nagłówek - po nim poznajemy w testach i w konsoli, że to my.
      "X-Grind-Queued": "1",
    },
  });
}

function headersToObject(init: HeadersInit | undefined, request: Request | null): Record<string, string> {
  const out: Record<string, string> = {};
  const headers = new Headers(init ?? request?.headers ?? {});
  headers.forEach((value, key) => {
    // Autoryzacja jest krótkotrwała; przy wysyłce z kolejki i tak podmieniamy
    // ją na świeży token, więc nie ma po co jej przechowywać.
    if (key.toLowerCase() !== "authorization") out[key] = value;
  });
  return out;
}

export function createOfflineFetch(): typeof fetch {
  return async function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

    if (!isQueueableWrite(url, method)) return fetch(input as RequestInfo, init);

    const rawBody =
      typeof init?.body === "string" ? init.body : request ? await request.clone().text() : null;
    const headers = headersToObject(init?.headers, request);
    const prefer = headers["Prefer"] ?? headers["prefer"] ?? "";
    const isUpsert = isUpsertPrefer(prefer);
    const wantsBody = wantsRepresentation(prefer);

    async function queueIt(): Promise<Response> {
      const { body, rows } = method === "POST" ? withLocalIds(rawBody, isUpsert) : { body: rawBody, rows: [] };
      const item: Omit<QueuedMutation, "id"> = {
        url,
        method,
        headers,
        body,
        table: tableFromUrl(url),
        createdAt: Date.now(),
        attempts: 0,
      };
      await enqueue(item);
      return acceptedResponse(rows, wantsBody);
    }

    // Gdy przeglądarka wie, że jest offline, nie ma po co czekać na timeout.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return queueIt();

    try {
      return await fetch(input as RequestInfo, init);
    } catch {
      // Fetch rzuca wyjątek tylko wtedy, gdy żądanie NIE dotarło. Odpowiedzi
      // 4xx i 5xx przechodzą normalnie i mają trafić do obsługi błędów ekranu -
      // kolejkowanie ich powtarzałoby w kółko zapis, który baza odrzuciła.
      return queueIt();
    }
  };
}
