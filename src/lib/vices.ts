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

/* -------------------------------------------------------------------------- */
/*  Kamienie milowe                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Progi, po które się sięga.
 *
 * Gęste na początku, rzadsze później — pierwszy tydzień jest najtrudniejszy
 * i to wtedy najbardziej potrzeba czegoś blisko. Przy 200 dniach nikt nie
 * potrzebuje już celu na jutro.
 */
export const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;

export function nextMilestone(days: number): { target: number; remaining: number } | null {
  const target = MILESTONES.find((m) => m > days);
  return target === undefined ? null : { target, remaining: target - days };
}

/* -------------------------------------------------------------------------- */
/*  Kalendarz                                                                  */
/* -------------------------------------------------------------------------- */

export type DayState = "before" | "clean" | "lapse";
export type DayCell = { date: string; state: DayState };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Ostatnie `count` dni jako siatka.
 *
 * Passa policzona w jednej liczbie nie pokazuje kształtu — a kształt jest
 * tym, co widać od razu: czy wpadki są rozrzucone, czy chodzą parami.
 * Dni sprzed rzucenia zostają puste, żeby nie udawać sukcesu, którego
 * wtedy nie było.
 */
export function dayCells(vice: ViceLike, events: ViceEventLike[], count = 90, now = new Date()): DayCell[] {
  const started = isoDay(new Date(vice.started_at));

  const lapsed = new Set(
    events.filter((e) => e.kind === "lapse").map((e) => isoDay(new Date(e.occurred_at))),
  );

  return Array.from({ length: count }, (_, i) => {
    const date = isoDay(new Date(now.getTime() - (count - 1 - i) * DAY_MS));
    if (date < started) return { date, state: "before" as const };
    return { date, state: lapsed.has(date) ? ("lapse" as const) : ("clean" as const) };
  });
}

/* -------------------------------------------------------------------------- */
/*  Pora dnia                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Kiedy w ciągu doby przychodzą wpadki.
 *
 * Wyzwalacz mówi „co", to mówi „kiedy" — a plan da się zrobić tylko wtedy,
 * gdy wiadomo, o której godzinie ma zadziałać.
 */
export function lapsesByPartOfDay(events: ViceEventLike[]): { label: string; count: number }[] {
  const buckets = [
    { label: "rano (6-12)", from: 6, to: 12, count: 0 },
    { label: "popołudniu (12-18)", from: 12, to: 18, count: 0 },
    { label: "wieczorem (18-24)", from: 18, to: 24, count: 0 },
    { label: "w nocy (0-6)", from: 0, to: 6, count: 0 },
  ];

  for (const e of events) {
    if (e.kind !== "lapse") continue;
    const hour = new Date(e.occurred_at).getHours();
    const bucket = buckets.find((b) => hour >= b.from && hour < b.to);
    if (bucket) bucket.count++;
  }

  return buckets
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(({ label, count }) => ({ label, count }));
}

/**
 * Ile minut trwa fala chęci, zanim opadnie.
 *
 * Liczba jest przybliżona z założenia — chodzi o to, żeby dać jej koniec.
 * „Przeczekaj" bez widocznego końca to nie jest instrukcja.
 */
export const URGE_SECONDS = 15 * 60;

/* -------------------------------------------------------------------------- */
/*  Tygodnie na wykres                                                         */
/* -------------------------------------------------------------------------- */

export type ViceWeek = {
  /** Poniedziałek tygodnia, ISO. */
  start: string;
  /** Ile dni w tym tygodniu było czystych (dni sprzed rzucenia się nie liczą). */
  clean: number;
  lapses: number;
  urges: number;
};

/**
 * Ostatnie `weeks` tygodni zwinięte do jednego wiersza na tydzień.
 *
 * Ekran nałogów pokazuje jeden nałóg naraz i ostatnie 90 dni. Ekran postępów
 * ma inne zadanie: postawić nałogi OBOK snu i objętości treningowej, bo to
 * jedyne miejsce w aplikacji, gdzie widać rzeczy naraz. Dlatego liczymy tu
 * wszystkie nałogi razem — pytanie brzmi „jak wyglądał ten tydzień", a nie
 * „jak wyglądał ten jeden nałóg".
 */
