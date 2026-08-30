import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui";

/**
 * Wspólna oprawa dokumentów.
 *
 * Ostrzeżenie na górze jest tam celowo i ma tam zostać do czasu, aż ktoś
 * z uprawnieniami przejrzy treść. Dokument, który wygląda na gotowy, a nie
 * został sprawdzony, jest gorszy niż jego brak - bo nikt do niego nie wróci.
 */
export function LegalPage({
  title,
  updated,
  draft = true,
  children,
}: {
  title: string;
  updated: string;
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 py-6">
      <header>
        <Link href="/" className="text-[13px] font-medium text-accent">
          ← Wróć do aplikacji
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-[13px] text-muted">Ostatnia aktualizacja: {updated}</p>
      </header>

      {draft && (
        <Alert tone="warn">
          <span className="font-semibold">Wersja robocza.</span> Ten dokument został
          przygotowany jako szkielet i wymaga uzupełnienia danych administratora oraz
          sprawdzenia przez prawnika, zanim aplikacja zostanie udostępniona publicznie.
        </Alert>
      )}

      <div className="flex flex-col gap-5 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[17px] font-bold leading-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Miejsce do uzupełnienia przez właściciela - celowo rzuca się w oczy. */
export function ToFill({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-[var(--warn-soft)] px-1 font-semibold text-warn">
      [{children}]
    </mark>
  );
}
