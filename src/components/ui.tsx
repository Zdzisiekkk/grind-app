"use client";

import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useRef } from "react";

/* ---------------------------------- Karta --------------------------------- */

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={clsx(
        "rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx(padded && "p-4", padded && (title || action) && "pt-3")}>{children}</div>
    </section>
  );
}

/* --------------------------------- Przycisk -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  block,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        size === "sm" && "min-h-9 px-3 text-[13px]",
        size === "md" && "min-h-11 px-4 text-[15px]",
        size === "lg" && "min-h-14 px-5 text-[17px]",
        variant === "primary" && "bg-accent text-[var(--accent-fg)] hover:bg-accent-hover",
        variant === "secondary" && "bg-surface-2 text-text hover:bg-surface-3 border border-border",
        variant === "ghost" && "text-muted hover:bg-surface-2",
        variant === "danger" && "bg-[var(--danger-soft)] text-danger hover:brightness-95",
        variant === "success" && "bg-[var(--success-soft)] text-success hover:brightness-95",
        block && "w-full",
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/* ------------------------------- Pola formularza --------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

const fieldBase =
  "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-text " +
  "placeholder:text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(fieldBase, "min-h-11", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(fieldBase, "min-h-20 resize-y", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(fieldBase, "min-h-11 appearance-none pr-9", className)}>
      {children}
    </select>
  );
}

/* -------------------------------- Drobne części ---------------------------- */

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warn" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "success" && "bg-[var(--success-soft)] text-success",
        tone === "warn" && "bg-[var(--warn-soft)] text-warn",
        tone === "danger" && "bg-[var(--danger-soft)] text-danger",
        tone === "info" && "bg-[var(--info-soft)] text-info",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "accent" | "success" | "danger";
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div
        className={clsx(
          "tabular mt-0.5 text-[20px] font-bold leading-tight",
          tone === "accent" && "text-accent",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon = "🫙",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-xs text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex gap-1 rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={clsx(
            "min-h-9 flex-1 rounded-lg px-2 text-[13px] font-semibold transition-colors",
            o.value === value ? "bg-surface text-text shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Panel z dołu ------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-surface sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="-mr-1 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Komunikaty ------------------------------- */

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "warn" | "info" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={clsx(
        "rounded-xl px-3 py-2.5 text-[13px]",
        tone === "danger" && "bg-[var(--danger-soft)] text-danger",
        tone === "warn" && "bg-[var(--warn-soft)] text-warn",
        tone === "info" && "bg-[var(--info-soft)] text-info",
        tone === "success" && "bg-[var(--success-soft)] text-success",
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------- Szkielety -------------------------------- */

/**
 * Prostokąt-zastępnik na czas ładowania. Ma stały rozmiar, więc treść nie
 * podskakuje, gdy dane dojadą.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

/** Zastępnik całego ekranu — nagłówek i kilka kart. */
export function ScreenSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Wczytywanie">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-[var(--shadow)]"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
      ))}
      <span className="sr-only">Wczytywanie…</span>
    </div>
  );
}
