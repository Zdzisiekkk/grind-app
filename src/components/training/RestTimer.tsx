"use client";

import { useEffect, useRef, useState } from "react";
import { mmss } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import { notify } from "@/lib/notify";

/**
 * Co ile odświeżać powiadomienie z odliczaniem.
 *
 * Sam timer liczy co 250 ms - dobre dla animacji paska, fatalne dla
 * powiadomień (Android potrafi je wtedy tłumić jako spam). 5 s wystarcza,
 * żeby zerknięcie na zablokowany ekran pokazało czas z dokładnością, jakiej
 * ktokolwiek potrzebuje w przerwie między seriami.
 */
const NOTIFY_EVERY_S = 10;

/**
 * Odliczanie przerwy między seriami.
 * Startuje samo po zapisaniu serii; pływa nad dolną nawigacją.
 * Liczy od znacznika czasu, a nie przez zliczanie tyknięć - dzięki temu
 * nie gubi sekund, gdy telefon uśpi kartę w tle.
 */
export function RestTimer({
  endsAt,
  totalSeconds,
  onDismiss,
  onExtend,
}: {
  endsAt: number;
  totalSeconds: number;
  onDismiss: () => void;
  onExtend: (seconds: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.round((endsAt - now) / 1000));
  const done = remaining === 0;

  useEffect(() => {
    if (!done || notified.current) return;
    notified.current = true;
    navigator.vibrate?.([180, 90, 180]);
    notify("Grind - przerwa skończona", "Do roboty 💪", "trening-przerwa");
  }, [done]);

  /*
   * Odliczanie jako powiadomienie - "widget" minutnika na zablokowanym
   * ekranie. Ten sam ograniczenie co reszta powiadomień w aplikacji: działa
   * tylko, dopóki karta/PWA żyje w pamięci. Na Androidzie to zwykle cała
   * przerwa między seriami; na iOS system może uśpić stronę wcześniej -
   * wibracja i dźwięk przy końcu (wyżej) i tak dotrą, bo telefon budzi
   * zaplanowany `setInterval` na krótko przed jego odpaleniem.
   */
  useEffect(() => {
    if (done || remaining % NOTIFY_EVERY_S !== 0) return;
    notify("Grind - przerwa", `Zostało ${mmss(remaining)}`, "trening-przerwa");
  }, [remaining, done]);

  useEffect(() => {
    notified.current = false;
  }, [endsAt]);

  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 1;

  return (
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
      <div
        className={clsx(
          "relative mx-auto flex max-w-lg items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 shadow-[var(--shadow)]",
          done ? "border-success bg-[var(--success-soft)]" : "border-border bg-surface",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-accent/12 transition-[width] duration-300"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
        <span className="relative text-lg" aria-hidden>
          {done ? "✅" : "⏱️"}
        </span>
        <div className="relative min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
            {done ? "Przerwa skończona" : "Przerwa"}
          </div>
          <div className="tabular text-[19px] font-bold leading-tight">
            {done ? "Do roboty" : mmss(remaining)}
          </div>
        </div>
        {!done && (
          <button
            type="button"
            onClick={() => onExtend(30)}
            className="relative min-h-9 rounded-lg bg-surface-2 px-2.5 text-[13px] font-semibold"
          >
            +30 s
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Zamknij timer"
          className="relative flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
