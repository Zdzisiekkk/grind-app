/*
 * Przypomnienie o elektrolitach (src/lib/elektrolity.ts).
 *
 * Reguła ma jeden cel: odezwać się dokładnie wtedy, gdy jest powód -
 * czyli gdy ktoś wypił dużo - i milczeć w każdym innym przypadku.
 * Przypomnienie, które przychodzi po półtora litra, jest szumem,
 * a szum uczy wyłączać powiadomienia.
 *
 * Uruchom: npm run test:elektrolity
 */
import {
  DOMYSLNY_PROG_ML,
  czyPrzypomniec,
  trescElektrolitow,
} from "../src/lib/elektrolity.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " - " + extra : ""}`);
};

const wlaczone = { wlaczone: true, progMl: null };

console.log("\n  Próg\n");

check("mało wypite - cisza", czyPrzypomniec(1500, wlaczone) === false);
check("tuż pod progiem - cisza", czyPrzypomniec(DOMYSLNY_PROG_ML - 1, wlaczone) === false);
check("dokładnie próg - przypomina", czyPrzypomniec(DOMYSLNY_PROG_ML, wlaczone) === true);
check("dużo ponad próg - przypomina", czyPrzypomniec(5000, wlaczone) === true);
check("nic nie wypite - cisza", czyPrzypomniec(0, wlaczone) === false);

console.log("\n  Ustawienia\n");

check(
  "wyłączone znaczy wyłączone, choćby ktoś wypił wiadro",
  czyPrzypomniec(9000, { wlaczone: false, progMl: null }) === false,
);
check(
  "własny próg działa zamiast domyślnego",
  czyPrzypomniec(2100, { wlaczone: true, progMl: 2000 }) === true &&
    czyPrzypomniec(2100, { wlaczone: true, progMl: 2500 }) === false,
);
check(
  "próg zerowy albo ujemny nie zamienia się w przypominanie zawsze",
  czyPrzypomniec(100, { wlaczone: true, progMl: 0 }) === false &&
    czyPrzypomniec(100, { wlaczone: true, progMl: -500 }) === false,
);

console.log("\n  Treść\n");

check(
  "podaje powód w litrach, nie w mililitrach",
  trescElektrolitow(3200).includes("3,2 l"),
  trescElektrolitow(3200),
);
check(
  "okrągła wartość też ma miejsce po przecinku",
  trescElektrolitow(3000).includes("3,0 l"),
  trescElektrolitow(3000),
);
check(
  "nie podaje dawek ani preparatów - to dziennik, nie zalecenie lekarskie",
  !/\d+\s*(mg|g\b)|tabletk|saszetk|suplement/i.test(trescElektrolitow(4000)),
  trescElektrolitow(4000),
);

console.log(`\n  ${fails === 0 ? "Wszystko gra" : `${fails} błędów`}\n`);
if (fails > 0) process.exit(1);
