/*
 * Kiedy przypominać o stanie dnia (src/lib/statusDnia.ts).
 *
 * Reguła ma chronić przed dwoma błędami naraz: przypominaniem o niczym
 * (spam co pół minuty, jak w pierwszej wersji) i przypominaniem o rzeczy,
 * która o danej porze jest normalna (o 9 rano nikt nie ma zjedzonych
 * dziennych kalorii).
 *
 * Uruchom: npm run test:status
 */
import { slotPrzypomnienia, trescPrzypomnienia } from "../src/lib/statusDnia.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const g = (h, m = 0) => h * 60 + m;

console.log("\n  Sloty czasowe\n");

check("przed 8:00 nie ma slotu", slotPrzypomnienia(g(7, 59)) === null);
check("o 8:00 zaczyna się slot 0", slotPrzypomnienia(g(8)) === 0);
check("11:59 to wciąż slot 0", slotPrzypomnienia(g(11, 59)) === 0);
check("12:00 to slot 1", slotPrzypomnienia(g(12)) === 1);
check("16:00 to slot 2", slotPrzypomnienia(g(16)) === 2);
check("20:00 to slot 3", slotPrzypomnienia(g(20)) === 3);
check("po 22:00 cisza", slotPrzypomnienia(g(22)) === null && slotPrzypomnienia(g(23, 30)) === null);
check(
  "cztery sloty na całą dobę - tyle, ile ma być",
  new Set(
    Array.from({ length: 24 * 60 }, (_, m) => slotPrzypomnienia(m)).filter((s) => s !== null),
  ).size === 4,
);

console.log("\n  Kiedy jest o czym przypominać\n");

const cel = { kcal: 0, kcalGoal: 2000, waterMl: 0, waterGoal: 2000 };

check(
  "o 9:00 pusty dziennik to jeszcze nie powód",
  trescPrzypomnienia(cel, g(9)) === null,
  String(trescPrzypomnienia(cel, g(9))),
);

check(
  "o 20:00 pusty dziennik to już powód",
  trescPrzypomnienia(cel, g(20)) !== null,
);

check(
  "o 20:00 wymienia obie zaległości",
  (trescPrzypomnienia(cel, g(20)) ?? "").includes("kcal") &&
    (trescPrzypomnienia(cel, g(20)) ?? "").includes("wody"),
  String(trescPrzypomnienia(cel, g(20))),
);

check(
  "kto jest na bieżąco, nie dostaje nic",
  trescPrzypomnienia({ kcal: 1600, kcalGoal: 2000, waterMl: 1600, waterGoal: 2000 }, g(20)) === null,
);

check(
  "brak celu kcal nie zgłasza kalorii, ale woda dalej działa",
  (() => {
    const t = trescPrzypomnienia({ kcal: 0, kcalGoal: null, waterMl: 0, waterGoal: 2000 }, g(20));
    return t !== null && !t.includes("kcal") && t.includes("wody");
  })(),
);

// O 12:00 "należy się" 31% celu. Kto ma 20%, odstaje - ale mieści się
// w 15-punktowym marginesie i nie jest to powód do wybudzania ekranu.
check(
  "drobne odchylenie mieści się w marginesie",
  trescPrzypomnienia({ kcal: 400, kcalGoal: 2000, waterMl: 400, waterGoal: 2000 }, g(12)) === null,
  String(trescPrzypomnienia({ kcal: 400, kcalGoal: 2000, waterMl: 400, waterGoal: 2000 }, g(12))),
);

check(
  "ale wyraźne odstawanie o tej samej porze już tak",
  trescPrzypomnienia({ kcal: 0, kcalGoal: 2000, waterMl: 0, waterGoal: 2000 }, g(12)) !== null,
);

check(
  "podaje ile ZOSTAŁO, nie ile zjedzone",
  (trescPrzypomnienia({ kcal: 500, kcalGoal: 2000, waterMl: 2000, waterGoal: 2000 }, g(20)) ?? "")
    .includes("1500 kcal"),
  String(trescPrzypomnienia({ kcal: 500, kcalGoal: 2000, waterMl: 2000, waterGoal: 2000 }, g(20))),
);

check(
  "przekroczony cel nie robi ujemnych zaległości",
  trescPrzypomnienia({ kcal: 3000, kcalGoal: 2000, waterMl: 3000, waterGoal: 2000 }, g(20)) === null,
);

console.log(`\n  ${fails === 0 ? "Wszystko gra" : `${fails} błędów`}\n`);
if (fails > 0) process.exit(1);
