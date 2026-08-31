/**
 * Sprowadzanie odpowiedzi modelu do limitów aplikacji.
 *
 * DLACZEGO to w ogóle istnieje: `zodOutputFormat` nie przenosi ograniczeń
 * Zoda do gramatyki, którą wiązany jest model. `z.enum(...)`, `.max(240)`,
 * `.min(1)` i `.regex(...)` lądują w OPISIE pola jako tekst w rodzaju
 * "{maxLength: 240}" - czyli jako prośba, nie jako reguła. Model zwykle ją
 * spełnia, ale nie zawsze.
 *
 * Za to `messages.parse()` waliduje odpowiedź PEŁNYM schematem i rzuca
 * wyjątkiem. Zdanie dłuższe o dziewięć znaków wyrzucało więc całą, opłaconą
 * już odpowiedź - a użytkownik dostawał "spróbuj ponownie" i próbował,
 * z tym samym skutkiem.
 *
 * Stąd wzorzec używany przez wszystkie funkcje AI: model odpowiada na schemat
 * BEZ twardych limitów (opisy dalej mówią, jak ma być), a limity egzekwujemy
 * tutaj - przycinając, dociskając i odrzucając pojedyncze pozycje zamiast
 * całej odpowiedzi.
 */

/** Ucięcie na granicy słowa - zdanie urwane w połowie wyrazu wygląda na błąd. */
export function przytnij(tekst: string, limit: number): string {
  const czysty = (tekst ?? "").trim();
  if (czysty.length <= limit) return czysty;

  /*
   * Krótkie pola (skrót dnia planu ma cztery znaki) tniemy bez wielokropka.
   * Przy takiej długości sam wielokropek zajmuje ćwiartkę pola i "AAA…"
   * wygląda jak usterka, a nie jak skrót.
   */
  if (limit <= 8) return czysty.slice(0, limit).trimEnd();

  const ciety = czysty.slice(0, limit - 1);
  const spacja = ciety.lastIndexOf(" ");
  return (spacja > limit * 0.6 ? ciety.slice(0, spacja) : ciety).trimEnd() + "…";
}

/** Liczba całkowita dociśnięta do zakresu. Śmieci lądują na dolnej granicy. */
export function liczba(wartosc: number, min: number, max: number): number {
  if (!Number.isFinite(wartosc)) return min;
  return Math.min(max, Math.max(min, Math.round(wartosc)));
}

/** To samo, ale bez zaokrąglania - dla wartości odżywczych na 100 g. */
export function ulamek(wartosc: number, min: number, max: number, miejsca = 1): number {
  if (!Number.isFinite(wartosc)) return min;
  const w = Math.min(max, Math.max(min, wartosc));
  return Number(w.toFixed(miejsca));
}

/**
 * Napis sprowadzony do postaci [a-z0-9_].
 *
 * Model potrafi odpowiedzieć "Wieczór-Retinoid" albo "Sen-Wydluzenie" tam,
 * gdzie schemat prosił o stały klucz. Bez tego każdy skan zakładałby nową
 * rutynę zamiast aktualizować poprzednią.
 */
export function slug(surowy: string, zapasowy = ""): string {
  const znormalizowany = (surowy ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return znormalizowany || zapasowy;
}

/**
 * Wartość z zamkniętej listy albo wskazany zamiennik.
 *
 * Enum ze schematu jest dla modelu jedynie podpowiedzią w opisie, więc
 * "Pielęgnacja" zamiast "pielegnacja" i "GYM" zamiast "gym" zdarzają się
 * naprawdę. Najpierw próbujemy dopasować po slugu, dopiero potem oddajemy
 * zamiennik.
 */
export function zListy<T extends string>(
  wartosc: string,
  dozwolone: readonly T[],
  zamiennik: T,
): T {
  const s = slug(wartosc);
  return (dozwolone as readonly string[]).includes(s) ? (s as T) : zamiennik;
}

/** Pierwsze wystąpienie wygrywa - duplikaty psują upserty po kluczu. */
export function bezDuplikatow<T>(lista: T[], klucz: (x: T) => string): T[] {
  const widziane = new Set<string>();
  return lista.filter((x) => {
    const k = klucz(x);
    if (widziane.has(k)) return false;
    widziane.add(k);
    return true;
  });
}
