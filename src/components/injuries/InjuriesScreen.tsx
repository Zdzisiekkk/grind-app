"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chip, EmptyState, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { PainPicker } from "@/components/injuries/PainPicker";
import { DataWpisu } from "@/components/DataWpisu";
import {
  BODY_PARTS,
  INJURY_SIDES,
  INJURY_STATUSES,
  bodyPart,
  injurySideLabel,
  injuryStatusTone,
  painDescriptor,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { shortDate } from "@/lib/format";
import type { Injury, InjurySide, InjuryStatus } from "@/lib/database.types";

export type InjuryWithPain = Injury & {
  lastLevel: number | null;
  lastDate: string | null;
  entries: number;
};

const EMPTY = {
  name: "",
  body_part: "knee",
  side: "none" as InjurySide,
  status: "active" as InjuryStatus,
  started_at: "",
  note: "",
  track_pain: true,
};

export function InjuriesScreen({
  userId,
  injuries,
  today,
}: {
  userId: string;
  injuries: InjuryWithPain[];
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InjuryWithPain | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [rating, setRating] = useState<InjuryWithPain | null>(null);
  const [painDate, setPainDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = injuries.filter((i) => i.status !== "healed");
  const healed = injuries.filter((i) => i.status === "healed");

  function openNew() {
    setEditing(null);
    setDraft(EMPTY);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(injury: InjuryWithPain) {
    setEditing(injury);
    setDraft({
      name: injury.name,
      body_part: injury.body_part,
      side: injury.side,
      status: injury.status,
      started_at: injury.started_at ?? "",
      note: injury.note ?? "",
      track_pain: injury.track_pain,
    });
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      user_id: userId,
      name: draft.name.trim(),
      body_part: draft.body_part,
      side: draft.side,
      status: draft.status,
      started_at: draft.started_at || null,
      healed_at: draft.status === "healed" ? (editing?.healed_at ?? today) : null,
      note: draft.note.trim() || null,
      track_pain: draft.track_pain,
    };

    const { error } = editing
      ? await supabase.from("injuries").update(payload).eq("id", editing.id)
      : await supabase.from("injuries").insert(payload);

    setSaving(false);
    if (error) {
      setError(`Nie udało się zapisać: ${error.message}`);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function remove(injury: InjuryWithPain) {
    const msg = injury.entries
      ? `Usunąć "${injury.name}" razem z ${injury.entries} ocenami bólu? Tego nie da się cofnąć.`
      : `Usunąć "${injury.name}"?`;
    if (!confirm(msg)) return;

    const { error } = await supabase.from("injuries").delete().eq("id", injury.id);
    if (error) setError(`Nie udało się usunąć: ${error.message}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kontuzje</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Apka pyta o ocenę po treningach, a wykres pokazuje, czy idzie w dobrą stronę.
          </p>
        </div>
        <Button variant="primary" onClick={openNew}>
          + Dodaj
        </Button>
      </header>

      {error && <Alert>{error}</Alert>}

      {injuries.length === 0 ? (
        <Card>
          <EmptyState
            icon="🩹"
            title="Brak kontuzji na liście"
            description="Dodaj każdą, którą chcesz mieć na oku - kolano, bark, plecy, cokolwiek. Po treningu apka sama zapyta o ból."
            action={
              <Button variant="primary" onClick={openNew}>
                Dodaj pierwszą
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="flex flex-col gap-2">
              {active.map((injury) => (
                <InjuryCard
                  key={injury.id}
                  injury={injury}
                  onRate={() => {
                    // Arkusz zawsze otwiera się na dzisiaj: cofnięcie daty ma
                    // być świadomym ruchem, a nie pozostałością po poprzedniej
                    // ocenie.
                    setPainDate(today);
                    setRating(injury);
                  }}
                  onEdit={() => openEdit(injury)}
                  onDelete={() => remove(injury)}
                />
              ))}
            </div>
          )}

          {healed.length > 0 && (
            <Card title="Wyleczone" subtitle="Historia zostaje, ocen już nie zbieramy">
              <div className="flex flex-col gap-2">
                {healed.map((injury) => (
                  <InjuryCard
                    key={injury.id}
                    injury={injury}
                    compact
                    onEdit={() => openEdit(injury)}
                    onDelete={() => remove(injury)}
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edytuj kontuzję" : "Nowa kontuzja"}
      >
        <div className="flex flex-col gap-4">
          <Field label="Nazwa" hint="Tak, jak sam o niej myślisz.">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="np. Lewe kolano po ACL"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Część ciała">
              <Select
                value={draft.body_part}
                onChange={(e) => setDraft({ ...draft, body_part: e.target.value })}
              >
                {BODY_PARTS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.icon} {b.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Strona">
              <Select
                value={draft.side}
                onChange={(e) => setDraft({ ...draft, side: e.target.value as InjurySide })}
              >
                {INJURY_SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Status"
            hint={INJURY_STATUSES.find((s) => s.value === draft.status)?.hint}
          >
            <Select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as InjuryStatus })}
            >
              {INJURY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Od kiedy (opcjonalnie)">
            <Input
              type="date"
              value={draft.started_at}
              onChange={(e) => setDraft({ ...draft, started_at: e.target.value })}
            />
          </Field>

          <Field label="Notatka (opcjonalnie)">
            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="np. zakaz głębokiego przysiadu do końca rehabilitacji"
              rows={2}
            />
          </Field>

          <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-[var(--accent)]"
              checked={draft.track_pain}
              onChange={(e) => setDraft({ ...draft, track_pain: e.target.checked })}
            />
            <span className="text-[13px]">
              <span className="font-medium">Pytaj o ból po treningu</span>
              <span className="block text-muted">
                Po dniach oznaczonych w planie apka poprosi o ocenę w skali 0-10.
              </span>
            </span>
          </label>

          <Button
            variant="primary"
            size="lg"
            block
            loading={saving}
            disabled={!draft.name.trim()}
            onClick={save}
          >
            {editing ? "Zapisz zmiany" : "Dodaj kontuzję"}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={rating !== null}
        onClose={() => setRating(null)}
        title={rating ? `Ocena bólu - ${rating.name}` : ""}
      >
        {rating && (
          <div className="flex flex-col gap-4">
            {/* Ból ocenia się wieczorem albo następnego dnia, gdy już wiadomo,
                jak kolano zniosło trening. Data w arkuszu, bo cały ekran to
                lista kontuzji, a nie dziennik jednego dnia. */}
            <DataWpisu label="Dzień" value={painDate} onChange={setPainDate} />

            <PainPicker
              // Zmiana dnia to inna ocena: bez klucza suwak zostałby na
              // wartości wpisanej dla poprzedniej daty.
              key={painDate}
              userId={userId}
              date={painDate}
              injuries={[rating]}
              initial={
                rating.lastDate === painDate && rating.lastLevel !== null
                  ? { [rating.id]: rating.lastLevel }
                  : undefined
              }
              onSaved={() => {
                setRating(null);
                router.refresh();
              }}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}

function InjuryCard({
  injury,
  compact,
  onRate,
  onEdit,
  onDelete,
}: {
  injury: InjuryWithPain;
  compact?: boolean;
  onRate?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const part = bodyPart(injury.body_part);
  const side = injurySideLabel(injury.side);
  const status = INJURY_STATUSES.find((s) => s.value === injury.status);
  const pain = injury.lastLevel !== null ? painDescriptor(injury.lastLevel) : null;

  return (
    <Card padded={false}>
      <div className="flex items-start gap-3 p-4">
        <span className="text-2xl leading-none" aria-hidden>
          {part.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{injury.name}</span>
            {side && <Chip>{side}</Chip>}
            <Chip tone={injuryStatusTone(injury.status)}>{status?.label}</Chip>
          </div>

          <p className="mt-1 text-[13px] text-muted">
            {pain ? (
              <>
                Ostatnio{" "}
                <span className="font-semibold" style={{ color: pain.color }}>
                  {injury.lastLevel}/10 · {pain.label}
                </span>
                {injury.lastDate && <> · {shortDate(injury.lastDate)}</>}
              </>
            ) : (
              "Brak ocen - dodaj pierwszą po treningu."
            )}
          </p>

          {injury.note && <p className="mt-1 text-[12px] text-faint">{injury.note}</p>}
        </div>
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        {!compact && onRate && (
          <Button variant="primary" size="sm" className="flex-1" onClick={onRate}>
            Oceń ból
          </Button>
        )}
        <Button variant="secondary" size="sm" className="flex-1" onClick={onEdit}>
          Edytuj
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Usuń ${injury.name}`}>
          🗑
        </Button>
      </div>
    </Card>
  );
}
