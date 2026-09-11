"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Sheet,
  Textarea,
  Toast,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { humanDate } from "@/lib/format";
import {
  ETAP_OPANOWANE,
  RODZAJE_TEMATOW,
  doPowtorki,
  minuty as fmtMinuty,
  minutyWTygodniu,
  passaNauki,
  pierwszaPowtorka,
  poPowtorce,
  type RodzajTematu,
} from "@/lib/nauka";
import type { NaukaPowtorka, NaukaSesja, NaukaTemat } from "@/lib/database.types";

/**
 * Zakładka "Nauka".
 *
 * Na górze powtórki na dziś - bo to jedyna rzecz w tej zakładce, która
 * przepada, jeśli się jej nie zrobi dzisiaj. Przerwa w powtórkach kosztuje
 * więcej niż przerwa w nauce nowego.
 */

export type NaukaDane = {
  userId: string;
  dzis: string;
  tematy: NaukaTemat[];
  sesje: NaukaSesja[];
  powtorki: NaukaPowtorka[];
  opanowanych: number;
};

/* ------------------- Stoper, który przetrwa przeładowanie ------------------ */

/*
 * Stoper trzyma czas startu w pamięci przeglądarki, nie w stanie Reacta.
 * Na telefonie zainstalowana aplikacja potrafi zostać przeładowana po
 * powrocie z tła - godzina nauki nie może wtedy zniknąć. useSyncExternalStore
 * zamiast efektu, bo serwer nie ma localStorage i pierwsze wyrenderowanie
 * musi się zgadzać z tym, co przyszło z serwera.
 */
const KLUCZ_STOPERA = "grind-nauka-stoper";
const sluchacze = new Set<() => void>();

