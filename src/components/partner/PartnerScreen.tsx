"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, Input, SegmentedControl, Toast } from "@/components/ui";
import { dolaczKodem, rozlacz, ustawAlerty, wygenerujKod, wyslijDoPartnera } from "@/app/(app)/partner/actions";
import { addDaysISO } from "@/lib/format";
import { dniOsoby, seriaRazem } from "@/lib/partnerWynik";
import type {
  PartnerDzien,
  PartnerStan,
  PartnerTydzienWiersz,
  PartnerWiadomosc,
  PartnerWspolny,
  PartnerWspolnyLog,
} from "@/lib/database.types";
import { Czat } from "./Czat";
import { Dzis } from "./Dzis";
import { Razem } from "./Razem";
import type { Wyslij } from "./typy";

type Props = {
  stan: PartnerStan;
  userId: string;
  dzis: string;
  dzien: string;
  partner?: PartnerDzien | null;
  tydzien?: PartnerTydzienWiersz[] | null;
  wspolne?: PartnerWspolny[];
  logiWspolne?: PartnerWspolnyLog[];
  wiadomosci?: PartnerWiadomosc[];
};

type Karta = "dzis" | "razem" | "czat";

export function PartnerScreen(p: Props) {
  if (!p.stan.w_parze) return <BezPary stan={p.stan} />;
  return <WParze {...p} imie={p.stan.imie} alerty={p.stan.alerty} />;
}

/* ------------------------------ Bez pary --------------------------------- */

