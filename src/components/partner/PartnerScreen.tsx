"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, Input } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { createClient } from "@/lib/supabase/client";
import { humanDate, num } from "@/lib/format";
import {
  dolaczKodem,
  odczytaneWiadomosci,
  rozlacz,
  ustawAlerty,
  wygenerujKod,
  wyslijDoPartnera,
} from "@/app/(app)/partner/actions";
import type {
  PartnerDzien,
  PartnerKontekst,
  PartnerStan,
  PartnerWiadomosc,
  PartnerWspolny,
  PartnerWspolnyLog,
} from "@/lib/database.types";

const TYPY_POSILKOW: Record<string, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

const REAKCJE = ["👏", "🔥", "💪"] as const;

type Props = {
  stan: PartnerStan;
  userId: string;
  dzis: string;
  dzien: string;
  partner?: PartnerDzien | null;
  wspolne?: PartnerWspolny[];
  logiWspolne?: PartnerWspolnyLog[];
  wiadomosci?: PartnerWiadomosc[];
};

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
  wspolne = [],
  logiWspolne = [],
  wiadomosci = [],
}: Props & { imie: string; alerty: boolean }) {
  const router = useRouter();
  const [info, setInfo] = useState<string | null>(null);
  const [trwa, start] = useTransition();

  // Otwarcie ekranu = przeczytane. Efekt, a nie zapis w renderze serwera.
  useEffect(() => {
    void odczytaneWiadomosci();
  }, []);

  const nieprzeczytane = wiadomosci.filter((w) => w.do_id === userId && !w.odczytano);

  function wyslij(
    rodzaj: "szturch" | "reakcja" | "wiadomosc",
    kontekst: PartnerKontekst,
    tresc?: string,
    emoji?: string,
  ) {
    start(async () => {
      const w = await wyslijDoPartnera(rodzaj, kontekst, tresc, emoji);
      setInfo(
        w.ok
          ? rodzaj === "szturch"
            ? `Szturchnięte: ${imie} dostanie powiadomienie.`
            : "Wysłane."
          : w.blad,
      );
    });
  }

  const nawykiZrobione = partner?.nawyki.filter((n) => n.zrobione >= n.cel).length ?? 0;
  const skinZrobione = partner?.skincare.filter((s) => s.zrobione).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{imie}</h1>
          <p className="text-[13px] text-muted">Wasz wspólny lock-in</p>
        </div>
        <div className="flex gap-1.5">
          <Link href="/partner" aria-current={dzien === dzis}>
            <Chip tone={dzien === dzis ? "accent" : "neutral"}>Dziś</Chip>
          </Link>
          <Link href={`/partner?d=${addDays(dzis, -1)}`} aria-current={dzien !== dzis}>
            <Chip tone={dzien !== dzis ? "accent" : "neutral"}>Wczoraj</Chip>
          </Link>
        </div>
      </header>

      {nieprzeczytane.length > 0 && (
        <Alert tone="info">
          {nieprzeczytane.length === 1
            ? "Masz nową wiadomość od partnera."
            : `Masz ${nieprzeczytane.length} nowe wiadomości od partnera.`}
        </Alert>
      )}
      {info && <Alert tone="info">{info}</Alert>}

      {partner && (
        <>
          <Karta
            tytul="Jedzenie"
            kontekst="posilek"
            reaguj={wyslij}
            blokada={trwa}
            szturchnij={partner.kcal === 0}
            podtytul={
              partner.cel_kcal
                ? `${num(partner.kcal)} z ${num(partner.cel_kcal)} kcal · białko ${num(partner.bialko)} g`
                : `${num(partner.kcal)} kcal · białko ${num(partner.bialko)} g`
            }
          >
            {partner.posilki.length === 0 ? (
              <p className="text-[13px] text-muted">Nic jeszcze nie zapisane.</p>
            ) : (
              <ul className="divide-y divide-border text-[13px]">
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
            <p className="mt-2 text-[12px] text-faint">
              Woda: {num(partner.woda_ml)} z {num(partner.cel_wody_ml)} ml
            </p>
          </Karta>

          <Karta
            tytul="Trening"
            kontekst="trening"
            reaguj={wyslij}
            blokada={trwa}
            szturchnij={partner.treningi.length === 0}
            podtytul={partner.treningi.length === 0 ? "Jeszcze bez treningu" : undefined}
          >
            {partner.treningi.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1 text-[14px]">
                <span className="font-medium">{t.nazwa}</span>
                <span className="text-[12px] text-muted">
                  {t.zakonczony ? `${t.minuty ?? "?"} min · ${t.serie} serii` : `w trakcie · ${t.serie} serii`}
                </span>
              </div>
            ))}
          </Karta>

          <Karta
            tytul="Nawyki"
            kontekst="nawyk"
            reaguj={wyslij}
            blokada={trwa}
            szturchnij={partner.nawyki.length > nawykiZrobione}
            podtytul={partner.nawyki.length ? `${nawykiZrobione} z ${partner.nawyki.length}` : "Brak nawyków na dziś"}
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
            reaguj={wyslij}
            blokada={trwa}
            szturchnij={partner.skincare.length > skinZrobione}
            podtytul={partner.skincare.length ? `${skinZrobione} z ${partner.skincare.length}` : "Brak rutyn"}
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
        </>
      )}

      <Wspolne
        wspolne={wspolne}
        logi={logiWspolne}
        userId={userId}
        dzis={dzis}
        imie={imie}
        szturchnij={() => wyslij("szturch", "nawyk", "Wspólny nawyk czeka")}
      />

      <Wiadomosci wiadomosci={wiadomosci} userId={userId} imie={imie} wyslij={wyslij} trwa={trwa} />

      <Card title="Ustawienia pary">
        <label className="flex items-start gap-2.5 text-[14px]">
          <input
            type="checkbox"
            defaultChecked={alerty}
            onChange={(e) => {
              const v = e.target.checked;
              start(async () => {
                await ustawAlerty(v);
                router.refresh();
              });
            }}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
          />
          <span>
            Wieczorny alert o zaległościach partnera
            <span className="block text-[12px] text-muted">
              O 20:30, jeśli {imie} ma jeszcze nieodhaczone nawyki albo skin care.
            </span>
          </span>
        </label>
        <div className="mt-4 border-t border-border pt-3">
          <Button
            variant="danger"
            size="sm"
            loading={trwa}
            onClick={() => {
              if (!confirm(`Rozłączyć się z ${imie}? Wspólne nawyki i wiadomości znikną.`)) return;
              start(async () => {
                await rozlacz();
                router.refresh();
              });
            }}
          >
            Rozłącz parę
          </Button>
        </div>
      </Card>
    </div>
  );
}

