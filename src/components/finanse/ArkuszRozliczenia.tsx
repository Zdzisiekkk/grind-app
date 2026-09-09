"use client";

import { useState } from "react";
import { Alert, Button, Chip, Field, Input, Sheet, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { nazwaMiesiaca, opisNieuchwyconego, rodzajMajatku, zl, zmiana } from "@/lib/finanse";
import { liczba, useZapis } from "./useZapis";
import type {
  FinanseCelZPostepem,
  FinansePozycja,
  FinanseRozliczeniePodglad,
} from "@/lib/database.types";

/**
 * Rozliczenie miesiąca w trzech krokach.
 *
 * Krok środkowy - konfrontacja z realnym stanem konta - jest tu najważniejszy
 * i najłatwiej byłoby go pominąć. Bez niego majątek liczony z samych wpisów
 * po pół roku pokazuje liczbę wziętą z sufitu, bo nikt nie zapisuje
 * wszystkiego. Z nim dostajesz coś więcej niż poprawną sumę: liczbę mówiącą,
 * ile miesięcznie wycieka poza rejestrem.
 */
export function ArkuszRozliczenia({
  open,
  onClose,
  userId,
  okres,
  podglad,
  pozycje,
  cele,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  okres: string;
  podglad: FinanseRozliczeniePodglad | null;
  /** Tylko płynne - to one są konfrontowane ze stanem konta. */
  pozycje: FinansePozycja[];
  cele: FinanseCelZPostepem[];
}) {
  const supabase = createClient();
  const { busy, error, zapisz } = useZapis();

  const [krok, setKrok] = useState<1 | 2 | 3>(1);
  const [kwoty, setKwoty] = useState<Record<string, string>>(() =>
    Object.fromEntries(pozycje.map((p) => [p.id, String(Number(p.kwota) || "")])),
  );
  const [naCele, setNaCele] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  if (!podglad) return null;

  const sumaPlynnych = pozycje.reduce((s, p) => s + liczba(kwoty[p.id] ?? ""), 0);
  const nieuchwycone =
    podglad.plynne_oczekiwane == null ? null : podglad.plynne_oczekiwane - sumaPlynnych;
  const opis = opisNieuchwyconego(nieuchwycone);
  const nadwyzka = podglad.wynik;

  async function zapiszPozycje() {
    const ok = await zapisz(() =>
      supabase.from("finanse_pozycje").upsert(
        pozycje.map((p) => ({
          id: p.id,
          user_id: userId,
          nazwa: p.nazwa,
          rodzaj: p.rodzaj,
          kwota: liczba(kwoty[p.id] ?? ""),
          archiwalna: p.archiwalna,
          order_index: p.order_index,
        })),
      ),
    );
    if (ok) setKrok(3);
  }

  async function zamknij() {
    const wplaty = cele
      .map((c) => ({ cel: c, kwota: liczba(naCele[c.id] ?? "") }))
      .filter((w) => w.kwota !== 0);

    await zapisz(async () => {
      if (wplaty.length) {
        const res = await supabase.from("finanse_wplaty").insert(
          wplaty.map((w) => ({
            user_id: userId,
            cel_id: w.cel.id,
            kwota: w.kwota,
            data: okres,
            note: `Rozliczenie ${nazwaMiesiaca(okres)}`,
          })),
        );
        if (res.error) return res;
      }
      return supabase.rpc("finanse_zamknij_miesiac", {
        p_okres: okres,
        p_note: note.trim() || undefined,
      });
    }, onClose);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Rozliczenie: ${nazwaMiesiaca(okres)}`}
      footer={
        <div className="flex gap-2">
          {krok > 1 && (
            <Button variant="ghost" onClick={() => setKrok((k) => (k === 3 ? 2 : 1))}>
              Wstecz
            </Button>
          )}
          {krok === 1 && (
            <Button variant="primary" block onClick={() => setKrok(2)}>
              Dalej: ile faktycznie masz
            </Button>
          )}
          {krok === 2 && (
            <Button variant="primary" block loading={busy} onClick={zapiszPozycje}>
              Dalej: co z nadwyżką
            </Button>
          )}
          {krok === 3 && (
            <Button variant="primary" block loading={busy} onClick={zamknij}>
              Zamknij miesiąc
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= krok ? "bg-accent" : "bg-surface-2"}`}
            />
          ))}
        </div>

        {/* --- Krok 1: bilans --- */}
        {krok === 1 && (
          <>
            <p className="text-[13px] text-muted">
              Tak wyszedł miniony miesiąc według Twoich wpisów.
            </p>
            <ul className="flex flex-col divide-y divide-border text-[14px]">
              <li className="flex justify-between py-2">
                <span className="text-muted">Wpłynęło</span>
                <span className="font-semibold tabular-nums text-success">
                  +{zl(podglad.wplywy)}
                </span>
              </li>
              <li className="flex justify-between py-2">
                <span className="text-muted">Koszty stałe</span>
                <span className="font-semibold tabular-nums">-{zl(podglad.stale)}</span>
              </li>
              <li className="flex justify-between py-2">
                <span className="text-muted">Wydatki uznaniowe</span>
                <span className="font-semibold tabular-nums">-{zl(podglad.uznaniowe)}</span>
              </li>
              <li className="flex justify-between py-2">
                <span className="font-medium">Zostało</span>
                <span
                  className={`text-[17px] font-bold tabular-nums ${nadwyzka < 0 ? "text-danger" : ""}`}
                >
                  {zmiana(nadwyzka)}
                </span>
              </li>
            </ul>
            {podglad.stale_oczekuje > 0 && (
              <Alert tone="warn">
                {zl(podglad.stale_oczekuje)} kosztów stałych z tego miesiąca nie zostało
                potwierdzonych i nie wchodzi do bilansu. Jeśli te rachunki jednak zeszły,
                potwierdź je przed zamknięciem.
              </Alert>
            )}
          </>
        )}

        {/* --- Krok 2: konfrontacja z rzeczywistością --- */}
        {krok === 2 && (
          <>
            <p className="text-[13px] text-muted">
              Sprawdź konto i wpisz, ile <strong>faktycznie</strong> masz. Nie poprawiaj tego
              tak, żeby się zgadzało - różnica jest tu najciekawszą liczbą.
            </p>

            {pozycje.length === 0 ? (
              <Alert tone="warn">
                Nie masz żadnej płynnej pozycji majątku. Dodaj konto albo gotówkę w karcie
                Majątek, zanim zamkniesz miesiąc.
              </Alert>
            ) : (
              <ul className="flex flex-col gap-2">
                {pozycje.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[16px]" aria-hidden>
                      {rodzajMajatku(p.rodzaj).icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{p.nazwa}</span>
                    {/* Szerokość na opakowaniu - Input ma własne `w-full`. */}
                    <div className="w-[110px] shrink-0">
                      <Input
                        inputMode="decimal"
                        value={kwoty[p.id] ?? ""}
                        onChange={(e) => setKwoty({ ...kwoty, [p.id]: e.target.value })}
                        aria-label={`Realny stan: ${p.nazwa}`}
                        className="px-2 text-right tabular-nums"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl border border-border bg-surface-2 p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">Powinno być</span>
                <span className="tabular-nums">{zl(podglad.plynne_oczekiwane)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Jest</span>
                <span className="tabular-nums">{zl(sumaPlynnych)}</span>
              </div>
              {/* Klasy wypisane wprost - Tailwind nie wygeneruje nazwy sklejonej w locie. */}
              <p
                className={`mt-2 border-t border-border pt-2 ${
                  opis.tone === "danger"
                    ? "text-danger"
                    : opis.tone === "warn"
                      ? "text-warn"
                      : opis.tone === "success"
                        ? "text-success"
                        : "text-muted"
                }`}
              >
                {opis.tekst}
              </p>
            </div>
          </>
        )}

        {/* --- Krok 3: przeznaczenie --- */}
        {krok === 3 && (
          <>
            {nadwyzka > 0 ? (
              <>
                <p className="text-[13px] text-muted">
                  Zostało {zl(nadwyzka)}. Przypisz część do celów - pieniądze bez przypisania
                  wracają do puli na koncie i najczęściej rozchodzą się w kolejnym miesiącu.
                </p>
                {cele.length === 0 ? (
                  <Alert tone="info">
                    Nie masz jeszcze żadnego celu. Nadwyżka zostanie na koncie, a cel możesz
                    założyć w każdej chwili.
                  </Alert>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {cele.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span className="text-[18px]" aria-hidden>
                          {c.ikona}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px]">{c.nazwa}</span>
                          <span className="block text-[12px] text-faint">
                            brakuje {zl(c.zostalo)}
                          </span>
                        </span>
                        <div className="w-[96px] shrink-0">
                          <Input
                            inputMode="decimal"
                            value={naCele[c.id] ?? ""}
                            onChange={(e) => setNaCele({ ...naCele, [c.id]: e.target.value })}
                            placeholder="0"
                            aria-label={`Na cel: ${c.nazwa}`}
                            className="px-2 text-right tabular-nums"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <Alert tone="warn">
                Miesiąc zamknął się na minusie ({zl(nadwyzka)}). Nie ma czego przypisywać -
                zamknięcie po prostu zapisze stan i policzy to do historii.
              </Alert>
            )}

            <Field label="Notatka (opcjonalnie)" hint="Za pół roku nie będziesz pamiętać, co się wtedy działo.">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="np. wyjazd i naprawa laptopa"
              />
            </Field>

            <div className="flex flex-wrap gap-1.5">
              <Chip tone={nadwyzka >= 0 ? "success" : "danger"}>Wynik {zmiana(nadwyzka)}</Chip>
              {nieuchwycone != null && Math.abs(nieuchwycone) >= 1 && (
                <Chip tone={nieuchwycone > 0 ? "warn" : "success"}>
                  Nieuchwycone {zmiana(-nieuchwycone)}
                </Chip>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
