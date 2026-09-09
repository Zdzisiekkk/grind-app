"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Select, Sheet } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { PainPicker } from "@/components/injuries/PainPicker";
import { DataWpisu } from "@/components/DataWpisu";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import { KATEGORIE_WYDATKOW, dziennyLimit, zl } from "@/lib/finanse";
import type { FinanseWydatek, Injury } from "@/lib/database.types";

/**
 * Szybkie wpisy z pulpitu: waga, ból śledzonych kontuzji i wydatek.
 *
 * Wydatek stoi tutaj, a nie tylko w Finansach, bo jako jedyny z tej trójki
 * zdarza się kilka razy dziennie. Droga "wejdź w zakładkę, żeby wpisać
 * dwadzieścia złotych za kawę" jest dokładnie tym, co zabija codzienne
 * notowanie wydatków po dwóch tygodniach.
 */
export function QuickLog({
  userId,
  lastWeightKg,
  injuries,
  painToday,
  budzet,
  wydaneWMiesiacu,
}: {
  userId: string;
  lastWeightKg: number | null;
  /** Kontuzje, o które apka pyta - puste, gdy użytkownik żadnej nie śledzi. */
  injuries: Injury[];
  painToday?: Record<string, number>;
  /** Miesięczny budżet uznaniowy; null = nieustawiony, wtedy bez podpowiedzi limitu. */
  budzet?: number | null;
  wydaneWMiesiacu?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"weight" | "pain" | "wydatek" | null>(null);
  const [wydatek, setWydatek] = useState({ kwota: "", kategoria: "jedzenie", opis: "" });
  const [weight, setWeight] = useState<number | null>(lastWeightKg ?? 80);
  // Waga i ból mają osobne daty: ważysz się rano, a o kolanie wiesz wieczorem.
  const [weightDate, setWeightDate] = useState(todayISO());
  const [painDate, setPainDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveWeight() {
    if (!weight) return;
    setSaving(true);
    setError(null);

    const { error } = await createClient()
      .from("body_weight_logs")
      .upsert(
        { user_id: userId, date: weightDate, weight_kg: weight },
        { onConflict: "user_id,date" },
      );

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setOpen(null);
    router.refresh();
  }

  async function saveWydatek() {
    const kwota = Number(wydatek.kwota.replace(",", ".").replace(/\s/g, ""));
    if (!Number.isFinite(kwota) || kwota <= 0) return;
    setSaving(true);
    setError(null);

    const { error } = await createClient().from("finanse_wydatki").insert({
      user_id: userId,
      kwota,
      kategoria: wydatek.kategoria as FinanseWydatek["kategoria"],
      opis: wydatek.opis.trim() || null,
    });

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setWydatek({ kwota: "", kategoria: wydatek.kategoria, opis: "" });
    setOpen(null);
    router.refresh();
  }

  const limit = dziennyLimit(budzet, wydaneWMiesiacu ?? 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => setOpen("wydatek")}>
          💸 Wydatek
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setWeightDate(todayISO());
            setOpen("weight");
          }}
        >
          ⚖️ Waga
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setPainDate(todayISO());
            setOpen("pain");
          }}
          disabled={injuries.length === 0}
        >
          🩹 {injuries.length === 0 ? "Brak kontuzji" : "Ból"}
        </Button>
      </div>

      <Sheet open={open === "wydatek"} onClose={() => setOpen(null)} title="Wydatek">
        <div className="flex flex-col gap-3">
          <Field
            label="Kwota (zł)"
            hint={
              limit != null
                ? limit > 0
                  ? `Do końca miesiąca wychodzi ${zl(limit)} na dzień.`
                  : "Budżet na ten miesiąc już wyczerpany."
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={wydatek.kwota}
              onChange={(e) => setWydatek({ ...wydatek, kwota: e.target.value })}
              placeholder="19,90"
              autoFocus
            />
          </Field>
          <Field label="Na co">
            <Select
              value={wydatek.kategoria}
              onChange={(e) => setWydatek({ ...wydatek, kategoria: e.target.value })}
            >
              {KATEGORIE_WYDATKOW.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.icon} {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Opis (opcjonalnie)">
            <Input
              value={wydatek.opis}
              onChange={(e) => setWydatek({ ...wydatek, opis: e.target.value })}
              placeholder="np. kawa"
            />
          </Field>

          {error && <Alert>{error}</Alert>}
          <Button variant="primary" size="lg" block loading={saving} onClick={saveWydatek}>
            Zapisz wydatek
          </Button>

          {/*
            "Nic nie wydałem" to nie kokieteria: bez tego sygnału dzień bez
            wpisów jest nie do odróżnienia od dnia, w którym ktoś zapomniał
            notować - a od tego zależy, czy należą się punkty za trzymanie
            się limitu.
          */}
          <Button
            variant="ghost"
            block
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              const { error } = await createClient()
                .from("finanse_dni_zero")
                // ignoreDuplicates, bo znacznik nie ma czego aktualizować -
                // a zwykły upsert wymagałby prawa UPDATE na tabeli, którego
                // migracja świadomie nie nadaje.
                .upsert({ user_id: userId, dzien: todayISO() }, { ignoreDuplicates: true });
              setSaving(false);
              if (error) {
                setError(`Nie udało się zapisać: ${error.message}`);
                return;
              }
              setOpen(null);
              router.refresh();
            }}
          >
            Dziś nic nie wydałem
          </Button>
        </div>
      </Sheet>

      <Sheet open={open === "weight"} onClose={() => setOpen(null)} title="Waga ciała">
        <div className="flex flex-col gap-4">
          <Field label={weightDate === todayISO() ? "Dzisiejsza waga" : "Waga tamtego dnia"}>
            <NumberStepper
              ariaLabel="Waga w kilogramach"
              value={weight}
              onChange={setWeight}
              step={0.1}
              min={20}
              max={500}
              decimals={1}
              suffix="kg"
              size="lg"
            />
          </Field>
          <DataWpisu value={weightDate} onChange={setWeightDate} />

          {error && <Alert>{error}</Alert>}
          <Button variant="primary" size="lg" block loading={saving} onClick={saveWeight}>
            Zapisz wagę
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={open === "pain"}
        onClose={() => setOpen(null)}
        title={painDate === todayISO() ? "Jak dziś boli?" : "Jak bolało"}
      >
        <div className="flex flex-col gap-4">
          <DataWpisu label="Dzień" value={painDate} onChange={setPainDate} />

          <PainPicker
            key={painDate}
            userId={userId}
            date={painDate}
            injuries={injuries}
            // Podpowiedź z dzisiejszych ocen pasuje tylko do dzisiaj.
            initial={painDate === todayISO() ? painToday : undefined}
            onSaved={() => {
              setOpen(null);
              router.refresh();
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
