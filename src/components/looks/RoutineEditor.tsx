"use client";

import { useState } from "react";
import { Alert, Button, Card, Chip, Field, Input, Select, Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { konflikty } from "@/lib/looks";
import { PROTOKOLY } from "@/lib/looks/protokoly";
import type { PoraDnia, WygladProdukt, WygladProtokol, WygladRutyna } from "@/lib/database.types";

/**
 * Rutyny, produkty i protokoły do samodzielnej edycji.
 *
 * Ostrzeżenia o konfliktach składników liczy `konflikty()` w kodzie, nie model.
 * „Retinoid i kwasy tego samego wieczoru" to reguła, którą albo się zna, albo
 * nie — a model, który raz na dziesięć razy o niej zapomni, jest gorszy niż
 * dziesięć linijek, które nie zapominają nigdy.
 */

const PORY: Array<{ value: PoraDnia; label: string }> = [
  { value: "rano", label: "Rano" },
  { value: "wieczor", label: "Wieczorem" },
  { value: "dowolnie", label: "Dowolnie" },
];

export function RoutineEditor({
  rutyny,
  produkty,
  protokoly,
  onZmiana,
}: {
  rutyny: WygladRutyna[];
  produkty: WygladProdukt[];
  protokoly: WygladProtokol[];
  onZmiana: () => void;
}) {
  const supabase = createClient();
  const [arkusz, setArkusz] = useState<"rutyna" | "produkt" | null>(null);
  const [nazwa, setNazwa] = useState("");
  const [pora, setPora] = useState<PoraDnia>("wieczor");
  const [skladniki, setSkladniki] = useState("");
  const [zapisuje, setZapisuje] = useState(false);

  const ostrzezenia = konflikty(
    produkty.map((p) => ({
      id: p.id,
      nazwa: p.nazwa,
      skladniki_aktywne: p.skladniki_aktywne,
      pora: p.pora,
    })),
  );

  const aktywne = new Set(protokoly.filter((p) => p.aktywny).map((p) => p.klucz));

  function wyczysc() {
    setNazwa("");
    setSkladniki("");
    setPora("wieczor");
    setArkusz(null);
  }

  async function zapisz() {
    if (!nazwa.trim()) return;
    setZapisuje(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (arkusz === "rutyna") {
      // Klucz z nazwy: model przy kolejnym skanie aktualizuje SWOJE rutyny po
      // kluczu, a ręcznie dodanych nie rusza w ogóle (patrz trasa /api/ai/wyglad).
      const klucz = `wlasna_${nazwa.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`;
      await supabase.from("wyglad_rutyny").upsert(
        { user_id: user.id, klucz, nazwa: nazwa.trim(), pora, kroki: [], zrodlo: "wlasna" },
        { onConflict: "user_id,klucz" },
      );
    } else {
      await supabase.from("wyglad_produkty").insert({
        user_id: user.id,
        nazwa: nazwa.trim(),
        pora,
        skladniki_aktywne: skladniki
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    setZapisuje(false);
    wyczysc();
    onZmiana();
  }

  async function przelaczProtokol(klucz: string, wlacz: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("wyglad_protokoly")
      .upsert({ user_id: user.id, klucz, aktywny: wlacz }, { onConflict: "user_id,klucz" });
    onZmiana();
  }

  async function usunRutyne(id: string) {
    await supabase.from("wyglad_rutyny").delete().eq("id", id);
    onZmiana();
  }

  async function usunProdukt(id: string) {
    await supabase.from("wyglad_produkty").delete().eq("id", id);
    onZmiana();
  }

  return (
    <div className="space-y-3">
      {ostrzezenia.length > 0 && (
        <div className="space-y-2">
          {ostrzezenia.map((k, i) => (
            <Alert key={i} tone={k.waga === "ostrzezenie" ? "danger" : "warn"}>
              <strong>{k.tytul}.</strong> {k.opis}
              <span className="mt-1 block text-[12px] opacity-80">{k.produkty.join(", ")}</span>
            </Alert>
          ))}
        </div>
      )}

      <Card
        title="Rutyny"
        action={
          <Button variant="ghost" onClick={() => setArkusz("rutyna")}>
            Dodaj
          </Button>
        }
      >
        {rutyny.length === 0 ? (
          <p className="text-[13px] text-muted">
            Pusto. Rutyny pojawią się same po skanie albo dodaj własną.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rutyny.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{r.nazwa}</span>
                  <span className="block text-[12px] text-faint">
                    {PORY.find((p) => p.value === r.pora)?.label}
                    {r.zrodlo === "ai" && " · z raportu"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void usunRutyne(r.id)}
                  className="text-[13px] text-danger"
                  aria-label={`Usuń rutynę ${r.nazwa}`}
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Produkty"
        subtitle="Wpisz składniki aktywne — sprawdzimy, czy się nie gryzą"
        action={
          <Button variant="ghost" onClick={() => setArkusz("produkt")}>
            Dodaj
          </Button>
        }
      >
        {produkty.length === 0 ? (
          <p className="text-[13px] text-muted">
            Brak produktów. Bez nich nie ostrzeżemy o łączeniu retinoidu z kwasami.
          </p>
        ) : (
          <div className="space-y-1.5">
            {produkty.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{p.nazwa}</span>
                  <span className="block text-[12px] text-faint">
                    {PORY.find((x) => x.value === p.pora)?.label}
                    {p.skladniki_aktywne.length > 0 && ` · ${p.skladniki_aktywne.join(", ")}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void usunProdukt(p.id)}
                  className="text-[13px] text-danger"
                  aria-label={`Usuń produkt ${p.nazwa}`}
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Protokoły" subtitle="Uczciwie o tym, co dają i czego nie">
        <div className="space-y-2">
          {PROTOKOLY.map((p) => (
            <details key={p.klucz} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <summary className="flex cursor-pointer items-center gap-2.5">
                <span className="text-xl" aria-hidden>
                  {p.ikona}
                </span>
                <span className="flex-1 text-[14px] font-medium">{p.nazwa}</span>
                {aktywne.has(p.klucz) && <Chip tone="accent">włączony</Chip>}
              </summary>

              <div className="mt-2.5 space-y-2 text-[13px]">
                <p>{p.obietnica}</p>
                {p.czego_nie_daje && (
                  <p className="rounded-lg bg-[var(--warn-soft)] px-2.5 py-2 text-warn">
                    {p.czego_nie_daje}
                  </p>
                )}
                <p className="text-faint">Horyzont: {p.horyzont}</p>

                <ol className="space-y-1.5">
                  {p.kroki.map((k, i) => (
                    <li key={i}>
                      <span className="font-medium">{k.nazwa}</span>
                      {k.ile && <span className="text-faint"> — {k.ile}</span>}
                      <span className="block text-muted">{k.opis}</span>
                    </li>
                  ))}
                </ol>

                <Button
                  variant="ghost"
                  onClick={() => void przelaczProtokol(p.klucz, !aktywne.has(p.klucz))}
                >
                  {aktywne.has(p.klucz) ? "Wyłącz" : "Włącz protokół"}
                </Button>
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Sheet
        open={arkusz !== null}
        onClose={wyczysc}
        title={arkusz === "rutyna" ? "Nowa rutyna" : "Nowy produkt"}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={wyczysc} className="flex-1">
              Anuluj
            </Button>
            <Button onClick={zapisz} disabled={!nazwa.trim() || zapisuje} className="flex-1">
              Zapisz
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Nazwa">
            <Input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              placeholder={arkusz === "rutyna" ? "Wieczorne mycie twarzy" : "Krem z retinolem"}
            />
          </Field>

          <Field label="Pora">
            <Select value={pora} onChange={(e) => setPora(e.target.value as PoraDnia)}>
              {PORY.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          {arkusz === "produkt" && (
            <Field
              label="Składniki aktywne"
              hint="Po przecinku, prosto z opakowania. Np. retinol, niacynamid"
            >
              <Input
                value={skladniki}
                onChange={(e) => setSkladniki(e.target.value)}
                placeholder="retinol, niacynamid"
              />
            </Field>
          )}
        </div>
      </Sheet>
    </div>
  );
}
