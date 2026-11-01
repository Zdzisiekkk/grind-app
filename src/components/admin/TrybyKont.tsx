"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, Chip, SegmentedControl } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { AdminTryb, TrybKonta } from "@/lib/database.types";

/**
 * Przełącznik trybu konta: pełna aplikacja albo uproszczona (kalorie,
 * treningi, skin care, nawyki + partner).
 *
 * Tryb nadaje tylko administrator - konto, któremu go ustawiono, nie ma
 * własnego przełącznika, a polityka na profiles nie pozwala go zmienić
 * zapisem z klienta (migracja 0080). Zmiana działa od następnego wejścia
 * na ekran, na którym osoba się akurat znajduje.
 */
export function TrybyKont({ konta, mojeId }: { konta: AdminTryb[]; mojeId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [lokalnie, setLokalnie] = useState<Record<string, TrybKonta>>({});
  const [blad, setBlad] = useState<string | null>(null);

  async function ustaw(id: string, tryb: TrybKonta) {
    setBlad(null);
    setLokalnie((s) => ({ ...s, [id]: tryb }));
    const { error } = await supabase.rpc("admin_ustaw_tryb", { p_konto: id, p_tryb: tryb });
    if (error) {
      setLokalnie((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id)));
      setBlad(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card title="Tryb aplikacji" subtitle="Pełna albo uproszczona, osobno dla każdego konta" padded={false}>
      {blad && (
        <div className="px-4 pt-3">
          <Alert>{blad}</Alert>
        </div>
      )}
      <ul className="divide-y divide-border">
        {konta.map((k) => (
          <li key={k.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                {k.display_name || k.email || "bez nazwy"}
                {k.id === mojeId && <span className="text-faint"> (Ty)</span>}
              </span>
              {k.w_parze && <Chip tone="accent">w parze</Chip>}
            </div>
            <SegmentedControl<TrybKonta>
              value={lokalnie[k.id] ?? k.tryb}
              onChange={(v) => void ustaw(k.id, v)}
              options={[
                { value: "pelny", label: "Pełny" },
                { value: "prosty", label: "Uproszczony" },
              ]}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
