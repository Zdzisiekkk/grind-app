import { ScreenSkeleton } from "@/components/ui";

/**
 * Wspólna granica ładowania dla całej aplikacji.
 *
 * Dzięki niej Next może prefetchować szkielet ekranu, więc tapnięcie w zakładkę
 * przełącza widok natychmiast, a dane dojeżdżają strumieniem. Bez tego pliku
 * przeglądarka stoi na starym ekranie do czasu, aż serwer wyrenderuje całość.
 */
export default function Loading() {
  return <ScreenSkeleton />;
}
