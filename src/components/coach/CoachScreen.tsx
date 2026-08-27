"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Card, Chip, EmptyState, Input, Spinner } from "@/components/ui";
import { acceptProposal, rejectProposal } from "@/app/(app)/trener/actions";
import { humanDate } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { CoachMessage, CoachProposal } from "@/lib/database.types";

const KIND_LABEL: Record<CoachProposal["kind"], { icon: string; label: string }> = {
  diet_kcal: { icon: "🍽️", label: "Zmiana celu kalorycznego" },
  training: { icon: "🏋️", label: "Rada treningowa" },
  note: { icon: "👁️", label: "Obserwacja" },
};

export function CoachScreen({
  pro,
  proposals,
  history,
  callsToday,
  dailyLimit,
  configured,
}: {
  pro: boolean;
  proposals: CoachProposal[];
  history: CoachMessage[];
  callsToday: number;
  dailyLimit: number;
  /** Czy klucz do modelu jest w ogóle wpisany po stronie serwera. */
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"analyze" | "chat" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  async function call(payload: object, kind: "analyze" | "chat") {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Trener nie odpowiedział.");
        return;
      }
      if (kind === "analyze") setSummary(data.summary ?? null);
      else setQuestion("");
      router.refresh();
    } catch {
      setError("Brak połączenia. Trener działa tylko online.");
    } finally {
      setBusy(null);
    }
  }

  if (!pro) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Trener AI</h1>
        <Card>
          <EmptyState
            icon="✨"
            title="To jest część wersji płatnej"
            description="Trener patrzy na Twoje treningi, dietę, sen i kontuzje naraz, mówi, co konkretnie stoi w miejscu, i proponuje jedną zmianę. Wykrywanie problemów działa na Twoich liczbach — dostęp dotyczy wyjaśnień i propozycji."
            action={
              <Link href="/subskrypcja">
                <Button variant="primary" size="lg">
                  Zobacz, co dostajesz
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const left = Math.max(0, dailyLimit - callsToday);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Trener AI</h1>
          <p className="text-[13px] text-muted">
            Proponuje. Decydujesz Ty — nic nie zmienia się samo.
          </p>
        </div>
        <Chip tone={left > 2 ? "neutral" : "warn"}>{left} / {dailyLimit} dziś</Chip>
      </header>

      {!configured && (
        <Alert tone="warn">
          Klucz do modelu nie jest jeszcze wpisany po stronie serwera, więc trener nie ma czym
          myśleć. Reszta aplikacji działa normalnie.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <Button
        variant="primary"
        size="lg"
        block
        loading={busy === "analyze"}
        disabled={left === 0 || !configured}
        onClick={() => call({ mode: "analyze" }, "analyze")}
      >
        {left === 0 ? "Limit na dziś wyczerpany" : "Przeanalizuj ostatni miesiąc"}
      </Button>

      {summary && (
        <Card title="Podsumowanie">
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{summary}</p>
        </Card>
      )}

      {/* --- Propozycje --- */}
      {proposals.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-faint">
            Czeka na Twoją decyzję
          </h2>
          {proposals.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <span className="text-[20px]" aria-hidden>
                  {KIND_LABEL[p.kind].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
                    {KIND_LABEL[p.kind].label}
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold leading-tight">{p.title}</p>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted">
                    {p.rationale}
                  </p>

                  {typeof (p.action as { daily_kcal?: number }).daily_kcal === "number" && (
                    <p className="mt-2 text-[13px]">
                      Po zatwierdzeniu cel dzienny zmieni się na{" "}
                      <span className="font-bold">
                        {(p.action as { daily_kcal: number }).daily_kcal} kcal
                      </span>
                      .
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="success"
                      loading={pending}
                      onClick={() => startTransition(() => acceptProposal(p.id))}
                    >
                      {Object.keys(p.action).length > 0 ? "Zastosuj" : "Przyjmuję"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => startTransition(() => rejectProposal(p.id))}
                    >
                      Odrzuć
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* --- Rozmowa --- */}
      <Card title="Zapytaj o cokolwiek" subtitle="Trener widzi Twoje dane z ostatniego miesiąca">
        {history.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {history.map((m) => (
              <li
                key={m.id}
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-accent text-[var(--accent-fg)]"
                    : "bg-surface-2 text-text",
                )}
              >
                <span className="whitespace-pre-line">{m.content}</span>
                <span className="mt-1 block text-[10px] opacity-60">
                  {humanDate(m.created_at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) call({ mode: "chat", message: question.trim() }, "chat");
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="np. dlaczego wyciskanie stoi od miesiąca?"
            disabled={left === 0 || !configured}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!question.trim() || left === 0 || !configured}
          >
            {busy === "chat" ? <Spinner /> : "Wyślij"}
          </Button>
        </form>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        Trener nie jest lekarzem ani fizjoterapeutą. Przy bólu i kontuzjach jego rady nie
        zastępują konsultacji ze specjalistą.
      </p>
    </div>
  );
}
