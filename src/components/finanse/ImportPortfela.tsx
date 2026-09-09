"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Chip, Input, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { typAktywa, zl } from "@/lib/finanse";
import type { AktywoZOdczytu } from "@/lib/ai/portfelSchema";
import type { FinanseAktywoZWynikiem } from "@/lib/database.types";

/**
 * Wczytanie portfela ze zrzutu ekranu.
 *
 * Dwie zasady, od których zależy, czy to jest pomoc, czy generator cichych
 * błędów:
 *
 *   1. NIC nie zapisuje się samo. Odczyt trafia na listę do zatwierdzenia,
 *      gdzie każda liczba jest do poprawienia, a każdą pozycję można odznaczyć.
 *   2. Pozycje już istniejące są AKTUALIZOWANE, nie dublowane - dopasowanie
 *      idzie po tickerze, a gdy go brak, po nazwie.
 *
 * Zrzut ekranu nigdzie nie jest zapisywany: żyje tyle, ile trwa wywołanie.
 */

const MAX_BOK = 1600; // Więcej niż przy jedzeniu - tu liczy się czytelność cyfr.

async function doBase64(plik: File): Promise<string> {
  const bitmapa = await createImageBitmap(plik);
  const skala = Math.min(1, MAX_BOK / Math.max(bitmapa.width, bitmapa.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmapa.width * skala);
  canvas.height = Math.round(bitmapa.height * skala);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nie udało się przygotować obrazu.");
  ctx.drawImage(bitmapa, 0, 0, canvas.width, canvas.height);
  bitmapa.close();

  return canvas.toDataURL("image/jpeg", 0.85).replace(/^data:[^,]*,/, "");
}

type Wiersz = AktywoZOdczytu & { wybrany: boolean };

export function ImportPortfela({
  userId,
  pozycjaId,
  istniejace,
}: {
  userId: string;
  pozycjaId: string;
  istniejace: FinanseAktywoZWynikiem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const plikRef = useRef<HTMLInputElement>(null);

  const [stan, setStan] = useState<"idle" | "czyta" | "przeglad" | "zapisuje">("idle");
  const [blad, setBlad] = useState<string | null>(null);
  const [uwaga, setUwaga] = useState<string | null>(null);
  const [ostrzezenie, setOstrzezenie] = useState<string | null>(null);
  const [wiersze, setWiersze] = useState<Wiersz[]>([]);

  /** Dopasowanie po tickerze, a gdy go nie ma - po nazwie bez wielkości liter. */
  const dopasuj = (w: Wiersz) =>
    istniejace.find(
      (a) =>
        (w.symbol && a.symbol && a.symbol.toLowerCase() === w.symbol.toLowerCase()) ||
        a.nazwa.toLowerCase() === w.nazwa.toLowerCase(),
    ) ?? null;

  async function wczytaj(e: React.ChangeEvent<HTMLInputElement>) {
    const plik = e.target.files?.[0];
    e.target.value = "";
    if (!plik) return;

    setStan("czyta");
    setBlad(null);
    setOstrzezenie(null);

    try {
      const zdjecie = await doBase64(plik);
      const res = await fetch("/api/ai/portfel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zdjecie }),
      });
      const json = await res.json();

      if (!res.ok) {
        setBlad(json.error ?? "Nie udało się odczytać zrzutu.");
        setStan("idle");
        return;
      }
      if (!json.rozpoznane || !json.pozycje?.length) {
        setBlad(json.uwaga ?? "Na tym zrzucie nie widać portfela.");
        setStan("idle");
        return;
      }

      setWiersze((json.pozycje as AktywoZOdczytu[]).map((p) => ({ ...p, wybrany: true })));
      setUwaga(json.uwaga ?? null);
      setOstrzezenie(json.ostrzezenie ?? null);
      setStan("przeglad");
    } catch (err) {
      setBlad(err instanceof Error ? err.message : "Nie udało się odczytać obrazu.");
      setStan("idle");
    }
  }

  async function zapisz() {
    const doZapisu = wiersze.filter((w) => w.wybrany && w.nazwa.trim() && w.ilosc > 0);
    if (doZapisu.length === 0) return;

    setStan("zapisuje");
    setBlad(null);

    for (const w of doZapisu) {
      const stary = dopasuj(w);
      const dane = {
        user_id: userId,
        pozycja_id: pozycjaId,
        symbol: w.symbol?.trim() || null,
        nazwa: w.nazwa.trim(),
        typ: w.typ,
        ilosc: w.ilosc,
        cena: w.cena,
        waluta: w.waluta.toUpperCase(),
        // Kurs zostaje przy starej wartości albo 1 - odczyt ze zrzutu nie zna
        // kursu, a zgadywanie go zmieniłoby wycenę bez niczyjej decyzji.
        kurs: stary ? Number(stary.kurs) : 1,
        cena_zrodlo: "import" as const,
        cena_aktualizacja: new Date().toISOString(),
      };

      const { error } = stary
        ? await supabase.from("finanse_aktywa").update(dane).eq("id", stary.id)
        : await supabase.from("finanse_aktywa").insert(dane);

      if (error) {
        setBlad(`Nie udało się zapisać „${w.nazwa}": ${error.message}`);
        setStan("przeglad");
        return;
      }
    }

    setStan("idle");
    setWiersze([]);
    router.refresh();
  }

  if (stan === "przeglad" || stan === "zapisuje") {
    const suma = wiersze
      .filter((w) => w.wybrany)
      .reduce((s, w) => s + w.ilosc * w.cena, 0);

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[14px] font-semibold">Sprawdź odczyt</h3>
          <span className="text-[13px] tabular-nums text-muted">{zl(suma)}</span>
        </div>

        {blad && <Alert>{blad}</Alert>}
        {ostrzezenie && <Alert tone="warn">{ostrzezenie}</Alert>}
        {uwaga && <p className="text-[12px] leading-snug text-faint">{uwaga}</p>}

        <ul className="flex flex-col gap-2">
          {wiersze.map((w, i) => {
            const stary = dopasuj(w);
            return (
              <li key={`${w.symbol ?? w.nazwa}-${i}`} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={w.wybrany}
                  aria-label={`Zapisz ${w.nazwa}`}
                  onChange={(e) =>
                    setWiersze((ws) =>
                      ws.map((x, j) => (i === j ? { ...x, wybrany: e.target.checked } : x)),
                    )
                  }
                  className="mt-3 size-5 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span aria-hidden>{typAktywa(w.typ).icon}</span>
                    <span className="min-w-0 truncate text-[14px] font-medium">
                      {w.symbol ? `${w.symbol} · ` : ""}
                      {w.nazwa}
                    </span>
                    {stary && <Chip tone="info">aktualizacja</Chip>}
                    {w.pewnosc !== "wysoka" && (
                      <Chip tone={w.pewnosc === "niska" ? "danger" : "warn"}>
                        {w.pewnosc === "niska" ? "słabo widoczne" : "sprawdź"}
                      </Chip>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="w-[88px]">
                      <Input
                        inputMode="decimal"
                        aria-label={`Ilość: ${w.nazwa}`}
                        value={String(w.ilosc)}
                        onChange={(e) =>
                          setWiersze((ws) =>
                            ws.map((x, j) =>
                              i === j ? { ...x, ilosc: Number(e.target.value) || 0 } : x,
                            ),
                          )
                        }
                        className="px-2 text-right tabular-nums"
                      />
                    </div>
                    <span className="text-[13px] text-faint">×</span>
                    <div className="min-w-0 flex-1">
                      <Input
                        inputMode="decimal"
                        aria-label={`Cena: ${w.nazwa}`}
                        value={String(w.cena)}
                        onChange={(e) =>
                          setWiersze((ws) =>
                            ws.map((x, j) =>
                              i === j ? { ...x, cena: Number(e.target.value) || 0 } : x,
                            ),
                          )
                        }
                        className="px-2 text-right tabular-nums"
                      />
                    </div>
                    <span className="w-9 shrink-0 text-[12px] text-faint">{w.waluta}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <Button
            variant="primary"
            loading={stan === "zapisuje"}
            disabled={!wiersze.some((w) => w.wybrany)}
            onClick={zapisz}
          >
            Zapisz {wiersze.filter((w) => w.wybrany).length}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setWiersze([]);
              setStan("idle");
            }}
          >
            Odrzuć
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {blad && <Alert>{blad}</Alert>}
      <input
        ref={plikRef}
        type="file"
        accept="image/*"
        hidden
        onChange={wczytaj}
        aria-label="Zrzut ekranu portfela"
      />
      <button
        type="button"
        disabled={stan === "czyta"}
        onClick={() => plikRef.current?.click()}
        className="flex items-center gap-2 text-[13px] font-medium text-accent disabled:opacity-50"
      >
        {stan === "czyta" ? <Spinner /> : <span aria-hidden>📷</span>}
        {stan === "czyta" ? "Odczytuję zrzut..." : "Wczytaj ze zrzutu ekranu"}
      </button>
      <p className="mt-1 text-[12px] leading-snug text-faint">
        Zrzut z aplikacji maklerskiej. Zobaczysz odczyt do poprawienia, zanim cokolwiek
        zostanie zapisane. Obraz nie jest nigdzie przechowywany.
      </p>
    </div>
  );
}
