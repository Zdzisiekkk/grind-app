"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Chip, Sheet, Spinner, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { kcalPorcji, kcalPrzepisu, type Propozycja } from "@/lib/ai/przepisSchema";
import { num } from "@/lib/format";

/**
 * "Mam w lodówce" - przepisy układane pod to, co realnie jest w domu.
 *
 * Katalog przepisów odpowiada na pytanie "co ugotować", ale nie na to, które
 * pada częściej: "co ugotować Z TEGO, co mam". Różnica jest praktyczna -
 * przepis wymagający wyprawy do sklepu o dwudziestej nie zostanie zrobiony.
 *
 * Propozycje są trzy i NIE zapisują się same. Model szacuje wartości
 * odżywcze, więc do dziennika trafiają dopiero po tapnięciu - i wtedy jako
 * zwykły przepis, który da się edytować tak jak każdy inny.
 */

const PRZYKLAD = "np. pierś z kurczaka, ryż, papryka, jogurt naturalny, czosnek";

export function PrzepisyZLodowki({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [otwarte, setOtwarte] = useState(false);
  const [produkty, setProdukty] = useState("");
  const [szuka, setSzuka] = useState(false);
  const [propozycje, setPropozycje] = useState<Propozycja[]>([]);
  const [uwaga, setUwaga] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisywany, setZapisywany] = useState<string | null>(null);
  const [zapisane, setZapisane] = useState<string[]>([]);

  async function szukaj() {
    setBlad(null);
    setUwaga(null);
    setPropozycje([]);
    setZapisane([]);
    setSzuka(true);

    try {
      const res = await fetch("/api/ai/przepis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produkty }),
      });
      const json = await res.json();

      if (!res.ok) {
        setBlad(json?.error ?? "Nie udało się poszukać przepisów.");
        return;
      }
      if (!json.rozpoznane || !json.propozycje?.length) {
        setBlad(json.uwaga ?? "Z tej listy nie da się nic ugotować.");
        return;
      }

      setPropozycje(json.propozycje);
      setUwaga(json.uwaga ?? null);
    } catch {
      setBlad("Brak połączenia. Spróbuj za chwilę.");
    } finally {
      setSzuka(false);
    }
  }

  /**
   * Zapis propozycji jako własnego przepisu.
   *
   * Kroki zapisujemy osobno od składników, bo tak wygląda model danych
   * przepisów w bazie. Gdyby zapis kroków padł, przepis i tak zostaje -
   * lepszy przepis bez instrukcji niż komunikat o błędzie i nic.
   */
  async function zapisz(p: Propozycja) {
    setZapisywany(p.nazwa);
    setBlad(null);

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({ user_id: userId, name: p.nazwa, icon: p.ikona, servings: p.porcje })
      .select("id")
      .single();

    if (error || !recipe) {
      setZapisywany(null);
      setBlad(
        error?.code === "23505"
          ? `Masz już przepis o nazwie "${p.nazwa}". Zmień nazwę istniejącego albo pomiń ten.`
          : `Nie udało się zapisać: ${error?.message ?? "nieznany błąd"}`,
      );
      return;
    }

    const { error: bladSkladnikow } = await supabase.from("recipe_items").insert(
      p.skladniki.map((s, i) => ({
        user_id: userId,
        recipe_id: recipe.id,
        name: s.nazwa,
        grams: s.gramatura,
        kcal_100g: s.kcal_100g,
        protein_100g: s.bialko_100g,
        carbs_100g: s.wegle_100g,
        fat_100g: s.tluszcz_100g,
        order_index: i,
      })),
    );

    if (p.kroki.length > 0) {
      await supabase.from("recipe_steps").insert(
        p.kroki.map((tekst, i) => ({
          user_id: userId,
          recipe_id: recipe.id,
          tekst,
          order_index: i,
        })),
      );
    }

    setZapisywany(null);
    if (bladSkladnikow) {
      setBlad(`Przepis zapisany, ale składniki się nie dodały: ${bladSkladnikow.message}`);
      return;
    }

    setZapisane((lista) => [...lista, p.nazwa]);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" block onClick={() => setOtwarte(true)}>
        🧊 Co ugotować z tego, co mam
      </Button>

      <Sheet
        open={otwarte}
        onClose={() => setOtwarte(false)}
        title="Mam w domu"
      >
        <div className="flex flex-col gap-3">
          <Textarea
            rows={3}
            value={produkty}
            maxLength={400}
            onChange={(e) => setProdukty(e.target.value)}
            placeholder={PRZYKLAD}
            aria-label="Produkty, które masz w domu"
          />

          <p className="px-1 text-[12px] text-muted">
            Wypisz po przecinku, co masz. Sól, pieprz i olej zakładamy z góry - reszty
            model nie dopisze bez pytania.
          </p>

          {blad && <Alert tone="warn">{blad}</Alert>}

          <Button block onClick={szukaj} disabled={szuka || produkty.trim().length < 3}>
            {szuka ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> szukam przepisów...
              </span>
            ) : (
              "Znajdź przepisy"
            )}
          </Button>

          {uwaga && <Alert tone="info">{uwaga}</Alert>}

          {propozycje.map((p) => {
            const brakujace = p.skladniki.filter((s) => !s.masz);
            const juzZapisany = zapisane.includes(p.nazwa);

            return (
              <div key={p.nazwa} className="rounded-xl bg-surface-2 p-3">
                <div className="mb-1.5 flex items-start gap-2">
                  <span className="text-[22px] leading-none" aria-hidden>
                    {p.ikona}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">{p.nazwa}</p>
                    <p className="text-[12px] leading-snug text-muted">{p.opis}</p>
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Chip>{p.czas_min} min</Chip>
                  <Chip>
                    {num(kcalPorcji(p))} kcal / porcja
                  </Chip>
                  <Chip>
                    {p.porcje} {p.porcje === 1 ? "porcja" : "porcje"} · {num(kcalPrzepisu(p.skladniki))} kcal
                  </Chip>
                </div>

                <ul className="mb-2 flex flex-col gap-0.5">
                  {p.skladniki.map((s) => (
                    <li key={s.nazwa} className="flex items-baseline gap-2 text-[13px]">
                      <span className={s.masz ? "text-muted" : "text-warn"} aria-hidden>
                        {s.masz ? "•" : "+"}
                      </span>
                      <span className="min-w-0 flex-1">{s.nazwa}</span>
                      <span className="tabular-nums text-[12px] text-faint">
                        {num(s.gramatura)} g
                      </span>
                    </li>
                  ))}
                </ul>

                {brakujace.length > 0 && (
                  <p className="mb-2 text-[12px] text-warn">
                    Trzeba dokupić: {brakujace.map((s) => s.nazwa).join(", ")}
                  </p>
                )}

                {p.kroki.length > 0 && (
                  <ol className="mb-3 flex list-decimal flex-col gap-1 pl-4 text-[13px] text-muted">
                    {p.kroki.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ol>
                )}

                <Button
                  variant={juzZapisany ? "ghost" : "secondary"}
                  block
                  disabled={zapisywany !== null || juzZapisany}
                  onClick={() => zapisz(p)}
                >
                  {juzZapisany
                    ? "✓ Zapisany w Twoich przepisach"
                    : zapisywany === p.nazwa
                      ? "Zapisuję..."
                      : "Zapisz jako mój przepis"}
                </Button>
              </div>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
