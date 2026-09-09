"use client";

import { useState } from "react";
import { Alert, Button, Chip, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { KATEGORIE_STALYCH, PODPOWIEDZI_STALYCH, kategoriaStalego, zl } from "@/lib/finanse";
import { liczba, useZapis } from "./useZapis";
import type { FinanseStaly, KategoriaStalego } from "@/lib/database.types";

/**
 * Szablon kosztów stałych.
 *
 * Suma tego szablonu jest mianownikiem poduszki, więc kompletność listy waży
 * tu więcej niż wygoda: brakujące 200 zł abonamentów zawyża zapas o kilka
 * tygodni przeżycia. Stąd podpowiedzi z rzeczami, o których się zapomina.
 */
export function ArkuszStalych({
  open,
  onClose,
  userId,
  stale,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  stale: FinanseStaly[];
}) {
  const supabase = createClient();
  const { busy, error, setError, zapisz } = useZapis();
  const [nowy, setNowy] = useState<{ nazwa: string; kwota: string; kategoria: KategoriaStalego; dzien: string } | null>(
    null,
  );

  const suma = stale.filter((s) => s.aktywny).reduce((sum, s) => sum + Number(s.kwota), 0);
  const wolne = PODPOWIEDZI_STALYCH.filter(
    (p) => !stale.some((s) => s.nazwa.toLowerCase() === p.nazwa.toLowerCase()),
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Koszty stałe"
      footer={
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="text-muted">Razem na miesiąc</span>
          <span className="text-[18px] font-bold tabular-nums">{zl(suma)}</span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <p className="text-[13px] text-muted">
          To, co schodzi co miesiąc bez Twojej decyzji. Suma zastępuje ręczne pole
          &bdquo;Koszty życia&rdquo; w profilu, więc od niej liczy się poduszka.
        </p>

        {stale.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {stale.map((s) => {
              const k = kategoriaStalego(s.kategoria);
              return (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <span className="text-[16px]" aria-hidden>
                    {k.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] ${s.aktywny ? "" : "text-faint line-through"}`}>
                      {s.nazwa}
                    </span>
                    <span className="block text-[12px] text-faint">{s.dzien_miesiaca}. dnia miesiąca</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">{zl(Number(s.kwota))}</span>
                  <button
                    type="button"
                    aria-label={s.aktywny ? `Wyłącz: ${s.nazwa}` : `Włącz: ${s.nazwa}`}
                    className="shrink-0 px-2 text-[12px] font-medium text-accent"
                    onClick={() =>
                      zapisz(() =>
                        supabase
                          .from("finanse_stale")
                          .update({ aktywny: !s.aktywny })
                          .eq("id", s.id),
                      )
                    }
                  >
                    {s.aktywny ? "wyłącz" : "włącz"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Usuń: ${s.nazwa}`}
                    className="shrink-0 text-faint"
                    onClick={() =>
                      zapisz(() => supabase.from("finanse_stale").delete().eq("id", s.id))
                    }
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {nowy ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <Field label="Nazwa">
              <Input
                value={nowy.nazwa}
                onChange={(e) => setNowy({ ...nowy, nazwa: e.target.value })}
                placeholder="np. Czynsz"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Kwota (zł)">
                <Input
                  inputMode="decimal"
                  value={nowy.kwota}
                  onChange={(e) => setNowy({ ...nowy, kwota: e.target.value })}
                  placeholder="1800"
                />
              </Field>
              <Field label="Dzień miesiąca">
                <Input
                  inputMode="numeric"
                  value={nowy.dzien}
                  onChange={(e) => setNowy({ ...nowy, dzien: e.target.value })}
                  placeholder="10"
                />
              </Field>
            </div>
            <Field label="Kategoria">
              <Select
                value={nowy.kategoria}
                onChange={(e) => setNowy({ ...nowy, kategoria: e.target.value as KategoriaStalego })}
              >
                {KATEGORIE_STALYCH.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.icon} {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button
                variant="primary"
                loading={busy}
                disabled={!nowy.nazwa.trim() || liczba(nowy.kwota) <= 0}
                onClick={async () => {
                  const dzien = Math.min(31, Math.max(1, Math.round(liczba(nowy.dzien)) || 1));
                  const ok = await zapisz(() =>
                    supabase.from("finanse_stale").insert({
                      user_id: userId,
                      nazwa: nowy.nazwa.trim(),
                      kwota: liczba(nowy.kwota),
                      kategoria: nowy.kategoria,
                      dzien_miesiaca: dzien,
                    }),
                  );
                  if (ok) setNowy(null);
                }}
              >
                Dodaj
              </Button>
              <Button variant="ghost" onClick={() => { setNowy(null); setError(null); }}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="text-[13px] font-medium text-accent"
              onClick={() => setNowy({ nazwa: "", kwota: "", kategoria: "inne", dzien: "1" })}
            >
              + Dodaj własny
            </button>

            {wolne.length > 0 && (
              <>
                <p className="mt-3 text-[12px] text-faint">
                  Albo z listy - to zwykle te pozycje, przez które bilans się nie spina:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {wolne.map((p) => (
                    <button
                      key={p.nazwa}
                      type="button"
                      onClick={() =>
                        setNowy({ nazwa: p.nazwa, kwota: "", kategoria: p.kategoria, dzien: "1" })
                      }
                    >
                      <Chip>
                        <span aria-hidden>{p.icon}</span> {p.nazwa}
                      </Chip>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
