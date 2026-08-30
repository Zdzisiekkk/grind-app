"use client";

import { useEffect, useState } from "react";
import { clearRejections, flushQueue, readRejections, type Rejection } from "@/lib/offline/flush";
import { usePendingCount, useOnline } from "@/lib/offline/useOffline";
import { plural } from "@/lib/format";
import { clsx } from "@/lib/clsx";

/**
 * Rejestruje service workera, pilnuje kolejki zapisów i mówi człowiekowi,
 * na czym stoi.
 *
 * Pasek siedzi nad dolną nawigacją, a nie u góry - na iPhonie górna krawędź
 * to notch i pole minowe, a tutaj jest zawsze widoczny i niczego nie zasłania.
 */
export function OfflineGate() {
  const online = useOnline();
  const pending = usePendingCount();
  const [rejections, setRejections] = useState<Rejection[]>([]);

  // Service worker jest potrzebny tylko po to, żeby apka OTWIERAŁA się bez
  // zasięgu. Za nieutracone zapisy odpowiada kolejka, więc brak wsparcia
  // (albo prywatne okno) nic nie psuje.
  //
  // W trybie deweloperskim workera NIE MA i mieć nie może. Trzyma on pliki
  // z `/_next/static/` na zawsze, bo w gotowej aplikacji nazwa takiego pliku
  // zawiera skrót jego treści - inna treść to inna nazwa. Turbopack podczas
  // pracy nazywa je inaczej: ta sama nazwa, co chwilę nowa zawartość. Worker
  // podawał wtedy wczorajszy kawałek kodu do dzisiejszej strony i przeglądarka
  // wywalała się na module, którego już nie ma. Zainstalowanego wcześniej
  // trzeba przy okazji wymieść, bo sam z siebie nie zniknie.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (regs.length === 0) return;
        await Promise.all(regs.map((r) => r.unregister()));
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        // Strona wciąż należy do starego workera aż do przeładowania.
        window.location.reload();
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* prywatne okno albo zablokowane - apka działa dalej, tylko online */
    });
  }, []);

  // Wysyłka: po powrocie sieci, po powrocie do aplikacji i raz na starcie.
  useEffect(() => {
    let alive = true;

    const run = () => {
      if (!navigator.onLine) return;
      flushQueue().then(() => {
        if (alive) setRejections(readRejections());
      });
    };

    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      alive = false;
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);

  if (rejections.length > 0) {
    return (
      <Bar tone="danger">
        <span className="flex-1">
          {rejections.length} {plural(rejections.length, "zapis", "zapisy", "zapisów")} baza
          odrzuciła. Sprawdź, czy nie trzeba wpisać ich jeszcze raz.
        </span>
        <button
          type="button"
          onClick={() => {
            clearRejections();
            setRejections([]);
          }}
          className="shrink-0 font-semibold underline"
        >
          OK
        </button>
      </Bar>
    );
  }

  if (!online) {
    return (
      <Bar tone="warn">
        <span aria-hidden>📡</span>
        <span className="flex-1">
          Brak połączenia.{" "}
          {pending > 0
            ? `${pending} ${plural(pending, "zapis czeka", "zapisy czekają", "zapisów czeka")} w telefonie.`
            : "Zapisy poczekają w telefonie."}
        </span>
      </Bar>
    );
  }

  if (pending > 0) {
    return (
      <Bar tone="info">
        <span aria-hidden className="animate-pulse">
          ⏳
        </span>
        <span className="flex-1">
          Wysyłam {pending} {plural(pending, "zapis", "zapisy", "zapisów")} zrobione bez zasięgu...
        </span>
      </Bar>
    );
  }

  return null;
}

function Bar({ tone, children }: { tone: "warn" | "info" | "danger"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={clsx(
        "fixed inset-x-0 z-30 mx-auto flex max-w-lg items-center gap-2 px-4 py-2 text-[12px] font-medium",
        "bottom-[calc(58px+env(safe-area-inset-bottom))] border-t",
        tone === "warn" && "border-warn/20 bg-[var(--warn-soft)] text-warn",
        tone === "info" && "border-info/20 bg-[var(--info-soft)] text-info",
        tone === "danger" && "border-danger/20 bg-[var(--danger-soft)] text-danger",
      )}
    >
      {children}
    </div>
  );
}
