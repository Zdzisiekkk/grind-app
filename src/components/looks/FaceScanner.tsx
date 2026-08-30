"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Sheet, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import type { Ujecie } from "@/lib/database.types";

/**
 * Skan twarzy.
 *
 * Trzy rzeczy decydują o tym, czy porównanie po trzech miesiącach będzie coś
 * warte, a wszystkie trzy są w kadrze, nie w modelu: ten sam kąt, to samo
 * oświetlenie i ta sama odległość. Dlatego jest owal-prowadnica i "duch"
 * poprzedniego zdjęcia pod spodem. Bez tego dwa skany różnią się głównie tym,
 * jak człowiek trzymał telefon.
 *
 * Kamera gaśnie w każdym wyjściu z tego komponentu. Zapalona po zamknięciu
 * arkusza jest błędem krytycznym - dioda obok obiektywu to jedyna rzecz,
 * po której człowiek pozna, że aplikacja go nagrywa.
 *
 * Stanu nie zerujemy tutaj: ekran nadrzędny montuje ten komponent z kluczem
 * zależnym od otwarcia, więc zamknięcie arkusza kasuje wszystko razem
 * z komponentem. Zerowanie w efekcie robiłoby to samo, tylko przez dodatkowe
 * przejście przez render.
 */

const KOLEJNOSC: Ujecie[] = ["front", "profil", "sylwetka"];

const OPIS: Record<Ujecie, { tytul: string; jak: string; wymagane: boolean }> = {
  front: {
    tytul: "Twarz na wprost",
    jak: "Neutralny wyraz, światło z przodu, bez okularów. Telefon na wysokości oczu.",
    wymagane: true,
  },
  profil: {
    tytul: "Profil",
    jak: "Obróć głowę o 90°, wzrok prosto przed siebie. To ujęcie pokazuje linię żuchwy.",
    wymagane: false,
  },
  sylwetka: {
    tytul: "Sylwetka",
    jak: "Cała postawa, ręce swobodnie. Stań naturalnie - nie prostuj się na siłę.",
    wymagane: false,
  },
};

/** Dłuższy bok zdjęcia. Więcej pikseli nie poprawia oceny, a kosztuje przy każdym skanie. */
const MAX_BOK = 1600;

/** Ile sekund na dojście do kadru i opuszczenie ręki. */
const ODLICZANIE_S = 5;

type Etap = "podglad" | "wysylanie" | "analiza";

/**
 * Przeskalowanie i kompresja w przeglądarce.
 *
 * Telefon robi zdjęcia po kilka megabajtów. Wysyłanie ich w oryginale to
 * transfer użytkownika i czas na łączu komórkowym - a do oceny skóry i tak
 * schodzimy do 1600 px.
 */
