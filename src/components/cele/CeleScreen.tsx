"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Select,
  Sheet,
  Textarea,
  Toast,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { humanDate } from "@/lib/format";
import {
  HORYZONTY,
  METRYKI,
  postepCelu,
  terminDlaHoryzontu,
  wartosc,
  type DaneDoCelow,
  type PostepCelu,
} from "@/lib/cele";
import type { Cel, CelKamien, CelMetryka } from "@/lib/database.types";

/**
 * Zakładka "Cele".
 *
 * Każdy cel pokazuje dwie rzeczy obok siebie: ile drogi za Tobą i ile czasu
 * minęło. Sama liczba "40%" nic nie mówi - 40% w połowie terminu to
 * spóźnienie, 40% po miesiącu z dwunastu to zapas.
 */

export type CeleDane = {
  userId: string;
  dzis: string;
  cele: Cel[];
  kamienie: CelKamien[];
  dane: DaneDoCelow;
  nawyki: Array<{ id: string; name: string; icon: string }>;
  tematy: Array<{ id: string; nazwa: string; ikona: string }>;
};

const liczbaZTekstu = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
};

const ulamek = (v: number) =>
  v.toLocaleString("pl-PL", { maximumFractionDigits: v < 10 ? 1 : 0 });

function dniDo(dzis: string, termin: string) {
  return Math.round(
    (new Date(termin + "T00:00:00Z").getTime() - new Date(dzis + "T00:00:00Z").getTime()) / 86_400_000,
  );
}

const STAN: Record<PostepCelu["stan"], { etykieta: string; ton: "success" | "accent" | "warn" | "neutral" }> = {
  osiagniety: { etykieta: "cel osiągnięty", ton: "success" },
  na_czas: { etykieta: "na czas", ton: "accent" },
  w_tyle: { etykieta: "w tyle", ton: "warn" },
  brak_danych: { etykieta: "brak danych", ton: "neutral" },
};

const BRAK_DANYCH: Partial<Record<CelMetryka, string>> = {
  waga: "Zapisz wagę na ekranie Dziś - cel liczy postęp z ostatniego pomiaru.",
  majatek: "Wpisz stan majątku w Finansach - stąd bierze się postęp.",
  nawyk: "Nawyk podpięty pod ten cel został usunięty.",
  kamienie: "Dodaj pierwszy krok milowy.",
};

type Kreator = {
  metryka: CelMetryka | null;
  tytul: string;
  horyzont: "kwartal" | "rok" | "wlasny";
  termin: string;
  cel: string;
  start: string;
  jednostka: string;
  habitId: string;
  tematId: string;
  kroki: string;
};

