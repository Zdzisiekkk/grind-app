/**
 * Ile kosztowało jedno wywołanie modelu.
 *
 * Powstało z prostego pytania "ile to właściwie kosztuje", na które dało się
 * odpowiedzieć tylko szacunkiem: tokeny wejścia da się policzyć z góry za
 * darmo, ale rozumowania modelu - nie. Liczy się ono do wyjścia i przy myśleniu
 * adaptacyjnym potrafi być większe niż sama odpowiedź.
 *
 * Dlatego każde wywołanie zapisuje w logu, co naprawdę zużyło. Po tygodniu
 * używania mamy prawdziwe liczby zamiast widełek - a przy zmianie promptu od
 * razu widać, czy podrożał.
 *
 * Ceny z platform.claude.com/docs/en/about-claude/pricing, w dolarach za milion
 * tokenów. Trzymane tutaj, bo log ma podawać kwotę, a nie surowe liczby, które
 * i tak trzeba by przeliczać ręcznie.
 */

type Cennik = { we: number; wy: number; cacheZapis: number; cacheOdczyt: number };

const CENNIK: Record<string, Cennik> = {
  "claude-opus-5": { we: 5, wy: 25, cacheZapis: 6.25, cacheOdczyt: 0.5 },
  "claude-sonnet-5": { we: 2, wy: 10, cacheZapis: 2.5, cacheOdczyt: 0.2 },
  "claude-haiku-4-5-20251001": { we: 1, wy: 5, cacheZapis: 1.25, cacheOdczyt: 0.1 },
};

type Uzycie = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Kwota w dolarach. Null, gdy modelu nie ma w cenniku - lepiej nic niż zmyślona liczba. */
export function kosztUSD(model: string, uzycie: Uzycie): number | null {
  const c = CENNIK[model];
  if (!c) return null;

  const we = uzycie.input_tokens ?? 0;
  const wy = uzycie.output_tokens ?? 0;
  const cz = uzycie.cache_creation_input_tokens ?? 0;
  const co = uzycie.cache_read_input_tokens ?? 0;

  return (we * c.we + wy * c.wy + cz * c.cacheZapis + co * c.cacheOdczyt) / 1_000_000;
}

/**
 * Jedna linijka w logu serwera.
 *
 * Bez żadnych danych użytkownika - sam kształt zapytania. Log z liczbami
 * o czyimś śnie czy wadze byłby kolejnym miejscem, w którym te dane leżą.
 */
export function zalogujKoszt(co: string, model: string, uzycie: Uzycie): void {
  const usd = kosztUSD(model, uzycie);
  console.log(
    `[koszt] ${co} model=${model} we=${uzycie.input_tokens ?? 0} ` +
      `wy=${uzycie.output_tokens ?? 0} ` +
      `cache_zapis=${uzycie.cache_creation_input_tokens ?? 0} ` +
      `cache_odczyt=${uzycie.cache_read_input_tokens ?? 0} ` +
      `usd=${usd === null ? "?" : usd.toFixed(4)}`,
  );
}