function addDays(iso: string, d: number): string {
  const t = new Date(`${iso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}

/* ------------------------------- Karta dnia ------------------------------ */

function Karta({
  tytul,
  podtytul,
  kontekst,
  reaguj,
  blokada,
  szturchnij,
  children,
}: {
  tytul: string;
  podtytul?: string;
  kontekst: PartnerKontekst;
  reaguj: (rodzaj: "szturch" | "reakcja" | "wiadomosc", kontekst: PartnerKontekst, tresc?: string, emoji?: string) => void;
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
            onClick={() => reaguj("reakcja", kontekst, undefined, e)}
            className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-[17px] active:scale-95 disabled:opacity-50"
            aria-label={`Reakcja ${e}`}
          >
            {e}
          </button>
        ))}
        {szturchnij && (
          <Button size="sm" className="ml-auto" disabled={blokada} onClick={() => reaguj("szturch", kontekst)}>
            👊 Szturchnij
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ----------------------------- Wspólne nawyki ---------------------------- */

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

  async function dodaj() {
    if (!nazwa.trim()) return;
    const { data: para } = await supabase.from("partner_pary").select("para_id").eq("user_id", userId).maybeSingle();
    if (!para) return;
    await supabase
      .from("partner_wspolne")
      .insert({ para_id: para.para_id, nazwa: nazwa.trim(), autor_id: userId });
    setNazwa("");
    router.refresh();
  }

  async function usun(w: PartnerWspolny) {
    if (!confirm(`Usunąć wspólny nawyk "${w.nazwa}"?`)) return;
    await supabase.from("partner_wspolne").delete().eq("id", w.id);
    router.refresh();
  }

  const komuBrakuje = wspolne.some((w) => zrobione(w.id, "ja") && !zrobione(w.id, "on"));

  return (
    <Card title="Wspólne nawyki" subtitle="Jeden nawyk, dwa odhaczenia">
      {wspolne.length === 0 ? (
        <p className="text-[13px] text-muted">Dodaj coś, co robicie razem, np. spacer, kreatyna, woda.</p>
      ) : (
        <ul className="space-y-1.5">
          {wspolne.map((w) => (
            <li key={w.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={zrobione(w.id, "ja")}
                onChange={() => void przelacz(w)}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                aria-label={`Ja: ${w.nazwa}`}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                {w.ikona} {w.nazwa}
              </span>
              <Chip tone={zrobione(w.id, "on") ? "success" : "neutral"}>
                {imie.split(" ")[0]} {zrobione(w.id, "on") ? "✓" : "…"}
              </Chip>
              <button
                type="button"
                onClick={() => void usun(w)}
                className="text-faint"
                aria-label={`Usuń ${w.nazwa}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Input value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="Nowy wspólny nawyk" maxLength={60} />
        <Button onClick={() => void dodaj()} disabled={!nazwa.trim()}>
          Dodaj
        </Button>
      </div>
      {komuBrakuje && (
        <Button size="sm" className="mt-2" onClick={szturchnij}>
          👊 Szturchnij {imie.split(" ")[0]}
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------ Wiadomości ------------------------------- */

function Wiadomosci({
  wiadomosci,
  userId,
  imie,
  wyslij,
  trwa,
}: {
  wiadomosci: PartnerWiadomosc[];
  userId: string;
  imie: string;
  wyslij: (rodzaj: "szturch" | "reakcja" | "wiadomosc", kontekst: PartnerKontekst, tresc?: string, emoji?: string) => void;
  trwa: boolean;
}) {
  const [tresc, setTresc] = useState("");

  function opis(w: PartnerWiadomosc): string {
    if (w.rodzaj === "szturch") return w.tresc ?? "👊 Szturchnięcie";
    if (w.rodzaj === "reakcja") return `${w.emoji ?? "👏"}${w.kontekst !== "ogolne" ? ` (${w.kontekst})` : ""}`;
    return w.tresc ?? "";
  }

  return (
    <Card title="Wiadomości">
      <div className="flex gap-2">
        <Input
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          placeholder={`Napisz do ${imie.split(" ")[0]}`}
          maxLength={200}
        />
        <Button
          variant="primary"
          disabled={!tresc.trim() || trwa}
          onClick={() => {
            wyslij("wiadomosc", "ogolne", tresc.trim());
            setTresc("");
          }}
        >
          Wyślij
        </Button>
      </div>
      {wiadomosci.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {wiadomosci.map((w) => {
            const moja = w.od_id === userId;
            return (
              <li
                key={w.id}
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-[14px]",
                  moja ? "ml-auto bg-accent-soft" : "bg-surface-2",
                )}
              >
                {opis(w)}
                <span className="block text-[11px] text-faint">{humanDate(w.created_at.slice(0, 10))}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
