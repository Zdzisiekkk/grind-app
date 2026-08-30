"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Sheet } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { PainPicker } from "@/components/injuries/PainPicker";
import { DataWpisu } from "@/components/DataWpisu";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type { Injury } from "@/lib/database.types";

/** Dwa najczęstsze szybkie wpisy z pulpitu: waga i ból śledzonych kontuzji. */
export function QuickLog({
  userId,
  lastWeightKg,
  injuries,
  painToday,
}: {
  userId: string;
  lastWeightKg: number | null;
  /** Kontuzje, o które apka pyta - puste, gdy użytkownik żadnej nie śledzi. */
  injuries: Injury[];
  painToday?: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"weight" | "pain" | null>(null);
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

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
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