function subskrybuj(cb: () => void) {
  sluchacze.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    sluchacze.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function odczytajStoper(): string | null {
  try {
    return localStorage.getItem(KLUCZ_STOPERA);
  } catch {
    return null;
  }
}

function ustawStoper(wartosc: { tematId: string; start: number } | null) {
  try {
    if (wartosc) localStorage.setItem(KLUCZ_STOPERA, JSON.stringify(wartosc));
    else localStorage.removeItem(KLUCZ_STOPERA);
  } catch {
    // Tryb prywatny bez pamięci - stoper po prostu nie przetrwa przeładowania.
  }
  sluchacze.forEach((cb) => cb());
}

function parsujStoper(surowy: string | null): { tematId: string; start: number } | null {
  if (!surowy) return null;
  try {
    const v = JSON.parse(surowy);
    return typeof v?.tematId === "string" && typeof v?.start === "number" ? v : null;
  } catch {
    return null;
  }
}

const liczbaZTekstu = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

type EdycjaTematu = {
  id: string | null;
  nazwa: string;
  ikona: string;
  rodzaj: RodzajTematu;
  celGodzin: string;
  jednostka: string;
  razem: string;
};

const NOWY_TEMAT: EdycjaTematu = {
  id: null,
  nazwa: "",
  ikona: "📘",
  rodzaj: "inne",
  celGodzin: "",
  jednostka: "",
  razem: "",
};

export function NaukaScreen(d: NaukaDane) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const aktywne = d.tematy.filter((t) => !t.archiwalny);
  const tematWg = new Map(d.tematy.map((t) => [t.id, t]));

  /* ------------------------------- Powtórki ------------------------------- */

  const [odpowiedziane, setOdpowiedziane] = useState<string[]>([]);
  const naDzis = doPowtorki(d.powtorki, d.dzis).filter((p) => !odpowiedziane.includes(p.id));
  const biezaca = naDzis[0] ?? null;
  const nastepnaData = d.powtorki
    .filter((p) => p.etap < ETAP_OPANOWANE && p.nastepna && p.nastepna > d.dzis)
    .map((p) => p.nastepna as string)
    .sort()[0];

  async function odpowiedz(p: NaukaPowtorka, pamietam: boolean) {
    setOdpowiedziane((x) => [...x, p.id]);
    const stan = poPowtorce(p.etap, d.dzis, pamietam);
    const { error } = await createClient()
      .from("nauka_powtorki")
      .update({ etap: stan.etap, nastepna: stan.nastepna, ostatnio: d.dzis })
      .eq("id", p.id);
    if (error) {
      setOdpowiedziane((x) => x.filter((y) => y !== p.id));
      setToast("Nie udało się zapisać odpowiedzi.");
      return;
    }
    if (stan.etap >= ETAP_OPANOWANE) setToast("Opanowane - znika z powtórek.");
  }

  /* -------------------------------- Stoper -------------------------------- */

  const stoper = parsujStoper(useSyncExternalStore(subskrybuj, odczytajStoper, () => null));
  const [tematStopera, setTematStopera] = useState<string>(aktywne[0]?.id ?? "");
  const [teraz, setTeraz] = useState(() => Date.now());
  const [reczneOtwarte, setReczneOtwarte] = useState(false);
  const [reczneMinuty, setReczneMinuty] = useState("30");
  const [notatka, setNotatka] = useState("");

  useEffect(() => {
    if (!stoper) return;
    const id = setInterval(() => setTeraz(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stoper]);

  const uplynelo = stoper ? Math.max(0, Math.floor((teraz - stoper.start) / 1000)) : 0;

  async function zapiszSesje(tematId: string, minuty: number, opis: string) {
    const { error } = await createClient()
      .from("nauka_sesje")
      .insert({
        user_id: d.userId,
        temat_id: tematId,
        minuty: Math.min(600, Math.max(1, Math.round(minuty))),
        notatka: opis.trim() || null,
      });
    if (error) {
      setToast("Nie udało się zapisać sesji.");
      return false;
    }
    setToast(`Zapisane: ${fmtMinuty(Math.round(minuty))}.`);
    router.refresh();
    return true;
  }

  async function zakonczStoper() {
    if (!stoper) return;
    const min = Math.floor(uplynelo / 60);
    if (min < 1) {
      ustawStoper(null);
      setToast("Krócej niż minuta - nie zapisuję.");
      return;
    }
    if (await zapiszSesje(stoper.tematId, min, notatka)) {
      ustawStoper(null);
      setNotatka("");
    }
  }

  /* ----------------------------- Ten tydzień ------------------------------ */

  const tydzien = minutyWTygodniu(d.sesje, d.dzis);
  const sumaTygodnia = [...tydzien.values()].reduce((a, b) => a + b, 0);
  const passa = passaNauki(new Set(d.sesje.map((s) => s.data)), d.dzis);

  /* ------------------------------- Przedmioty ----------------------------- */

  const [edycja, setEdycja] = useState<EdycjaTematu | null>(null);
  const [potwierdzUsun, setPotwierdzUsun] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  function otworzTemat(t: NaukaTemat) {
    setBlad(null);
    setPotwierdzUsun(false);
    setEdycja({
      id: t.id,
      nazwa: t.nazwa,
      ikona: t.ikona,
      rodzaj: t.rodzaj,
      celGodzin: t.cel_min_tydz ? String(Math.round((t.cel_min_tydz / 60) * 10) / 10) : "",
      jednostka: t.jednostka ?? "",
      razem: t.jednostek_razem ? String(t.jednostek_razem) : "",
    });
  }

  async function zapiszTemat() {
    if (!edycja) return;
    const nazwa = edycja.nazwa.trim();
    if (!nazwa) {
      setBlad("Przedmiot potrzebuje nazwy.");
      return;
    }
    const godziny = edycja.celGodzin ? liczbaZTekstu(edycja.celGodzin) : null;
    const razem = edycja.razem ? liczbaZTekstu(edycja.razem) : null;
    const wiersz = {
      nazwa,
      ikona: edycja.ikona || "📘",
      rodzaj: edycja.rodzaj,
      cel_min_tydz: godziny && godziny > 0 ? Math.min(3000, Math.round(godziny * 60)) : null,
      jednostka: edycja.jednostka.trim() || null,
      jednostek_razem: razem && razem > 0 ? Math.round(razem) : null,
    };
    const supabase = createClient();
    const { error } = edycja.id
      ? await supabase.from("nauka_tematy").update(wiersz).eq("id", edycja.id)
      : await supabase.from("nauka_tematy").insert({ ...wiersz, user_id: d.userId });
    if (error) {
      setBlad(
        error.message.includes("duplicate")
          ? "Masz już przedmiot o tej nazwie."
          : error.message.includes("postep_w_zakresie")
            ? "Zrobionych jednostek jest więcej niż wszystkich - popraw liczbę."
            : "Nie udało się zapisać.",
      );
      return;
    }
    setEdycja(null);
    router.refresh();
  }

  async function archiwizuj(id: string, archiwalny: boolean) {
    await createClient().from("nauka_tematy").update({ archiwalny }).eq("id", id);
    setEdycja(null);
    router.refresh();
  }

  async function usunTemat(id: string) {
    await createClient().from("nauka_tematy").delete().eq("id", id);
    setEdycja(null);
    router.refresh();
  }

  async function dodajJednostke(t: NaukaTemat, o: number) {
    const nowa = Math.max(0, Math.min(t.jednostek_razem ?? Infinity, t.jednostek_zrobione + o));
    await createClient().from("nauka_tematy").update({ jednostek_zrobione: nowa }).eq("id", t.id);
    router.refresh();
  }

  /* -------------------------- Nowe powtórki ------------------------------- */

  const [powtorkiOtwarte, setPowtorkiOtwarte] = useState(false);
  const [powtorkaTemat, setPowtorkaTemat] = useState<string>(aktywne[0]?.id ?? "");
  const [powtorkaTresc, setPowtorkaTresc] = useState("");

  async function dodajPowtorki() {
    const linie = powtorkaTresc
      .split("\n")
      .map((l) => l.trim().slice(0, 200))
      .filter(Boolean);
    if (!linie.length || !powtorkaTemat) return;
    const { error } = await createClient()
      .from("nauka_powtorki")
      .insert(
        linie.map((tresc) => ({
          user_id: d.userId,
          temat_id: powtorkaTemat,
          tresc,
          nastepna: pierwszaPowtorka(d.dzis),
        })),
      );
    if (error) {
      setToast("Nie udało się dodać powtórek.");
      return;
    }
    setPowtorkaTresc("");
    setPowtorkiOtwarte(false);
    setToast(linie.length === 1 ? "Pierwsza powtórka jutro." : `${linie.length} rzeczy - pierwsza powtórka jutro.`);
    router.refresh();
  }

  async function usunSesje(id: string) {
    await createClient().from("nauka_sesje").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* ---------------------------- Powtórki ---------------------------- */}
      {biezaca ? (
        <Card title="Powtórki na dziś" subtitle={`Zostało: ${naDzis.length}`}>
          <p className="text-[12px] text-faint">
            {tematWg.get(biezaca.temat_id)?.ikona} {tematWg.get(biezaca.temat_id)?.nazwa} · etap{" "}
            {biezaca.etap + 1} z {ETAP_OPANOWANE}
          </p>
          <p className="mt-1 text-[18px] font-semibold leading-snug">{biezaca.tresc}</p>
          <p className="mt-1 text-[12px] text-faint">
            Przypomnij sobie, zanim klikniesz. Szczerość tu się opłaca - „nie pamiętam” wraca jutro,
            a nie za miesiąc.
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => void odpowiedz(biezaca, false)}>
              Nie pamiętam
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => void odpowiedz(biezaca, true)}>
              Pamiętam
            </Button>
          </div>
        </Card>
      ) : (
        d.powtorki.length > 0 && (
          <Card>
            <p className="text-[14px]">
              ✓ Powtórki na dziś zrobione.
              {nastepnaData && (
                <span className="text-muted"> Następna: {humanDate(nastepnaData)}.</span>
              )}
            </p>
          </Card>
        )
      )}

      {/* ----------------------------- Sesja ------------------------------ */}
      <Card
        title="Sesja nauki"
        subtitle={
          passa > 1 ? `${passa} dni z rzędu` : sumaTygodnia > 0 ? `W tym tygodniu: ${fmtMinuty(sumaTygodnia)}` : undefined
        }
      >
        {aktywne.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="Dodaj pierwszy przedmiot"
            description="Język, przedmiot na studiach, kurs albo umiejętność - cokolwiek, w czym chcesz robić postęp."
            action={
              <Button variant="primary" onClick={() => setEdycja({ ...NOWY_TEMAT })}>
                Dodaj przedmiot
              </Button>
            }
          />
        ) : stoper ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <span className="text-[13px] text-muted">
              {tematWg.get(stoper.tematId)?.ikona} {tematWg.get(stoper.tematId)?.nazwa ?? "Przedmiot"}
            </span>
            <span className="tabular text-[44px] font-bold leading-none">
              {Math.floor(uplynelo / 3600) > 0 && `${Math.floor(uplynelo / 3600)}:`}
              {String(Math.floor((uplynelo % 3600) / 60)).padStart(Math.floor(uplynelo / 3600) > 0 ? 2 : 1, "0")}:
              {String(uplynelo % 60).padStart(2, "0")}
            </span>
            <Input
              value={notatka}
              onChange={(e) => setNotatka(e.target.value.slice(0, 500))}
              placeholder="Co przerobione? (opcjonalnie)"
            />
            <div className="flex w-full gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => ustawStoper(null)}>
                Anuluj
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => void zakonczStoper()}>
                Zakończ i zapisz
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <Select value={tematStopera} onChange={(e) => setTematStopera(e.target.value)} aria-label="Przedmiot">
              {aktywne.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ikona} {t.nazwa}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                disabled={!tematStopera}
                onClick={() => ustawStoper({ tematId: tematStopera, start: Date.now() })}
              >
                ▶ Start
              </Button>
              <Button className="flex-1" onClick={() => setReczneOtwarte(true)} disabled={!tematStopera}>
                Dopisz ręcznie
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* --------------------------- Przedmioty --------------------------- */}
      {aktywne.length > 0 && (
        <Card
          title="Przedmioty"
          action={
            <button
              type="button"
              className="text-[13px] font-medium text-accent"
              onClick={() => setEdycja({ ...NOWY_TEMAT })}
            >
              + Dodaj
            </button>
          }
        >
          <div className="space-y-2.5">
            {aktywne.map((t) => {
              const min = tydzien.get(t.id) ?? 0;
              const pct = t.cel_min_tydz ? Math.min(100, Math.round((min / t.cel_min_tydz) * 100)) : null;
              return (
                <div key={t.id} className="rounded-xl bg-surface-2 p-3">
                  <button type="button" onClick={() => otworzTemat(t)} className="flex w-full items-center gap-2 text-left">
                    <span className="text-xl" aria-hidden>
                      {t.ikona}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{t.nazwa}</span>
                      <span className="block text-[12px] text-muted">
                        {fmtMinuty(min)} w tym tygodniu
                        {t.cel_min_tydz ? ` z ${fmtMinuty(t.cel_min_tydz)}` : ""}
                      </span>
                    </span>
                    <span className="text-faint" aria-hidden>
                      ›
                    </span>
                  </button>
                  {pct != null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
                      <div
                        className={clsx("h-full rounded-full", pct >= 100 ? "bg-success" : "bg-accent")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {t.jednostek_razem && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-muted">
                        {t.jednostek_zrobione} / {t.jednostek_razem} {t.jednostka ?? ""}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => void dodajJednostke(t, -1)} aria-label="Cofnij jedną">
                        −1
                      </Button>
                      <Button size="sm" onClick={() => void dodajJednostke(t, 1)} disabled={t.jednostek_zrobione >= t.jednostek_razem}>
                        +1
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button block className="mt-3" onClick={() => setPowtorkiOtwarte(true)}>
            + Dodaj rzeczy do powtórek
          </Button>
          {d.opanowanych > 0 && (
            <p className="mt-2 text-center text-[12px] text-faint">Opanowane na stałe: {d.opanowanych}</p>
          )}
        </Card>
      )}

      {/* ------------------------ Ostatnie sesje -------------------------- */}
      {d.sesje.length > 0 && (
        <Card title="Ostatnie sesje">
          <ul className="divide-y divide-border">
            {d.sesje.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span aria-hidden>{tematWg.get(s.temat_id)?.ikona ?? "📘"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{tematWg.get(s.temat_id)?.nazwa ?? "Przedmiot"}</span>
                  {s.notatka && <span className="block truncate text-[12px] text-faint">{s.notatka}</span>}
                </span>
                <span className="tabular text-muted">{fmtMinuty(s.minuty)}</span>
                <span className="w-16 text-right text-[12px] text-faint">{humanDate(s.data)}</span>
                <button
                  type="button"
                  className="text-faint"
                  onClick={() => void usunSesje(s.id)}
                  aria-label="Usuń sesję"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------ Arkusze ----------------------------- */}
      <Sheet open={reczneOtwarte} onClose={() => setReczneOtwarte(false)} title="Dopisz sesję">
        <div className="space-y-3">
          <Field label="Przedmiot">
            <Select value={tematStopera} onChange={(e) => setTematStopera(e.target.value)}>
              {aktywne.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ikona} {t.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ile minut">
            <Input inputMode="numeric" value={reczneMinuty} onChange={(e) => setReczneMinuty(e.target.value)} />
          </Field>
          <Field label="Co przerobione (opcjonalnie)">
            <Input value={notatka} onChange={(e) => setNotatka(e.target.value.slice(0, 500))} />
          </Field>
          <Button
            variant="primary"
            block
            onClick={async () => {
              const m = liczbaZTekstu(reczneMinuty);
              if (!m || m < 1) return;
              if (await zapiszSesje(tematStopera, m, notatka)) {
                setReczneOtwarte(false);
                setNotatka("");
              }
            }}
          >
            Zapisz
          </Button>
        </div>
      </Sheet>

      <Sheet open={powtorkiOtwarte} onClose={() => setPowtorkiOtwarte(false)} title="Do powtórek">
        <div className="space-y-3">
          <Field label="Przedmiot">
            <Select value={powtorkaTemat} onChange={(e) => setPowtorkaTemat(e.target.value)}>
              {aktywne.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ikona} {t.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Co powtarzać"
            hint="Każda linia to osobna rzecz: słówko, wzór, pytanie. Wracają po 1, 3, 7, 14, 30 i 60 dniach."
          >
            <Textarea
              value={powtorkaTresc}
              onChange={(e) => setPowtorkaTresc(e.target.value)}
              rows={5}
              placeholder={"present perfect - kiedy używać\nthe bottom line = sedno sprawy"}
            />
          </Field>
          <Button variant="primary" block onClick={() => void dodajPowtorki()} disabled={!powtorkaTresc.trim()}>
            Dodaj
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(edycja)}
        onClose={() => setEdycja(null)}
        title={edycja?.id ? "Przedmiot" : "Nowy przedmiot"}
      >
        {edycja && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <Field label="Ikona">
                  <Input
                    value={edycja.ikona}
                    onChange={(e) => setEdycja({ ...edycja, ikona: e.target.value.slice(0, 8) })}
                    className="text-center"
                  />
                </Field>
              </div>
              <Field label="Nazwa" className="min-w-0 flex-1">
                <Input
                  value={edycja.nazwa}
                  onChange={(e) => setEdycja({ ...edycja, nazwa: e.target.value.slice(0, 80) })}
                  placeholder="np. Angielski B2"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RODZAJE_TEMATOW.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setEdycja({
                      ...edycja,
                      rodzaj: r.id,
                      ikona: edycja.ikona === "📘" || RODZAJE_TEMATOW.some((x) => x.ikona === edycja.ikona) ? r.ikona : edycja.ikona,
                    })
                  }
                  className={clsx(
                    "rounded-full px-2.5 py-1 text-[12px] font-medium",
                    edycja.rodzaj === r.id ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
                  )}
                >
                  {r.ikona} {r.etykieta}
                </button>
              ))}
            </div>
            <Field label="Cel tygodniowy (godziny)" hint="Puste = bez celu. Np. 3 albo 1,5.">
              <Input
                inputMode="decimal"
                value={edycja.celGodzin}
                onChange={(e) => setEdycja({ ...edycja, celGodzin: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Jednostka materiału" hint="np. lekcje">
                <Input
                  value={edycja.jednostka}
                  onChange={(e) => setEdycja({ ...edycja, jednostka: e.target.value.slice(0, 20) })}
                />
              </Field>
              <Field label="Ile wszystkich" hint="np. 40">
                <Input
                  inputMode="numeric"
                  value={edycja.razem}
                  onChange={(e) => setEdycja({ ...edycja, razem: e.target.value })}
                />
              </Field>
            </div>
            {blad && <Alert tone="danger">{blad}</Alert>}
            <Button variant="primary" block onClick={() => void zapiszTemat()}>
              Zapisz
            </Button>
            {edycja.id && (
              <>
                <Button block variant="ghost" onClick={() => void archiwizuj(edycja.id as string, true)}>
                  Schowaj do archiwum
                </Button>
                {!potwierdzUsun ? (
                  <Button block variant="ghost" onClick={() => setPotwierdzUsun(true)}>
                    Usuń przedmiot
                  </Button>
                ) : (
                  <div className="rounded-xl bg-[var(--danger-soft)] p-3">
                    <p className="text-[13px]">
                      Razem z przedmiotem znikną wszystkie jego sesje i powtórki. Archiwum ich nie
                      rusza.
                    </p>
                    <Button
                      block
                      variant="danger"
                      className="mt-2"
                      onClick={() => void usunTemat(edycja.id as string)}
                    >
                      Usuń na zawsze
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>

      {d.tematy.some((t) => t.archiwalny) && (
        <Card title="Archiwum">
          <ul className="space-y-1.5">
            {d.tematy
              .filter((t) => t.archiwalny)
              .map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden>{t.ikona}</span>
                  <span className="flex-1 truncate text-muted">{t.nazwa}</span>
                  <button type="button" className="text-accent" onClick={() => void archiwizuj(t.id, false)}>
                    Przywróć
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {toast && <Toast key={toast}>{toast}</Toast>}
    </div>
  );
}
