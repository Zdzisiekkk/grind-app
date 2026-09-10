"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { humanDate } from "@/lib/format";
import type {
  StatusZgloszenia,
  TypZgloszenia,
  Zgloszenie,
  ZgloszenieOdpowiedz,
} from "@/lib/database.types";

/**
 * Zgłaszanie problemów i podgląd odpowiedzi.
 *
 * Kontekst techniczny - adres ekranu, wersja aplikacji, przeglądarka -
 * dopisujemy automatycznie. Zgłoszenie "nie działa" bez tych trzech rzeczy
 * jest nie do odtworzenia, a dopytywanie o nie kończy się brakiem odpowiedzi:
 * człowiek zgłasza błąd raz, w złości, i nie wraca uzupełniać formularza.
 */

export const TYPY: ReadonlyArray<{ value: TypZgloszenia; label: string; icon: string }> = [
  { value: "blad", label: "Coś nie działa", icon: "🐛" },
  { value: "propozycja", label: "Propozycja zmiany", icon: "💡" },
  { value: "pytanie", label: "Pytanie", icon: "❓" },
  { value: "platnosc", label: "Płatność i subskrypcja", icon: "💳" },
  { value: "inne", label: "Inne", icon: "✉️" },
];

export const STATUSY: Record<StatusZgloszenia, { label: string; tone: "neutral" | "accent" | "success" | "warn" }> = {
  nowe: { label: "Nowe", tone: "accent" },
  w_toku: { label: "W toku", tone: "warn" },
  rozwiazane: { label: "Rozwiązane", tone: "success" },
  odrzucone: { label: "Odrzucone", tone: "neutral" },
};

