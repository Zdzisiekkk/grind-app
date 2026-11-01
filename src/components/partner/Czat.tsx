"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { odczytaneWiadomosci } from "@/app/(app)/partner/actions";
import type { PartnerWiadomosc } from "@/lib/database.types";
import { SKROTY_WIADOMOSCI, type Wyslij } from "./typy";

const KONTEKSTY: Record<string, string> = {
  trening: "trening",
  posilek: "jedzenie",
  nawyk: "nawyki",
  skincare: "skin care",
  woda: "woda",
};

function dzien(iso: string): string {
  return iso.slice(0, 10);
}

function godzina(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function etykietaDnia(d: string, dzis: string): string {
  if (d === dzis) return "Dzisiaj";
  const wczoraj = new Date(`${dzis}T12:00:00Z`);
  wczoraj.setUTCDate(wczoraj.getUTCDate() - 1);
  if (d === wczoraj.toISOString().slice(0, 10)) return "Wczoraj";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}

export function Czat({
  wiadomosci,
  userId,
  imie,
  dzis,
  wyslij,
  trwa,
}: {
  wiadomosci: PartnerWiadomosc[];
  userId: string;
  imie: string;
  dzis: string;
  wyslij: Wyslij;
  trwa: boolean;
}) {
  const pierwsze = imie.split(" ")[0];
  const [tresc, setTresc] = useState("");
  const koniec = useRef<HTMLDivElement>(null);

  // Wiadomości przychodzą od najnowszej; w czacie najnowsza ma być na dole.
  const chronologicznie = [...wiadomosci].reverse();

  // Otwarcie czatu = przeczytane.
  useEffect(() => {
    if (wiadomosci.some((w) => w.do_id === userId && !w.odczytano)) void odczytaneWiadomosci();
  }, [wiadomosci, userId]);

  useEffect(() => {
    koniec.current?.scrollIntoView({ block: "nearest" });
  }, [wiadomosci.length]);

  function wyslijTresc(t: string) {
    if (!t.trim() || trwa) return;
    wyslij("wiadomosc", "ogolne", t.trim());
    setTresc("");
  }

  return (
    <Card padded>
      {chronologicznie.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">
          Cisza. Napisz coś do {pierwsze} albo wyślij jeden ze skrótów poniżej.
        </p>
      ) : (
        <ul className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {chronologicznie.map((w, i) => {
            const moja = w.od_id === userId;
            const d = dzien(w.created_at);
            const naglowek = i === 0 || d !== dzien(chronologicznie[i - 1].created_at);
            const kontekst = w.kontekst !== "ogolne" ? KONTEKSTY[w.kontekst] : null;

            return (
              <li key={w.id} className="flex flex-col">
                {naglowek && (
                  <span className="my-2 self-center text-[11px] font-medium uppercase tracking-wide text-faint">
                    {etykietaDnia(d, dzis)}
                  </span>
                )}
                {w.rodzaj === "reakcja" ? (
                  <div className={clsx("flex items-center gap-1.5", moja ? "self-end" : "self-start")}>
                    <span className="text-[28px] leading-none">{w.emoji ?? "👏"}</span>
                    <span className="text-[11px] text-faint">
                      {moja ? "Ty" : pierwsze}
                      {kontekst ? ` · ${kontekst}` : ""} · <time suppressHydrationWarning>{godzina(w.created_at)}</time>
                    </span>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-[14px]",
                      moja ? "self-end rounded-br-md bg-accent text-accent-fg" : "self-start rounded-bl-md bg-surface-2",
                      w.rodzaj === "szturch" && "border border-dashed border-accent/60",
                    )}
                  >
                    {w.rodzaj === "szturch" ? (
                      <span>
                        👊 {w.tresc ?? (kontekst ? `Szturchnięcie: ${kontekst}` : "Szturchnięcie")}
                      </span>
                    ) : (
                      w.tresc
                    )}
                    <time
                      suppressHydrationWarning
                      className={clsx("mt-0.5 block text-[10px]", moja ? "text-accent-fg/70" : "text-faint")}
                    >
                      {godzina(w.created_at)}
                      {moja && w.odczytano ? " · przeczytane" : ""}
                    </time>
                  </div>
                )}
              </li>
            );
          })}
          <div ref={koniec} />
        </ul>
      )}

      <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SKROTY_WIADOMOSCI.map((s) => (
          <button
            key={s}
            type="button"
            disabled={trwa}
            onClick={() => wyslijTresc(s)}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted transition-transform active:scale-95 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          wyslijTresc(tresc);
        }}
      >
        <Input
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          placeholder={`Napisz do ${pierwsze}`}
          maxLength={200}
        />
        <Button type="submit" variant="primary" disabled={!tresc.trim() || trwa}>
          Wyślij
        </Button>
      </form>
    </Card>
  );
}
