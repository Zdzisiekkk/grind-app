"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Sheet,
  Stat,
  Textarea,
  Toast,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import {
  URGE_SECONDS,
  bestStreak,
  breathPhase,
  cleanBand,
  cleanSince,
  crisisStepAt,
  dayCells,
  dayWord,
  daysClean,
  formatMinutes,
  lapsesByPartOfDay,
  nextMilestone,
  saved,
  topTriggers,
  urgesResisted,
} from "@/lib/vices";
import type { Vice, ViceEvent } from "@/lib/database.types";

export type ViceWithEvents = Vice & { events: ViceEvent[] };

/** Ikony pod najczęstsze nałogi - reszta i tak jest do wpisania ręcznie. */
const VICE_ICONS = ["🚭", "🍺", "🍬", "📱", "🎰", "🎮", "☕", "🍔", "📺", "💊", "🛒", "🚬"];

const EMPTY = {
  name: "",
  icon: "🚭",
  daily_cost: "",
  daily_minutes: "",
  motivation: "",
};

export function VicesScreen({
  userId,
  vices,
}: {
  userId: string;
  vices: ViceWithEvents[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ViceWithEvents | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [lapsing, setLapsing] = useState<ViceWithEvents | null>(null);
  const [crisis, setCrisis] = useState<ViceWithEvents | null>(null);
  const [lapseTrigger, setLapseTrigger] = useState("");
  const [lapseNote, setLapseNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; seq: number } | null>(null);

  /** Kolejny numer montuje toast od nowa, więc dwa zapisy pod rząd oba widać. */
  function showToast(text: string) {
    setToast((prev) => ({ text, seq: (prev?.seq ?? 0) + 1 }));
  }

  function openNew() {
    setEditing(null);
    setDraft(EMPTY);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(vice: ViceWithEvents) {
    setEditing(vice);
    setDraft({
      name: vice.name,
      icon: vice.icon,
      daily_cost: vice.daily_cost === null ? "" : String(vice.daily_cost),
      daily_minutes: vice.daily_minutes === null ? "" : String(vice.daily_minutes),
      motivation: vice.motivation ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);

    const numOrNull = (raw: string) => {
      const n = Number(raw.replace(",", "."));
      return raw.trim() && Number.isFinite(n) && n >= 0 ? n : null;
    };

    const payload = {
      user_id: userId,
      name: draft.name.trim(),
      icon: draft.icon,
      daily_cost: numOrNull(draft.daily_cost),
      daily_minutes: numOrNull(draft.daily_minutes),
      motivation: draft.motivation.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("vices").update(payload).eq("id", editing.id)
      : await supabase.from("vices").insert({ ...payload, order_index: vices.length });

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setFormOpen(false);
    showToast(editing ? "Zapisano zmiany" : "Licznik wystartował");
    router.refresh();
  }

  /** Chęć, która minęła. Licznika nie rusza - i o to chodzi. */
  async function logUrge(vice: ViceWithEvents) {
    const { error } = await supabase
      .from("vice_events")
      .insert({ user_id: userId, vice_id: vice.id, kind: "urge" });

    if (error) setError(`Nie udało się zapisać: ${error.message}`);
    else {
      navigator.vibrate?.(12);
      setCrisis(null);
      showToast("Zapisane. Ta chęć minęła.");
      router.refresh();
    }
  }

  async function logLapse() {
    if (!lapsing) return;
    setSaving(true);

    const { error } = await supabase.from("vice_events").insert({
      user_id: userId,
      vice_id: lapsing.id,
      kind: "lapse",
      trigger: lapseTrigger.trim() || null,
      note: lapseNote.trim() || null,
    });

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setLapsing(null);
    setCrisis(null);
    setLapseTrigger("");
    setLapseNote("");
    showToast("Zapisane. Licznik startuje od nowa.");
    router.refresh();
  }

  async function remove(vice: ViceWithEvents) {
    if (!confirm(`Usunąć "${vice.name}" razem z całą historią?`)) return;
    const { error } = await supabase.from("vices").delete().eq("id", vice.id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Nałogi</h1>
          <p className="mt-0.5 text-[13px] text-muted">Tu wygrywa dzień, w którym nic nie zrobiłeś.</p>
        </div>
        <Button variant="primary" onClick={openNew}>
          + Dodaj
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {vices.length === 0 ? (
        <Card>
          <EmptyState
            icon="🚭"
            title="Nic tu jeszcze nie walczysz"
            description="Papierosy, alkohol, słodycze, scrollowanie przed snem - dodaj to, co chcesz odstawić, a licznik zacznie iść od dziś."
            action={
              <Button variant="primary" onClick={openNew}>
                Dodaj pierwszy
              </Button>
            }
          />
        </Card>
      ) : (
        vices.map((vice) => (
          <ViceCard
            key={vice.id}
            vice={vice}
            onUrge={() => setCrisis(vice)}
            onLapse={() => setLapsing(vice)}
            onEdit={() => openEdit(vice)}
            onDelete={() => remove(vice)}
          />
        ))
      )}

      {/* --------------------------- Nowy / edycja --------------------------- */}
      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edytuj nałóg" : "Nowy nałóg"}
        footer={
          <Button variant="primary" size="lg" block loading={saving} onClick={save}>
            {editing ? "Zapisz" : "Zacznij liczyć"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Co odstawiasz">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="np. Papierosy"
              autoFocus
            />
          </Field>

          <Field label="Ikona">
            <div className="grid grid-cols-6 gap-1.5">
              {VICE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setDraft({ ...draft, icon })}
                  aria-pressed={draft.icon === icon}
                  aria-label={`Ikona ${icon}`}
                  className={clsx(
                    "flex min-h-11 items-center justify-center rounded-xl text-[20px] transition-transform active:scale-95",
                    draft.icon === icon ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2",
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Kosztował dziennie (zł)" hint="Zostaw puste, jeśli nie chcesz liczyć.">
              <Input
                inputMode="decimal"
                value={draft.daily_cost}
                onChange={(e) => setDraft({ ...draft, daily_cost: e.target.value })}
                placeholder="20"
              />
            </Field>
            <Field label="Zabierał dziennie (min)">
              <Input
                inputMode="numeric"
                value={draft.daily_minutes}
                onChange={(e) => setDraft({ ...draft, daily_minutes: e.target.value })}
                placeholder="60"
              />
            </Field>
          </div>

          <Field
            label="Po co to robisz"
            hint="Zobaczysz to w momencie, w którym najbardziej się zachce."
          >
            <Textarea
              rows={3}
              value={draft.motivation}
              onChange={(e) => setDraft({ ...draft, motivation: e.target.value })}
              placeholder="Chcę wrócić do sparingów bez zadyszki."
            />
          </Field>

          {editing && (
            <Button variant="danger" block onClick={() => remove(editing)}>
              Usuń nałóg
            </Button>
          )}
        </div>
      </Sheet>

      {/* ------------------------------- Wpadka ------------------------------ */}
      <Sheet
        open={lapsing !== null}
        onClose={() => setLapsing(null)}
        title="Wpadka"
        footer={
          <Button variant="danger" size="lg" block loading={saving} onClick={logLapse}>
            Zapisz i zacznij od nowa
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="info">
            Zapisanie wpadki to nie kara. Bez niej licznik kłamie, a wzorzec - to, co ją
            wywołuje - nigdy nie wyjdzie na jaw.
          </Alert>

          <Field label="Co to wywołało" hint="Krótko i tak samo za każdym razem, np. stres, alkohol, nuda.">
            <Input
              value={lapseTrigger}
              onChange={(e) => setLapseTrigger(e.target.value)}
              placeholder="stres"
              autoFocus
            />
          </Field>

          <Field label="Notatka">
            <Textarea
              rows={3}
              value={lapseNote}
              onChange={(e) => setLapseNote(e.target.value)}
              placeholder="Co się działo tuż przedtem?"
            />
          </Field>
        </div>
      </Sheet>

      {/* ----------------------------- Mam ochotę ---------------------------- */}
      <Sheet open={crisis !== null} onClose={() => setCrisis(null)} title="Mam ochotę">
        {crisis && (
          <CrisisPanel
            // Klucz po nałogu: przełączenie na inny zaczyna odliczanie od nowa,
            // zamiast dziedziczyć sekundy z poprzedniego.
            key={crisis.id}
            vice={crisis}
            onSurvived={() => logUrge(crisis)}
            onGaveIn={() => {
              setCrisis(null);
              setLapsing(crisis);
            }}
          />
        )}
      </Sheet>

      {toast && <Toast key={toast.seq}>{toast.text}</Toast>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ViceCard({
  vice,
  onUrge,
  onLapse,
  onEdit,
  onDelete,
}: {
  vice: ViceWithEvents;
  onUrge: () => void;
  onLapse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysClean(vice, vice.events);
  const best = bestStreak(vice, vice.events);
  const money = saved(vice, days);
  const triggers = topTriggers(vice.events);
  const resisted = urgesResisted(vice.events);
  const band = cleanBand(days);
  const since = cleanSince(vice, vice.events);
  const milestone = nextMilestone(days);
  const cells = dayCells(vice, vice.events);
  const parts = lapsesByPartOfDay(vice.events);
  const recent = vice.events.slice(0, 10);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{vice.icon}</span>
          {vice.name}
        </span>
      }
      subtitle={`Od ${since.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}`}
      action={
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edytuj ${vice.name}`}
            className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2"
          >
            ⋯
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Usuń ${vice.name}`}
            className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger"
          >
            🗑
          </button>
        </span>
      }
    >
      {/* Licznik - jedyna liczba, po którą naprawdę się tu wchodzi. */}
      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "tabular text-[44px] font-bold leading-none",
            band === "start" && "text-warn",
            band === "week" && "text-accent",
            band === "month" && "text-success",
            band === "solid" && "text-success",
          )}
        >
          {days}
        </span>
        <span className="text-[15px] font-semibold text-muted">{dayWord(days)} czysto</span>
      </div>

      {vice.motivation && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] italic text-muted">
          &bdquo;{vice.motivation}&rdquo;
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Rekord" value={best} sub={dayWord(best)} />
        <Stat
          label="Zaoszczędzone"
          value={vice.daily_cost ? `${money.money.toFixed(0)} zł` : "-"}
          sub={vice.daily_minutes ? formatMinutes(money.minutes) : undefined}
          tone={vice.daily_cost ? "success" : undefined}
        />
        <Stat label="Chęci pokonane" value={resisted} tone={resisted > 0 ? "accent" : undefined} />
      </div>

      {milestone && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="font-medium text-muted">
              {milestone.remaining} {dayWord(milestone.remaining)} do {milestone.target}
            </span>
            <span className="tabular text-faint">
              {days}/{milestone.target}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, (days / milestone.target) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Passa w jednej liczbie nie pokazuje kształtu - a kształt widać od razu:
          czy wpadki są rozrzucone, czy chodzą parami. */}
      <div className="mt-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
          Ostatnie 90 dni
        </p>
        <div className="mt-1.5 flex flex-wrap gap-[3px]">
          {cells.map((cell) => (
            <span
              key={cell.date}
              title={`${cell.date}${cell.state === "lapse" ? " - wpadka" : ""}`}
              className={clsx(
                "size-[9px] rounded-[2px]",
                cell.state === "before" && "bg-surface-2 opacity-40",
                cell.state === "clean" && "bg-success/70",
                cell.state === "lapse" && "bg-danger",
              )}
            />
          ))}
        </div>
      </div>

      {triggers.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
            Co Cię najczęściej łamie
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {triggers.map((t) => (
              <Chip key={t.trigger} tone={t.count > 1 ? "warn" : "neutral"}>
                {t.trigger} · {t.count}×
              </Chip>
            ))}
          </div>
          {parts.length > 0 && (
            <p className="mt-1.5 text-[12px] text-muted">
              Najczęściej {parts[0].label} - {parts[0].count}×.
            </p>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <details className="mt-3 rounded-xl bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-medium text-muted">
            Historia ({vice.events.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {recent.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-[12px]">
                <span aria-hidden>{e.kind === "lapse" ? "🔴" : "🟢"}</span>
                <span className="tabular shrink-0 text-faint">
                  {new Date(e.occurred_at).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {e.kind === "lapse" ? e.trigger || "wpadka" : "chęć minęła"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="success" onClick={onUrge}>
          Mam ochotę
        </Button>
        <Button variant="ghost" onClick={onLapse} className="text-danger">
          Wpadka
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Prowadnica oddechu 4-7-8.
 *
 * Okrąg rośnie na wdechu, stoi przy wstrzymaniu i maleje na wydechu - tempo
 * widać, więc nie trzeba go liczyć. Rozmiar zmieniamy stylem, nie animacją
 * CSS, bo faza musi się zgadzać z sekundą na zegarze, a nie biec własnym
 * rytmem. Przy `prefers-reduced-motion` przejście i tak jest wyłączone
 * globalnie w globals.css, a sama liczba sekund zostaje czytelna.
 */
function BreathingGuide({ elapsed }: { elapsed: number }) {
  const { label, left, total, progress } = breathPhase(elapsed);

  // Wdech rośnie, wydech maleje, wstrzymanie stoi u góry.
  const scale =
    label === "wdech" ? 0.55 + progress * 0.45
    : label === "wstrzymaj" ? 1
    : 1 - progress * 0.45;

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex size-[120px] items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full bg-accent/15 ring-2 ring-accent/40 transition-transform duration-1000 ease-linear"
          style={{ width: 120, height: 120, transform: `scale(${scale})` }}
        >
          <span className="tabular text-[26px] font-bold text-accent">{Math.ceil(left)}</span>
        </div>
      </div>
      <p className="text-[13px] font-medium uppercase tracking-wide text-muted">
        {label} · {total} s
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Panel na moment, w którym się chce.
 *
 * Fala chęci opada sama - problem w tym, że w jej środku nie da się w to
 * uwierzyć. Dlatego zegar ma widoczny koniec, a obok stoi to, co realnie
 * jest do stracenia: passa i pieniądze. To jedyny ekran w aplikacji, który
 * ma coś odwlec, a nie coś zapisać.
 */
function CrisisPanel({
  vice,
  onSurvived,
  onGaveIn,
}: {
  vice: ViceWithEvents;
  onSurvived: () => void;
  onGaveIn: () => void;
}) {
  const [left, setLeft] = useState(URGE_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const days = daysClean(vice, vice.events);
  const money = saved(vice, days);
  const triggers = topTriggers(vice.events, 1);
  const resisted = urgesResisted(vice.events);
  const done = left <= 0;
  const { step, index, count } = crisisStepAt(left);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-2 px-4 py-5 text-center">
        <p className="text-[13px] text-muted">
          {done ? "Fala opadła." : "Przeczekaj. Chęć nie rośnie w nieskończoność."}
        </p>
        <p
          className={clsx(
            "tabular mt-1 text-[52px] font-bold leading-none",
            done ? "text-success" : "text-accent",
          )}
        >
          {mm}:{ss}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className={clsx("h-full rounded-full", done ? "bg-success" : "bg-accent")}
            style={{ width: `${((URGE_SECONDS - left) / URGE_SECONDS) * 100}%` }}
          />
        </div>
      </div>

      {!done && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
            Do zrobienia teraz · {index + 1} z {count}
          </p>
          <h3 className="mt-1 text-[16px] font-semibold">{step.title}</h3>
          <p className="mt-1 text-[14px] text-muted">{step.body}</p>
          {step.breathing && <BreathingGuide elapsed={URGE_SECONDS - left} />}
        </div>
      )}

      {vice.motivation && (
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
            Po co to robisz
          </p>
          <p className="mt-1 text-[15px] font-medium italic">&bdquo;{vice.motivation}&rdquo;</p>
        </div>
      )}

      <div>
        <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
          Co stracisz w tej sekundzie
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <Stat label="Passa" value={days} sub={dayWord(days)} tone="danger" />
          <Stat
            label="Odłożone"
            value={vice.daily_cost ? `${money.money.toFixed(0)} zł` : "-"}
            sub={vice.daily_minutes ? formatMinutes(money.minutes) : undefined}
          />
        </div>
      </div>

      {triggers.length > 0 && (
        <Alert tone="info">
          Ostatnio łamał Cię najczęściej <strong>{triggers[0].trigger}</strong>. Jeśli to
          teraz to samo - wiesz już, że to minie.
        </Alert>
      )}

      {resisted > 0 && (
        <p className="text-center text-[13px] text-muted">
          Przeczekałeś już <strong className="text-text">{resisted}</strong>{" "}
          {resisted === 1 ? "taką falę" : "takich fal"}. Ta niczym się od tamtych nie różni.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="success" size="lg" block onClick={onSurvived}>
          Przetrwałem
        </Button>
        <Button variant="ghost" block onClick={onGaveIn} className="text-danger">
          Nie dałem rady
        </Button>
      </div>

      <p className="text-center text-[12px] text-faint">
        Jedno i drugie zapisuje się w historii. Wpadka nie kasuje rekordu.
      </p>
    </div>
  );
}
