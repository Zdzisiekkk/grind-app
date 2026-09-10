"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Select, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { humanDate } from "@/lib/format";
import { STATUSY, TYPY } from "@/components/pomoc/Zgloszenia";
import type {
  StatusZgloszenia,
  Zgloszenie,
  ZgloszenieOdpowiedz,
} from "@/lib/database.types";

/**
 * Skrzynka zgłoszeń administratora.
 *
 * Domyślnie pokazuje TYLKO otwarte. Skrzynka, która przy każdym wejściu wita
 * setką rozwiązanych spraw, przestaje być listą rzeczy do zrobienia i staje
 * się archiwum, do którego nikt nie zagląda.
 *
 * Odpowiedź i zmiana statusu są obok siebie, bo prawie zawsze idą razem:
 * "naprawione" bez wiadomości do człowieka to zamknięcie sprawy nad jego głową.
 */
export function Skrzynka({
  adminId,
  zgloszenia,
  odpowiedzi,
}: {
  adminId: string;
  zgloszenia: Zgloszenie[];
  odpowiedzi: ZgloszenieOdpowiedz[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [filtr, setFiltr] = useState<"otwarte" | "wszystkie">("otwarte");
  const [rozwiniete, setRozwiniete] = useState<string | null>(null);
  const [tresc, setTresc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widoczne = zgloszenia.filter(
    (z) => filtr === "wszystkie" || z.status === "nowe" || z.status === "w_toku",
  );

  async function odpowiedzNa(id: string, nowyStatus?: StatusZgloszenia) {
    setBusy(true);
    setError(null);

    if (tresc.trim()) {
      const { error } = await supabase.from("zgloszenia_odpowiedzi").insert({
        zgloszenie_id: id,
        autor_id: adminId,
        tresc: tresc.trim().slice(0, 4000),
      });
      if (error) {
        setBusy(false);
        setError(`Nie udało się odpowiedzieć: ${error.message}`);
        return;
      }
    }

    if (nowyStatus) {
      const { error } = await supabase
        .from("zgloszenia")
        .update({ status: nowyStatus })
        .eq("id", id);
      if (error) {
        setBusy(false);
        setError(`Nie udało się zmienić statusu: ${error.message}`);
        return;
      }
    }

    setBusy(false);
    setTresc("");
    router.refresh();
  }

  return (
    <Card
      title="Skrzynka zgłoszeń"
      subtitle={`${zgloszenia.filter((z) => z.status === "nowe").length} nowych · ${zgloszenia.length} razem`}
      action={
        <Select
          value={filtr}
          onChange={(e) => setFiltr(e.target.value as "otwarte" | "wszystkie")}
          className="min-h-9 py-1 text-[13px]"
        >
          <option value="otwarte">Otwarte</option>
          <option value="wszystkie">Wszystkie</option>
        </Select>
      }
      padded={widoczne.length === 0}
    >
      {error && <Alert>{error}</Alert>}

      {widoczne.length === 0 ? (
        <EmptyState
          icon="📭"
          title={filtr === "otwarte" ? "Nic nie czeka" : "Brak zgłoszeń"}
          description={
            filtr === "otwarte"
              ? "Wszystkie zgłoszenia są zamknięte. Przełącz na Wszystkie, żeby zobaczyć historię."
              : "Nikt jeszcze nic nie zgłosił."
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {widoczne.map((z) => {
            const watek = odpowiedzi.filter((o) => o.zgloszenie_id === z.id);
            const otwarty = rozwiniete === z.id;
            const t = TYPY.find((x) => x.value === z.typ) ?? TYPY[TYPY.length - 1];
            const s = STATUSY[z.status];
            // Czeka na obsługę, gdy ostatnie słowo należy do zgłaszającego.
            const naNas = watek.length === 0 || !watek[watek.length - 1].od_admina;

            return (
              <li key={z.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setRozwiniete(otwarty ? null : z.id);
                    setTresc("");
                  }}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="text-[16px]" aria-hidden>
                    {t.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{z.tytul}</span>
                    <span className="block text-[12px] text-faint">
                      {humanDate(z.created_at.slice(0, 10))} · {watek.length} odpowiedzi
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {naNas && z.status !== "rozwiazane" && z.status !== "odrzucone" && (
                      <Chip tone="danger">na Tobie</Chip>
                    )}
                    <Chip tone={s.tone}>{s.label}</Chip>
                  </span>
                </button>

                {otwarty && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed">
                      {z.tresc}
                    </p>

                    {/*
                      Kontekst techniczny pod treścią, nie nad: przy czytaniu
                      liczy się najpierw, co się stało, a dopiero potem na czym.
                    */}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-faint">
                      <dt>Ekran</dt>
                      <dd className="truncate">{z.strona || "—"}</dd>
                      <dt>Wersja</dt>
                      <dd className="truncate">{z.wersja || "—"}</dd>
                      <dt>Przeglądarka</dt>
                      <dd className="truncate">{z.przegladarka || "—"}</dd>
                    </dl>

                    {watek.map((o) => (
                      <div
                        key={o.id}
                        className={`rounded-xl p-3 text-[13px] leading-relaxed ${
                          o.od_admina ? "border border-accent/40 bg-accent/5" : "bg-surface-2"
                        }`}
                      >
                        <p className="mb-1 text-[12px] font-medium text-muted">
                          {o.od_admina ? "🛠️ Ty" : "Zgłaszający"} ·{" "}
                          {humanDate(o.created_at.slice(0, 10))}
                        </p>
                        <p className="whitespace-pre-wrap">{o.tresc}</p>
                      </div>
                    ))}

                    <Textarea
                      value={tresc}
                      onChange={(e) => setTresc(e.target.value)}
                      placeholder="Odpowiedź do zgłaszającego"
                      className="min-h-24"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        loading={busy}
                        disabled={!tresc.trim()}
                        onClick={() => odpowiedzNa(z.id)}
                      >
                        Odpowiedz
                      </Button>
                      <Button
                        variant="success"
                        loading={busy}
                        onClick={() => odpowiedzNa(z.id, "rozwiazane")}
                      >
                        {tresc.trim() ? "Odpowiedz i zamknij" : "Rozwiązane"}
                      </Button>
                      <Button
                        variant="ghost"
                        loading={busy}
                        onClick={() => odpowiedzNa(z.id, "odrzucone")}
                      >
                        Odrzuć
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