export function Zgloszenia({
  userId,
  zgloszenia,
  odpowiedzi,
  wersja,
}: {
  userId: string;
  zgloszenia: Zgloszenie[];
  odpowiedzi: ZgloszenieOdpowiedz[];
  wersja: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [otwarty, setOtwarty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typ, setTyp] = useState<TypZgloszenia>("blad");
  const [tytul, setTytul] = useState("");
  const [tresc, setTresc] = useState("");
  const [rozwiniete, setRozwiniete] = useState<string | null>(null);
  const [odpowiedz, setOdpowiedz] = useState("");

  async function wyslij() {
    if (!tytul.trim() || !tresc.trim()) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.from("zgloszenia").insert({
      user_id: userId,
      typ,
      tytul: tytul.trim().slice(0, 120),
      tresc: tresc.trim().slice(0, 4000),
      // Zbierane w tle - nikt nie zna wersji aplikacji na pamięć.
      strona: document.referrer || "/pomoc",
      wersja,
      przegladarka: navigator.userAgent.slice(0, 300),
    });

    setBusy(false);
    if (error) {
      setError(`Nie udało się wysłać: ${error.message}`);
      return;
    }
    setTytul("");
    setTresc("");
    setOtwarty(false);
    router.refresh();
  }

  async function dopisz(zgloszenieId: string) {
    if (!odpowiedz.trim()) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.from("zgloszenia_odpowiedzi").insert({
      zgloszenie_id: zgloszenieId,
      autor_id: userId,
      tresc: odpowiedz.trim().slice(0, 4000),
    });

    setBusy(false);
    if (error) {
      setError(`Nie udało się dopisać: ${error.message}`);
      return;
    }
    setOdpowiedz("");
    router.refresh();
  }

  return (
    <>
      <Card
        title="Zgłoszenia"
        subtitle="Błędy, propozycje i pytania"
        action={
          <Button variant="primary" onClick={() => setOtwarty(true)}>
            + Zgłoś
          </Button>
        }
        padded={zgloszenia.length === 0}
      >
        {error && <Alert>{error}</Alert>}

        {zgloszenia.length === 0 ? (
          <EmptyState
            icon="✉️"
            title="Nic jeszcze nie zgłaszałeś"
            description="Jeśli coś nie działa albo czegoś brakuje - napisz. Odpowiedź wróci w tym samym miejscu."
          />
        ) : (
          <ul className="divide-y divide-border">
            {zgloszenia.map((z) => {
              const moje = odpowiedzi.filter((o) => o.zgloszenie_id === z.id);
              const nieprzeczytane = moje.some((o) => o.od_admina);
              const rozwiniety = rozwiniete === z.id;
              const t = TYPY.find((x) => x.value === z.typ) ?? TYPY[TYPY.length - 1];
              const s = STATUSY[z.status];

              return (
                <li key={z.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRozwiniete(rozwiniety ? null : z.id);
                      setOdpowiedz("");
                    }}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className="text-[16px]" aria-hidden>
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{z.tytul}</span>
                      <span className="block text-[12px] text-faint">
                        {humanDate(z.created_at.slice(0, 10))}
                        {moje.length > 0 && ` · ${moje.length} odpowiedzi`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {nieprzeczytane && <Chip tone="success">odpowiedź</Chip>}
                      <Chip tone={s.tone}>{s.label}</Chip>
                    </span>
                  </button>

                  {rozwiniety && (
                    <div className="mt-3 flex flex-col gap-3">
                      <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed">
                        {z.tresc}
                      </p>

                      {moje.map((o) => (
                        <div
                          key={o.id}
                          className={`rounded-xl p-3 text-[13px] leading-relaxed ${
                            o.od_admina
                              ? "border border-accent/40 bg-accent/5"
                              : "bg-surface-2"
                          }`}
                        >
                          <p className="mb-1 text-[12px] font-medium text-muted">
                            {o.od_admina ? "🛠️ Obsługa" : "Ty"} ·{" "}
                            {humanDate(o.created_at.slice(0, 10))}
                          </p>
                          <p className="whitespace-pre-wrap">{o.tresc}</p>
                        </div>
                      ))}

                      {z.status !== "rozwiazane" && z.status !== "odrzucone" && (
                        <div className="flex flex-col gap-2">
                          <Textarea
                            value={odpowiedz}
                            onChange={(e) => setOdpowiedz(e.target.value)}
                            placeholder="Dopisz coś do tego zgłoszenia"
                          />
                          <Button
                            variant="secondary"
                            loading={busy}
                            disabled={!odpowiedz.trim()}
                            onClick={() => dopisz(z.id)}
                          >
                            Dopisz
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet open={otwarty} onClose={() => setOtwarty(false)} title="Nowe zgłoszenie">
        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}

          <Field label="Czego dotyczy">
            <Select value={typ} onChange={(e) => setTyp(e.target.value as TypZgloszenia)}>
              {TYPY.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tytuł">
            <Input
              value={tytul}
              onChange={(e) => setTytul(e.target.value)}
              placeholder="np. Waga nie zapisuje się na telefonie"
              maxLength={120}
              autoFocus
            />
          </Field>

          <Field
            label="Opis"
            hint="Najbardziej pomaga: co robiłeś, czego się spodziewałeś i co się stało zamiast tego."
          >
            <Textarea
              value={tresc}
              onChange={(e) => setTresc(e.target.value)}
              placeholder="Wpisuję wagę, klikam Zapisz, arkusz się zamyka, ale liczba się nie zmienia."
              maxLength={4000}
              className="min-h-32"
            />
          </Field>

          <p className="text-[12px] leading-snug text-faint">
            Do zgłoszenia dołączymy wersję aplikacji i model przeglądarki - bez tego większości
            błędów nie da się odtworzyć. Nie wysyłamy żadnych Twoich wpisów ani danych zdrowotnych.
          </p>

          <Button
            variant="primary"
            block
            loading={busy}
            disabled={!tytul.trim() || !tresc.trim()}
            onClick={wyslij}
          >
            Wyślij zgłoszenie
          </Button>
        </div>
      </Sheet>
    </>
  );
}
