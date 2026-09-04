/**
 * Co widać na pulpicie.
 *
 * Pulpit urósł do dwunastu kart i przestał być pulpitem - zrobiła się z niego
 * lista wszystkiego, co aplikacja umie. Rzecz, która wymaga działania (zaległy
 * nawyk), wyglądała tak samo jak statystyka sprzed tygodnia i tonęła w tym
 * samym przewijaniu.
 *
 * Zamiast zgadywać, komu co jest potrzebne, każdy wybiera sam - a domyślny
 * zestaw jest krótki i mówi o dzisiaj. Kto chce widzieć wszystko, włącza
 * wszystko jednym tapnięciem; nic nie znika bezpowrotnie.
 */

export type KartaPulpitu = {
  id: string;
  nazwa: string;
  opis: string;
  /** Widoczna, dopóki człowiek niczego nie wybrał. */
  domyslna: boolean;
};

/**
 * Kolejność w tej tablicy jest kolejnością na pulpicie - najpierw rzeczy
 * do zrobienia dzisiaj, potem podsumowania i przeglądy.
 */
export const KARTY_PULPITU: readonly KartaPulpitu[] = [
  {
    id: "trening",
    nazwa: "Trening",
    opis: "Dzisiejszy trening z planu albo przycisk startu.",
    domyslna: true,
  },
  {
    id: "dieta",
    nazwa: "Dieta",
    opis: "Kalorie i makroskładniki na dziś.",
    domyslna: true,
  },
  {
    id: "nawyki",
    nazwa: "Nawyki na dziś",
    opis: "Co zostało do odhaczenia.",
    domyslna: true,
  },
  {
    id: "woda",
    nazwa: "Nawodnienie",
    opis: "Ile wypite i szybkie dodawanie szklanki.",
    domyslna: true,
  },
  {
    id: "zadania",
    nazwa: "Zadania na teraz",
    opis: "Zadania z terminem na dziś lub zaległe.",
    domyslna: true,
  },
  {
    id: "sen",
    nazwa: "Sen",
    opis: "Ostatnia noc i wynik snu.",
    domyslna: false,
  },
  {
    id: "nalogi",
    nazwa: "Nałogi",
    opis: "Ile dni czysto i przycisk zgłoszenia ochoty.",
    domyslna: false,
  },
  {
    id: "aktywnosci",
    nazwa: "Aktywności dziś",
    opis: "Spacery, rower i inne rzeczy poza planem treningowym.",
    domyslna: false,
  },
  {
    id: "wyglad",
    nazwa: "Wygląd",
    opis: "Wynik ostatniego skanu i kiedy był.",
    domyslna: false,
  },
  {
    id: "przepis",
    nazwa: "Przepis dnia",
    opis: "Podpowiedź, co ugotować.",
    domyslna: false,
  },
  {
    id: "tydzien",
    nazwa: "Ostatnie 7 dni",
    opis: "Podsumowanie tygodnia w liczbach.",
    domyslna: false,
  },
];

/** Identyfikatory kart widocznych, gdy człowiek jeszcze niczego nie wybrał. */
export const DOMYSLNE_KARTY: readonly string[] = KARTY_PULPITU.filter((k) => k.domyslna).map(
  (k) => k.id,
);

/**
 * Czy dana karta ma być widoczna.
 *
 * `null` w profilu (stan każdego nowego konta) to zestaw domyślny, a nie
 * pusty pulpit. Pusta TABLICA to już świadoma decyzja "nie chcę nic" i tę
 * decyzję uszanowujemy - dlatego te dwa przypadki muszą się różnić.
 * Nieznanych identyfikatorów nie honorujemy: karta mogła zniknąć z aplikacji,
 * a wpis po niej zostać w bazie.
 */
export function widoczneKarty(wybor: unknown): Set<string> {
  if (!Array.isArray(wybor)) return new Set(DOMYSLNE_KARTY);

  const znane = new Set(KARTY_PULPITU.map((k) => k.id));
  return new Set(wybor.filter((id): id is string => typeof id === "string" && znane.has(id)));
}
