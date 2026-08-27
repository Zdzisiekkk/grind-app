/*
 * Sprawdza arytmetykę nałogów.
 *
 * Licznik „czystych dni" to jedyna liczba, po którą się tam wchodzi — i taka,
 * na której pomyłka kosztuje najwięcej: pokazany o jeden dzień za mało zabiera
 * passę, której nikt nie zerwał.
 *
 * Uruchom: npm run test:vices
 */
import { bestStreak, cleanBand, daysClean, formatMinutes, saved, topTriggers, urgesResisted }
  from "../src/lib/vices.ts";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
};

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
const vice = (days, cost = null, minutes = null) => ({
  started_at: ago(days),
  daily_cost: cost,
  daily_minutes: minutes,
});

console.log("\n  Licznik czystych dni\n");

check("bez wpadek liczy od rzucenia", daysClean(vice(10), []) === 10);

check("świeżo rzucony nałóg to zero dni, nie jeden",
  daysClean(vice(0), []) === 0);

// Wpadka wpisana dziś, ale zdarzona trzy dni temu — licznik idzie od zdarzenia.
const zWpadka = [
  { kind: "lapse", occurred_at: ago(3), trigger: "stres" },
  { kind: "urge", occurred_at: ago(1), trigger: null },
];
check("wpadka zeruje licznik, chęć nie",
  daysClean(vice(10), zWpadka) === 3, `dni=${daysClean(vice(10), zWpadka)}`);

check("liczy się najświeższa wpadka, nie pierwsza z listy",
  daysClean(vice(30), [
    { kind: "lapse", occurred_at: ago(2), trigger: null },
    { kind: "lapse", occurred_at: ago(20), trigger: null },
  ]) === 2);

console.log("\n  Rekord\n");

check("rekord obejmuje odcinek przed pierwszą wpadką",
  bestStreak(vice(30), [{ kind: "lapse", occurred_at: ago(5), trigger: null }]) === 25,
  `rekord=${bestStreak(vice(30), [{ kind: "lapse", occurred_at: ago(5), trigger: null }])}`);

check("trwająca passa też może być rekordem",
  bestStreak(vice(40), []) === 40);

check("rekord bierze najdłuższy odstęp, nie ostatni",
  bestStreak(vice(60), [
    { kind: "lapse", occurred_at: ago(50), trigger: null },
    { kind: "lapse", occurred_at: ago(10), trigger: null },
  ]) === 40);

console.log("\n  Oszczędności\n");

const money = saved(vice(10, 20, 60), 10);
check("pieniądze liczone od bieżącej passy", money.money === 200, `${money.money} zł`);
check("czas liczony tak samo", money.minutes === 600, `${money.minutes} min`);
check("bez podanego kosztu nie zmyśla liczby", saved(vice(10), 10).money === 0);

check("minuty czytane jako godziny", formatMinutes(600) === "10 h", formatMinutes(600));
check("krótkie odcinki zostają minutami", formatMinutes(45) === "45 min");
check("bardzo długie odcinki jako dni", formatMinutes(60 * 24 * 5) === "5 dni", formatMinutes(7200));

console.log("\n  Wyzwalacze\n");

const wpadki = [
  { kind: "lapse", occurred_at: ago(9), trigger: "Stres" },
  { kind: "lapse", occurred_at: ago(6), trigger: "stres " },
  { kind: "lapse", occurred_at: ago(3), trigger: "alkohol" },
  { kind: "urge", occurred_at: ago(1), trigger: "nuda" },
];
const top = topTriggers(wpadki);
check("ten sam wyzwalacz różną wielkością liter to jeden wzorzec",
  top[0].trigger === "stres" && top[0].count === 2, JSON.stringify(top));
check("chęci nie liczą się jako wyzwalacze wpadek",
  top.every((t) => t.trigger !== "nuda"));
check("pokonane chęci liczone osobno", urgesResisted(wpadki) === 1);

console.log("\n  Progi\n");

check("pierwszy tydzień to osobny próg", cleanBand(3) === "start");
check("po miesiącu inny próg", cleanBand(45) === "month");
check("kwartał to najwyższy próg", cleanBand(120) === "solid");

console.log(fails ? `\n  BŁĘDÓW: ${fails}\n` : "\n  WSZYSTKO PRZESZŁO\n");
process.exit(fails ? 1 : 0);
