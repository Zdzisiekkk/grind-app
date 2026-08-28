"use client";

import { useCallback, useState } from "react";
import { Alert, Button, Field, Input, Sheet, Spinner } from "@/components/ui";
import { CodeScanner } from "@/components/scan/CodeScanner";
import { looksLikeFoodBarcode, normalizeFoodBarcode } from "@/lib/barcode";
import type { Food } from "@/lib/database.types";
import type { OffProduct } from "@/lib/off";

/**
 * Dodanie produktu przez kod kreskowy.
 *
 * Szybsza droga niż wpisywanie nazwy: w sklepie i w kuchni kod jest jedyną
 * rzeczą, która na pewno jest pod ręką, a „twaróg półtłusty" trzeba wpisać
 * i jeszcze wybrać właściwy z dwudziestu podobnych.
 *
 * Ręczne wpisanie numeru zostaje zawsze widoczne. Aparat potrafi nie dostać
 * zgody, nie mieć tylnego obiektywu albo trafić na kod pod zgrzewem — i wtedy
 * trzynaście cyfr spod kreski jest szybsze niż walka ze sprzętem.
 */

const FORMATY = ["ean_13", "ean_8", "upc_a"];

type Znaleziony =
  | { kind: "food"; food: Food }
  | { kind: "off"; product: OffProduct };

export function BarcodeSheet({
  open,
  onClose,
  onZnaleziono,
}: {
  open: boolean;
  onClose: () => void;
  onZnaleziono: (co: Znaleziony) => void;
}) {
  const [szuka, setSzuka] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [recznie, setRecznie] = useState("");
  const [nieznanyKod, setNieznanyKod] = useState<string | null>(null);

  const sprawdz = useCallback(
    async (surowy: string) => {
      const kod = normalizeFoodBarcode(surowy);
      if (!kod) {
        setBlad("To nie wygląda na kod produktu. Przepisz cyfry spod kreski.");
        return;
      }

      setSzuka(true);
      setBlad(null);
      setNieznanyKod(null);

      try {
        const res = await fetch(`/api/food/kod?kod=${kod}`);
        const body = await res.json();

        if (!res.ok) {
          // Brak w bazach to nie porażka skanera: kod odczytaliśmy poprawnie,
          // tylko nikt jeszcze nie opisał tego produktu. Pokazujemy numer,
          // żeby dało się dodać go ręcznie i mieć go u siebie na stałe.
          if (res.status === 404) setNieznanyKod(body?.kod ?? kod);
          setBlad(body?.error ?? "Nie udało się sprawdzić kodu.");
          setSzuka(false);
          return;
        }

        onZnaleziono(
          body.zrodlo === "baza"
            ? { kind: "food", food: body.food as Food }
            : { kind: "off", product: body.product as OffProduct },
        );
        setSzuka(false);
      } catch {
        setSzuka(false);
        setBlad("Brak połączenia. Wpisz produkt ręcznie — zostanie u Ciebie na stałe.");
      }
    },
    [onZnaleziono],
  );

  return (
    <Sheet open={open} onClose={onClose} title="Kod kreskowy">
      <div className="space-y-3">
        {szuka ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted">
            <Spinner /> sprawdzam kod…
          </div>
        ) : (
          <CodeScanner
            aktywny={open}
            formaty={FORMATY}
            akceptuj={looksLikeFoodBarcode}
            onKod={(kod) => void sprawdz(kod)}
            podpowiedz="Przyłóż kod kreskowy z opakowania do poprzeczki."
          />
        )}

        {blad && <Alert tone="warn">{blad}</Alert>}

        {nieznanyKod && (
          <p className="text-[13px] text-muted">
            Odczytany numer: <span className="tabular font-semibold">{nieznanyKod}</span>. Dodaj
            produkt w zakładce „Własny produkt” — zapamiętamy go.
          </p>
        )}

        <Field label="Albo wpisz numer spod kreski" hint="8, 12 lub 13 cyfr">
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              value={recznie}
              onChange={(e) => setRecznie(e.target.value)}
              placeholder="5900512345678"
            />
            <Button
              variant="secondary"
              disabled={recznie.replace(/\D/g, "").length < 8}
              onClick={() => void sprawdz(recznie)}
            >
              Sprawdź
            </Button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