export function viceWeeks(
  vices: (ViceLike & { id: string })[],
  eventsByVice: Map<string, ViceEventLike[]>,
  weeks = 12,
  now = new Date(),
): ViceWeek[] {
  // Poniedziałek bieżącego tygodnia, liczony w UTC — to czysta arytmetyka
  // kalendarzowa, a doba w UTC zawsze ma 24 godziny.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const shift = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(today.getTime() - shift * DAY_MS);

  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisMonday.getTime() - (weeks - 1 - i) * DAY_MS * 7);
    const startIso = isoDay(start);
    const endIso = isoDay(new Date(start.getTime() + 6 * DAY_MS));

    const lapseDays = new Set<string>();
    let urges = 0;
    let lapses = 0;
    // Dzień liczy się do czystych tylko wtedy, gdy JAKIKOLWIEK nałóg był już
    // wtedy rzucony — inaczej tygodnie sprzed założenia konta wyglądałyby
    // na siedem dni sukcesu.
    let tracked = false;

    for (const vice of vices) {
      const startedIso = isoDay(new Date(vice.started_at));
      if (startedIso <= endIso) tracked = true;

      for (const event of eventsByVice.get(vice.id) ?? []) {
        const day = isoDay(new Date(event.occurred_at));
        if (day < startIso || day > endIso) continue;
        if (event.kind === "lapse") {
          lapses++;
          lapseDays.add(day);
        } else {
          urges++;
        }
      }
    }

    // Tydzień bieżący jeszcze trwa — liczymy tylko dni, które się wydarzyły.
    const elapsed = Math.min(7, Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1);
    const days = Math.max(0, Math.min(7, elapsed));

    return {
      start: startIso,
      clean: tracked ? Math.max(0, days - lapseDays.size) : 0,
      lapses,
      urges,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Kryzys — co robić przez te piętnaście minut                                */
/* -------------------------------------------------------------------------- */

/**
 * Oddech 4-7-8: wdech 4 s, wstrzymanie 7 s, wydech 8 s.
 *
 * Cykl trwa 19 sekund. Wybrany nie dlatego, że jest magiczny, tylko dlatego,
 * że wydech dłuższy od wdechu wymusza wolniejsze tempo — a policzalne fazy
 * dają rękom i głowie jedno zadanie zamiast żadnego.
 */
export const BREATH_CYCLE = 19;

export function breathPhase(elapsedSeconds: number): {
  label: string;
  left: number;
  total: number;
  /** 0–1: jak daleko w tej fazie. Sterujemy tym rozmiarem okręgu. */
  progress: number;
} {
  const t = ((elapsedSeconds % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;

  if (t < 4) return { label: "wdech", left: 4 - t, total: 4, progress: t / 4 };
  if (t < 11) return { label: "wstrzymaj", left: 11 - t, total: 7, progress: (t - 4) / 7 };
  return { label: "wydech", left: 19 - t, total: 8, progress: (t - 11) / 8 };
}

export type CrisisStep = {
  /** Od której sekundy odliczania krok jest aktualny. */
  from: number;
  title: string;
  body: string;
  /** Czy przy tym kroku pokazujemy prowadnicę oddechu. */
  breathing?: boolean;
};

/**
 * Cztery rzeczy do zrobienia przez kwadrans.
 *
 * Panel pokazywał wcześniej sam licznik, passę i zaoszczędzone pieniądze.
 * Piętnaście minut to długo, gdy patrzy się na zegar, a człowiek w kryzysie
 * o pierwszej w nocy nie potrzebuje statystyki — potrzebuje czegoś do zrobienia
 * rękami. Kroki idą od najbardziej fizycznego do najbardziej twojego, bo
 * w pierwszej minucie nikt nie jest gotowy czytać własnych powodów.
 */
export const CRISIS_STEPS: CrisisStep[] = [
  {
    from: 0,
    title: "Oddychaj razem z kółkiem",
    body: "Cztery sekundy wdech, siedem wstrzymania, osiem wydechu. Nie licz w głowie — patrz na kółko. To ma zająć ręce i głowę, a nie cię uleczyć.",
    breathing: true,
  },
  {
    from: 180,
    title: "Wstań i się rusz",
    body: "Szklanka wody i dwie minuty ruchu: dwadzieścia przysiadów, spacer po mieszkaniu, cokolwiek. Chęć jest przywiązana do miejsca, w którym siedzisz — zmień miejsce.",
  },
  {
    from: 420,
    title: "Przypomnij sobie, po co",
    body: "Przeczytaj swój powód poniżej. Jeśli go nie wpisałeś, wpisz go teraz w ustawieniach nałogu — nie na tę falę, tylko na następną.",
  },
  {
    from: 660,
    title: "Zostały cztery minuty",
    body: "Najgorsze już minęło; fala zwykle opada wcześniej, niż kończy się ten zegar. Sprawdź, ile razy przeczekałeś ją wcześniej — ta liczba nie kłamie.",
  },
];

/** Krok aktualny dla danego stanu zegara i numer kroku (do „2 z 4"). */
export function crisisStepAt(secondsLeft: number, total = URGE_SECONDS): {
  step: CrisisStep;
  index: number;
  count: number;
} {
  const elapsed = total - secondsLeft;
  let index = 0;
  for (let i = 0; i < CRISIS_STEPS.length; i++) {
    if (elapsed >= CRISIS_STEPS[i].from) index = i;
  }
  return { step: CRISIS_STEPS[index], index, count: CRISIS_STEPS.length };
}
