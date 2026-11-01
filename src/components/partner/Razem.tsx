"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { createClient } from "@/lib/supabase/client";
import {
  PROG_ZALICZENIA,
  dniOsoby,
  punktyTygodnia,
  seriaRazem,
  type DzienOsoby,
} from "@/lib/partnerWynik";
import type { PartnerTydzienWiersz, PartnerWspolny, PartnerWspolnyLog } from "@/lib/database.types";
import type { Wyslij } from "./typy";

const DNI_TYGODNIA = ["N", "P", "W", "Ś", "C", "P", "S"];

function litera(iso: string): string {
  return DNI_TYGODNIA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

export function Razem({
  tydzien,
  wspolne,
  logi,
  userId,
  dzis,
  imie,
  wyslij,
}: {
  tydzien: PartnerTydzienWiersz[] | null;
  wspolne: PartnerWspolny[];
  logi: PartnerWspolnyLog[];
  userId: string;
  dzis: string;
  imie: string;
  wyslij: Wyslij;
}) {
  const pierwsze = imie.split(" ")[0];
  const ja = tydzien ? dniOsoby(tydzien, "ja") : [];
  const on = tydzien ? dniOsoby(tydzien, "on") : [];

  return (
    <div className="flex flex-col gap-4">
      {tydzien && ja.length > 0 && (
        <>
          <Seria ja={ja} on={on} dzis={dzis} pierwsze={pierwsze} />
          <Pojedynek ja={ja} on={on} dzis={dzis} pierwsze={pierwsze} />
        </>
      )}
      <Wspolne
        wspolne={wspolne}
        logi={logi}
        userId={userId}
        dzis={dzis}
        imie={pierwsze}
        szturchnij={() => wyslij("szturch", "nawyk", "Wspólny nawyk czeka")}
      />
    </div>
  );
}

/* --------------------------------- Seria --------------------------------- */

function Seria({
  ja,
  on,
  dzis,
  pierwsze,
}: {
  ja: DzienOsoby[];
  on: DzienOsoby[];
  dzis: string;
  pierwsze: string;
}) {
  const seria = seriaRazem(ja, on, dzis);
  const onPo = new Map(on.map((d) => [d.data, d]));
  const dzisJa = ja.find((d) => d.data === dzis);
  const dzisOn = onPo.get(dzis);
  const oboje = !!dzisJa?.zaliczony && !!dzisOn?.zaliczony;

  return (
    <Card padded>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent-soft">
          <span className="text-[22px] leading-none" aria-hidden>
            🔥
          </span>
          <span className="tabular text-[20px] font-bold leading-none text-accent">{seria}</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">
            {seria === 0 ? "Zacznijcie serię" : seria === 1 ? "1 dzień razem" : `${seria} dni razem z rzędu`}
          </h2>
          <p className="text-[13px] text-muted">
            {oboje
              ? "Dziś zaliczyliście oboje. Tak trzymać!"
              : dzisJa?.zaliczony
                ? `Ty masz dziś zaliczone. Czeka ${pierwsze}.`
                : dzisOn?.zaliczony
                  ? `${pierwsze} ma dziś zaliczone. Czekamy na Ciebie.`
                  : "Dzień liczy się, gdy oboje zrobicie ponad 60% swojego planu."}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <Rzad nazwa="Ty" dni={ja} dzis={dzis} />
        <Rzad nazwa={pierwsze} dni={on} dzis={dzis} />
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0" />
          <div className="grid flex-1 grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
            {ja.map((d) => (
              <span
                key={d.data}
                className={clsx(
                  "text-center text-[10px]",
                  d.data === dzis ? "font-bold text-text" : "text-faint",
                )}
              >
                {litera(d.data)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Rzad({ nazwa, dni, dzis }: { nazwa: string; dni: DzienOsoby[]; dzis: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 truncate text-[12px] text-muted">{nazwa}</span>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {dni.map((d) => (
          <span
            key={d.data}
            title={`${d.data}: ${Math.round(d.wynik * 100)}%`}
            className={clsx(
              "aspect-square rounded-full",
              d.zaliczony ? "bg-success" : d.wynik > 0 ? "bg-accent-soft ring-1 ring-inset ring-accent/40" : "bg-surface-2",
              d.data === dzis && "outline outline-2 outline-offset-1 outline-accent/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Pojedynek ------------------------------- */

function Pojedynek({
  ja,
  on,
  dzis,
  pierwsze,
}: {
  ja: DzienOsoby[];
  on: DzienOsoby[];
  dzis: string;
  pierwsze: string;
}) {
  const mojeP = punktyTygodnia(ja, dzis);
  const jegoP = punktyTygodnia(on, dzis);
  const max = Math.max(mojeP, jegoP, 1);
  const roznica = Math.round(Math.abs(mojeP - jegoP) * 10) / 10;

  const komunikat =
    roznica < 1
      ? "Łeb w łeb. Kto pierwszy się potknie?"
      : mojeP > jegoP
        ? `Prowadzisz o ${roznica} pkt. ${pierwsze} goni.`
        : `${pierwsze} prowadzi o ${roznica} pkt. Czas gonić.`;

  return (
    <Card title="Pojedynek tygodnia" subtitle="Punkty za ostatnie 7 dni (do 4 dziennie)">
      <div className="space-y-3">
        <Slupek nazwa="Ty" pkt={mojeP} max={max} prowadzi={mojeP > jegoP + 0.9} />
        <Slupek nazwa={pierwsze} pkt={jegoP} max={max} prowadzi={jegoP > mojeP + 0.9} />
      </div>
      <p className="mt-3 text-[13px] text-muted">{komunikat}</p>
      <p className="mt-1 text-[11px] text-faint">
        Punkt za jedzenie i trening, a nawyki i skin care po ułamku. Próg zaliczonego dnia to{" "}
        {Math.round(PROG_ZALICZENIA * 100)}%.
      </p>
    </Card>
  );
}

function Slupek({ nazwa, pkt, max, prowadzi }: { nazwa: string; pkt: number; max: number; prowadzi: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px]">
        <span className="font-medium">
          {nazwa} {prowadzi && <span aria-label="prowadzi">👑</span>}
        </span>
        <span className="tabular text-muted">{pkt} pkt</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={clsx("h-full rounded-full transition-[width] duration-500", prowadzi ? "bg-accent" : "bg-info")}
          style={{ width: `${Math.round((pkt / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Wspólne nawyki ---------------------------- */

const SUGESTIE = [
  { ikona: "🚶", nazwa: "Spacer" },
  { ikona: "💧", nazwa: "2,5 l wody" },
  { ikona: "💊", nazwa: "Kreatyna" },
  { ikona: "😴", nazwa: "Spać przed 23" },
  { ikona: "📵", nazwa: "Bez telefonu przed snem" },
];

function Wspolne({
  wspolne,
  logi,
  userId,
  dzis,
  imie,
  szturchnij,
}: {
  wspolne: PartnerWspolny[];
  logi: PartnerWspolnyLog[];
  userId: string;
  dzis: string;
  imie: string;
  szturchnij: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [nazwa, setNazwa] = useState("");
  const [lokalnie, setLokalnie] = useState<Record<string, boolean>>({});

  const zrobione = (id: string, kto: "ja" | "on") =>
    kto === "ja"
      ? (lokalnie[id] ?? logi.some((l) => l.wspolne_id === id && l.user_id === userId && l.data === dzis))
      : logi.some((l) => l.wspolne_id === id && l.user_id !== userId && l.data === dzis);

  /** Ile dni z rzędu (do dziś) oboje odhaczyli ten nawyk. */
  function seriaNawyku(id: string): number {
    const dniJa = new Set(logi.filter((l) => l.wspolne_id === id && l.user_id === userId).map((l) => l.data));
    const dniOn = new Set(logi.filter((l) => l.wspolne_id === id && l.user_id !== userId).map((l) => l.data));
    let n = 0;
    const d = new Date(`${dzis}T12:00:00Z`);
    for (let i = 0; i < 60; i++) {
      const iso = d.toISOString().slice(0, 10);
      const razem = dniJa.has(iso) && dniOn.has(iso);
      if (razem) n++;
      else if (i > 0) break;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return n;
  }

  async function przelacz(w: PartnerWspolny) {
    const juz = zrobione(w.id, "ja");
    setLokalnie((s) => ({ ...s, [w.id]: !juz }));
    if (juz) {
      await supabase
        .from("partner_wspolne_log")
        .delete()
        .eq("wspolne_id", w.id)
        .eq("user_id", userId)
        .eq("data", dzis);
    } else {
      await supabase.from("partner_wspolne_log").insert({ wspolne_id: w.id, user_id: userId, data: dzis });
    }
    router.refresh();
  }

  async function dodaj(n: string, ikona = "🔥") {
    if (!n.trim()) return;
    const { data: para } = await supabase.from("partner_pary").select("para_id").eq("user_id", userId).maybeSingle();
    if (!para) return;
    await supabase
      .from("partner_wspolne")
      .insert({ para_id: para.para_id, nazwa: n.trim(), ikona, autor_id: userId });
    setNazwa("");
    router.refresh();
  }

  async function usun(w: PartnerWspolny) {
    if (!confirm(`Usunąć wspólny nawyk "${w.nazwa}"?`)) return;
    await supabase.from("partner_wspolne").delete().eq("id", w.id);
    router.refresh();
  }

  const komuBrakuje = wspolne.some((w) => zrobione(w.id, "ja") && !zrobione(w.id, "on"));
  const wolneSugestie = SUGESTIE.filter((s) => !wspolne.some((w) => w.nazwa === s.nazwa));

  return (
    <Card title="Wspólne nawyki" subtitle="Jeden nawyk, dwa odhaczenia">
      {wspolne.length === 0 ? (
        <p className="text-[13px] text-muted">Dodaj coś, co robicie razem. Dobry start to jedna z podpowiedzi poniżej.</p>
      ) : (
        <ul className="space-y-1.5">
          {wspolne.map((w) => {
            const seria = seriaNawyku(w.id);
            const oboje = zrobione(w.id, "ja") && zrobione(w.id, "on");
            return (
              <li
                key={w.id}
                className={clsx(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5",
                  oboje ? "bg-[var(--success-soft)]" : "bg-surface-2",
                )}
              >
                <input
                  type="checkbox"
                  checked={zrobione(w.id, "ja")}
                  onChange={() => void przelacz(w)}
                  className="h-6 w-6 shrink-0 accent-[var(--accent)]"
                  aria-label={`Ja: ${w.nazwa}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">
                    {w.ikona} {w.nazwa}
                  </span>
                  {seria >= 2 && <span className="text-[11px] text-accent">🔥 {seria} dni razem</span>}
                </span>
                <Chip tone={zrobione(w.id, "on") ? "success" : "neutral"}>
                  {imie} {zrobione(w.id, "on") ? "✓" : "…"}
                </Chip>
                <button
                  type="button"
                  onClick={() => void usun(w)}
                  className="flex size-8 items-center justify-center text-faint"
                  aria-label={`Usuń ${w.nazwa}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {wolneSugestie.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {wolneSugestie.map((s) => (
            <button
              key={s.nazwa}
              type="button"
              onClick={() => void dodaj(s.nazwa, s.ikona)}
              className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted active:scale-95"
            >
              {s.ikona} {s.nazwa}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Input
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void dodaj(nazwa)}
          placeholder="Własny wspólny nawyk"
          maxLength={60}
        />
        <Button onClick={() => void dodaj(nazwa)} disabled={!nazwa.trim()}>
          Dodaj
        </Button>
      </div>
      {komuBrakuje && (
        <Button size="sm" className="mt-2" onClick={szturchnij}>
          👊 Szturchnij {imie}
        </Button>
      )}
    </Card>
  );
}
