"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Klient Supabase w przeglądarce. Jedna instancja na całą kartę. */
export function createClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY());
  }
  return cached;
}
