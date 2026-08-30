"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  ScoreRing,
  SegmentedControl,
  Stat,
  Toast,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { FaceScanner } from "@/components/looks/FaceScanner";
import { ScanReport } from "@/components/looks/ScanReport";
import { ProgressTimeline, type ZdjecieDoPorownania } from "@/components/looks/ProgressTimeline";
import { RoutineEditor } from "@/components/looks/RoutineEditor";
import { PROTOKOLY, PROTOKOL_WG_KLUCZA } from "@/lib/looks/protokoly";
import { PODOCENA_ETYKIETA } from "@/lib/ai/wygladSchema";
import type { PodocenaKlucz, WygladAnalysis } from "@/lib/ai/wygladSchema";
import { deltaOdPoprzedniego } from "@/lib/looks";
import type { Skan } from "@/lib/looks";
import { humanDate, todayISO } from "@/lib/format";
import { STATUS } from "@/lib/viz";
import type {
  WygladLimit,
  WygladProdukt,
  WygladProtokol,
  WygladRutyna,
} from "@/lib/database.types";

/**
 * Zakładka "Wygląd".
 *
 * Kolejność na ekranie nie jest przypadkowa: najpierw jedna rzecz do zrobienia
 * dzisiaj, potem liczba. Odwrotnie - wynik na górze, zadania gdzieś niżej -
 * robi z tego moduł do oceniania się, a nie do zmieniania czegokolwiek.
 */

type Zakladka = "dzis" | "raport" | "progres" | "rutyny";

export type LooksDane = {
  maZgode: boolean;
  maPro: boolean;
  skany: Skan[];
  ostatniRaport: WygladAnalysis | null;
  rutyny: WygladRutyna[];
  /** Klucze rutyn odhaczonych dzisiaj. */
  odhaczoneDzis: string[];
  protokoly: WygladProtokol[];
  produkty: WygladProdukt[];
  limit: WygladLimit | null;
  najstarszeZdjecie: ZdjecieDoPorownania | null;
  najnowszeZdjecie: ZdjecieDoPorownania | null;
  senPrzedSkanem: Array<number | null>;
  czysteDniPrzedSkanem: Array<number | null>;
  wagaPrzySkanie: Array<number | null>;
};

/** Ile dni z rzędu protokół jest włączony. Liczone od daty startu, nie od odhaczeń. */
function dniProtokolu(rozpoczeto: string): number {
  const start = new Date(rozpoczeto + "T00:00:00Z").getTime();
  const dzis = new Date(todayISO() + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((dzis - start) / 86_400_000)) + 1;
}

