"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { createOfflineFetch } from "@/lib/offline/offlineFetch";
import type { Database } from "@/lib/database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Klient Supabase w przeglądarce. Jedna instancja na całą kartę.
 *
 * Podstawiamy własny `fetch`, który przy braku sieci odkłada zapisy do kolejki
 * w IndexedDB zamiast rzucać błędem. Dzięki temu każdy ekran zapisuje offline
 * bez własnej obsługi - a seria wbita w piwnicy nie przepada.
 */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
      global: { fetch: createOfflineFetch() },
    });
  }
  return cached;
}
