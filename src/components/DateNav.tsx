"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, humanDate, longDate, todayISO } from "@/lib/format";
import { clsx } from "@/lib/clsx";

/** Przełącznik dnia: ‹ wczoraj — dzisiaj — jutro › plus skok do dowolnej daty. */
export function DateNav({ date, basePath }: { date: string; basePath: string }) {
  const router = useRouter();
  const isToday = date === todayISO();

  const go = (next: string) => router.push(`${basePath}?d=${next}` as never);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(addDaysISO(date, -1))}
        aria-label="Poprzedni dzień"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg"
      >
        ‹
      </button>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Wybierz datę</span>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span className="pointer-events-none flex min-h-11 flex-col items-center justify-center rounded-xl bg-surface-2 px-3">
          <span className={clsx("text-[15px] font-semibold capitalize", isToday && "text-accent")}>
            {humanDate(date)}
          </span>
          <span className="text-[11px] text-faint">{longDate(date)}</span>
        </span>
      </label>

      <button
        type="button"
        onClick={() => go(addDaysISO(date, 1))}
        disabled={isToday}
        aria-label="Następny dzień"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg disabled:opacity-35"
      >
        ›
      </button>
    </div>
  );
}
