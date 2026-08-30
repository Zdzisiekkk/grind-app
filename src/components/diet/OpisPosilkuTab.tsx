"use client";

import { useState } from "react";
import { Alert, Button, Chip, NumberField, Spinner, Textarea } from "@/components/ui";
import { kcalSkladnika, type Skladnik } from "@/lib/ai/posilekSchema";
import { num } from "@/lib/format";

/**
 * "Opisz, co zjadłeś" - zakładka dla tego, czego nie ma w żadnej bazie.
 *
 * Wyszukiwarka kończyła się komunikatem "Nie znaleziono produktu - dodaj go
 * ręcznie". Przy schabowym u mamy albo wczorajszej zupie nie ma kodu
 * kreskowego i nie ma czego szukać, a przepisywanie makr z etykiety, której
 * nie ma, to moment, w którym ludzie przestają prowadzić dziennik.
 *
 * KROK PRZEGLĄDU JEST OBOWIĄZKOWY. Model szacuje - czasem trafnie, czasem
 * przyjmie średnie jajko tam, gdzie były trzy małe. Wrzucanie tego prosto do
 * dziennika udawałoby pewność, której tu nie ma. Poprawka gramatury przelicza
 * kalorie na miejscu, bez kolejnego (płatnego) pytania do modelu.
 */

const PRZYKLAD = "np. dwa jajka sadzone na maśle, kromka chleba razowego i kubek kawy z mlekiem";

/** Ile pozycji naraz - powyżej tego opis jest listą zakupów, nie posiłkiem. */
const MAX_POZYCJI = 15;

type Stan = "pisanie" | "liczenie" | "przeglad";

export function OpisPosilkuTab({
  onDodaj,
}: {
  /** Zatwierdzone pozycje. Zapis robi rodzic, bo to on wie, do którego posiłku. */
  onDodaj: (skladniki: Skladnik[]) => Promise<void>;
}) {
  const [opis, setOpis] = useState("");
  const [stan, setStan] = useState<Stan>("pisanie");
  const [skladniki, setSkladniki] = useState<Skladnik[]>([]);
  const [uwaga, setUwaga] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisywanie, setZapisywanie] = useState(false);

  async function policz() {
    setBlad(null);
    setUwaga(null);
    setStan("liczenie");

    try {
      const res = await fetch("/api/ai/posilek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opis }),
      });
      const json = await res.json();

      if (!res.ok) {
        setBlad(json?.error ?? "Nie udało się policzyć posiłku.");
        setStan("pisanie");
        return;
      }

      if (!json.rozpoznane || !json.skladniki?.length) {
        setBlad(json.uwaga ?? "Z tego opisu nie da się wyliczyć posiłku.");
        setStan("pisanie");
        return;
      }

      setSkladniki(json.skladniki.slice(0, MAX_POZYCJI));
      setUwaga(json.uwaga ?? null);
      setStan("przeglad");
    } catch {
      setBlad("Brak połączenia. Spróbuj za chwilę.");
      setStan("pisanie");
    }
  }

  async function zatwierdz() {
    setZapisywanie(true);
    setBlad(null);
    try {
      await onDodaj(skladniki);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : String(e));
      setZapisywanie(false);
    }
  }

  if (stan === "przeglad") {
    const razem = skladniki.reduce((s, x) => s + kcalSkladnika(x), 0);

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-faint">
            Sprawdź, zanim dodasz
          </h3>
          <span className="text-[13px] font-semibold tabular-nums">{num(razem)} kcal</span>
        </div>

        {uwaga && <Alert tone="info">{uwaga}</Alert>}

        <ul className="flex flex-col gap-2">
          {skladniki.map((s, i) => (
            <li key={i} className="rounded-xl bg-surface-2 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{s.nazwa}</p>
                  <p className="text-[12px] text-muted tabular-nums">
                    {num(s.kcal_100g)} kcal/100 g · B {num(s.bialko_100g)} · W{" "}
                    {num(s.wegle_100g)} · T {num(s.tluszcz_100g)}
                  </p>
                </div>
                {/*
                  Pewność jest widoczna przy KAŻDEJ pozycji, nie schowana
                  w jednym zdaniu na górze. "Niska" przy jednym składniku
                  z pięciu ma być widać dokładnie przy tym jednym.
                */}
                <Chip
                  tone={
                    s.pewnosc === "wysoka" ? "success" : s.pewnosc === "srednia" ? "neutral" : "warn"
                  }
                >
                  {s.pewnosc === "srednia" ? "średnia" : s.pewnosc}
                </Chip>
              </div>

              <div className="flex items-center gap-2">
                <NumberField
                  aria-label={`Gramatura: ${s.nazwa}`}
                  value={s.gramatura}
                  min={1}
                  max={5000}
                  fallback={1}
                  className="w-24"
                  onChange={(g) =>
                    setSkladniki((lista) =>
                      lista.map((x, j) => (j === i ? { ...x, gramatura: g ?? 1 } : x)),
                    )
                  }
                />
                <span className="text-[13px] text-muted">g</span>
                <span className="ml-auto text-[13px] font-medium tabular-nums">
                  {num(kcalSkladnika(s))} kcal
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setSkladniki((lista) => lista.filter((_, j) => j !== i))}
                  aria-label={`Usuń: ${s.nazwa}`}
                >
                  Usuń
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {blad && <Alert tone="danger">{blad}</Alert>}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setStan("pisanie");
              setSkladniki([]);
              setUwaga(null);
            }}
          >
            Popraw opis
          </Button>
          <Button
            block
            onClick={zatwierdz}
            disabled={zapisywanie || skladniki.length === 0}
          >
            {zapisywanie
              ? "Dodaję..."
              : `Dodaj ${skladniki.length === 1 ? "pozycję" : `${skladniki.length} pozycje`}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        autoFocus
        rows={3}
        value={opis}
        maxLength={500}
        onChange={(e) => setOpis(e.target.value)}
        placeholder={PRZYKLAD}
        aria-label="Opis posiłku"
      />

      <p className="px-1 text-[12px] text-muted">
        Napisz zwykłym zdaniem, ile i czego. Im dokładniej podasz ilości, tym bliżej prawdy będzie
        wynik - a każdą liczbę i tak poprawisz przed dodaniem.
      </p>

      {blad && <Alert tone="warn">{blad}</Alert>}

      <Button block onClick={policz} disabled={stan === "liczenie" || opis.trim().length < 3}>
        {stan === "liczenie" ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> liczę...
          </span>
        ) : (
          "Policz wartości"
        )}
      </Button>
    </div>
  );
}
