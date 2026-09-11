"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, EmptyState, Field, Input, SegmentedControl, Textarea, Toast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { addDaysISO, humanDate } from "@/lib/format";
import {
  CZYNNIKI,
  NASTROJ,
  RODZAJE_SESJI,
  STRES,
  czynnikiZlychDni,
  nastrojASen,
  nastrojIkona,
  passaWpisow,
  trendTygodnia,
  type RodzajSesji,
} from "@/lib/glowa";
import type { GlowaDzien, GlowaSesja, GlowaWpis } from "@/lib/database.types";

/**
 * Zakładka "Głowa".
 *
 * Kolejność jak w reszcie aplikacji: najpierw jedna rzecz na dziś (wpis
 * nastroju, dziesięć sekund), potem narzędzia, na końcu liczby. Liczby
 * pojawiają się dopiero, gdy jest z czego je liczyć - zestawienie z trzech
 * dni jest gorsze niż żadne.
 */

export type GlowaDane = {
  userId: string;
  dzis: string;
  dni: GlowaDzien[];
  sesje: GlowaSesja[];
  wpisy: GlowaWpis[];
  noce: Array<{ date: string; sleep_min: number | null }>;
};

const MINUTY_SESJI = [3, 5, 10, 15, 20] as const;

const jeden = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Minutnik = { koniec: number; minuty: number; rodzaj: RodzajSesji };

