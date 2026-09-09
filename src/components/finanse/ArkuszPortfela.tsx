"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Chip, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { TYPY_AKTYWOW, typAktywa, zl, zmiana } from "@/lib/finanse";
import { ImportPortfela } from "./ImportPortfela";
import { liczba, useZapis } from "./useZapis";
import type { FinanseAktywoZWynikiem, FinansePozycja } from "@/lib/database.types";

/**
 * Portfel jednego rachunku, rozpisany na aktywa.
 *
 * Wartość rachunku przestaje tu być wpisywana ręcznie - liczy ją suma
 * pozycji, przez trigger w bazie. Dlatego ekran nie ma pola "ile masz
 * łącznie": dwie liczby opisujące to samo rozjechałyby się przy pierwszej
 * zmianie ceny, a nie byłoby wiadomo, której wierzyć.
 */
export function ArkuszPortfela({
  open,
  onClose,
  userId,
  pozycja,
  aktywa,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  pozycja: FinansePozycja | null;
  aktywa: FinanseAktywoZWynikiem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { busy, error, setError, zapisz } = useZapis();
  const [nowe, setNowe] = useState<{
    symbol: string;
    nazwa: string;
    typ: string;
    ilosc: string;
    cena: string;
    waluta: string;
    kurs: string;
    koszt: string;
    notowanieZrodlo: string;
    notowanieSymbol: string;
  } | null>(null);
  const [edytowane, setEdytowane] = useState<string | null>(null);
  const [ceny, setCeny] = useState<Record<string, string>>({});
  const [odswieza, setOdswieza] = useState(false);
  const [komunikat, setKomunikat] = useState<string | null>(null);

  if (!pozycja) return null;

  const moje = aktywa.filter((a) => a.pozycja_id === pozycja.id);
  const suma = moje.reduce((s, a) => s + Number(a.wartosc), 0);
  const koszt = moje.reduce((s, a) => s + Number(a.koszt_zakupu ?? 0), 0);
  const zysk = koszt > 0 ? suma - koszt : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pozycja.nazwa}
      footer={
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="text-muted">Wartość rachunku</span>
          <span className="flex items-baseline gap-2">
            {zysk != null && (
              <span className={`text-[13px] tabular-nums ${zysk >= 0 ? "text-success" : "text-danger"}`}>
                {zmiana(zysk)}
              </span>
            )}
            <span className="text-[18px] font-bold tabular-nums">{zl(suma)}</span>
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        <p className="text-[13px] text-muted">
          Rozpisz, co dokładnie leży na tym rachunku. Wartość pozycji w majątku liczy się
          wtedy sama z sumy aktywów.
        </p>

        <ImportPortfela userId={userId} pozycjaId={pozycja.id} istniejace={moje} />

        {moje.some((a) => a.notowanie_symbol) && (
          <div>
            <button
              type="button"
              disabled={odswieza}
              onClick={async () => {
                setOdswieza(true);
                setKomunikat(null);
                try {
                  const res = await fetch("/api/notowania", { method: "POST" });
                  const json = await res.json();
                  setKomunikat(
                    res.ok
                      ? json.uwaga ??
                          (json.zastosowane > 0
                            ? `Zaktualizowano ${json.zastosowane} ${json.zastosowane === 1 ? "cenę" : "ceny"}.`
                            : "Ceny są już aktualne.")
                      : (json.error ?? "Nie udało się pobrać notowań."),
                  );
                  if (res.ok) router.refresh();
                } catch {
                  setKomunikat("Nie udało się połączyć ze źródłem notowań.");
                } finally {
                  setOdswieza(false);
                }
              }}
              className="text-[13px] font-medium text-accent disabled:opacity-50"
            >
              {odswieza ? "Pobieram notowania..." : "🔄 Odśwież ceny"}
            </button>
            {komunikat && <p className="mt-1 text-[12px] text-faint">{komunikat}</p>}
          </div>
        )}

        {moje.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {moje.map((a) => {
              const t = typAktywa(a.typ);
              const otwarte = edytowane === a.id;
              return (
                <li key={a.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[15px]" aria-hidden>
                      {t.icon}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEdytowane(otwarte ? null : a.id);
                        setCeny({ ...ceny, [a.id]: String(Number(a.cena)) });
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[14px] font-medium">
                        {a.symbol ? `${a.symbol} · ` : ""}
                        {a.nazwa}
                      </span>
                      <span className="block text-[12px] text-faint">
                        {a.notowanie_symbol ? "🔄 " : ""}
                        {Number(a.ilosc)} × {Number(a.cena).toLocaleString("pl-PL")} {a.waluta}
                        {a.udzial > 0 && ` · ${a.udzial}% portfela`}
                      </span>
                    </button>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-semibold tabular-nums">
                        {zl(Number(a.wartosc))}
                      </span>
                      {a.zysk != null && (
                        <span
                          className={`block text-[12px] tabular-nums ${Number(a.zysk) >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {zmiana(Number(a.zysk))}
                          {a.zysk_procent != null && ` (${a.zysk_procent}%)`}
                        </span>
                      )}
                    </span>
                  </div>

                  {otwarte && (
                    <div className="mt-2 flex items-end gap-2 rounded-xl border border-border bg-surface-2 p-2">
                      {/*
                        Aktualizacja samej ceny osobno od reszty, bo to jedyne
                        pole, które zmienia się co tydzień - a przechodzenie
                        przez pełny formularz po to, żeby poprawić jedną liczbę,
                        skutecznie zniechęca do aktualizowania czegokolwiek.
                      */}
                      <div className="min-w-0 flex-1">
                        <Field label={`Cena za sztukę (${a.waluta})`}>
                          <Input
                            inputMode="decimal"
                            value={ceny[a.id] ?? ""}
                            onChange={(e) => setCeny({ ...ceny, [a.id]: e.target.value })}
                            className="tabular-nums"
                          />
                        </Field>
                      </div>
                      <Button
                        variant="primary"
                        loading={busy}
                        onClick={() =>
                          zapisz(
                            () =>
                              supabase
                                .from("finanse_aktywa")
                                .update({
                                  cena: liczba(ceny[a.id] ?? ""),
                                  cena_zrodlo: "reczna",
                                  cena_aktualizacja: new Date().toISOString(),
                                })
                                .eq("id", a.id),
                            () => setEdytowane(null),
                          )
                        }
                      >
                        Zapisz
                      </Button>
                      <Button
                        variant="ghost"
                        loading={busy}
                        onClick={() =>
                          zapisz(
                            () => supabase.from("finanse_aktywa").delete().eq("id", a.id),
                            () => setEdytowane(null),
                          )
                        }
                      >
                        Usuń
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {nowe ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ticker">
                <Input
                  value={nowe.symbol}
                  onChange={(e) => setNowe({ ...nowe, symbol: e.target.value.toUpperCase() })}
                  placeholder="CDR"
                  autoFocus
                />
              </Field>
              <div className="col-span-2">
                <Field label="Nazwa">
                  <Input
                    value={nowe.nazwa}
                    onChange={(e) => setNowe({ ...nowe, nazwa: e.target.value })}
                    placeholder="CD Projekt"
                  />
                </Field>
              </div>
            </div>
            <Field label="Rodzaj">
              <Select value={nowe.typ} onChange={(e) => setNowe({ ...nowe, typ: e.target.value })}>
                {TYPY_AKTYWOW.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ile sztuk">
                <Input
                  inputMode="decimal"
                  value={nowe.ilosc}
                  onChange={(e) => setNowe({ ...nowe, ilosc: e.target.value })}
                  placeholder="10"
                />
              </Field>
              <Field label="Cena za sztukę">
                <Input
                  inputMode="decimal"
                  value={nowe.cena}
                  onChange={(e) => setNowe({ ...nowe, cena: e.target.value })}
                  placeholder="220"
                />
              </Field>
              <Field label="Waluta">
                <Select
                  value={nowe.waluta}
                  onChange={(e) =>
                    setNowe({
                      ...nowe,
                      waluta: e.target.value,
                      kurs: e.target.value === "PLN" ? "1" : nowe.kurs,
                    })
                  }
                >
                  {["PLN", "USD", "EUR", "GBP", "CHF"].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Kurs do PLN"
                hint={nowe.waluta === "PLN" ? "Dla złotówek zawsze 1." : undefined}
              >
                <Input
                  inputMode="decimal"
                  value={nowe.kurs}
                  disabled={nowe.waluta === "PLN"}
                  onChange={(e) => setNowe({ ...nowe, kurs: e.target.value })}
                  placeholder="4,30"
                />
              </Field>
            </div>
            <Field
              label="Ile w to włożone (zł)"
              hint="Opcjonalnie - bez tego nie policzymy, czy jesteś na plusie."
            >
              <Input
                inputMode="decimal"
                value={nowe.koszt}
                onChange={(e) => setNowe({ ...nowe, koszt: e.target.value })}
                placeholder="1800"
              />
            </Field>

            {/*
              Symbol notowania osobno od tickera: to, co widać w aplikacji
              maklerskiej, i to, pod czym instrument leży w serwisie z cenami,
              bywa napisane inaczej. Puste = cena zostaje ręczna, czyli Twoja.
            */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ceny z sieci">
                <Select
                  value={nowe.notowanieZrodlo}
                  onChange={(e) =>
                    setNowe({
                      ...nowe,
                      notowanieZrodlo: e.target.value,
                      notowanieSymbol:
                        e.target.value === "stooq" ? nowe.symbol.toLowerCase() : nowe.notowanieSymbol,
                    })
                  }
                >
                  <option value="">Wpisuję ręcznie</option>
                  <option value="stooq">Stooq (GPW, ETF)</option>
                  <option value="coingecko">CoinGecko (krypto)</option>
                </Select>
              </Field>
              <Field
                label="Symbol notowania"
                hint={
                  nowe.notowanieZrodlo === "coingecko"
                    ? "Nazwa z CoinGecko, np. bitcoin"
                    : nowe.notowanieZrodlo === "stooq"
                      ? "Np. cdr, pko, vwce.de"
                      : undefined
                }
              >
                <Input
                  value={nowe.notowanieSymbol}
                  disabled={!nowe.notowanieZrodlo}
                  onChange={(e) =>
                    setNowe({ ...nowe, notowanieSymbol: e.target.value.toLowerCase() })
                  }
                  placeholder={nowe.notowanieZrodlo === "coingecko" ? "bitcoin" : "cdr"}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                loading={busy}
                disabled={!nowe.nazwa.trim() || liczba(nowe.ilosc) <= 0}
                onClick={async () => {
                  const ok = await zapisz(() =>
                    supabase.from("finanse_aktywa").insert({
                      user_id: userId,
                      pozycja_id: pozycja.id,
                      symbol: nowe.symbol.trim() || null,
                      nazwa: nowe.nazwa.trim(),
                      typ: nowe.typ as FinanseAktywoZWynikiem["typ"],
                      ilosc: liczba(nowe.ilosc),
                      cena: liczba(nowe.cena),
                      waluta: nowe.waluta,
                      kurs: nowe.waluta === "PLN" ? 1 : liczba(nowe.kurs) || 1,
                      koszt_zakupu: nowe.koszt.trim() ? liczba(nowe.koszt) : null,
                      cena_aktualizacja: new Date().toISOString(),
                      notowanie_zrodlo:
                        (nowe.notowanieZrodlo as "stooq" | "coingecko") || null,
                      notowanie_symbol: nowe.notowanieZrodlo
                        ? nowe.notowanieSymbol.trim() || null
                        : null,
                    }),
                  );
                  if (ok) setNowe(null);
                }}
              >
                Dodaj
              </Button>
              <Button variant="ghost" onClick={() => { setNowe(null); setError(null); }}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-left text-[13px] font-medium text-accent"
            onClick={() =>
              setNowe({
                symbol: "",
                nazwa: "",
                typ: "akcje",
                ilosc: "",
                cena: "",
                waluta: "PLN",
                kurs: "1",
                koszt: "",
                notowanieZrodlo: "",
                notowanieSymbol: "",
              })
            }
          >
            + Dodaj aktywo
          </button>
        )}

        {moje.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            {TYPY_AKTYWOW.filter((t) => moje.some((a) => a.typ === t.value)).map((t) => {
              const w = moje
                .filter((a) => a.typ === t.value)
                .reduce((s, a) => s + Number(a.wartosc), 0);
              return (
                <Chip key={t.value}>
                  <span aria-hidden>{t.icon}</span> {t.label}: {Math.round((w / suma) * 100)}%
                </Chip>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
