/**
 * Kiedy przypomnieć o stanie dnia (kalorie i woda).
 *
 * Pierwsza wersja tego "widgetu" odświeżała powiadomienie co 30 sekund.
 * W założeniu miało to udawać widget na ekranie blokady; w praktyce był to
 * nieustanny ping, który uczy człowieka wyłączać powiadomienia całkiem -
 * a wtedy nie dochodzą też te naprawdę ważne (nawyk, pora snu).
 *
 * Nowa reguła ma dwa warunki naraz:
 *  1. najwyżej raz na cztery godziny (sloty 8, 12, 16, 20),
 *  2. tylko wtedy, gdy realnie odstajesz od celu.
 *
 * "Odstajesz" liczymy względem pory dnia, a nie względem całego celu -
 * o dziesiątej rano każdy ma zjedzone 20% dziennych kalorii i przypominanie
 * mu o tym byłoby karaniem za to, że jeszcze nie zjadł obiadu.
 */

export type StanDnia = {
  kcal: number;
  kcalGoal: number | null;
  waterMl: number;
  waterGoal: number;
};

/** Okno, w którym w ogóle wolno przypominać. Poza nim - cisza. */
export const OD_GODZINY = 8;
export const DO_GODZINY = 22;

/** Co ile godzin najwyżej jedno przypomnienie. */
export const CO_GODZIN = 4;

/**
 * Jaka część dziennego celu "powinna" być zrobiona o tej porze.
 *
 * Krzywa jest celowo łagodna z rana i stroma po południu: normalny dzień to
 * śniadanie, obiad i kolacja, a nie równomierne dojadanie co godzinę.
 */
function oczekiwanaCzesc(minuty: number): number {
  const h = minuty / 60;
  if (h <= OD_GODZINY) return 0;
  if (h >= DO_GODZINY) return 1;
  // Liniowo od 8:00 (0%) do 21:00 (100%), potem płasko.
  return Math.min(1, (h - OD_GODZINY) / (21 - OD_GODZINY));
}

/**
 * Numer czterogodzinnego slotu - klucz, po którym poznajemy, że w tym oknie
 * już przypominaliśmy. Poza godzinami pracy zwraca null.
 */
export function slotPrzypomnienia(minuty: number): number | null {
  const h = Math.floor(minuty / 60);
  if (h < OD_GODZINY || h >= DO_GODZINY) return null;
  return Math.floor((h - OD_GODZINY) / CO_GODZIN);
}

/**
 * Treść przypomnienia albo null, gdy nie ma o czym przypominać.
 *
 * Margines 15 punktów procentowych: bez niego powiadomienie wychodziłoby
 * przy każdym najmniejszym odchyleniu, a "jesteś 3% za celem" to nie jest
 * informacja, dla której warto wybudzać ekran.
 */
export function trescPrzypomnienia(stan: StanDnia, minuty: number): string | null {
  const oczekiwane = oczekiwanaCzesc(minuty);
  if (oczekiwane <= 0) return null;

  const braki: string[] = [];

  if (stan.kcalGoal && stan.kcalGoal > 0) {
    const czesc = stan.kcal / stan.kcalGoal;
    if (czesc < oczekiwane - 0.15) {
      braki.push(`${Math.max(0, stan.kcalGoal - stan.kcal)} kcal do celu`);
    }
  }

  if (stan.waterGoal > 0) {
    const czesc = stan.waterMl / stan.waterGoal;
    if (czesc < oczekiwane - 0.15) {
      braki.push(`${Math.max(0, stan.waterGoal - stan.waterMl)} ml wody`);
    }
  }

  if (braki.length === 0) return null;
  return `Zostało: ${braki.join(" i ")}`;
}
