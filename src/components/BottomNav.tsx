"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

const ITEMS = [
  { href: "/", label: "Dziś", icon: "🏠" },
  { href: "/trening", label: "Trening", icon: "🏋️" },
  { href: "/dieta", label: "Dieta", icon: "🍽️" },
  { href: "/progres", label: "Postępy", icon: "📈" },
  { href: "/wiecej", label: "Więcej", icon: "⚙️" },
] as const;

/**
 * Kropka pod ikoną: pełna, gdy zakładka jest aktywna, pulsująca, gdy trwa
 * przejście. Ma stały rozmiar i zawsze jest w drzewie — zmienia się tylko
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

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Nawigacja główna"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-0.5",
                  "text-[11px] font-medium transition-colors duration-100",
                  // Natychmiastowa reakcja na dotyk — nie czekamy na odpowiedź serwera.
                  "active:bg-surface-2",
                  active ? "text-accent" : "text-faint",
                )}
              >
                <span className="text-[19px] leading-none" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
                <TabIndicator active={active} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
