"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

const ITEMS = [
  { href: "/", label: "Dziś", icon: "🏠" },
  { href: "/trening", label: "Trening", icon: "🏋️" },
  { href: "/dieta", label: "Dieta", icon: "🍽️" },
  { href: "/progres", label: "Postępy", icon: "📈" },
  { href: "/wiecej", label: "Więcej", icon: "⚙️" },
] as const;

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
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-accent" : "text-faint",
                )}
              >
                <span className="text-[19px] leading-none" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
