"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { deleteAccount, withdrawHealthConsent } from "@/app/(app)/profil/actions";
import { linkiDoZdjec } from "@/app/(app)/wyglad/actions";
import { zbudujZip, type PlikZip } from "@/lib/zip";

/**
 * Prawo do kopii danych i prawo do bycia zapomnianym - działające, nie
 * obiecane w regulaminie.
 *
 * Usunięcie konta jest za dwoma zaporami: świadomym kliknięciem i przepisaniem
 * słowa. Nie chodzi o utrudnianie, tylko o to, że operacji nie da się cofnąć,
 * a przycisk "usuń" bywa klikany kciukiem w kieszeni.
 */

const README = `Kopia Twoich danych z Grinda.

dane.json - wszystkie wpisy: treningi, dieta, sen, nawyki, zadania, książki,
            finanse, wygląd, głowa, nauka, cele, zgłoszenia i punkty XP.
wyglad/   - zdjęcia ze skanów wyglądu, jeden katalog na skan (data_skanu).

JSON otworzysz w dowolnym edytorze tekstu albo zaimportujesz gdzie indziej.
Zdjęcia to zwykłe pliki JPEG.
`;

/**
 * Składanie ZIP-a w przeglądarce.
 *
 * Zdjęcia nie idą przez nasz serwer: funkcja na Vercelu oddaje najwyżej kilka
 * megabajtów, a kilkadziesiąt skanów po cztery zdjęcia to dużo więcej.
 * Przeglądarka pobiera je sama, każde przez krótkotrwały podpisany link,
 * i pakuje na miejscu.
 */
async function pobierzZip(postep: (tekst: string) => void): Promise<void> {
  postep("Zbieram dane…");
  const odp = await fetch("/api/dane/eksport", { cache: "no-store" });
  if (!odp.ok) throw new Error("Nie udało się pobrać danych.");
  const json = new Uint8Array(await odp.arrayBuffer());

  // Daty skanów z samego eksportu - katalog "2026-09-10" mówi więcej niż identyfikator.
  let datySkanow = new Map<string, string>();
  try {
    const dane = JSON.parse(new TextDecoder().decode(json));
    const skany: Array<{ id: string; utworzono: string }> = dane?.dane?.wyglad_skany ?? [];
    datySkanow = new Map(skany.map((s) => [s.id, String(s.utworzono).slice(0, 10)]));
  } catch {
    // Bez dat katalogi dostaną same identyfikatory - to nadal pełna kopia.
  }

  const pliki: PlikZip[] = [
    { nazwa: "README.txt", dane: new TextEncoder().encode(README) },
    { nazwa: "dane.json", dane: json },
  ];

  const linki = await linkiDoZdjec();
  const zdjecia = Object.entries(linki).flatMap(([skanId, ujecia]) =>
    Object.entries(ujecia).map(([ujecie, url]) => ({ skanId, ujecie, url: url as string })),
  );

  let pobrane = 0;
  for (const z of zdjecia) {
    postep(`Zdjęcia: ${pobrane + 1} z ${zdjecia.length}…`);
    const r = await fetch(z.url).catch(() => null);
    if (r?.ok) {
      const katalog = `${datySkanow.get(z.skanId) ?? "skan"}_${z.skanId.slice(0, 8)}`;
      pliki.push({ nazwa: `wyglad/${katalog}/${z.ujecie}.jpg`, dane: new Uint8Array(await r.arrayBuffer()) });
    }
    pobrane++;
  }

  postep("Pakuję…");
  const zip = zbudujZip(pliki);
  const url = URL.createObjectURL(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `grind-dane-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function DataControls({
  hasSubscription,
  healthConsentAt,
}: {
  /** Aktywna subskrypcja Stripe - usunięcie konta jej nie anuluje. */
  hasSubscription: boolean;
  healthConsentAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<"idle" | "confirm">("idle");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zip, setZip] = useState<string | null>(null);
  const [bladZip, setBladZip] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Twoje dane"
        subtitle="Wszystko, co zapisałeś, należy do Ciebie i możesz to stąd zabrać."
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            block
            loading={zip != null}
            onClick={async () => {
              setBladZip(null);
              try {
                await pobierzZip(setZip);
              } catch (e) {
                setBladZip(e instanceof Error ? e.message : "Nie udało się przygotować kopii.");
              } finally {
                setZip(null);
              }
            }}
          >
            {zip ?? "⬇ Pobierz wszystko (ZIP ze zdjęciami)"}
          </Button>
          {bladZip && <Alert>{bladZip}</Alert>}
          <a href="/api/dane/eksport" download className="text-center text-[13px] text-muted underline">
            Same dane, bez zdjęć (JSON)
          </a>
          <p className="text-[12px] leading-relaxed text-faint">
            ZIP zawiera wszystkie wpisy - treningi, dietę, sen, nawyki, zadania, książki, finanse,
            głowę, naukę i cele - oraz zdjęcia ze skanów wyglądu. Warto go czasem zgrać: aplikacja
            może kiedyś przestać działać, Twoje dwa lata treningów nie powinny.
          </p>
        </div>
      </Card>

      {healthConsentAt && (
        <Card
          title="Zgoda na dane o zdrowiu"
          subtitle="Sen, ból, kontuzje i waga. Możesz ją cofnąć w każdej chwili."
        >
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Cofnięcie zgody usuwa te dane - dziennik snu, oceny bólu, kontuzje i pomiary
              wagi. Treningi, plany i zadania zostają.
            </p>
            <Button
              variant="ghost"
              loading={pending}
              onClick={() => {
                if (!confirm("Cofnąć zgodę i usunąć dane o zdrowiu? Tego nie da się cofnąć.")) return;
                startTransition(() => withdrawHealthConsent());
              }}
            >
              Cofnij zgodę i usuń te dane
            </Button>
          </div>
        </Card>
      )}

      <Card title="Usunięcie konta" subtitle="Nieodwracalne. Nie zostawiamy żadnych kopii.">
        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}

          {hasSubscription && (
            <Alert tone="warn">
              Masz aktywną subskrypcję. Usunięcie konta <strong>jej nie anuluje</strong> -
              wypowiedz ją najpierw w panelu płatności, inaczej karta będzie dalej obciążana.
            </Alert>
          )}

          {stage === "idle" ? (
            <Button variant="danger" onClick={() => setStage("confirm")}>
              Chcę usunąć konto
            </Button>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed">
                Znikną wszystkie treningi, posiłki, noce, nawyki, zadania, książki, notatki
                i zdjęcia. Nie da się tego przywrócić. Jeśli chcesz zachować kopię, pobierz ją
                wyżej - to zajmuje chwilę.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">
                  Przepisz słowo <span className="font-bold text-text">USUŃ</span>, żeby
                  potwierdzić
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-center font-bold outline-none focus:border-danger"
                  aria-label="Potwierdzenie usunięcia konta"
                />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStage("idle")}>
                  Rezygnuję
                </Button>
                <Button
                  variant="danger"
                  block
                  loading={pending}
                  disabled={typed.trim().toUpperCase() !== "USUŃ"}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await deleteAccount();
                      } catch (e) {
                        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
                        setError(e instanceof Error ? e.message : "Nie udało się usunąć konta.");
                      }
                    });
                  }}
                >
                  Usuń konto na zawsze
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
