/**
 * Uruchamia migracje na zdalnym projekcie Supabase przez Management API
 * (ten sam endpoint, którego używa SQL Editor w panelu).
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... node scripts/run-migrations.mjs
 *
 * Migracje są idempotentne, więc ponowne uruchomienie niczego nie psuje.
 */
import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Token czytamy z .env.local, a nie z linii poleceń.
 *
 * Sekret podany w komendzie ląduje w historii powłoki, a przy pracy
 * z asystentem także w zapisie sesji na dysku. Plik .env.local jest
 * w .gitignore i nigdzie nie wycieka.
 */
function wczytajEnv() {
  try {
    for (const linia of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const m = linia.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Brak pliku to nie błąd - zmienne mogą przyjść ze środowiska.
  }
}
wczytajEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN;

/*
 * Identyfikator projektu wyciągamy z adresu, który i tak jest w .env.local.
 * To nie jest sekret (widać go w każdym zapytaniu z przeglądarki), więc nie ma
 * powodu wymagać drugiej zmiennej do wpisania.
 */
const ref =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!token || !ref) {
  console.error(
    "\n❌ Brakuje danych do połączenia.\n" +
      "   Dopisz do .env.local:\n" +
      "     SUPABASE_ACCESS_TOKEN=<token z supabase.com/dashboard/account/tokens>\n" +
      (ref ? "" : "     SUPABASE_PROJECT_REF=<identyfikator projektu>\n") +
      "   Po wykonaniu migracji token unieważnij - jest jednorazowo potrzebny.\n",
  );
  process.exit(1);
}

console.log(`Projekt: ${ref}\n`);

const dir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const query = await readFile(join(dir, file), "utf8");
  process.stdout.write(`→ ${file} ... `);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.log("BŁĄD");
    console.error(body);
    process.exit(1);
  }
  console.log("ok");
}

console.log(`\nGotowe: ${files.length} migracji.`);
