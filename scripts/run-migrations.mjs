/**
 * Uruchamia migracje na zdalnym projekcie Supabase przez Management API
 * (ten sam endpoint, którego używa SQL Editor w panelu).
 *
 *   npm run db:push            # wszystkie migracje (tylko na czystej bazie)
 *   OD=0048 npm run db:push    # tylko od podanego numeru w górę
 *
 * Token bierze z .env.local. Na bazie, która ma już wykonane migracje,
 * ZAWSZE podawaj OD - patrz komentarz przy filtrowaniu plików niżej.
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

/*
 * Zakres migracji do wykonania: OD=0048 npm run db:push
 *
 * Migracje tego projektu SĄ odtwarzalne od zera (tak sprawdza je validate:sql
 * w PGlite), ale NIE są odtwarzalne na bazie już zmigrowanej. Migracja 0010
 * tworzy widok snu z kolumną nap_min, a 0040 przeniosła drzemki do osobnej
 * tabeli i tę kolumnę zabrała - powtórzone 0010 pyta więc o coś, czego już
 * nie ma. To nie jest usterka: migracja opisuje stan świata z dnia, w którym
 * powstała, i taka ma zostać.
 *
 * Dlatego na działającej bazie uruchamiamy tylko nowe pliki.
 */
const od = process.env.OD;
const dir = join(process.cwd(), "supabase", "migrations");
let files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
if (od) {
  const przed = files.length;
  files = files.filter((f) => f.slice(0, 4) >= od);
  console.log(`Zakres: od ${od} - ${files.length} z ${przed} plików.\n`);
  if (files.length === 0) {
    console.error(`Żaden plik nie pasuje do OD=${od}.`);
    process.exit(1);
  }
}

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
