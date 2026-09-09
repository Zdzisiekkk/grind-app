"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { KATEGORIE_WYDATKOW, zl } from "@/lib/finanse";
import { liczba, useZapis } from "./useZapis";
import type { FinanseRuch, FinanseZrodlo, KategoriaWydatku } from "@/lib/database.types";

/**
 * Poprawianie i kasowanie pojedynczego ruchu.
 *
 * Jeden arkusz na trzy rodzaje wpisu, bo pola są w istocie te same: kwota,
 * data, opis i jedna lista wyboru. Trzy osobne ekrany różniłyby się wyłącznie
 * nagłówkiem, a rozjeżdżałyby się przy każdej kolejnej zmianie.
 *
 * Kasowanie idzie w dwóch krokach. Wpis znika bez śladu i bez cofnięcia,
 * a pomyłkowe skasowanie wypłaty rozjeżdża cały bilans miesiąca.
 *
 * Komponent jest montowany z `key` równym identyfikatorowi ruchu, więc pola
 * startują od właściwych wartości bez dosypywania ich efektem po renderze -
 * otwarcie innego wpisu to po prostu nowy komponent.
 */
export function ArkuszRuchu({
  open,
  onClose,
  ruch,
  zrodla,
}: {
  open: boolean;
  onClose: () => void;
  ruch: FinanseRuch | null;
  zrodla: FinanseZrodlo[];
}) {
  const supabase = createClient();
  const { busy, error, zapisz } = useZapis();

  const [kwota, setKwota] = useState(() => String(Number(ruch?.kwota ?? 0)));
  const [data, setData] = useState(() => ruch?.data ?? "");
  const [opis, setOpis] = useState(() => ruch?.opis ?? "");
  const [kategoria, setKategoria] = useState<string>(() =>
    ruch?.typ === "wydatek" ? ruch.kategoria : "jedzenie",
  );
  const [zrodlo, setZrodlo] = useState<string>(() =>
    ruch?.typ === "wplyw" ? (ruch.cel_id ?? "") : "",
  );
  const [potwierdz, setPotwierdz] = useState(false);

  if (!ruch) return null;

  /*
   * Trzy osobne wywołania zamiast jednej nazwy tabeli w zmiennej: typowany
   * klient Supabase sprawdza kształt aktualizacji względem KONKRETNEJ tabeli,
   * a dynamiczna nazwa zabiera mu tę wiedzę - i razem z nią jedyną ochronę
   * przed literówką w nazwie kolumny.
   */
  function aktualizuj() {
    if (ruch!.typ === "wydatek") {
      return supabase
        .from("finanse_wydatki")
        .update({
          kwota: liczba(kwota),
          kategoria: kategoria as KategoriaWydatku,
          opis: opis.trim() || null,
          data,
        })
        .eq("id", ruch!.id);
    }
    if (ruch!.typ === "wplyw") {
      return supabase
        .from("finanse_wplywy")
        .update({
          kwota: liczba(kwota),
          zrodlo_id: zrodlo || null,
          opis: opis.trim() || null,
          data,
        })
        .eq("id", ruch!.id);
    }
    return supabase
      .from("finanse_wplaty")
      .update({ kwota: liczba(kwota), note: opis.trim() || null, data })
      .eq("id", ruch!.id);
  }

  function usun() {
    if (ruch!.typ === "wydatek")
      return supabase.from("finanse_wydatki").delete().eq("id", ruch!.id);
    if (ruch!.typ === "wplyw")
      return supabase.from("finanse_wplywy").delete().eq("id", ruch!.id);
    return supabase.from("finanse_wplaty").delete().eq("id", ruch!.id);
  }

  const tytul =
    ruch.typ === "wydatek" ? "Wydatek" : ruch.typ === "wplyw" ? "Wpływ" : "Wpłata na cel";

  return (
    <Sheet open={open} onClose={onClose} title={tytul}>
      <div className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}

        {ruch.typ === "cel" && (
          <p className="text-[13px] text-muted">
            Wpłata na cel {ruch.cel_nazwa ? `„${ruch.cel_nazwa}"` : ""}. Zmiana kwoty przeliczy
            postęp celu.
          </p>
        )}

        <Field label="Kwota (zł)">
          <Input
            inputMode="decimal"
            value={kwota}
            onChange={(e) => setKwota(e.target.value)}
            className="tabular-nums"
          />
        </Field>

        {ruch.typ === "wydatek" && (
          <Field label="Na co">
            <Select value={kategoria} onChange={(e) => setKategoria(e.target.value)}>
              {KATEGORIE_WYDATKOW.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.icon} {k.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {ruch.typ === "wplyw" && (
          <Field label="Skąd">
            <Select value={zrodlo} onChange={(e) => setZrodlo(e.target.value)}>
              <option value="">Bez źródła</option>
              {zrodla.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.ikona} {z.nazwa}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Data">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>

        <Field label={ruch.typ === "cel" ? "Notatka" : "Opis"}>
          <Input value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="opcjonalnie" />
        </Field>

        <Button
          variant="primary"
          block
          loading={busy}
          disabled={liczba(kwota) === 0}
          onClick={() => zapisz(aktualizuj, onClose)}
                >
          Zapisz zmiany
        </Button>

        {potwierdz ? (
          <Button
            variant="danger"
            block
            loading={busy}
            onClick={() => zapisz(usun, onClose)}
          >
            Tak, usuń {zl(Number(ruch.kwota))}
          </Button>
        ) : (
          <Button variant="ghost" block onClick={() => setPotwierdz(true)}>
            Usuń wpis
          </Button>
        )}
      </div>
    </Sheet>
  );
}
