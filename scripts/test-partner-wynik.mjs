/*
 * Wynik dnia pary i seria razem (src/lib/partnerWynik.ts).
 * Uruchom: npm run test:partner
 */
import { wynikDnia, dniOsoby, seriaRazem, punktyTygodnia } from "../src/lib/partnerWynik.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const w = (kto, data, o = {}) => ({
  kto, data, jedzenie: false, trening: false, nawyki_n: 0, nawyki_ok: 0, skin_n: 0, skin_ok: 0, ...o,
});
const pelny = { jedzenie: true, trening: true, nawyki_n: 2, nawyki_ok: 2, skin_n: 2, skin_ok: 2 };

console.log("\n  Wynik dnia\n");
check("pusty dzień to 0", wynikDnia(w("ja", "2026-11-01")).wynik === 0);
check("pełny dzień to 1", wynikDnia(w("ja", "2026-11-01", pelny)).wynik === 1);
check(
  "odpoczynek (bez treningu) wciąż zaliczony",
  dniOsoby([w("ja", "2026-11-01", { ...pelny, trening: false })], "ja")[0].zaliczony,
);
check(
  "bez nawyków i skin care liczy się tylko jedzenie i trening",
  wynikDnia(w("ja", "2026-11-01", { jedzenie: true, trening: true })).wynik === 1,
);
check(
  "samo jedzenie przy 4 obszarach to za mało",
  !dniOsoby([w("ja", "2026-11-01", { ...pelny, trening: false, nawyki_ok: 0, skin_ok: 0 })], "ja")[0].zaliczony,
);

console.log("\n  Seria razem\n");
const dni = (kto, mapa) =>
  dniOsoby(Object.entries(mapa).map(([d, ok]) => w(kto, d, ok ? pelny : {})), kto);

const ja = dni("ja", { "2026-10-29": true, "2026-10-30": true, "2026-10-31": true, "2026-11-01": false });
const on = dni("on", { "2026-10-29": true, "2026-10-30": true, "2026-10-31": true, "2026-11-01": false });
check("dzisiejszy niedokończony dzień nie zrywa serii", seriaRazem(ja, on, "2026-11-01") === 3);

const on2 = dni("on", { "2026-10-29": true, "2026-10-30": false, "2026-10-31": true, "2026-11-01": true });
const ja2 = dni("ja", { "2026-10-29": true, "2026-10-30": true, "2026-10-31": true, "2026-11-01": true });
check("przerwa u jednej osoby kończy serię", seriaRazem(ja2, on2, "2026-11-01") === 2);
check("dziś zaliczone przez oboje dolicza się", seriaRazem(ja2, on2, "2026-11-01") === 2);
check("brak danych partnera to seria 0", seriaRazem(ja2, [], "2026-11-01") === 0);

console.log("\n  Pojedynek\n");
check("punkty tygodnia sumują się", punktyTygodnia(dni("ja", { "2026-10-31": true, "2026-11-01": true }), "2026-11-01") === 8);

console.log(fails ? `\n  ${fails} błędów\n` : "\n  Wszystko zielone\n");
process.exit(fails ? 1 : 0);