export function CeleScreen(d: CeleDane) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const aktywne = d.cele.filter((c) => c.status === "aktywny");
  const zamkniete = d.cele.filter((c) => c.status !== "aktywny");
  const kamienieCelu = (id: string) =>
    d.kamienie.filter((k) => k.cel_id === id).sort((a, b) => a.kolejnosc - b.kolejnosc);

  /* ------------------------------- Kreator -------------------------------- */

  const pustyKreator = (): Kreator => ({
    metryka: null,
    tytul: "",
    horyzont: "kwartal",
    termin: terminDlaHoryzontu("kwartal", d.dzis),
    cel: "",
    start: "0",
    jednostka: "",
    habitId: d.nawyki[0]?.id ?? "",
    tematId: "",
    kroki: "",
  });
  const [kreator, setKreator] = useState<Kreator | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  async function utworz() {
    if (!kreator?.metryka) return;
    const k = kreator;
    const m = k.metryka as CelMetryka;
    setBlad(null);

    const tytul = k.tytul.trim();
    if (!tytul) return setBlad("Cel potrzebuje nazwy.");
    if (k.termin < d.dzis) return setBlad("Termin nie może być w przeszłości.");

    const docelowa = m === "kamienie" ? null : liczbaZTekstu(k.cel);
    if (m !== "kamienie" && docelowa == null) return setBlad("Podaj wartość docelową.");
    if (METRYKI[m].licznik && (docelowa ?? 0) <= 0) return setBlad("Wartość docelowa musi być większa od zera.");
    if (m === "waga" && d.dane.waga == null) return setBlad("Najpierw zapisz wagę - cel musi wiedzieć, skąd startujesz.");
    if (m === "majatek" && d.dane.netto == null) return setBlad("Najpierw wpisz majątek w Finansach.");
    if (m === "nawyk" && !k.habitId) return setBlad("Wybierz nawyk.");

    const kroki = k.kroki
      .split("\n")
      .map((l) => l.trim().slice(0, 120))
      .filter(Boolean);
    if (m === "kamienie" && !kroki.length) return setBlad("Wpisz przynajmniej jeden krok.");

    /*
     * Punkt startu zapamiętany w chwili tworzenia. Bez niego "waga 78 kg"
     * nie ma od czego liczyć drogi, a liczenie od pierwszego pomiaru w historii
     * pokazywałoby postęp zrobiony, zanim cel w ogóle powstał.
     */
    const start =
      m === "waga" ? d.dane.waga : m === "majatek" ? d.dane.netto : m === "wlasna" ? (liczbaZTekstu(k.start) ?? 0) : null;

    setZapisuje(true);
    const supabase = createClient();
    const { data: nowy, error } = await supabase
      .from("cele")
      .insert({
        user_id: d.userId,
        tytul,
        horyzont: k.horyzont,
        metryka: m,
        termin: k.termin,
        wartosc_cel: docelowa,
        wartosc_start: start,
        wartosc_reczna: m === "wlasna" ? start : null,
        jednostka: m === "wlasna" ? k.jednostka.trim() || null : null,
        habit_id: m === "nawyk" ? k.habitId : null,
        temat_id: m === "nauka" && k.tematId ? k.tematId : null,
      })
      .select("id")
      .single();

    if (!error && nowy && kroki.length) {
      await supabase
        .from("cele_kamienie")
        .insert(kroki.map((tytulKroku, i) => ({ user_id: d.userId, cel_id: nowy.id, tytul: tytulKroku, kolejnosc: i })));
    }
    setZapisuje(false);
    if (error) return setBlad("Nie udało się zapisać celu.");

    setKreator(null);
    setToast("Cel zapisany.");
    router.refresh();
  }

  /* ------------------------------- Akcje ---------------------------------- */

  async function ustawStatus(c: Cel, status: Cel["status"]) {
    await createClient()
      .from("cele")
      .update({ status, osiagniety_at: status === "osiagniety" ? new Date().toISOString() : null })
      .eq("id", c.id);
    setToast(status === "osiagniety" ? "Gratulacje - cel odhaczony. 🏁" : status === "aktywny" ? "Cel wraca do gry." : "Cel odłożony.");
    router.refresh();
  }

  const [edycja, setEdycja] = useState<{ cel: Cel; tytul: string; termin: string; docelowa: string } | null>(null);
  const [potwierdzUsun, setPotwierdzUsun] = useState(false);

  async function zapiszEdycje() {
    if (!edycja) return;
    const docelowa = edycja.cel.metryka === "kamienie" ? null : liczbaZTekstu(edycja.docelowa);
    if (!edycja.tytul.trim() || (edycja.cel.metryka !== "kamienie" && docelowa == null)) return;
    if (edycja.termin < edycja.cel.od) return;
    await createClient()
      .from("cele")
      .update({ tytul: edycja.tytul.trim(), termin: edycja.termin, wartosc_cel: docelowa })
      .eq("id", edycja.cel.id);
    setEdycja(null);
    router.refresh();
  }

  async function usunCel(id: string) {
    await createClient().from("cele").delete().eq("id", id);
    setEdycja(null);
    router.refresh();
  }

  async function zapiszReczna(c: Cel, tekst: string) {
    const v = liczbaZTekstu(tekst);
    if (v == null) return;
    await createClient().from("cele").update({ wartosc_reczna: v }).eq("id", c.id);
    router.refresh();
  }

  async function przelaczKrok(k: CelKamien) {
    await createClient()
      .from("cele_kamienie")
      .update({ zrobione_at: k.zrobione_at ? null : new Date().toISOString() })
      .eq("id", k.id);
    router.refresh();
  }

  async function dodajKrok(c: Cel, tytul: string) {
    const t = tytul.trim().slice(0, 120);
    if (!t) return;
    await createClient()
      .from("cele_kamienie")
      .insert({ user_id: d.userId, cel_id: c.id, tytul: t, kolejnosc: kamienieCelu(c.id).length });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {aktywne.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎯"
            title="Nie masz jeszcze celu"
            description="Cel spina resztę aplikacji: waga, treningi, książki, nauka czy majątek liczą się do niego same."
            action={
              <Button variant="primary" onClick={() => setKreator(pustyKreator())}>
                Ustal pierwszy cel
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {aktywne.map((c) => (
            <KartaCelu
              key={c.id}
              cel={c}
              dzis={d.dzis}
              postep={postepCelu(c, d.dane, kamienieCelu(c.id))}
              kamienie={kamienieCelu(c.id)}
              nazwaNawyku={d.nawyki.find((n) => n.id === c.habit_id)}
              nazwaTematu={d.tematy.find((t) => t.id === c.temat_id)}
              onStatus={(s) => void ustawStatus(c, s)}
              onEdytuj={() => {
                setPotwierdzUsun(false);
                setEdycja({
                  cel: c,
                  tytul: c.tytul,
                  termin: c.termin,
                  docelowa: c.wartosc_cel != null ? String(c.wartosc_cel).replace(".", ",") : "",
                });
              }}
              onReczna={(t) => void zapiszReczna(c, t)}
              onKrok={(k) => void przelaczKrok(k)}
              onNowyKrok={(t) => void dodajKrok(c, t)}
            />
          ))}
          <Button block onClick={() => setKreator(pustyKreator())}>
            + Nowy cel
          </Button>
        </>
      )}

      {zamkniete.length > 0 && (
        <Card title="Zamknięte">
          <ul className="space-y-2">
            {zamkniete.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[13px]">
                <span aria-hidden>{c.status === "osiagniety" ? "🏁" : "💤"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.tytul}</span>
                  <span className="block text-[12px] text-faint">
                    {c.status === "osiagniety" && c.osiagniety_at
                      ? `osiągnięty ${humanDate(c.osiagniety_at.slice(0, 10))}`
                      : "odłożony"}
                  </span>
                </span>
                <button type="button" className="text-accent" onClick={() => void ustawStatus(c, "aktywny")}>
                  Przywróć
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------ Kreator ----------------------------- */}
      <Sheet open={Boolean(kreator)} onClose={() => setKreator(null)} title="Nowy cel">
        {kreator && !kreator.metryka && (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(METRYKI) as CelMetryka[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setKreator({ ...kreator, metryka: m })}
                className="rounded-xl bg-surface-2 p-3 text-left"
              >
                <span className="text-2xl" aria-hidden>
                  {METRYKI[m].ikona}
                </span>
                <span className="mt-1 block text-[14px] font-semibold">{METRYKI[m].etykieta}</span>
                <span className="block text-[12px] leading-snug text-muted">{METRYKI[m].opis}</span>
              </button>
            ))}
          </div>
        )}

        {kreator?.metryka && (
          <div className="space-y-3">
            <button
              type="button"
              className="text-[13px] text-muted"
              onClick={() => setKreator({ ...kreator, metryka: null })}
            >
              ‹ {METRYKI[kreator.metryka].ikona} {METRYKI[kreator.metryka].etykieta}
            </button>

            <Field label="Nazwa celu">
              <Input
                value={kreator.tytul}
                onChange={(e) => setKreator({ ...kreator, tytul: e.target.value.slice(0, 100) })}
                placeholder={
                  {
                    waga: "np. Zejść do 78 kg",
                    majatek: "np. Pierwsze 20 000 zł",
                    treningi: "np. 40 treningów w kwartale",
                    ksiazki: "np. 12 książek w tym roku",
                    nauka: "np. 100 godzin angielskiego",
                    nawyk: "np. Medytacja 60 dni",
                    wlasna: "np. Przebiec 10 km poniżej 50 min",
                    kamienie: "np. Obronić licencjat",
                  }[kreator.metryka]
                }
              />
            </Field>

            <Field label="Horyzont">
              <SegmentedControl
                value={kreator.horyzont}
                onChange={(h) =>
                  setKreator({
                    ...kreator,
                    horyzont: h,
                    termin: h === "wlasny" ? kreator.termin : terminDlaHoryzontu(h, d.dzis),
                  })
                }
                options={HORYZONTY.map((h) => ({ value: h.id, label: h.etykieta }))}
              />
            </Field>

            <Field label="Termin">
              <Input
                type="date"
                value={kreator.termin}
                min={d.dzis}
                onChange={(e) => setKreator({ ...kreator, termin: e.target.value, horyzont: "wlasny" })}
              />
            </Field>

            {kreator.metryka === "nawyk" &&
              (d.nawyki.length ? (
                <Field label="Który nawyk">
                  <Select value={kreator.habitId} onChange={(e) => setKreator({ ...kreator, habitId: e.target.value })}>
                    {d.nawyki.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.icon} {n.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Alert tone="warn">Najpierw dodaj nawyk w zakładce Nawyki.</Alert>
              ))}

            {kreator.metryka === "nauka" && d.tematy.length > 0 && (
              <Field label="Przedmiot">
                <Select value={kreator.tematId} onChange={(e) => setKreator({ ...kreator, tematId: e.target.value })}>
                  <option value="">Cała nauka</option>
                  {d.tematy.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ikona} {t.nazwa}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {kreator.metryka === "wlasna" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Jednostka">
                  <Input
                    value={kreator.jednostka}
                    onChange={(e) => setKreator({ ...kreator, jednostka: e.target.value.slice(0, 20) })}
                    placeholder="np. km"
                  />
                </Field>
                <Field label="Stan dziś">
                  <Input inputMode="decimal" value={kreator.start} onChange={(e) => setKreator({ ...kreator, start: e.target.value })} />
                </Field>
              </div>
            )}

            {kreator.metryka !== "kamienie" ? (
              <Field
                label={`Wartość docelowa${METRYKI[kreator.metryka].jednostka ? ` (${METRYKI[kreator.metryka].jednostka})` : ""}`}
                hint={
                  kreator.metryka === "waga" && d.dane.waga != null
                    ? `Startujesz z ${ulamek(d.dane.waga)} kg.`
                    : kreator.metryka === "majatek" && d.dane.netto != null
                      ? `Dziś: ${wartosc(Math.round(d.dane.netto), "zł")}.`
                      : undefined
                }
              >
                <Input inputMode="decimal" value={kreator.cel} onChange={(e) => setKreator({ ...kreator, cel: e.target.value })} />
              </Field>
            ) : (
              <Field label="Kroki milowe" hint="Każda linia to jeden krok. Dopiszesz kolejne później.">
                <Textarea
                  rows={4}
                  value={kreator.kroki}
                  onChange={(e) => setKreator({ ...kreator, kroki: e.target.value })}
                  placeholder={"Wybrać temat pracy\nNapisać pierwszy rozdział\nOddać do promotora"}
                />
              </Field>
            )}

            {blad && <Alert tone="danger">{blad}</Alert>}
            <Button variant="primary" block onClick={() => void utworz()} loading={zapisuje}>
              Zapisz cel
            </Button>
          </div>
        )}
      </Sheet>

      {/* ------------------------------ Edycja ------------------------------ */}
      <Sheet open={Boolean(edycja)} onClose={() => setEdycja(null)} title="Edytuj cel">
        {edycja && (
          <div className="space-y-3">
            <Field label="Nazwa">
              <Input value={edycja.tytul} onChange={(e) => setEdycja({ ...edycja, tytul: e.target.value.slice(0, 100) })} />
            </Field>
            <Field label="Termin">
              <Input
                type="date"
                value={edycja.termin}
                min={edycja.cel.od}
                onChange={(e) => setEdycja({ ...edycja, termin: e.target.value })}
              />
            </Field>
            {edycja.cel.metryka !== "kamienie" && (
              <Field label="Wartość docelowa">
                <Input inputMode="decimal" value={edycja.docelowa} onChange={(e) => setEdycja({ ...edycja, docelowa: e.target.value })} />
              </Field>
            )}
            <Button variant="primary" block onClick={() => void zapiszEdycje()}>
              Zapisz
            </Button>
            <Button block variant="ghost" onClick={() => { void ustawStatus(edycja.cel, "porzucony"); setEdycja(null); }}>
              Odłóż cel
            </Button>
            {!potwierdzUsun ? (
              <Button block variant="ghost" onClick={() => setPotwierdzUsun(true)}>
                Usuń cel
              </Button>
            ) : (
              <Button block variant="danger" onClick={() => void usunCel(edycja.cel.id)}>
                Usuń na zawsze
              </Button>
            )}
          </div>
        )}
      </Sheet>

      {toast && <Toast key={toast}>{toast}</Toast>}
    </div>
  );
}