export function LooksScreen(dane: LooksDane) {
  const router = useRouter();
  const supabase = createClient();

  const [zakladka, setZakladka] = useState<Zakladka>("dzis");
  const [skanerOtwarty, setSkanerOtwarty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zgodaWTrakcie, setZgodaWTrakcie] = useState(false);
  const [odhaczone, setOdhaczone] = useState<string[]>(dane.odhaczoneDzis);

  const ostatni = dane.skany[0] ?? null;
  const delta = deltaOdPoprzedniego(dane.skany);
  const aktywneProtokoly = dane.protokoly.filter((p) => p.aktywny).map((p) => p.klucz);

  /* ------------------------------- Zgoda ---------------------------------- */

  async function przyjmijZgode() {
    setZgodaWTrakcie(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("wyglad_zgoda")
      .upsert({ user_id: user.id, wiek_potwierdzony: true }, { onConflict: "user_id" });
    setZgodaWTrakcie(false);
    router.refresh();
  }

  if (!dane.maZgode) {
    return (
      <div className="space-y-3">
        <Card title="Zanim zrobisz pierwszy skan">
          <div className="space-y-3 text-[14px] leading-relaxed">
            <p>
              Ten moduł ocenia zdjęcia Twojej twarzy. Zdjęcia trafiają na nasz serwer i są wysyłane
              do modelu Anthropic, żeby je opisał. Nikt poza Tobą ich nie zobaczy - leżą w prywatnym
              magazynie, do którego nie ma adresu bez Twojego zalogowania.
            </p>
            <p>
              Zostają, dopóki sam ich nie usuniesz. Znikają razem z kontem, a wcześniej możesz je
              pobrać w eksporcie danych.
            </p>
            <Alert tone="warn">
              To nie jest porada medyczna ani diagnoza dermatologiczna. Przy niepokojącej zmianie
              skórnej idź do dermatologa, a nie do aplikacji.
            </Alert>
            <p className="text-muted">
              Moduł jest dla osób od 16 lat. Klikając poniżej potwierdzasz swój wiek.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={przyjmijZgode} disabled={zgodaWTrakcie}>
              Mam 16 lat lub więcej - rozumiem
            </Button>
            <Link href="/prywatnosc" className="text-center text-[13px] text-muted underline">
              Polityka prywatności
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------ Odhaczanie ------------------------------- */

  async function przelaczRutyne(rutyna: WygladRutyna) {
    const juz = odhaczone.includes(rutyna.id);
    setOdhaczone((o) => (juz ? o.filter((x) => x !== rutyna.id) : [...o, rutyna.id]));

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (juz) {
      await supabase
        .from("wyglad_rutyna_log")
        .delete()
        .eq("rutyna_id", rutyna.id)
        .eq("data", todayISO());
    } else {
      await supabase.from("wyglad_rutyna_log").upsert(
        { user_id: user.id, rutyna_id: rutyna.id, data: todayISO(), wykonano: true },
        { onConflict: "rutyna_id,data" },
      );
    }
  }

  async function wlaczProtokol(klucz: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("wyglad_protokoly")
      .upsert({ user_id: user.id, klucz, aktywny: true }, { onConflict: "user_id,klucz" });
    setToast(`Protokół "${PROTOKOL_WG_KLUCZA.get(klucz as never)?.nazwa ?? klucz}" włączony.`);
    router.refresh();
  }

  /* -------------------------------- Skan ----------------------------------- */

  const mozeSkanowac = dane.maPro && (dane.limit?.mozna ?? false);
  const powodOdmowy = !dane.maPro
    ? "Skan AI jest częścią wersji płatnej. Rutyny, protokoły i pomiary działają bez niej."
    : dane.limit?.powod === "limit_miesiaca"
      ? `Wykorzystałeś ${dane.limit.w_miesiacu} z ${dane.limit.limit_miesiaca} skanów w tym miesiącu.`
      : dane.limit?.powod === "odstep"
        ? `Następny skan ${humanDate(String(dane.limit.nastepny_od).slice(0, 10))} - wcześniej i tak zobaczyłbyś zmianę oświetlenia, nie twarzy.`
        : null;

  const rutynyDnia = dane.rutyny.filter((r) => r.aktywna);
  const rano = rutynyDnia.filter((r) => r.pora === "rano");
  const wieczor = rutynyDnia.filter((r) => r.pora !== "rano");

  return (
    <div className="space-y-3">
      <SegmentedControl
        value={zakladka}
        onChange={setZakladka}
        options={[
          { value: "dzis", label: "Dziś" },
          { value: "raport", label: "Raport" },
          { value: "progres", label: "Progres" },
          { value: "rutyny", label: "Rutyny" },
        ]}
      />

      {zakladka === "dzis" && (
        <>
          {ostatni?.ocena_ogolna != null ? (
            <Card>
              <div className="flex items-center gap-4">
                <ScoreRing
                  score={ostatni.ocena_ogolna}
                  color={STATUS.good}
                  caption={<span className="text-[11px] text-faint">ocena</span>}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-muted">
                    Skan {humanDate(ostatni.utworzono.slice(0, 10))}
                  </p>
                  {delta ? (
                    <p
                      className={clsx(
                        "text-[15px] font-bold",
                        delta.zmiana > 0
                          ? "text-success"
                          : delta.zmiana < 0
                            ? "text-danger"
                            : "text-muted",
                      )}
                    >
                      {delta.zmiana > 0 ? "+" : ""}
                      {delta.zmiana} od {humanDate(delta.data.slice(0, 10))}
                    </p>
                  ) : (
                    <p className="text-[13px] text-faint">
                      Pierwszy skan - punktem odniesienia będzie on sam.
                    </p>
                  )}
                  {ostatni.jakosc_ok === false && (
                    <Chip tone="warn" className="mt-1">
                      słabe zdjęcie
                    </Chip>
                  )}
                </div>
              </div>

              {ostatni.oceny && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.entries(ostatni.oceny) as Array<[PodocenaKlucz, number]>)
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <Stat key={k} label={PODOCENA_ETYKIETA[k] ?? k} value={v} />
                    ))}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="🪪"
                title="Brak skanu"
                description="Zrób pierwszy skan, żeby zobaczyć, od czego zacząć. Kolejne mają sens raz na tydzień."
              />
            </Card>
          )}

          {dane.ostatniRaport?.najwieksza_dzwignia && (
            <Card title="Największa dźwignia" subtitle="Jedna rzecz na najbliższe 30 dni">
              <p className="text-[15px] leading-relaxed">
                {dane.ostatniRaport.najwieksza_dzwignia}
              </p>
            </Card>
          )}

          {rutynyDnia.length > 0 && (
            <Card title="Dzisiaj">
              <div className="space-y-4">
                {[
                  { tytul: "Rano", lista: rano },
                  { tytul: "Wieczorem", lista: wieczor },
                ]
                  .filter((g) => g.lista.length > 0)
                  .map((g) => (
                    <div key={g.tytul}>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                        {g.tytul}
                      </p>
                      <div className="space-y-1.5">
                        {g.lista.map((r) => (
                          <label
                            key={r.id}
                            className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5"
                          >
                            <input
                              type="checkbox"
                              checked={odhaczone.includes(r.id)}
                              onChange={() => void przelaczRutyne(r)}
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
                                <span className="block text-[12px] text-faint">
                                  {r.kroki.join(" · ")}
                                </span>
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

          {aktywneProtokoly.length > 0 && (
            <Card title="Protokoły">
              <div className="space-y-2">
                {dane.protokoly
                  .filter((p) => p.aktywny)
                  .map((p) => {
                    const opis = PROTOKOL_WG_KLUCZA.get(p.klucz as never);
                    const dni = dniProtokolu(p.rozpoczeto);
                    return (
                      <div
                        key={p.klucz}
                        className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
                      >
                        <span className="text-xl" aria-hidden>
                          {opis?.ikona ?? "•"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium">
                            {opis?.nazwa ?? p.klucz}
                          </span>
                          <span className="block text-[12px] text-faint">
                            {opis?.horyzont ?? ""}
                          </span>
                        </span>
                        <Chip tone="accent">
                          {dni} {dni === 1 ? "dzień" : "dni"}
                        </Chip>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          <Card>
            <Button
              onClick={() => setSkanerOtwarty(true)}
              disabled={!mozeSkanowac}
              className="w-full"
            >
              {ostatni ? "Nowy skan" : "Zrób pierwszy skan"}
            </Button>
            {powodOdmowy && <p className="mt-2 text-[13px] text-muted">{powodOdmowy}</p>}
            {mozeSkanowac && dane.limit && (
              <p className="mt-2 text-[12px] text-faint">
                {dane.limit.bez_limitu ? (
                  <>
                    Konto administratora - bez limitu. W tym miesiącu: {dane.limit.w_miesiacu}.
                    Kadencja raz na tydzień nadal jest tą sensowną: częściej mierzy się
                    oświetlenie, nie zmianę.
                  </>
                ) : (
                  <>
                    W tym miesiącu: {dane.limit.w_miesiacu} z {dane.limit.limit_miesiaca}. Sensowna
                    kadencja to raz na tydzień - częściej mierzy się oświetlenie, nie zmianę.
                  </>
                )}
              </p>
            )}
          </Card>
        </>
      )}

      {zakladka === "raport" &&
        (dane.ostatniRaport ? (
          <ScanReport
            analiza={dane.ostatniRaport}
            aktywneProtokoly={aktywneProtokoly}
            onWlaczProtokol={wlaczProtokol}
          />
        ) : (
          <Card>
            <EmptyState
              icon="📋"
              title="Nie ma jeszcze raportu"
              description="Pojawi się po pierwszym skanie."
            />
          </Card>
        ))}

      {zakladka === "progres" && (
        <ProgressTimeline
          skany={dane.skany}
          najstarsze={dane.najstarszeZdjecie}
          najnowsze={dane.najnowszeZdjecie}
          senPrzedSkanem={dane.senPrzedSkanem}
          czysteDniPrzedSkanem={dane.czysteDniPrzedSkanem}
          wagaPrzySkanie={dane.wagaPrzySkanie}
        />
      )}

      {zakladka === "rutyny" && (
        <RoutineEditor
          rutyny={dane.rutyny}
          produkty={dane.produkty}
          protokoly={dane.protokoly}
          onZmiana={() => router.refresh()}
        />
      )}

      <FaceScanner
        // Zamknięcie kasuje komponent razem ze zrobionymi zdjęciami - następne
        // wejście zaczyna od pierwszego ujęcia, a nie w środku poprzedniego.
        key={skanerOtwarty ? "otwarty" : "zamkniety"}
        open={skanerOtwarty}
        onClose={() => setSkanerOtwarty(false)}
        onGotowe={() => {
          setToast("Skan gotowy.");
          router.refresh();
        }}
      />

      {toast && <Toast key={toast}>{toast}</Toast>}
    </div>
  );
}

/** Lista protokołów do włączenia - używana też przez edytor rutyn. */
export const WSZYSTKIE_PROTOKOLY = PROTOKOLY;
