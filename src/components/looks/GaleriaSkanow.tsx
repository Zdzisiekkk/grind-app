"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  SegmentedControl,
  Select,
  Sheet,
  Spinner,
} from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { humanDate } from "@/lib/format";
import {
  PODOCENA_ETYKIETA,
  ZMIANA_ETYKIETA,
  type PodocenaKlucz,
  type WygladAnalysis,
  type Zmiana,
} from "@/lib/ai/wygladSchema";
import type { Ujecie } from "@/lib/database.types";
import { linkiDoZdjec, usunSkan, type LinkiZdjec } from "@/app/(app)/wyglad/actions";

/**
 * Wszystkie skany ze wszystkimi zdjęciami.
 *
 * Wcześniej aplikacja pokazywała jedno porównanie: pierwsze zdjęcie twarzy
 * z ostatnim. Profil, zęby i sylwetka leżały w magazynie i nie dało się ich
 * obejrzeć nigdzie - choć to właśnie na sylwetce najlepiej widać zmianę
 * składu ciała i postawy.
 *
 * Porównanie działa na każdym ujęciu i dowolnych dwóch skanach. Suwak dla
 * twarzy (nałożenie pokazuje drobne różnice), "obok siebie" dla sylwetki
 * (tam kadr rzadko zgadza się co do centymetra).
 */

export type SkanWGalerii = {
  id: string;
  utworzono: string;
  ocena_ogolna: number | null;
  jakosc_ok: boolean | null;
  ujecia: Ujecie[];
  raport: WygladAnalysis | null;
};

const UJECIA: Ujecie[] = ["front", "zeby", "profil", "sylwetka"];

export const UJECIE_ETYKIETA: Record<Ujecie, string> = {
  front: "Na wprost",
  zeby: "Zęby",
  profil: "Profil",
  sylwetka: "Sylwetka",
};

const TON_ZMIANY: Record<Zmiana, "success" | "danger" | "neutral"> = {
  wyraznie_lepiej: "success",
  lepiej: "success",
  bez_zmian: "neutral",
  gorzej: "danger",
  wyraznie_gorzej: "danger",
  brak_porownania: "neutral",
};

type Tryb = "suwak" | "obok";

function data(s: SkanWGalerii) {
  return humanDate(s.utworzono.slice(0, 10));
}

