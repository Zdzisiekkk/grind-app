/**
 * Liczby dla nałogów.
 *
 * Moduł jest czysty (żadnego Reacta, żadnego Supabase), więc te same funkcje
 * liczą wynik na serwerze, w przeglądarce i w teście. To ważniejsze niż
 * zwykle: licznik „czystych dni" jest jedyną rzeczą, po którą się tu sięga,
 * a licznik, który raz pokazuje 12, a raz 13, nie jest wart nic.
 */

export type ViceEventLike = {
  kind: "lapse" | "urge";
  occurred_at: string;
  trigger: string | null;
};

export type ViceLike = {
  started_at: string;
  daily_cost: number | null;
  daily_minutes: number | null;
};

const DAY_MS = 86_400_000;

/**
 * Od kiedy trwa obecna passa.
 *
 * Ostatnia wpadka, a gdy jej nie ma — moment rzucenia. Wpadki wpisane wstecz
 * liczą się od chwili zdarzenia, nie od chwili wpisania.
 */
export function cleanSince(vice: ViceLike, events: ViceEventLike[]): Date {
  const start = new Date(vice.started_at);
  let latest = start;

  for (const e of events) {
    if (e.kind !== "lapse") continue;
    const at = new Date(e.occurred_at);
    if (at > latest) latest = at;
  }
  return latest;
}

/** Pełne doby od początku passy. Świeżo rzucony nałóg to 0 dni, nie 1. */
export function daysClean(vice: ViceLike, events: ViceEventLike[], now = new Date()): number {
  const ms = now.getTime() - cleanSince(vice, events).getTime();
  return Math.max(0, Math.floor(ms / DAY_MS));
}

/**
 * Najdłuższa passa w historii — łącznie z trwającą.
 *
 * Odstępy liczymy między kolejnymi wpadkami, a pierwszy odstęp od momentu
 * rzucenia. Bez tego ostatniego rekord po pierwszej wpadce wynosiłby zero,
 * choć wcześniej ktoś wytrzymał miesiąc.
 */
export function bestStreak(vice: ViceLike, events: ViceEventLike[], now = new Date()): number {
  const lapses = events
    .filter((e) => e.kind === "lapse")
    .map((e) => new Date(e.occurred_at).getTime())
    .sort((a, b) => a - b);

  const points = [new Date(vice.started_at).getTime(), ...lapses, now.getTime()];

  let best = 0;
  for (let i = 1; i < points.length; i++) {
    best = Math.max(best, Math.floor((points[i] - points[i - 1]) / DAY_MS));
  }
  return Math.max(0, best);
}

/**
 * Co nałóg oddał: pieniądze i czas.
 *
 * Liczone od bieżącej passy, nie od sumy życia — po wpadce licznik startuje
 * od nowa, tak samo jak dni. Nagroda za passę, którą się właśnie zerwało,
 * byłaby kłamstwem.
 */
export function saved(vice: ViceLike, days: number): { money: number; minutes: number } {
  return {
    money: Math.round((vice.daily_cost ?? 0) * days * 100) / 100,
    minutes: (vice.daily_minutes ?? 0) * days,
  };
}

/**
 * Wyzwalacze, które się powtarzają — od najczęstszego.
 *
 * Jedna wpadka to pech, trzy z tym samym powodem to wzorzec i dopiero z nim
 * da się coś zrobić. Dlatego zwracamy liczby, a nie samą listę.
 */
export function topTriggers(events: ViceEventLike[], limit = 3): { trigger: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const e of events) {
    if (e.kind !== "lapse") continue;
    const key = e.trigger?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger, "pl"))
    .slice(0, limit);
}

/** Ile razy chęć minęła bez wpadki — jedyna liczba tutaj, która tylko rośnie. */
export function urgesResisted(events: ViceEventLike[]): number {
  return events.filter((e) => e.kind === "urge").length;
}

/** „12 dni", „1 dzień", „0 dni" — polska odmiana bez zgadywania w JSX. */
export function dayWord(n: number): string {
  if (n === 1) return "dzień";
  return "dni";
}

/** Odzyskany czas czyta się w godzinach, gdy uzbiera się ich sensowna liczba. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} dni`;
}

/** Progi, na których licznik dostaje inny kolor — pierwszy tydzień jest najtrudniejszy. */
export function cleanBand(days: number): "start" | "week" | "month" | "solid" {
  if (days < 7) return "start";
  if (days < 30) return "week";
  if (days < 90) return "month";
  return "solid";
}