function KartaCelu({
  cel,
  dzis,
  postep,
  kamienie,
  nazwaNawyku,
  nazwaTematu,
  onStatus,
  onEdytuj,
  onReczna,
  onKrok,
  onNowyKrok,
}: {
  cel: Cel;
  dzis: string;
  postep: PostepCelu;
  kamienie: CelKamien[];
  nazwaNawyku?: { name: string; icon: string };
  nazwaTematu?: { nazwa: string; ikona: string };
  onStatus: (s: Cel["status"]) => void;
  onEdytuj: () => void;
  onReczna: (tekst: string) => void;
  onKrok: (k: CelKamien) => void;
  onNowyKrok: (tytul: string) => void;
}) {
  const meta = METRYKI[cel.metryka];
  const jednostka = cel.metryka === "wlasna" ? cel.jednostka : meta.jednostka;
  const [reczna, setReczna] = useState("");
  const [nowyKrok, setNowyKrok] = useState("");
  const zostalo = dniDo(dzis, cel.termin);
  const stan = STAN[postep.stan];

  const podpis =
    cel.metryka === "kamienie"
      ? `${postep.aktualna ?? 0} z ${postep.cel} kroków`
      : meta.licznik
        ? `${wartosc(postep.aktualna, null)} z ${wartosc(postep.cel, jednostka)}`
        : `${wartosc(postep.aktualna, jednostka)} · cel ${wartosc(postep.cel, jednostka)} · start ${wartosc(postep.start, jednostka)}`;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {meta.ikona}
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onEdytuj} className="block text-left text-[15px] font-semibold leading-tight">
            {cel.tytul}
          </button>
          <p className="mt-0.5 text-[12px] text-muted">
            {zostalo > 0 ? `do ${humanDate(cel.termin)} · zostało ${zostalo} dni` : zostalo === 0 ? "termin dziś" : `termin minął ${humanDate(cel.termin)}`}
            {nazwaNawyku && ` · ${nazwaNawyku.icon} ${nazwaNawyku.name}`}
            {nazwaTematu && ` · ${nazwaTematu.ikona} ${nazwaTematu.nazwa}`}
          </p>
        </div>
        <Chip tone={stan.ton}>{stan.etykieta}</Chip>
      </div>

      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={clsx(
            "h-full rounded-full",
            postep.stan === "osiagniety" ? "bg-success" : postep.stan === "w_tyle" ? "bg-warn" : "bg-accent",
          )}
          style={{ width: `${Math.round(postep.procent * 100)}%` }}
        />
        {/* Kreska: gdzie byłbyś, idąc równym tempem od startu do terminu. */}
        <div
          className="absolute inset-y-0 w-0.5 text-faint"
          style={{ left: `${Math.round(postep.czas * 100)}%`, background: "currentColor" }}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[12px]">
        <span className="tabular text-muted">{podpis}</span>
        <span className="tabular font-semibold">{Math.round(postep.procent * 100)}%</span>
      </div>

      {postep.stan === "brak_danych" && BRAK_DANYCH[cel.metryka] && (
        <p className="mt-2 text-[12px] text-faint">{BRAK_DANYCH[cel.metryka]}</p>
      )}

      {postep.naTydzien != null && postep.stan !== "brak_danych" && cel.metryka !== "kamienie" && (
        <p className="mt-2 text-[12px] text-faint">
          Żeby zdążyć: {ulamek(Math.abs(postep.naTydzien))} {jednostka ?? ""} tygodniowo
          {postep.stan === "w_tyle" ? " - trzeba przyspieszyć." : "."}
        </p>
      )}

      {cel.metryka === "wlasna" && (
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1">
            <Input
              inputMode="decimal"
              value={reczna}
              onChange={(e) => setReczna(e.target.value)}
              placeholder={`Aktualnie${jednostka ? ` (${jednostka})` : ""}`}
            />
          </div>
          <Button
            onClick={() => {
              onReczna(reczna);
              setReczna("");
            }}
            disabled={!reczna.trim()}
          >
            Zapisz
          </Button>
        </div>
      )}

      {cel.metryka === "kamienie" && (
        <div className="mt-3 space-y-1.5">
          {kamienie.map((k) => (
            <label key={k.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(k.zrobione_at)}
                onChange={() => onKrok(k)}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              <span className={clsx("text-[14px]", k.zrobione_at && "text-muted line-through")}>{k.tytul}</span>
            </label>
          ))}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input value={nowyKrok} onChange={(e) => setNowyKrok(e.target.value)} placeholder="Kolejny krok" />
            </div>
            <Button
              onClick={() => {
                onNowyKrok(nowyKrok);
                setNowyKrok("");
              }}
              disabled={!nowyKrok.trim()}
            >
              Dodaj
            </Button>
          </div>
        </div>
      )}

      {postep.stan === "osiagniety" && (
        <Button variant="success" block className="mt-3" onClick={() => onStatus("osiagniety")}>
          🏁 Odhacz jako osiągnięty
        </Button>
      )}
    </Card>
  );
}
