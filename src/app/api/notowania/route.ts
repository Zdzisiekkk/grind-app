import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Odświeżenie notowań portfela.
 *
 * Trzy źródła, wszystkie darmowe i bez klucza - bo każdy klucz to kolejny
 * sekret do pilnowania, a żaden płatny dostawca nie ma lepszego pokrycia GPW
 * niż Stooq:
 *
 *   * Stooq        - akcje i ETF-y (CSV, jedno zapytanie na wiele symboli),
 *   * CoinGecko    - kryptowaluty,
 *   * NBP          - kursy walut, czyli to samo źródło, którego użyje PIT.
 *
 * Awaria jednego źródła nie psuje pozostałych: każde leci osobno i osobno
 * zawodzi. Portfel z połową odświeżonych cen jest lepszy niż komunikat
 * o błędzie i zero zmian.
 */
export const maxDuration = 30;

type Notowanie = {
  zrodlo: "stooq" | "coingecko" | "nbp";
  symbol: string;
  cena: number;
  waluta: string;
  data: string;
};

const dzisiaj = () => new Date().toISOString().slice(0, 10);

/**
 * Stooq oddaje CSV z nagłówkiem, po jednym wierszu na symbol.
 * Brak notowania to dosłowne "N/D" w kolumnie zamknięcia - nie zero,
 * więc nie da się tego pomylić z ceną.
 */
async function zeStooq(symbole: string[]): Promise<Notowanie[]> {
  if (symbole.length === 0) return [];
  const url = `https://stooq.pl/q/l/?s=${symbole.join("+")}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stooq odpowiedział ${res.status}`);

  const linie = (await res.text()).trim().split("\n").slice(1);
  const wynik: Notowanie[] = [];
  for (const linia of linie) {
    const [symbol, data, , , , , zamkniecie] = linia.split(",");
    const cena = Number(zamkniecie);
    if (!symbol || !Number.isFinite(cena) || cena <= 0) continue;
    wynik.push({
      zrodlo: "stooq",
      symbol: symbol.toLowerCase(),
      cena,
      // Stooq podaje ceny GPW w złotych; zagraniczne w walucie notowania,
      // a tę i tak przelicza osobno kurs NBP przypisany do aktywa.
      waluta: "PLN",
      data: /^\d{4}-\d{2}-\d{2}$/.test(data ?? "") ? data : dzisiaj(),
    });
  }
  return wynik;
}

async function zCoinGecko(idy: string[]): Promise<Notowanie[]> {
  if (idy.length === 0) return [];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idy.join(",")}&vs_currencies=pln`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko odpowiedział ${res.status}`);

  const dane = (await res.json()) as Record<string, { pln?: number }>;
  return Object.entries(dane)
    .filter(([, v]) => typeof v?.pln === "number" && v.pln > 0)
    .map(([id, v]) => ({
      zrodlo: "coingecko" as const,
      symbol: id.toLowerCase(),
      cena: v.pln as number,
      waluta: "PLN",
      data: dzisiaj(),
    }));
}

async function zNbp(waluty: string[]): Promise<Notowanie[]> {
  if (waluty.length === 0) return [];
  const res = await fetch("https://api.nbp.pl/api/exchangerates/tables/A/?format=json", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NBP odpowiedział ${res.status}`);

  const tabela = (await res.json()) as Array<{
    effectiveDate: string;
    rates: Array<{ code: string; mid: number }>;
  }>;
  const t = tabela[0];
  if (!t) return [];

  const chciane = new Set(waluty.map((w) => w.toUpperCase()));
  return t.rates
    .filter((r) => chciane.has(r.code) && r.mid > 0)
    .map((r) => ({
      zrodlo: "nbp" as const,
      symbol: r.code.toLowerCase(),
      cena: r.mid,
      waluta: "PLN",
      data: t.effectiveDate,
    }));
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });

  const { data: aktywa } = await supabase
    .from("finanse_aktywa")
    .select("notowanie_zrodlo, notowanie_symbol, waluta")
    .eq("user_id", user.id)
    .not("notowanie_symbol", "is", null);

  if (!aktywa || aktywa.length === 0) {
    return NextResponse.json({
      pobrane: 0,
      zastosowane: 0,
      uwaga: "Żadne aktywo nie ma jeszcze przypisanego notowania.",
    });
  }

  const stooq = [
    ...new Set(
      aktywa.filter((a) => a.notowanie_zrodlo === "stooq").map((a) => a.notowanie_symbol!.toLowerCase()),
    ),
  ];
  const krypto = [
    ...new Set(
      aktywa
        .filter((a) => a.notowanie_zrodlo === "coingecko")
        .map((a) => a.notowanie_symbol!.toLowerCase()),
    ),
  ];
  const waluty = [...new Set(aktywa.map((a) => a.waluta).filter((w) => w !== "PLN"))];

  const wyniki = await Promise.allSettled([zeStooq(stooq), zCoinGecko(krypto), zNbp(waluty)]);

  const notowania = wyniki.flatMap((w) => (w.status === "fulfilled" ? w.value : []));
  const bledy = wyniki
    .filter((w): w is PromiseRejectedResult => w.status === "rejected")
    .map((w) => (w.reason instanceof Error ? w.reason.message : "nieznany błąd"));

  if (notowania.length > 0) {
    const { error } = await supabase.from("finanse_notowania").upsert(
      notowania.map((n) => ({ ...n, user_id: user.id, updated_at: new Date().toISOString() })),
      { onConflict: "user_id,zrodlo,symbol" },
    );
    if (error) {
      return NextResponse.json({ error: `Nie udało się zapisać notowań: ${error.message}` }, { status: 502 });
    }
  }

  // Przełożenie cen na portfel robi baza - to ona zna regułę, że aktywa
  // z ceną wpisaną ręcznie zostają nietknięte.
  const { data: zastosowane } = await supabase.rpc("finanse_zastosuj_notowania", {});

  return NextResponse.json({
    pobrane: notowania.length,
    zastosowane: zastosowane ?? 0,
    uwaga:
      bledy.length > 0
        ? `Część źródeł nie odpowiedziała: ${bledy.join("; ")}. Reszta cen jest aktualna.`
        : null,
  });
}
