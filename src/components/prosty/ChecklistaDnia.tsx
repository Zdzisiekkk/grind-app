"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";

type Nawyk = { id: string; nazwa: string; ikona: string; cel: number; zrobione: number };
type Rutyna = { id: string; nazwa: string; pora: string; zrobione: boolean };

/**
 * Nawyki i skin care na dziś w jednym miejscu - to, co w trybie uproszczonym
 * odhacza się najczęściej, więc nie wymaga wejścia w osobny ekran.
 *
 * Zapisy te same co na ekranach źródłowych (habit_logs, wyglad_rutyna_log),
 * więc passy i adherencja liczą się bez żadnych poprawek.
 */
export function ChecklistaDnia({
  userId,
  nawyki,
  rutyny,
}: {
  userId: string;
  nawyki: Nawyk[];
  rutyny: Rutyna[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [licznik, setLicznik] = useState<Record<string, number>>(
    Object.fromEntries(nawyki.map((n) => [n.id, n.zrobione])),
  );
  const [skin, setSkin] = useState<Record<string, boolean>>(
    Object.fromEntries(rutyny.map((r) => [r.id, r.zrobione])),
  );

  async function nawyk(n: Nawyk) {
    const teraz = licznik[n.id] ?? 0;
    // Dotknięcie domkniętego nawyku cofa go - to jedyna droga na poprawkę omyłki.
    const next = teraz >= n.cel ? 0 : teraz + 1;
    setLicznik((s) => ({ ...s, [n.id]: next }));
    if (next > teraz) navigator.vibrate?.(12);
    await supabase
      .from("habit_logs")
      .upsert(
        { user_id: userId, habit_id: n.id, date: todayISO(), count: next },
        { onConflict: "user_id,habit_id,date" },
      );
    router.refresh();
  }

  async function rutyna(r: Rutyna) {
    const juz = skin[r.id];
    setSkin((s) => ({ ...s, [r.id]: !juz }));
    if (juz) {
      await supabase.from("wyglad_rutyna_log").delete().eq("rutyna_id", r.id).eq("data", todayISO());
    } else {
      await supabase
        .from("wyglad_rutyna_log")
        .upsert(
          { user_id: userId, rutyna_id: r.id, data: todayISO(), wykonano: true },
          { onConflict: "rutyna_id,data" },
        );
    }
    router.refresh();
  }

  const nawykiOk = nawyki.filter((n) => (licznik[n.id] ?? 0) >= n.cel).length;
  const skinOk = rutyny.filter((r) => skin[r.id]).length;

  return (
    <>
      <Card
        title="Nawyki"
        action={
          nawyki.length > 0 ? (
            <Chip tone={nawykiOk === nawyki.length ? "success" : "neutral"}>
              {nawykiOk}/{nawyki.length}
            </Chip>
          ) : null
        }
      >
        {nawyki.length === 0 ? (
          <p className="text-[13px] text-muted">Brak nawyków na dziś. Dodasz je w zakładce Nawyki.</p>
        ) : (
          <ul className="space-y-1.5">
            {nawyki.map((n) => {
              const ok = (licznik[n.id] ?? 0) >= n.cel;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void nawyk(n)}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-left active:bg-surface-3"
                  >
                    <span aria-hidden>{ok ? "✅" : "⬜"}</span>
                    <span className={clsx("flex-1 text-[14px] font-medium", ok && "text-muted line-through")}>
                      {n.ikona} {n.nazwa}
                    </span>
                    {n.cel > 1 && (
                      <span className="text-[12px] tabular-nums text-faint">
                        {licznik[n.id] ?? 0}/{n.cel}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Skin care"
        action={
          rutyny.length > 0 ? (
            <Chip tone={skinOk === rutyny.length ? "success" : "neutral"}>
              {skinOk}/{rutyny.length}
            </Chip>
          ) : null
        }
      >
        {rutyny.length === 0 ? (
          <p className="text-[13px] text-muted">Brak rutyn. Dodasz je w zakładce Skin care.</p>
        ) : (
          <ul className="space-y-1.5">
            {rutyny.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void rutyna(r)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-left active:bg-surface-3"
                >
                  <span aria-hidden>{skin[r.id] ? "✅" : "⬜"}</span>
                  <span className={clsx("flex-1 text-[14px] font-medium", skin[r.id] && "text-muted line-through")}>
                    {r.nazwa}
                  </span>
                  <span className="text-[12px] text-faint">{r.pora === "rano" ? "rano" : "wieczór"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
