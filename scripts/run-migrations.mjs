/**
 * Uruchamia migracje na zdalnym projekcie Supabase przez Management API
 * (ten sam endpoint, którego używa SQL Editor w panelu).
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... node scripts/run-migrations.mjs
 *
 * Migracje są idempotentne, więc ponowne uruchomienie niczego nie psuje.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Brakuje SUPABASE_ACCESS_TOKEN albo SUPABASE_PROJECT_REF.");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const query = await readFile(join(dir, file), "utf8");
  process.stdout.write(`→ ${file} … `);

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
