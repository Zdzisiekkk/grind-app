"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Input, Sheet, Spinner } from "@/components/ui";
import { looksLikeBookBarcode, normalizeIsbn } from "@/lib/isbn";
import type { IsbnBook } from "@/lib/isbn";

/**
 * Skanowanie kodu z okładki.
 *
 * Dwa sposoby czytania kodu, bo jeden nie wystarcza: przeglądarki oparte na
 * Chrome mają wbudowany BarcodeDetector (zero dodatkowych kilobajtów), a
 * Safari na iPhonie go nie ma i nigdy nie miało. Tam dociągamy dekoder
 * dynamicznym importem — dopiero w momencie otwarcia aparatu, żeby nie
 * obciążać nim całej aplikacji.
 *
 * Ręczne wpisanie numeru zostaje zawsze widoczne. Aparat potrafi nie dostać
 * zgody, nie mieć tylnego obiektywu albo trafić na wygnieciony kod — i wtedy
 * trzynaście cyfr z okładki jest szybsze niż walka ze sprzętem.
 */

type Status = "idle" | "starting" | "scanning" | "looking-up";

// Typ jest w standardzie, ale nie ma go jeszcze w lib.dom.
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function nativeDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export function IsbnScanner({
  open,
  onClose,
  onFound,
}: {
  open: boolean;
  onClose: () => void;
  onFound: (book: IsbnBook) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  /** Zwalnia aparat. Kamera zapalona po zamknięciu arkusza to najgorszy możliwy błąd. */
  const stopCamera = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const lookup = useCallback(
    async (raw: string) => {
      const isbn = normalizeIsbn(raw);
      if (!isbn) {
        setError("To nie wygląda na poprawny ISBN. Przepisz trzynaście cyfr spod kodu.");
        return;
      }

      stopCamera();
      setStatus("looking-up");
      setError(null);

      try {
        const res = await fetch(`/api/ksiazki/isbn?isbn=${isbn}`);
        const body = await res.json();

        if (!res.ok) {
          // Brak w bazach to nie porażka skanera: kod odczytaliśmy poprawnie,
          // tylko żadne źródło nie zna tej książki. Otwieramy formularz
          // z zapamiętanym numerem, żeby został do wpisania sam tytuł —
          // dobijanie się do zamkniętych drzwi byłoby tu bez sensu.
          if (res.status === 404) {
            onFound({ isbn, title: "", author: null, pages: null, coverUrl: null });
            return;
          }
          setStatus("idle");
          setError(body?.error ?? "Nie udało się sprawdzić numeru.");
          return;
        }
        onFound(body as IsbnBook);
      } catch {
        setStatus("idle");
        setError("Brak połączenia. Wpisz dane książki ręcznie.");
      }
    },
    [onFound, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch {
      setStatus("idle");
      setError("Brak dostępu do aparatu. Wpisz numer ISBN ręcznie — jest pod kodem kreskowym.");
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("idle");
      return;
    }

    video.srcObject = stream;
    // iOS odtwarza wideo w podglądzie tylko z tymi dwoma atrybutami.
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play().catch(() => {});
    setStatus("scanning");

    const native = nativeDetector();

    if (native) {
      const detector = new native({ formats: ["ean_13"] });
      let cancelled = false;
      stopRef.current = () => {
        cancelled = true;
      };

      const tick = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const hit = found.map((f) => f.rawValue).find(looksLikeBookBarcode);
          if (hit) {
            void lookup(hit);
            return;
          }
        } catch {
          // Pojedyncza nieudana klatka nic nie znaczy — próbujemy dalej.
        }
        if (!cancelled) requestAnimationFrame(() => void tick());
      };
      void tick();
      return;
    }

    // Safari i reszta bez BarcodeDetectora: dekoder dociągany dopiero teraz.
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
      const reader = new BrowserMultiFormatReader(hints);

      const controls = await reader.decodeFromVideoElement(video, (result) => {
        const value = result?.getText();
        if (value && looksLikeBookBarcode(value)) void lookup(value);
      });
      stopRef.current = () => controls.stop();
    } catch {
      setStatus("idle");
      setError("Nie udało się uruchomić skanera. Wpisz numer ISBN ręcznie.");
    }
  }, [lookup]);

  // Zamknięcie arkusza gasi aparat — także wtedy, gdy komponent znika nagle.
  useEffect(() => {
    if (!open) stopCamera();
    return stopCamera;
  }, [open, stopCamera]);

  return (
    <Sheet
      open={open}
      onClose={() => {
        stopCamera();
        setStatus("idle");
        onClose();
      }}
      title="Zeskanuj książkę"
    >
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full object-cover"
          />

          {status !== "scanning" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2 text-center">
              {status === "idle" ? (
                <>
                  <span className="text-3xl" aria-hidden>
                    📷
                  </span>
                  <p className="px-6 text-[13px] text-muted">
                    Wyceluj w kod kreskowy na tylnej okładce.
                  </p>
                </>
              ) : (
                <>
                  <Spinner />
                  <p className="text-[13px] text-muted">
                    {status === "looking-up" ? "Szukam książki…" : "Uruchamiam aparat…"}
                  </p>
                </>
              )}
            </div>
          )}

          {status === "scanning" && (
            /* Ramka celownika — bez niej nie wiadomo, gdzie trzymać książkę. */
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80"
            />
          )}
        </div>

        {error && <Alert>{error}</Alert>}

        {status === "idle" && (
          <Button variant="primary" size="lg" block onClick={() => void startCamera()}>
            Włącz aparat
          </Button>
        )}

        <Field
          label="Albo wpisz ISBN z okładki"
          hint="Trzynaście cyfr pod kodem kreskowym. Myślniki możesz pominąć."
        >
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="978…"
            />
            <Button
              variant="secondary"
              disabled={manual.trim().length < 10}
              loading={status === "looking-up"}
              onClick={() => void lookup(manual)}
            >
              Szukaj
            </Button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