export function GaleriaSkanow({
  galeria,
  maPro,
  onZmiana,
}: {
  galeria: SkanWGalerii[];
  maPro: boolean;
  onZmiana: () => void;
}) {
  const [linki, setLinki] = useState<LinkiZdjec | null>(null);
  const [bladLinkow, setBladLinkow] = useState(false);
  const pobranoO = useRef(0);

  const odswiezLinki = useCallback(() => {
    pobranoO.current = Date.now();
    linkiDoZdjec()
      .then((l) => {
        setLinki(l);
        setBladLinkow(false);
      })
      .catch(() => setBladLinkow(true));
  }, []);

  useEffect(() => {
    odswiezLinki();
  }, [odswiezLinki]);

  /*
   * Link wygasa po pięciu minutach. Zdjęcie, które nie chce się wczytać,
   * prosi o świeże linki - ale najwyżej raz na minutę, żeby jedno naprawdę
   * zepsute zdjęcie nie kręciło pętli żądań.
   */
  const przyBledzieZdjecia = useCallback(() => {
    if (Date.now() - pobranoO.current > 60_000) odswiezLinki();
  }, [odswiezLinki]);

  const url = (skanId: string, u: Ujecie) => linki?.[skanId]?.[u];

  /* ----------------------------- Porównanie ------------------------------ */

  const ujeciaDoPorownania = UJECIA.filter(
    (u) => galeria.filter((s) => s.ujecia.includes(u)).length >= 2,
  );
  const [ujecie, setUjecie] = useState<Ujecie>(ujeciaDoPorownania[0] ?? "front");
  const [nowszyId, setNowszyId] = useState<string | null>(null);
  const [starszyId, setStarszyId] = useState<string | null>(null);
  const [tryb, setTryb] = useState<Tryb>("suwak");
  const [suwak, setSuwak] = useState(50);
  const porownanieRef = useRef<HTMLDivElement>(null);

  // Galeria przychodzi od najnowszego.
  const zTymUjeciem = galeria.filter((s) => s.ujecia.includes(ujecie));
  const nowszy = zTymUjeciem.find((s) => s.id === nowszyId) ?? zTymUjeciem[0];
  const starszy =
    zTymUjeciem.find((s) => s.id === starszyId) ?? zTymUjeciem[zTymUjeciem.length - 1];

  function zmienUjecie(u: Ujecie) {
    setUjecie(u);
    setNowszyId(null);
    setStarszyId(null);
  }

  /* ------------------------------- Arkusz -------------------------------- */

  const [otwartyId, setOtwartyId] = useState<string | null>(null);
  const [ujecieArkusza, setUjecieArkusza] = useState<Ujecie>("front");
  const [potwierdzUsuniecie, setPotwierdzUsuniecie] = useState(false);
  const [pracuje, setPracuje] = useState<"usuwanie" | "analiza" | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const otwarty = galeria.find((s) => s.id === otwartyId) ?? null;

  function otworz(s: SkanWGalerii) {
    setOtwartyId(s.id);
    setUjecieArkusza(s.ujecia.includes("front") ? "front" : s.ujecia[0]);
    setPotwierdzUsuniecie(false);
    setBlad(null);
  }

  function zamknij() {
    if (pracuje) return;
    setOtwartyId(null);
  }

  function porownajZ(s: SkanWGalerii) {
    const inne = galeria.filter((x) => x.id !== s.id && x.ujecia.includes(ujecieArkusza));
    if (!inne.length) return;
    const starszyOd = inne.filter((x) => x.utworzono < s.utworzono);
    setUjecie(ujecieArkusza);
    if (starszyOd.length) {
      setNowszyId(s.id);
      setStarszyId(starszyOd[starszyOd.length - 1].id);
    } else {
      setNowszyId(inne[0].id);
      setStarszyId(s.id);
    }
    setOtwartyId(null);
    requestAnimationFrame(() =>
      porownanieRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  async function usun(s: SkanWGalerii) {
    setPracuje("usuwanie");
    setBlad(null);
    const wynik = await usunSkan(s.id);
    setPracuje(null);
    if (!wynik.ok) {
      setBlad(wynik.blad ?? "Nie udało się usunąć skanu.");
      return;
    }
    setOtwartyId(null);
    onZmiana();
  }

  async function dokonczAnalize(s: SkanWGalerii) {
    setPracuje("analiza");
    setBlad(null);
    const res = await fetch("/api/ai/wyglad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skanId: s.id }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setPracuje(null);
    if (!res?.ok) {
      setBlad(body?.error ?? "Analiza się nie udała.");
      return;
    }
    setOtwartyId(null);
    onZmiana();
  }

  if (galeria.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="🖼️"
          title="Nie ma jeszcze zdjęć"
          description="Po pierwszym skanie znajdziesz tu wszystkie ujęcia - twarz, zęby, profil i sylwetkę."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bladLinkow && (
        <Alert tone="warn">
          Nie udało się wczytać zdjęć.{" "}
          <button type="button" className="underline" onClick={odswiezLinki}>
            Spróbuj ponownie
          </button>
        </Alert>
      )}

      {ujeciaDoPorownania.length > 0 && nowszy && starszy && (
        <div ref={porownanieRef} className="scroll-mt-4">
          <Card title="Przed i po" subtitle="To samo ujęcie z dwóch wybranych skanów">
            <div className="space-y-2.5">
              {ujeciaDoPorownania.length > 1 && (
                <SegmentedControl
                  value={ujecie}
                  onChange={zmienUjecie}
                  options={ujeciaDoPorownania.map((u) => ({ value: u, label: UJECIE_ETYKIETA[u] }))}
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Nowszy">
                  <Select value={nowszy.id} onChange={(e) => setNowszyId(e.target.value)}>
                    {zTymUjeciem.map((s) => (
                      <option key={s.id} value={s.id}>
                        {data(s)}
                        {s.ocena_ogolna != null ? ` · ${s.ocena_ogolna}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Starszy">
                  <Select value={starszy.id} onChange={(e) => setStarszyId(e.target.value)}>
                    {zTymUjeciem.map((s) => (
                      <option key={s.id} value={s.id}>
                        {data(s)}
                        {s.ocena_ogolna != null ? ` · ${s.ocena_ogolna}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <SegmentedControl
                value={tryb}
                onChange={setTryb}
                options={[
                  { value: "suwak", label: "Suwak" },
                  { value: "obok", label: "Obok siebie" },
                ]}
              />

              {nowszy.id === starszy.id ? (
                <p className="text-[13px] text-muted">Wybierz dwa różne skany.</p>
              ) : tryb === "suwak" ? (
                <>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
                    <Obraz
                      url={url(starszy.id, ujecie)}
                      alt={`${UJECIE_ETYKIETA[ujecie]} z ${data(starszy)}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      onBlad={przyBledzieZdjecia}
                    />
                    {/*
                      clip-path zamiast zwężanego pudełka: oba zdjęcia mają
                      zawsze pełny rozmiar i leżą dokładnie na sobie. Poprzednia
                      wersja rozciągała nowsze na szerokość całego okna, więc
                      na komputerze obrazy się rozjeżdżały.
                    */}
                    <Obraz
                      url={url(nowszy.id, ujecie)}
                      alt={`${UJECIE_ETYKIETA[ujecie]} z ${data(nowszy)}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ clipPath: `inset(0 ${100 - suwak}% 0 0)` }}
                      onBlad={przyBledzieZdjecia}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
                      style={{ left: `${suwak}%` }}
                      aria-hidden
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                      {data(nowszy)}
                    </span>
                    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                      {data(starszy)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={suwak}
                    onChange={(e) => setSuwak(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                    aria-label="Suwak porównania zdjęć"
                  />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[nowszy, starszy].map((s) => (
                    <figure key={s.id} className="min-w-0">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
                        <Obraz
                          url={url(s.id, ujecie)}
                          alt={`${UJECIE_ETYKIETA[ujecie]} z ${data(s)}`}
                          className="h-full w-full object-cover"
                          onBlad={przyBledzieZdjecia}
                        />
                      </div>
                      <figcaption className="mt-1 text-center text-[12px] text-muted">
                        {data(s)}
                        {s.ocena_ogolna != null ? ` · ${s.ocena_ogolna}` : ""}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <Card title="Wszystkie skany" subtitle="Dotknij skanu, żeby obejrzeć zdjęcia w pełnym rozmiarze">
        <div className="space-y-2.5">
          {galeria.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => otworz(s)}
              className="block w-full rounded-xl bg-surface-2 p-2.5 text-left"
            >
              <span className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold">{data(s)}</span>
                <span className="flex items-center gap-1.5">
                  {s.jakosc_ok === false && <Chip tone="warn">słabe zdjęcie</Chip>}
                  {s.ocena_ogolna != null ? (
                    <Chip tone="accent">{s.ocena_ogolna}</Chip>
                  ) : (
                    <Chip tone="warn">bez oceny</Chip>
                  )}
                </span>
              </span>
              <span className="grid grid-cols-4 gap-1.5">
                {UJECIA.map((u) =>
                  s.ujecia.includes(u) ? (
                    <span key={u} className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-black">
                      <Obraz
                        url={url(s.id, u)}
                        alt={`${UJECIE_ETYKIETA[u]} z ${data(s)}`}
                        className="h-full w-full object-cover"
                        onBlad={przyBledzieZdjecia}
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                        {UJECIE_ETYKIETA[u]}
                      </span>
                    </span>
                  ) : (
                    <span
                      key={u}
                      className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border px-1 text-center text-[10px] leading-tight text-faint"
                    >
                      bez: {UJECIE_ETYKIETA[u].toLowerCase()}
                    </span>
                  ),
                )}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Sheet
        open={Boolean(otwarty)}
        onClose={zamknij}
        title={otwarty ? `Skan z ${data(otwarty)}` : ""}
      >
        {otwarty && (
          <div className="space-y-3">
            {otwarty.ujecia.length > 1 && (
              <SegmentedControl
                value={ujecieArkusza}
                onChange={setUjecieArkusza}
                options={UJECIA.filter((u) => otwarty.ujecia.includes(u)).map((u) => ({
                  value: u,
                  label: UJECIE_ETYKIETA[u],
                }))}
              />
            )}

            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
              <Obraz
                url={url(otwarty.id, ujecieArkusza)}
                alt={`${UJECIE_ETYKIETA[ujecieArkusza]} z ${data(otwarty)}`}
                className="h-full w-full object-contain"
                onBlad={przyBledzieZdjecia}
              />
            </div>

            {otwarty.ocena_ogolna != null && otwarty.raport ? (
              <OcenySkanu skan={otwarty} />
            ) : (
              <Alert tone="warn">
                Ten skan nie ma oceny - analiza się wtedy nie udała. Zdjęcia są zapisane, więc
                można ją dokończyć.
              </Alert>
            )}

            {blad && <Alert tone="danger">{blad}</Alert>}

            <div className="flex flex-col gap-2">
              {galeria.some((x) => x.id !== otwarty.id && x.ujecia.includes(ujecieArkusza)) && (
                <Button onClick={() => porownajZ(otwarty)} disabled={Boolean(pracuje)}>
                  Porównaj to ujęcie z innym skanem
                </Button>
              )}

              {otwarty.ocena_ogolna == null && maPro && (
                <Button
                  variant="primary"
                  onClick={() => void dokonczAnalize(otwarty)}
                  loading={pracuje === "analiza"}
                  disabled={Boolean(pracuje)}
                >
                  Dokończ analizę
                </Button>
              )}

              {!potwierdzUsuniecie ? (
                <Button
                  variant="ghost"
                  onClick={() => setPotwierdzUsuniecie(true)}
                  disabled={Boolean(pracuje)}
                >
                  Usuń skan
                </Button>
              ) : (
                <div className="rounded-xl bg-[var(--danger-soft)] p-3">
                  <p className="text-[13px]">
                    Zdjęcia i ocena znikną na zawsze. Miejsce w miesięcznej puli nie wraca - analiza
                    już się odbyła.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setPotwierdzUsuniecie(false)}
                      disabled={Boolean(pracuje)}
                    >
                      Zostaw
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => void usun(otwarty)}
                      loading={pracuje === "usuwanie"}
                      disabled={Boolean(pracuje)}
                    >
                      Usuń na zawsze
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Oceny jednego skanu w arkuszu - krócej niż pełny raport. */
function OcenySkanu({ skan }: { skan: SkanWGalerii }) {
  const raport = skan.raport;
  if (!raport) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-semibold">Ocena ogólna</span>
        <span className="tabular text-[20px] font-bold">{skan.ocena_ogolna}</span>
      </div>
      {raport.porownanie_ogolne && (
        <p className="text-[13px] text-muted">{raport.porownanie_ogolne}</p>
      )}
      <div className="space-y-1.5">
        {raport.podoceny.map((p) => (
          <div key={p.klucz} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate">
              {PODOCENA_ETYKIETA[p.klucz as PodocenaKlucz] ?? p.klucz}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {p.zmiana && p.zmiana !== "brak_porownania" && (
                <Chip tone={TON_ZMIANY[p.zmiana]}>{ZMIANA_ETYKIETA[p.zmiana]}</Chip>
              )}
              <span className="tabular w-7 text-right font-bold">{p.ocena}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">{raport.podsumowanie}</p>
    </div>
  );
}

/** Zdjęcie z podpisanego linku; do czasu jego przyjścia - kółko ładowania. */
function Obraz({
  url,
  alt,
  className,
  style,
  onBlad,
}: {
  url: string | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onBlad: () => void;
}) {
  if (!url) {
    return (
      <span className={clsx("flex items-center justify-center text-white/60", className)} style={style}>
        <Spinner />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className} style={style} onError={onBlad} loading="lazy" />
  );
}
