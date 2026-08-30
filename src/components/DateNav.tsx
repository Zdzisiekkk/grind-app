"use client";

import { useRouter } from "next/navigation";
import { addDaysISO, humanDate, longDate, todayISO } from "@/lib/format";
import { DNI_WSTECZ, najstarszaData } from "@/lib/wstecz";
import { clsx } from "@/lib/clsx";

/**
 * Przełącznik dnia: ‹ wczoraj - dzisiaj - jutro › plus skok do dowolnej daty.
 *
 * Dieta pozwala cofnąć się dowolnie daleko, bo tam wpis to fakt o jednym dniu
 * i niczego nie przelicza. Ekrany z passami dostają okno `DNI_WSTECZ` - stąd
 * `ograniczWstecz`, a nie jedno zachowanie dla wszystkich.
 */
export function DateNav({
  date,
  basePath,
  ograniczWstecz = false,
}: {
  date: string;
  basePath: string;
  /** Czy blokować cofanie poza okno wpisywania wstecz. */
  ograniczWstecz?: boolean;
}) {
  const router = useRouter();
  const dzis = todayISO();
  const isToday = date === dzis;
  const najstarsza = ograniczWstecz ? najstarszaData(dzis) : null;
  const naGranicy = najstarsza !== null && date <= najstarsza;

  const go = (next: string) => router.push(`${basePath}?d=${next}` as never);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(addDaysISO(date, -1))}
          disabled={naGranicy}
          aria-label="Poprzedni dzień"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg disabled:opacity-35"
        >
          ‹
        </button>

        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Wybierz datę</span>
          <input
            type="date"
            value={date}
            min={najstarsza ?? undefined}
            max={dzis}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span
            className={clsx(
              "pointer-events-none flex min-h-11 flex-col items-center justify-center rounded-xl px-3",
              // Przeszły dzień ma inne tło niż dzisiaj: odhaczenie wczorajszego
              // nawyku w przekonaniu, że wpisuje się dzisiejszy, to błąd,
              // którego potem nikt nie zauważy.
              isToday ? "bg-surface-2" : "bg-[var(--warn-soft)]",
            )}
          >
            <span
              className={clsx(
                "text-[15px] font-semibold capitalize",
                isToday ? "text-accent" : "text-warn",
              )}
            >
              {humanDate(date)}
            </span>
            <span className={clsx("text-[11px]", isToday ? "text-faint" : "text-warn")}>
              {longDate(date)}
            </span>
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

      {naGranicy && (
        <p className="px-1 text-center text-[11px] text-faint">
          Dalej wstecz nie wpiszesz - okno to {DNI_WSTECZ} dni.
        </p>
      )}
    </div>
  );
}
