"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";

/**
 * Aparat czytający kody kreskowe.
 *
 * Dwa sposoby odczytu, bo jeden nie wystarcza: przeglądarki oparte na Chrome
 * mają wbudowany BarcodeDetector (zero dodatkowych kilobajtów), a Safari na
 * iPhonie go nie ma i nigdy nie miało. Tam dociągamy dekoder dynamicznym
 * importem — dopiero po włączeniu aparatu, żeby nie obciążać nim całej
 * aplikacji.
 *
 * Komponent jest sam z siebie głupi: rozpoznaje kod i oddaje go dalej. Co
 * znaczy dany numer — książka czy jogurt — rozstrzyga ten, kto go osadza.
 *
 * Aparat zapala się z przycisku, nie po samym pojawieniu się na ekranie.
 * Kamera włączona bez wyraźnego kliknięcia zaskakuje, a na iPhonie prośba
 * o zgodę i tak działa pewniej po geście użytkownika.
 */

// Typ jest w standardzie, ale nie ma go jeszcze w lib.dom.
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function nativeDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export type CodeScannerProps = {
  /** Gdy false, aparat gaśnie natychmiast. */
  aktywny: boolean;
  /** Formaty dla BarcodeDetectora, np. ["ean_13", "ean_8", "upc_a"]. */
  formaty: string[];
  /** Filtr wstępny — odrzuca odczyty, które nie są tym, czego szukamy. */
  akceptuj: (kod: string) => boolean;
  onKod: (kod: string) => void;
  /** Zdanie pod podglądem: co przyłożyć do aparatu. */
  podpowiedz: string;
};

export function CodeScanner({ aktywny, formaty, akceptuj, onKod, podpowiedz }: CodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  // Callback trzymany w ref: pętla odczytu żyje dłużej niż pojedynczy render,
  // a bez tego zamykałaby w sobie pierwszą wersję funkcji na zawsze.
  const onKodRef = useRef(onKod);
  const akceptujRef = useRef(akceptuj);
  useEffect(() => {
    onKodRef.current = onKod;
    akceptujRef.current = akceptuj;
  }, [onKod, akceptuj]);

  const [dziala, setDziala] = useState(false);
  const [startuje, setStartuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  /** Gasi aparat. Kamera zapalona po zamknięciu ekranu to najgorszy możliwy błąd. */
  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!aktywny) stop();
    return stop;
  }, [aktywny, stop]);

  const start = useCallback(async () => {
    setStartuje(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch {
      setStartuje(false);
      setBlad("Brak dostępu do aparatu. Wpisz kod spod kreski ręcznie.");
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      setStartuje(false);
      return;
    }

    video.srcObject = stream;
    // iOS odtwarza podgląd tylko z tymi dwoma atrybutami.
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play().catch(() => {});

    setBlad(null);
    setStartuje(false);
    setDziala(true);

    const native = nativeDetector();

    if (native) {
      const detector = new native({ formats: formaty });
      let przerwane = false;
      stopRef.current = () => {
        przerwane = true;
      };

      const tick = async () => {
        if (przerwane || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const hit = found.map((f) => f.rawValue).find((v) => akceptujRef.current(v));
          if (hit) {
            onKodRef.current(hit);
            return;
          }
        } catch {
          // Pojedyncza nieudana klatka nic nie znaczy — próbujemy dalej.
        }
        if (!przerwane) requestAnimationFrame(() => void tick());
      };
      void tick();
      return;
    }

    // Safari i reszta bez BarcodeDetectora: dekoder dopiero teraz.
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
      ]);
      const reader = new BrowserMultiFormatReader(hints);

      const controls = await reader.decodeFromVideoElement(video, (result) => {
        const value = result?.getText();
        if (value && akceptujRef.current(value)) onKodRef.current(value);
      });
      stopRef.current = () => controls.stop();
    } catch {
      setDziala(false);
      setBlad("Nie udało się uruchomić skanera. Wpisz kod ręcznie.");
    }
  }, [formaty]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" aria-label="Podgląd z aparatu" />

        {/* Ramka celownika — kod ma trafić w poprzeczkę, nie gdziekolwiek. */}
        {dziala && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-4/5 rounded-lg border-2 border-white/70">
              <div className="mt-[46px] h-0.5 w-full bg-[var(--danger)]/80" />
            </div>
          </div>
        )}

        {!dziala && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={() => void start()} disabled={startuje}>
              {startuje ? <Spinner className="h-4 w-4" /> : "Włącz aparat"}
            </Button>
          </div>
        )}
      </div>

      <p className="text-[13px] text-muted" aria-live="polite">
        {dziala ? podpowiedz : "Aparat jest wyłączony."}
      </p>

      {blad && <Alert tone="warn">{blad}</Alert>}
    </div>
  );
}
