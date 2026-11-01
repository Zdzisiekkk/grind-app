"use client";

import { Button, Chip, ProgressRing } from "@/components/ui";
import { Card } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { num } from "@/lib/format";
import type { PartnerDzien, PartnerKontekst } from "@/lib/database.types";
import type { Wyslij } from "./typy";

const TYPY_POSILKOW: Record<string, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

const REAKCJE = ["👏", "🔥", "💪"] as const;

/** Czego partnerowi brakuje dziś: z tego powstaje główny przycisk "Szturchnij". */
function braki(p: PartnerDzien): Array<{ kontekst: PartnerKontekst; etykieta: string }> {
  const lista: Array<{ kontekst: PartnerKontekst; etykieta: string }> = [];
  if (p.kcal === 0) lista.push({ kontekst: "posilek", etykieta: "jedzenie" });
  if (p.treningi.length === 0) lista.push({ kontekst: "trening", etykieta: "trening" });
  if (p.nawyki.some((n) => n.zrobione < n.cel)) lista.push({ kontekst: "nawyk", etykieta: "nawyki" });
  if (p.skincare.some((s) => !s.zrobione)) lista.push({ kontekst: "skincare", etykieta: "skin care" });
  return lista;
}

function Pasek({ wartosc, cel, ton = "accent" }: { wartosc: number; cel: number; ton?: "accent" | "info" }) {
  const pct = cel > 0 ? Math.min(100, Math.round((wartosc / cel) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx("h-full rounded-full transition-[width] duration-500", ton === "accent" ? "bg-accent" : "bg-info")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Dzis({
  partner,
  imie,
  czyDzis,
  wyslij,
  blokada,
}: {
  partner: PartnerDzien;
  imie: string;
  czyDzis: boolean;
  wyslij: Wyslij;
  blokada: boolean;
}) {
  const pierwsze = imie.split(" ")[0];
  const nawykiOk = partner.nawyki.filter((n) => n.zrobione >= n.cel).length;
  const skinOk = partner.skincare.filter((s) => s.zrobione).length;
  const brakuje = braki(partner);

  // Cztery obszary: ile "zaliczonych" w sensie wszystko zrobione.
  const obszary = [
    { ikona: "🍽️", nazwa: "Jedzenie", ok: partner.kcal > 0 },
    { ikona: "🏋️", nazwa: "Trening", ok: partner.treningi.length > 0 },
    { ikona: "✅", nazwa: "Nawyki", ok: partner.nawyki.length > 0 && nawykiOk === partner.nawyki.length },
    { ikona: "✨", nazwa: "Skin care", ok: partner.skincare.length > 0 && skinOk === partner.skincare.length },
  ];
  const zaliczone = obszary.filter((o) => o.ok).length;

  return (
    <div className="flex flex-col gap-4">
      <Card padded>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={zaliczone}
            max={4}
            size={76}
            label={
              <span className="tabular text-[18px] font-bold">
                {zaliczone}
                <span className="text-faint">/4</span>
              </span>
            }
          />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {zaliczone === 4
                ? `Komplet u ${pierwsze} 🎉`
                : zaliczone === 0
                  ? `Dzień u ${pierwsze} jest jeszcze pusty`
                  : `${pierwsze}: ${zaliczone} z 4 obszarów`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {obszary.map((o) => (
                <Chip key={o.nazwa} tone={o.ok ? "success" : "neutral"}>
                  <span aria-hidden>{o.ikona}</span> {o.nazwa}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        {czyDzis && brakuje.length > 0 && (
          <Button
            block
            className="mt-4"
            disabled={blokada}
            onClick={() => wyslij("szturch", brakuje[0].kontekst)}
          >
            👊 Szturchnij w sprawie: {brakuje[0].etykieta}
          </Button>
        )}
      </Card>

      <Karta
        tytul="Jedzenie"
        kontekst="posilek"
        wyslij={wyslij}
        blokada={blokada}
        szturchnij={czyDzis && partner.kcal === 0}
        podtytul={
          partner.cel_kcal
            ? `${num(partner.kcal)} z ${num(partner.cel_kcal)} kcal · białko ${num(partner.bialko)} g`
            : `${num(partner.kcal)} kcal · białko ${num(partner.bialko)} g`
        }
      >
        {partner.cel_kcal ? <Pasek wartosc={partner.kcal} cel={partner.cel_kcal} /> : null}
        {partner.posilki.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Nic jeszcze nie zapisane.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-[13px]">
            {partner.posilki.map((m, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="text-faint">{TYPY_POSILKOW[m.typ] ?? m.typ} · </span>
                  {m.nazwa}
                  <span className="text-faint"> {num(m.gramy)} g</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{num(m.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[12px] text-muted">
            <span>💧 Woda</span>
            <span className="tabular-nums">
              {num(partner.woda_ml)} z {num(partner.cel_wody_ml)} ml
            </span>
          </div>
          <Pasek wartosc={partner.woda_ml} cel={partner.cel_wody_ml} ton="info" />
        </div>
      </Karta>

      <Karta
        tytul="Trening"
        kontekst="trening"
        wyslij={wyslij}
        blokada={blokada}
        szturchnij={czyDzis && partner.treningi.length === 0}
        podtytul={partner.treningi.length === 0 ? "Jeszcze bez treningu" : undefined}
      >
        {partner.treningi.map((t, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-[14px]">
            <span className="font-medium">{t.nazwa}</span>
            <Chip tone={t.zakonczony ? "success" : "accent"}>
              {t.zakonczony ? `${t.minuty ?? "?"} min · ${t.serie} serii` : `w trakcie · ${t.serie} serii`}
            </Chip>
          </div>
        ))}
      </Karta>

      <Karta
        tytul="Nawyki"
        kontekst="nawyk"
        wyslij={wyslij}
        blokada={blokada}
        szturchnij={czyDzis && partner.nawyki.length > nawykiOk}
        podtytul={partner.nawyki.length ? `${nawykiOk} z ${partner.nawyki.length}` : "Brak nawyków na dziś"}
      >
        <ul className="space-y-1">
          {partner.nawyki.map((n, i) => {
            const ok = n.zrobione >= n.cel;
            return (
              <li key={i} className="flex items-center gap-2 text-[14px]">
                <span aria-hidden>{ok ? "✅" : "⬜"}</span>
                <span className={clsx(ok && "text-muted line-through")}>
                  {n.ikona} {n.nazwa}
                </span>
                {n.cel > 1 && (
                  <span className="text-[12px] text-faint">
                    {n.zrobione}/{n.cel}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Karta>

      <Karta
        tytul="Skin care"
        kontekst="skincare"
        wyslij={wyslij}
        blokada={blokada}
        szturchnij={czyDzis && partner.skincare.length > skinOk}
        podtytul={partner.skincare.length ? `${skinOk} z ${partner.skincare.length}` : "Brak rutyn"}
      >
        <ul className="space-y-1">
          {partner.skincare.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-[14px]">
              <span aria-hidden>{s.zrobione ? "✅" : "⬜"}</span>
              <span className={clsx(s.zrobione && "text-muted line-through")}>{s.nazwa}</span>
              <span className="text-[12px] text-faint">{s.pora === "rano" ? "rano" : "wieczór"}</span>
            </li>
          ))}
        </ul>
      </Karta>
    </div>
  );
}

function Karta({
  tytul,
  podtytul,
  kontekst,
  wyslij,
  blokada,
  szturchnij,
  children,
}: {
  tytul: string;
  podtytul?: string;
  kontekst: PartnerKontekst;
  wyslij: Wyslij;
  blokada: boolean;
  szturchnij: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card title={tytul} subtitle={podtytul}>
      {children}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5">
        {REAKCJE.map((e) => (
          <button
            key={e}
            type="button"
            disabled={blokada}
            onClick={() => wyslij("reakcja", kontekst, undefined, e)}
            className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-[18px] transition-transform active:scale-90 disabled:opacity-50"
            aria-label={`Reakcja ${e}`}
          >
            {e}
          </button>
        ))}
        {szturchnij && (
          <Button size="sm" className="ml-auto" disabled={blokada} onClick={() => wyslij("szturch", kontekst)}>
            👊 Szturchnij
          </Button>
        )}
      </div>
    </Card>
  );
}