export function GlowaScreen(d: GlowaDane) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  /* ------------------------------ Wpis dnia ------------------------------- */

  const dzisiejszy = d.dni.find((x) => x.data === d.dzis) ?? null;
  const [edycja, setEdycja] = useState(!dzisiejszy);
  const [nastroj, setNastroj] = useState<number | null>(dzisiejszy?.nastroj ?? null);
  const [stres, setStres] = useState<number>(dzisiejszy?.stres ?? 2);
  const [czynniki, setCzynniki] = useState<string[]>(dzisiejszy?.czynniki ?? []);
  const [notatka, setNotatka] = useState(dzisiejszy?.notatka ?? "");
  const [zapisuje, setZapisuje] = useState(false);

  async function zapiszDzien() {
    if (nastroj == null) return;
    setZapisuje(true);
    const { error } = await createClient()
      .from("glowa_dzien")
      .upsert(
        {
          user_id: d.userId,
          data: d.dzis,
          nastroj,
          stres,
          czynniki,
          notatka: notatka.trim() || null,
        },
        { onConflict: "user_id,data" },
      );
    setZapisuje(false);
    if (error) {
      setToast("Nie udało się zapisać. Spróbuj jeszcze raz.");
      return;
    }
    setEdycja(false);
    setToast(dzisiejszy ? "Poprawione." : "Zapisane.");
    router.refresh();
  }

  const poDniach = new Map(d.dni.map((x) => [x.data, x]));
  const pasek = Array.from({ length: 14 }, (_, i) => addDaysISO(d.dzis, i - 13));
  const passa = passaWpisow(new Set(d.dni.map((x) => x.data)), d.dzis);

  /* ------------------------------ Minutnik -------------------------------- */

  const [rodzaj, setRodzaj] = useState<RodzajSesji>("medytacja");
  const [ileMinut, setIleMinut] = useState<number>(5);
  const [minutnik, setMinutnik] = useState<Minutnik | null>(null);
  const [pozostalo, setPozostalo] = useState(0);

  const zapiszSesje = useCallback(
    async (r: RodzajSesji, minuty: number) => {
      const { error } = await createClient()
        .from("glowa_sesje")
        .insert({ user_id: d.userId, rodzaj: r, minuty });
      if (error) {
        setToast("Nie udało się zapisać sesji.");
        return;
      }
      setToast(`Zapisane: ${minuty} min.`);
      router.refresh();
    },
    [d.userId, router],
  );

  /*
   * Czas liczony od znacznika końca, a nie odejmowaniem sekundy co tik.
   * Telefon usypia przeglądarkę przy zgaszonym ekranie i tiki przestają
   * przychodzić - odliczanie "co sekundę" stanęłoby w miejscu, a od znacznika
   * po odblokowaniu od razu pokazuje prawdę.
   */
  useEffect(() => {
    if (!minutnik) return;
    const id = setInterval(() => {
      const zostalo = Math.max(0, Math.round((minutnik.koniec - Date.now()) / 1000));
      setPozostalo(zostalo);
      if (zostalo === 0) {
        clearInterval(id);
        setMinutnik(null);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(400);
        void zapiszSesje(minutnik.rodzaj, minutnik.minuty);
      }
    }, 250);
    return () => clearInterval(id);
  }, [minutnik, zapiszSesje]);

  function startMinutnika() {
    setPozostalo(ileMinut * 60);
    setMinutnik({ koniec: Date.now() + ileMinut * 60_000, minuty: ileMinut, rodzaj });
  }

  function zakonczWczesniej() {
    if (!minutnik) return;
    const zrobione = Math.floor((minutnik.minuty * 60 - pozostalo) / 60);
    setMinutnik(null);
    if (zrobione >= 1) void zapiszSesje(minutnik.rodzaj, zrobione);
    else setToast("Krócej niż minuta - nie zapisuję.");
  }

  const tydzienOd = addDaysISO(d.dzis, -6);
  const minutTygodnia = d.sesje
    .filter((s) => s.data >= tydzienOd)
    .reduce((a, s) => a + s.minuty, 0);

  /* ------------------------------- Dziennik ------------------------------- */

  const [tresc, setTresc] = useState("");
  const [wdziecznosc, setWdziecznosc] = useState<string[]>(["", "", ""]);
  const [rozwiniete, setRozwiniete] = useState<string[]>([]);
  const [doUsuniecia, setDoUsuniecia] = useState<string | null>(null);

  async function zapiszWpis() {
    const lista = wdziecznosc.map((w) => w.trim()).filter(Boolean);
    if (!tresc.trim() && !lista.length) return;
    const { error } = await createClient()
      .from("glowa_wpisy")
      .insert({ user_id: d.userId, tresc: tresc.trim(), wdziecznosc: lista });
    if (error) {
      setToast("Nie udało się zapisać wpisu.");
      return;
    }
    setTresc("");
    setWdziecznosc(["", "", ""]);
    setToast("Wpis zapisany.");
    router.refresh();
  }

  async function usunWpis(id: string) {
    await createClient().from("glowa_wpisy").delete().eq("id", id);
    setDoUsuniecia(null);
    router.refresh();
  }

  /* ----------------------------- Zestawienia ------------------------------ */

  const trend = trendTygodnia(d.dni, d.dzis);
  const sen = nastrojASen(d.dni, d.noce);
  const czynnikiZle = czynnikiZlychDni(d.dni);

  return (
    <div className="space-y-3">
      {/* ------------------------------ Dziś ------------------------------ */}
      <Card
        title="Jak dziś?"
        subtitle={passa > 1 ? `${passa} dni z rzędu z wpisem` : "Dziesięć sekund, raz dziennie"}
      >
        {!edycja && dzisiejszy ? (
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden>
              {nastrojIkona(dzisiejszy.nastroj)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {NASTROJ.find((n) => n.v === dzisiejszy.nastroj)?.etykieta}
              </p>
              <p className="text-[13px] text-muted">
                Stres: {STRES.find((s) => s.v === dzisiejszy.stres)?.etykieta.toLowerCase()}
                {dzisiejszy.czynniki.length > 0 &&
                  ` · ${dzisiejszy.czynniki
                    .map((c) => CZYNNIKI.find((x) => x.id === c)?.etykieta ?? c)
                    .join(", ")}`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEdycja(true)}>
              Popraw
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Nastrój">
              {NASTROJ.map((n) => (
                <button
                  key={n.v}
                  type="button"
                  role="radio"
                  aria-checked={nastroj === n.v}
                  onClick={() => setNastroj(n.v)}
                  className={clsx(
                    "flex flex-col items-center gap-0.5 rounded-xl py-2 transition",
                    nastroj === n.v ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {n.ikona}
                  </span>
                  <span className="text-[10px] text-muted">{n.etykieta}</span>
                </button>
              ))}
            </div>

            <Field label="Stres">
              <SegmentedControl
                value={String(stres)}
                onChange={(v) => setStres(Number(v))}
                options={STRES.map((s) => ({ value: String(s.v), label: String(s.v) }))}
              />
              <span className="mt-1 block text-[12px] text-faint">
                {STRES.find((s) => s.v === stres)?.etykieta}
              </span>
            </Field>

            <div>
              <p className="mb-1.5 text-[13px] font-medium text-muted">Co na to wpłynęło?</p>
              <div className="flex flex-wrap gap-1.5">
                {CZYNNIKI.map((c) => {
                  const wlaczony = czynniki.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={wlaczony}
                      onClick={() =>
                        setCzynniki((x) => (wlaczony ? x.filter((y) => y !== c.id) : [...x, c.id]))
                      }
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[12px] font-medium",
                        wlaczony ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
                      )}
                    >
                      {c.ikona} {c.etykieta}
                    </button>
                  );
                })}
              </div>
            </div>

            <Textarea
              value={notatka}
              onChange={(e) => setNotatka(e.target.value.slice(0, 500))}
              placeholder="Jedno zdanie o dniu (opcjonalnie)"
              rows={2}
            />

            <div className="flex gap-2">
              {dzisiejszy && (
                <Button variant="ghost" className="flex-1" onClick={() => setEdycja(false)}>
                  Anuluj
                </Button>
              )}
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => void zapiszDzien()}
                disabled={nastroj == null}
                loading={zapisuje}
              >
                Zapisz
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between gap-0.5" aria-label="Nastrój z ostatnich 14 dni">
          {pasek.map((dzien) => {
            const wpis = poDniach.get(dzien);
            return (
              <span
                key={dzien}
                title={`${humanDate(dzien)}${wpis ? ` · nastrój ${wpis.nastroj}/5` : " · bez wpisu"}`}
                className={clsx(
                  "flex h-7 flex-1 items-center justify-center rounded-md text-[14px]",
                  dzien === d.dzis ? "bg-accent-soft" : "bg-surface-2",
                )}
              >
                {wpis ? nastrojIkona(wpis.nastroj) : <span className="text-faint">·</span>}
              </span>
            );
          })}
        </div>
      </Card>

      {/* --------------------------- Wyciszenie --------------------------- */}
      <Card
        title="Wyciszenie"
        subtitle={
          minutTygodnia > 0
            ? `${minutTygodnia} min w ostatnich 7 dniach`
            : "Kilka minut dziennie robi więcej niż godzina raz w miesiącu"
        }
      >
        {minutnik ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <span className="text-[13px] text-muted">
              {RODZAJE_SESJI.find((r) => r.id === minutnik.rodzaj)?.etykieta}
            </span>
            <span className="tabular text-[48px] font-bold leading-none" aria-live="off">
              {Math.floor(pozostalo / 60)}:{String(pozostalo % 60).padStart(2, "0")}
            </span>
            {minutnik.rodzaj === "oddech" && (
              <span className="text-[13px] text-muted">Wdech 4 s · zatrzymaj 4 s · wydech 6 s</span>
            )}
            <div className="flex w-full gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setMinutnik(null)}>
                Przerwij
              </Button>
              <Button className="flex-1" onClick={zakonczWczesniej}>
                Zakończ i zapisz
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SegmentedControl
              value={rodzaj}
              onChange={setRodzaj}
              options={RODZAJE_SESJI.map((r) => ({ value: r.id, label: `${r.ikona} ${r.etykieta.split(" ")[0]}` }))}
            />
            <SegmentedControl
              value={String(ileMinut)}
              onChange={(v) => setIleMinut(Number(v))}
              options={MINUTY_SESJI.map((m) => ({ value: String(m), label: `${m} min` }))}
            />
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={startMinutnika}>
                Start
              </Button>
              <Button className="flex-1" onClick={() => void zapiszSesje(rodzaj, ileMinut)}>
                Już zrobione
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------------------- Dziennik ---------------------------- */}
      <Card title="Dziennik" subtitle="Za co dziś jesteś wdzięczny - i co siedzi w głowie">
        <div className="space-y-2">
          {wdziecznosc.map((w, i) => (
            <Input
              key={i}
              value={w}
              onChange={(e) =>
                setWdziecznosc((x) => x.map((y, j) => (j === i ? e.target.value.slice(0, 200) : y)))
              }
              placeholder={`🙏 ${i + 1}. rzecz, za którą jestem wdzięczny`}
            />
          ))}
          <Textarea
            value={tresc}
            onChange={(e) => setTresc(e.target.value.slice(0, 4000))}
            placeholder="Co się dziś wydarzyło, co chodzi po głowie…"
            rows={3}
          />
          <Button
            block
            onClick={() => void zapiszWpis()}
            disabled={!tresc.trim() && !wdziecznosc.some((w) => w.trim())}
          >
            Zapisz wpis
          </Button>
        </div>

        {d.wpisy.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {d.wpisy.map((w) => {
              const otwarty = rozwiniete.includes(w.id);
              return (
                <div key={w.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-faint">{humanDate(w.data)}</span>
                    {doUsuniecia === w.id ? (
                      <span className="flex gap-2 text-[12px]">
                        <button type="button" className="text-muted" onClick={() => setDoUsuniecia(null)}>
                          Zostaw
                        </button>
                        <button type="button" className="font-semibold text-danger" onClick={() => void usunWpis(w.id)}>
                          Usuń
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[12px] text-faint"
                        onClick={() => setDoUsuniecia(w.id)}
                        aria-label="Usuń wpis"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {w.wdziecznosc.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[13px]">
                      {w.wdziecznosc.map((x, i) => (
                        <li key={i}>🙏 {x}</li>
                      ))}
                    </ul>
                  )}
                  {w.tresc && (
                    <button
                      type="button"
                      onClick={() =>
                        setRozwiniete((r) => (otwarty ? r.filter((x) => x !== w.id) : [...r, w.id]))
                      }
                      className={clsx(
                        "mt-1 block w-full whitespace-pre-line text-left text-[13px] text-muted",
                        !otwarty && "line-clamp-3",
                      )}
                    >
                      {w.tresc}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* --------------------------- Zestawienia -------------------------- */}
      <Card title="Co idzie w parze">
        {trend.nastroj == null && !sen && czynnikiZle.length === 0 ? (
          <EmptyState
            icon="🧠"
            title="Za mało wpisów"
            description="Po tygodniu codziennych wpisów pojawią się tu średnie i zestawienia ze snem."
          />
        ) : (
          <div className="space-y-2.5 text-[14px]">
            {trend.nastroj != null && (
              <p>
                Nastrój w ostatnich 7 dniach: <strong>{jeden(trend.nastroj)}</strong>/5
                {trend.nastrojPrzed != null && (
                  <span className="text-muted"> (tydzień wcześniej {jeden(trend.nastrojPrzed)})</span>
                )}
                {trend.stres != null && (
                  <>
                    , stres <strong>{jeden(trend.stres)}</strong>/5
                    {trend.stresPrzed != null && (
                      <span className="text-muted"> (wcześniej {jeden(trend.stresPrzed)})</span>
                    )}
                  </>
                )}
                .
              </p>
            )}
            {sen && (
              <p>
                Po nocach od 7 godzin nastrój wypadał średnio <strong>{jeden(sen.poDobrych)}</strong>,
                po krótszych <strong>{jeden(sen.poKrotkich)}</strong>{" "}
                <span className="text-muted">
                  ({sen.dniDobrych} i {sen.dniKrotkich} dni)
                </span>
                .
              </p>
            )}
            {czynnikiZle.map((c) => (
              <p key={c.id}>
                W słabe dni częściej pojawia się{" "}
                <strong>{CZYNNIKI.find((x) => x.id === c.id)?.etykieta.toLowerCase()}</strong>{" "}
                <span className="text-muted">
                  ({Math.round(c.wZle * 100)}% słabych dni, zwykle {Math.round(c.ogolnie * 100)}%)
                </span>
                .
              </p>
            ))}
            <p className="text-[12px] text-faint">
              To zestawienia, nie przyczyny. Mówią, gdzie warto się przyjrzeć - nie co jest winne.
            </p>
          </div>
        )}
      </Card>

      {toast && <Toast key={toast}>{toast}</Toast>}
    </div>
  );
}
