/*
 * Sprawdza decyzje kolejki offline.
 *
 * To jedyna część trybu offline, którą da się przetestować bez przeglądarki —
 * i akurat ta, w której pomyłka jest najdroższa: zakolejkowanie logowania albo
 * zgubienie identyfikatora serii.
 *
 * Uruchom: npm run test:offline
 */
import { isQueueableWrite, tableFromUrl, withLocalIds, isUpsertPrefer, wantsRepresentation }
  from "../src/lib/offline/rest.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
};

const SB = "https://x.supabase.co";

console.log("\n  Co wolno odłożyć na później\n");
check("zapis serii tak", isQueueableWrite(`${SB}/rest/v1/workout_logs`, "POST"));
check("poprawka serii tak", isQueueableWrite(`${SB}/rest/v1/workout_logs?id=eq.1`, "PATCH"));
check("usunięcie serii tak", isQueueableWrite(`${SB}/rest/v1/workout_logs?id=eq.1`, "DELETE"));
check("odczyt NIE", !isQueueableWrite(`${SB}/rest/v1/workout_logs?select=*`, "GET"));
check("logowanie NIE", !isQueueableWrite(`${SB}/auth/v1/token?grant_type=password`, "POST"));
check("rejestracja NIE", !isQueueableWrite(`${SB}/auth/v1/signup`, "POST"));
check("wywołanie funkcji NIE", !isQueueableWrite(`${SB}/rest/v1/rpc/clone_plan`, "POST"));
check("wyszukiwarka produktów NIE", !isQueueableWrite("/api/food/search?q=ryz", "POST"));

console.log("\n  Nazwa tabeli do pokazania człowiekowi\n");
check("z prostego adresu", tableFromUrl(`${SB}/rest/v1/sleep_logs`) === "sleep_logs");
check("z adresu z filtrem", tableFromUrl(`${SB}/rest/v1/todos?id=eq.7`) === "todos");

console.log("\n  Stemplowanie wiersza identyfikatorem\n");
let n = 0;
const id = () => `id-${++n}`;
const at = () => "2026-01-01T00:00:00.000Z";

const one = withLocalIds(JSON.stringify({ user_id: "u", reps: 8 }), false, id, at);
const oneRow = JSON.parse(one.body);
check("wstawienie dostaje id", oneRow.id === "id-1", `id=${oneRow.id}`);
check("wstawienie dostaje datę", oneRow.created_at === at());
check("odpowiedź niesie ten sam wiersz", one.rows[0].id === oneRow.id);
check("pojedynczy obiekt zostaje obiektem", !Array.isArray(JSON.parse(one.body)));

const many = withLocalIds(JSON.stringify([{ a: 1 }, { a: 2 }]), false, id, at);
const manyRows = JSON.parse(many.body);
check("tablica zostaje tablicą", Array.isArray(manyRows) && manyRows.length === 2);
check("każdy wiersz ma własne id", manyRows[0].id !== manyRows[1].id);

// Upsert NIE dostaje id: PostgREST wpisałby je do „do update set" i nadpisał
// klucz istniejącego wiersza.
const up = withLocalIds(JSON.stringify({ user_id: "u", date: "2026-01-01", count: 2 }), true, id, at);
check("upsert BEZ id", JSON.parse(up.body).id === undefined);

const kept = withLocalIds(JSON.stringify({ id: "moje", a: 1 }), false, id, at);
check("własne id nie jest nadpisywane", JSON.parse(kept.body).id === "moje");

check("puste ciało przechodzi bez zmian", withLocalIds(null, false, id, at).body === null);
check("nie-JSON przechodzi bez zmian", withLocalIds("nie json", false, id, at).body === "nie json");

console.log("\n  Nagłówek Prefer\n");
check("upsert rozpoznany", isUpsertPrefer("resolution=merge-duplicates,return=minimal"));
check("zwykły insert to nie upsert", !isUpsertPrefer("return=representation"));
check("prośba o wiersze rozpoznana", wantsRepresentation("return=representation"));
check("return=minimal nie chce wierszy", !wantsRepresentation("return=minimal"));

console.log(fails === 0 ? "\n  WSZYSTKO PRZESZŁO\n" : `\n  BŁĘDÓW: ${fails}\n`);
process.exit(fails ? 1 : 0);
