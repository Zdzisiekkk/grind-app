"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { RoutineEditor } from "@/components/looks/RoutineEditor";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { todayISO } from "@/lib/format";
import type { WygladProdukt, WygladProtokol, WygladRutyna } from "@/lib/database.types";

export function SkinCareScreen({
  rutyny,
  odhaczoneDzis,
  protokoly,
  produkty,
}: {
  rutyny: WygladRutyna[];
  odhaczoneDzis: string[];
  protokoly: WygladProtokol[];
  produkty: WygladProdukt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [odhaczone, setOdhaczone] = useState<string[]>(odhaczoneDzis);

  const aktywne = rutyny.filter((r) => r.aktywna);
  const grupy = [
    { tytul: "Rano", lista: aktywne.filter((r) => r.pora === "rano") },
    { tytul: "Wieczorem", lista: aktywne.filter((r) => r.pora !== "rano") },
  ].filter((g) => g.lista.length > 0);

  async function przelacz(r: WygladRutyna) {
    const juz = odhaczone.includes(r.id);
    setOdhaczone((o) => (juz ? o.filter((x) => x !== r.id) : [...o, r.id]));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (juz) {
      await supabase.from("wyglad_rutyna_log").delete().eq("rutyna_id", r.id).eq("data", todayISO());
    } else {
      await supabase
        .from("wyglad_rutyna_log")
        .upsert(
          { user_id: user.id, rutyna_id: r.id, data: todayISO(), wykonano: true },
          { onConflict: "rutyna_id,data" },
        );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Skin care</h1>
        <p className="text-[13px] text-muted">
          {aktywne.length > 0
            ? `${odhaczone.filter((id) => aktywne.some((r) => r.id === id)).length} z ${aktywne.length} zrobione dzisiaj`
            : "Dodaj pierwszą rutynę poniżej"}
        </p>
      </header>

      {grupy.length === 0 ? (
        <EmptyState
          icon="🧴"
          title="Brak rutyn"
          description="Dodaj rutynę (np. poranną albo wieczorną), a tutaj odhaczysz ją codziennie."
        />
      ) : (
        <Card title="Dzisiaj">
          <div className="space-y-4">
            {grupy.map((g) => (
              <div key={g.tytul}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">{g.tytul}</p>
                <div className="space-y-1.5">
                  {g.lista.map((r) => (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={odhaczone.includes(r.id)}
                        onChange={() => void przelacz(r)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            "block text-[14px] font-medium",
                            odhaczone.includes(r.id) && "text-muted line-through",
                          )}
                        >
                          {r.nazwa}
                        </span>
                        {r.kroki.length > 0 && (
                          <span className="block text-[12px] text-faint">{r.kroki.join(" · ")}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <RoutineEditor
        rutyny={rutyny}
        produkty={produkty}
        protokoly={protokoly}
        onZmiana={() => router.refresh()}
      />
    </div>
  );
}