function BezPary({ stan }: { stan: Extract<PartnerStan, { w_parze: false }> }) {
  const router = useRouter();
  const [kod, setKod] = useState(stan.kod);
  const [wpisany, setWpisany] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [trwa, start] = useTransition();

  function generuj() {
    setBlad(null);
    start(async () => {
      const w = await wygenerujKod();
      if (w.ok) setKod(w.kod);
      else setBlad(w.blad);
    });
  }

  function dolacz() {
    setBlad(null);
    start(async () => {
      const w = await dolaczKodem(wpisany);
      if (w.ok) router.refresh();
      else setBlad(w.blad);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Partner</h1>
        <p className="text-[13px] text-muted">
          Połącz konta i róbcie lock-in razem: widzicie swój dzień, przypominacie sobie i szturchacie.
        </p>
      </header>

      <Card title="Mam kod od partnera">
        <div className="flex gap-2">
          <Input
            value={wpisany}
            onChange={(e) => setWpisany(e.target.value.toUpperCase())}
            placeholder="np. AB12-CD34"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono tracking-widest"
          />
          <Button variant="primary" onClick={dolacz} loading={trwa} disabled={wpisany.trim().length < 8}>
            Połącz
          </Button>
        </div>
      </Card>

      <Card title="Wygeneruj kod dla partnera" subtitle="Kod działa 48 godzin i jednorazowo">
        {kod ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="font-mono text-3xl font-bold tracking-[0.25em]">
              {kod.slice(0, 4)}-{kod.slice(4)}
            </div>
            <p className="text-[12px] text-muted">
              Wyślij go drugiej osobie. Ona wpisuje go u siebie w zakładce Partner.
            </p>
            <Button size="sm" onClick={generuj} loading={trwa}>
              Nowy kod
            </Button>
          </div>
        ) : (
          <Button variant="primary" block onClick={generuj} loading={trwa}>
            Wygeneruj kod
          </Button>
        )}
      </Card>

      {blad && <Alert tone="danger">{blad}</Alert>}
    </div>
  );
}

/* ------------------------------- W parze --------------------------------- */

function WParze({
  imie,
  alerty,
  userId,
  dzis,
  dzien,
  partner,
  tydzien = null,
  wspolne = [],
  logiWspolne = [],
  wiadomosci = [],
}: Props & { imie: string; alerty: boolean }) {
  const router = useRouter();
  const [karta, setKarta] = useState<Karta>("dzis");
  const [toast, setToast] = useState<{ id: number; tekst: string; ok: boolean } | null>(null);
  const [trwa, start] = useTransition();

  const pierwsze = imie.split(" ")[0];
  const nieprzeczytane = wiadomosci.filter((w) => w.do_id === userId && !w.odczytano).length;
  const ja = tydzien ? dniOsoby(tydzien, "ja") : [];
  const on = tydzien ? dniOsoby(tydzien, "on") : [];
  const seria = tydzien ? seriaRazem(ja, on, dzis) : 0;
  const dzisOboje =
    !!ja.find((d) => d.data === dzis)?.zaliczony && !!on.find((d) => d.data === dzis)?.zaliczony;

  const wyslij: Wyslij = (rodzaj, kontekst, tresc, emoji) => {
    start(async () => {
      const w = await wyslijDoPartnera(rodzaj, kontekst, tresc, emoji);
      setToast({
        id: Date.now(),
        ok: w.ok,
        tekst: w.ok
          ? rodzaj === "szturch"
            ? `Szturchnięte! ${pierwsze} dostanie powiadomienie`
            : rodzaj === "reakcja"
              ? "Reakcja wysłana"
              : "Wysłane"
          : w.blad,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{imie}</h1>
          <p className="text-[13px] text-muted">
            {seria > 0 ? `🔥 ${seria} ${seria === 1 ? "dzień" : "dni"} razem z rzędu` : "Wasz wspólny lock-in"}
          </p>
        </div>
        {karta === "dzis" && (
          <div className="flex shrink-0 gap-1.5">
            <Link href="/partner" aria-current={dzien === dzis}>
              <Chip tone={dzien === dzis ? "accent" : "neutral"}>Dziś</Chip>
            </Link>
            <Link href={`/partner?d=${addDaysISO(dzis, -1)}`} aria-current={dzien !== dzis}>
              <Chip tone={dzien !== dzis ? "accent" : "neutral"}>Wczoraj</Chip>
            </Link>
          </div>
        )}
      </header>

      <SegmentedControl<Karta>
        value={karta}
        onChange={setKarta}
        options={[
          { value: "dzis", label: `Dzień ${pierwsze}` },
          { value: "razem", label: "Razem" },
          { value: "czat", label: nieprzeczytane > 0 ? `Czat (${nieprzeczytane})` : "Czat" },
        ]}
      />

      {dzisOboje && karta !== "czat" && <Alert tone="success">Oboje zaliczyliście dziś swój plan 🎉</Alert>}
      {nieprzeczytane > 0 && karta !== "czat" && (
        <button type="button" onClick={() => setKarta("czat")} className="text-left">
          <Alert tone="info">
            {nieprzeczytane === 1
              ? `${pierwsze} napisał(a) do Ciebie. Zobacz w czacie.`
              : `${nieprzeczytane} nowe wiadomości od ${pierwsze}. Zobacz w czacie.`}
          </Alert>
        </button>
      )}

      {karta === "dzis" &&
        (partner ? (
          <Dzis partner={partner} imie={imie} czyDzis={dzien === dzis} wyslij={wyslij} blokada={trwa} />
        ) : (
          <Alert tone="warn">Nie udało się wczytać dnia partnera. Odśwież stronę.</Alert>
        ))}

      {karta === "razem" && (
        <>
          <Razem
            tydzien={tydzien}
            wspolne={wspolne}
            logi={logiWspolne}
            userId={userId}
            dzis={dzis}
            imie={imie}
            wyslij={wyslij}
          />
          <Ustawienia
            alerty={alerty}
            pierwsze={pierwsze}
            trwa={trwa}
            onAlerty={(v) =>
              start(async () => {
                await ustawAlerty(v);
                router.refresh();
              })
            }
            onRozlacz={() =>
              start(async () => {
                await rozlacz();
                router.refresh();
              })
            }
          />
        </>
      )}

      {karta === "czat" && (
        <Czat wiadomosci={wiadomosci} userId={userId} imie={imie} dzis={dzis} wyslij={wyslij} trwa={trwa} />
      )}

      {toast && (
        <Toast key={toast.id} tone={toast.ok ? "success" : "danger"}>
          {toast.tekst}
        </Toast>
      )}
    </div>
  );
}

function Ustawienia({
  alerty,
  pierwsze,
  trwa,
  onAlerty,
  onRozlacz,
}: {
  alerty: boolean;
  pierwsze: string;
  trwa: boolean;
  onAlerty: (v: boolean) => void;
  onRozlacz: () => void;
}) {
  return (
    <Card title="Ustawienia pary">
      <label className="flex items-start gap-2.5 text-[14px]">
        <input
          type="checkbox"
          defaultChecked={alerty}
          onChange={(e) => onAlerty(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span>
          Wieczorny alert o zaległościach partnera
          <span className="block text-[12px] text-muted">
            O 20:30, jeśli {pierwsze} ma jeszcze nieodhaczone nawyki albo skin care.
          </span>
        </span>
      </label>
      <div className="mt-4 border-t border-border pt-3">
        <Button
          variant="danger"
          size="sm"
          loading={trwa}
          onClick={() => {
            if (!confirm(`Rozłączyć się z ${pierwsze}? Wspólne nawyki i wiadomości znikną.`)) return;
            onRozlacz();
          }}
        >
          Rozłącz parę
        </Button>
      </div>
    </Card>
  );
}
