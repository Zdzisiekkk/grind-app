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
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

/**
 * TypeScript pisze „./format", na dysku leży „format.ts".
 *
 * Kolejność ma znaczenie: „looks.ts" wygrywa z katalogiem „looks/". Tak samo
 * rozstrzygają to TypeScript i bundlery, a Node sam z siebie wybrałby katalog
 * i wywalił się na ERR_UNSUPPORTED_DIR_IMPORT — czyli test nie działałby
 * dokładnie tam, gdzie moduł ma i plik, i folder o tej samej nazwie.
 */
function withExtension(url) {
  const sciezka = fileURLToPath(url);
  if (existsSync(sciezka) && !statSync(sciezka).isDirectory()) return url;
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
