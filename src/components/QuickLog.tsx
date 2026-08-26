"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Sheet } from "@/components/ui";
import { NumberStepper } from "@/components/training/NumberStepper";
import { KneePainPicker } from "@/components/training/KneePainPicker";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";

/** Dwa najczęstsze szybkie wpisy z pulpitu: waga i ból kolana. */
export function QuickLog({
  userId,
  lastWeightKg,
}: {
  userId: string;
  lastWeightKg: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"weight" | "pain" | null>(null);
  const [weight, setWeight] = useState<number | null>(lastWeightKg ?? 80);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveWeight() {
    if (!weight) return;
    setSaving(true);
    setError(null);

    const { error } = await createClient()
      .from("body_weight_logs")
      .upsert(
        { user_id: userId, date: todayISO(), weight_kg: weight },
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
        <Button variant="secondary" onClick={() => setOpen("weight")}>
          ⚖️ Waga
        </Button>
        <Button variant="secondary" onClick={() => setOpen("pain")}>
          🦵 Ból kolana
        </Button>
      </div>

      <Sheet open={open === "weight"} onClose={() => setOpen(null)} title="Waga ciała">
        <div className="flex flex-col gap-4">
          <Field label="Dzisiejsza waga">
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
          {error && <Alert>{error}</Alert>}
          <Button variant="primary" size="lg" block loading={saving} onClick={saveWeight}>
            Zapisz wagę
          </Button>
        </div>
      </Sheet>

      <Sheet open={open === "pain"} onClose={() => setOpen(null)} title="Ból kolana">
        <KneePainPicker
          userId={userId}
          date={todayISO()}
          onSaved={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      </Sheet>
    </>
  );
}