async function doJpega(zrodlo: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const skala = Math.min(1, MAX_BOK / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * skala);
  canvas.height = Math.round(h * skala);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(zrodlo, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

export function FaceScanner({
  open,
  onClose,
  onGotowe,
  duchy,
}: {
  open: boolean;
  onClose: () => void;
  onGotowe: () => void;
  /** Podpisane adresy poprzednich ujęć - nakładane na podgląd. */
  duchy: Partial<Record<Ujecie, string>>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [etap, setEtap] = useState<Etap>("podglad");
  const [krok, setKrok] = useState(0);
  const [zrobione, setZrobione] = useState<Partial<Record<Ujecie, Blob>>>({});
  const [blad, setBlad] = useState<string | null>(null);
  const [kameraOk, setKameraOk] = useState(false);
  const [status, setStatus] = useState("");
  /** Sekundy do wyzwolenia migawki; null = nie odliczamy. */
  const [odliczanie, setOdliczanie] = useState<number | null>(null);

  const ujecie = KOLEJNOSC[krok];

  /*
   * Samo gaszenie sprzętu, bez dotykania stanu Reacta. Wołane też ze sprzątania
   * efektu, czyli w momencie, w którym komponent już znika - ustawianie tam
   * stanu byłoby pracą na rzecz czegoś, czego za chwilę nie ma.
   */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 } },
      });
    } catch {
      setBlad(
        "Brak dostępu do aparatu. Możesz wybrać zdjęcie z galerii - działa tak samo, tylko trudniej trafić w ten sam kadr.",
      );
      return;
    }

    setBlad(null);
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    video.srcObject = stream;
    // iOS odtwarza podgląd tylko z tymi dwoma atrybutami.
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play().catch(() => {});
    setKameraOk(true);
  }, []);

  /*
   * Aparat zapala się z przycisku, nie sam po otwarciu arkusza.
   *
   * Tak samo robi to skaner kodów w module książek. Powód jest ten sam:
   * kamera włączona bez wyraźnego kliknięcia zaskakuje, a na iPhonie prośba
   * o zgodę i tak działa pewniej po geście użytkownika. Efekt odpowiada już
   * tylko za gaszenie.
   */
  useEffect(() => {
    if (!open) stopCamera();
    return stopCamera;
  }, [open, stopCamera]);

  /** Sama migawka - bez odliczania, wołana z timera i z galerii. */
  const zapiszKlatke = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const blob = await doJpega(video, video.videoWidth, video.videoHeight);
    if (!blob) {
      setBlad("Nie udało się zapisać klatki. Spróbuj jeszcze raz.");
      return;
    }
    setZrobione((z) => ({ ...z, [ujecie]: blob }));
    setKrok((k) => (k < KOLEJNOSC.length - 1 ? k + 1 : k));
  }, [ujecie]);

  /*
   * Pięć sekund na ustawienie się.
   *
   * Do tej pory zdjęcie robiło się w momencie kliknięcia - czyli zawsze
   * z ręką na ekranie i głową przekrzywioną w stronę przycisku. Przy skanie,
   * którego cała wartość polega na powtarzalności kadru, to psuło każde ujęcie.
   */
  useEffect(() => {
    if (odliczanie === null) return;

    if (odliczanie === 0) {
      const id = setTimeout(() => {
        void zapiszKlatke();
        setOdliczanie(null);
      }, 350);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => setOdliczanie(odliczanie - 1), 1000);
    return () => clearTimeout(id);
  }, [odliczanie, zapiszKlatke]);


  async function zPliku(plik: File) {
    const bitmap = await createImageBitmap(plik);
    const blob = await doJpega(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    if (blob) setZrobione((z) => ({ ...z, [ujecie]: blob }));
  }

  /**
   * Wysyłka i analiza.
   *
   * Kolejność jest istotna: najpierw serwer rezerwuje skan (i sprawdza limity),
   * dopiero potem lecą pliki. Odwrotnie znaczyłoby, że po trzech wysłanych
   * zdjęciach człowiek dowiaduje się, że i tak nie może zrobić skanu.
   */
  async function wyslij() {
    setEtap("wysylanie");
    setBlad(null);
    stopCamera();

    try {
      setStatus("Rozpoczynam skan...");
      const start = await fetch("/api/ai/wyglad/start", { method: "POST" });
      const startBody = await start.json();
      if (!start.ok) {
        setBlad(startBody?.error ?? "Nie udało się rozpocząć skanu.");
        setEtap("podglad");
        return;
      }

      const skanId: string = startBody.skanId;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("brak sesji");

      const wpisy = Object.entries(zrobione) as Array<[Ujecie, Blob]>;
      for (const [u, blob] of wpisy) {
        setStatus(`Wysyłam: ${OPIS[u].tytul.toLowerCase()}...`);
        const sciezka = `${user.id}/${skanId}/${u}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("wyglad")
          .upload(sciezka, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(upErr.message);

        const { error: rowErr } = await supabase
          .from("wyglad_zdjecia")
          .insert({ user_id: user.id, skan_id: skanId, ujecie: u, storage_path: sciezka });
        if (rowErr) throw new Error(rowErr.message);
      }

      setEtap("analiza");
      setStatus("Analizuję zdjęcia... to potrwa kilkanaście sekund.");
      const res = await fetch("/api/ai/wyglad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skanId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBlad(body?.error ?? "Analiza się nie udała.");
        setEtap("podglad");
        return;
      }

      onGotowe();
      onClose();
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Coś poszło nie tak.");
      setEtap("podglad");
    }
  }

  const maFront = Boolean(zrobione.front);
  const pracuje = etap !== "podglad";

  return (
    <Sheet
      open={open}
      onClose={pracuje ? () => {} : onClose}
      title={`Skan - ${OPIS[ujecie].tytul}`}
      footer={
        !pracuje && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Anuluj
            </Button>
            <Button onClick={wyslij} disabled={!maFront} className="flex-1">
              {maFront ? `Analizuj (${Object.keys(zrobione).length})` : "Zrób zdjęcie na wprost"}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Ujęcia">
          {KOLEJNOSC.map((u, i) => (
            <button
              key={u}
              type="button"
              role="tab"
              aria-selected={i === krok}
              onClick={() => {
                if (pracuje) return;
                // Zmiana ujęcia przerywa odliczanie - inaczej migawka
                // strzeliłaby w kadr, którego nikt już nie ogląda.
                setOdliczanie(null);
                setKrok(i);
              }}
              className={clsx(
                "flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition",
                i === krok ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
              )}
            >
              {zrobione[u] ? "✓ " : ""}
              {OPIS[u].tytul}
              {!OPIS[u].wymagane && !zrobione[u] && (
                <span className="block text-[10px] text-faint">opcjonalne</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            aria-label="Podgląd z aparatu"
          />

          {/*
            Duch poprzedniego ujęcia. To on decyduje o tym, czy suwak przed/po
            pokaże zmianę twarzy, czy zmianę kąta trzymania telefonu.
          */}
          {duchy[ujecie] && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={duchy[ujecie]}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.28]"
              style={{ transform: "scaleX(-1)" }}
            />
          )}

          {/*
            Prowadnica dopasowana do ujęcia.
            Owal twarzy przy sylwetce był bez sensu: kadrujesz całą postać,
            a na ekranie masz koło na wysokości głowy. Zarys postaci mówi
            wprost, ile miejsca zostawić nad głową i pod stopami - a to od tego
            zależy, czy zdjęcie sprzed trzech miesięcy da się nałożyć na dzisiejsze.
          */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 300 400"
            aria-hidden
          >
            {ujecie === "sylwetka" ? (
              <g
                fill="none"
                strokeWidth="2"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={clsx(kameraOk ? "stroke-[var(--accent)]" : "stroke-white/40")}
              >
                {/* głowa */}
                <circle cx="150" cy="52" r="24" />
                {/* tułów: barki, talia, biodra */}
                <path d="M126 82 L104 108 L98 190 L112 262" />
                <path d="M174 82 L196 108 L202 190 L188 262" />
                <path d="M126 82 Q150 74 174 82" />
                {/* ręce swobodnie wzdłuż ciała */}
                <path d="M104 110 L86 200 L82 250" />
                <path d="M196 110 L214 200 L218 250" />
                {/* nogi */}
                <path d="M112 262 L108 336 L106 380" />
                <path d="M188 262 L192 336 L194 380" />
                <path d="M150 264 L150 330" />
              </g>
            ) : (
              <ellipse
                cx="150"
                cy={ujecie === "profil" ? 180 : 180}
                rx={ujecie === "profil" ? 80 : 95}
                ry="125"
                fill="none"
                strokeWidth="2"
                strokeDasharray="6 6"
                className={clsx(kameraOk ? "stroke-[var(--accent)]" : "stroke-white/40")}
              />
            )}
          </svg>

          {/* Odliczanie - duża cyfra na środku, widoczna z odległości ręki. */}
          {odliczanie !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="text-[96px] font-bold leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
                aria-hidden
              >
                {odliczanie === 0 ? "📸" : odliczanie}
              </span>
            </div>
          )}

          {zrobione[ujecie] && (
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[12px] text-white">
              zrobione ✓
            </div>
          )}
        </div>

        <p className="text-[13px] text-muted" aria-live="polite">
          {odliczanie !== null
            ? `Zdjęcie za ${odliczanie} s - ustaw się i opuść ręce.`
            : OPIS[ujecie].jak}
        </p>
        {duchy[ujecie] && (
          <p className="text-[12px] text-faint">
            Pod spodem widać poprzednie zdjęcie - dopasuj kadr, żeby porównanie miało sens.
          </p>
        )}

        {blad && <Alert tone="danger">{blad}</Alert>}

        <div aria-live="polite" className="min-h-[20px] text-[13px] text-muted">
          {pracuje && (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              {status}
            </span>
          )}
        </div>

        {!pracuje && (
          <div className="flex gap-2">
            {kameraOk ? (
              <Button
                onClick={() => setOdliczanie(odliczanie === null ? ODLICZANIE_S : null)}
                className="flex-1"
                aria-label={
                  odliczanie === null
                    ? `Zrób zdjęcie za ${ODLICZANIE_S} sekund: ${OPIS[ujecie].tytul}`
                    : "Przerwij odliczanie"
                }
              >
                {odliczanie !== null
                  ? `Przerwij (${odliczanie})`
                  : zrobione[ujecie]
                    ? `Zrób ponownie (${ODLICZANIE_S} s)`
                    : `Zrób zdjęcie (${ODLICZANIE_S} s)`}
              </Button>
            ) : (
              <Button onClick={() => void startCamera()} className="flex-1">
                Włącz aparat
              </Button>
            )}
            <label className="flex cursor-pointer items-center rounded-xl bg-surface-2 px-3 text-[13px] font-medium text-muted">
              Z galerii
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={(e) => {
                  const plik = e.target.files?.[0];
                  if (!plik) return;
                  setOdliczanie(null);
                  void zPliku(plik);
                }}
              />
            </label>
          </div>
        )}
      </div>
    </Sheet>
  );
}
