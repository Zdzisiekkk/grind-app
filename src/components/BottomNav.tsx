"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { Sheet } from "@/components/ui";

/**
 * Pięć zakładek i przycisk dodawania pośrodku.
 *
 * Wcześniej było ich siedem. Siedem ikon na szerokości telefonu daje pola
 * poniżej pięćdziesięciu punktów - poniżej progu, przy którym trafia się
 * kciukiem za pierwszym razem - a etykiety trzeba było łamać na dwie linijki
 * ("Nawyki / i nałogi"), co samo w sobie jest przyznaniem, że coś się nie
 * mieści. Rzeczy, które uzupełnia się codziennie, mają być dostępne szybko;
 * reszta może żyć w "Więcej", byle dało się tam trafić.
 *
 * Środkowy przycisk nie jest kolejną zakładką - to skrót do zapisania
 * czegokolwiek, bez wchodzenia w odpowiedni ekran. Dokładnie ta czynność
 * dzieje się w aplikacji najczęściej.
 */
const ITEMS = [
  { href: "/", label: "Dziś", icon: "🏠" },
  { href: "/trening", label: "Trening", icon: "🏋️" },
  { href: "/dieta", label: "Dieta", icon: "🍽️" },
  { href: "/wiecej", label: "Więcej", icon: "⚙️" },
] as const;

/** Co da się dodać z przycisku "+" - w kolejności, w jakiej robi się to często. */
const SKROTY = [
  { href: "/dieta", ikona: "🍽️", tytul: "Posiłek", opis: "Wyszukaj produkt, opisz słowami albo zrób zdjęcie" },
  { href: "/trening", ikona: "🏋️", tytul: "Trening", opis: "Zacznij sesję z planu albo zapisz zrobioną" },
  { href: "/nawyki", ikona: "🔥", tytul: "Nawyk lub nałóg", opis: "Odhacz dzisiejsze, zgłoś ochotę albo wpadkę" },
  { href: "/sen", ikona: "😴", tytul: "Sen", opis: "Zapisz noc: godziny, jakość i drzemki" },
  { href: "/zadania", ikona: "☑️", tytul: "Zadanie", opis: "Dorzuć coś do listy albo odhacz zrobione" },
] as const;

/**
 * Kropka pod ikoną: pełna, gdy zakładka jest aktywna, pulsująca, gdy trwa
 * przejście. Ma stały rozmiar i zawsze jest w drzewie - zmienia się tylko
 * przezroczystość, więc nic nie skacze.
 */
function TabIndicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={clsx(
        "block size-1 rounded-full bg-current transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : active ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function Zakladka({
  item,
  active,
}: {
  item: (typeof ITEMS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-0.5",
        "px-0.5 text-center text-[10px] font-medium leading-tight transition-colors duration-100",
        // Natychmiastowa reakcja na dotyk - nie czekamy na odpowiedź serwera.
        "active:bg-surface-2",
        active ? "text-accent" : "text-faint",
      )}
    >
      <span className="text-[18px] leading-none" aria-hidden>
        {item.icon}
      </span>
      <span className="w-full truncate">{item.label}</span>
      <TabIndicator active={active} />
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [dodawanie, setDodawanie] = useState(false);

  const aktywna = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav
        aria-label="Nawigacja główna"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-lg"
      >
        <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
          {ITEMS.slice(0, 2).map((item) => (
            <li key={item.href} className="flex-1">
              <Zakladka item={item} active={aktywna(item.href)} />
            </li>
          ))}

          <li className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setDodawanie(true)}
              aria-label="Dodaj wpis"
              className="flex size-11 touch-manipulation items-center justify-center rounded-full bg-accent text-[22px] font-light leading-none text-white shadow-[var(--shadow)] transition-transform active:scale-95"
            >
              <span aria-hidden>+</span>
            </button>
          </li>

          {ITEMS.slice(2).map((item) => (
            <li key={item.href} className="flex-1">
              <Zakladka item={item} active={aktywna(item.href)} />
            </li>
          ))}
        </ul>
      </nav>

      <Sheet open={dodawanie} onClose={() => setDodawanie(false)} title="Co chcesz zapisać?">
        <ul className="flex flex-col gap-1.5">
          {SKROTY.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                onClick={() => setDodawanie(false)}
                className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 active:bg-surface"
              >
                <span className="text-[22px]" aria-hidden>
                  {s.ikona}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium leading-tight">{s.tytul}</span>
                  <span className="block text-[12px] leading-snug text-muted">{s.opis}</span>
                </span>
                <span className="text-faint" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
