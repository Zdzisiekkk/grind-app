/*
 * Rozwiązywanie ścieżek „@/…” w Node.
 *
 * Testy uruchamiane bez bundlera (test:analysis) importują pliki źródłowe
 * wprost, a te używają aliasu „@/” z tsconfig i — jak każdy TypeScript —
 * pomijają rozszerzenie. Ten hak robi jedno i drugie, dzięki czemu nie trzeba
 * psuć importów w kodzie aplikacji tylko po to, żeby dało się go przetestować.
 *
 * Node sam zdejmuje typy z plików .ts, więc kompilacja nie jest potrzebna.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

/** TypeScript pisze „./format", na dysku leży „format.ts". */
function withExtension(url) {
  if (existsSync(fileURLToPath(url))) return url;
  for (const suffix of [".ts", ".tsx", "/index.ts"]) {
    const candidate = new URL(url.href + suffix);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return url;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(withExtension(new URL(specifier.slice(2), SRC)).href, context);
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    return next(withExtension(new URL(specifier, context.parentURL)).href, context);
  }
  return next(specifier, context);
}
