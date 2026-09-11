import { CeleScreen } from "@/components/cele/CeleScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import type { DaneDoCelow } from "@/lib/cele";
import type { Cel, CelKamien, FinansePodsumowanie } from "@/lib/database.types";

export const metadata = { title: "Cele" };

/**
 * Cele czytają dane z pięciu innych modułów. Wszystko zbierane tutaj,
 * jednym przebiegiem, a postęp liczy czysta funkcja `postepCelu` - ta sama,
 * której używa pulpit.
 */
export default async function CelePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();

  const [{ data: celeRaw }, { data: kamienie }] = await Promise.all([
    supabase.from("cele").select("*").eq("user_id", user.id).order("termin"),
    supabase.from("cele_kamienie").select("*").eq("user_id", user.id).order("kolejnosc"),
  ]);
  const cele = (celeRaw ?? []) as Cel[];

  // Historia tylko od najstarszego aktywnego celu - dalej i tak nic się nie liczy.
  const odMin =
    cele
      .filter((c) => c.status === "aktywny")
      .map((c) => c.od)
      .sort()[0] ?? addDaysISO(dzis, -1);

  const [
    { data: waga },
    { data: finPods },
    { data: sesje },
    { data: ksiazki },
    { data: nauka },
    { data: logi },
    { data: nawyki },
    { data: tematy },
  ] = await Promise.all([
    supabase
      .from("body_weight_logs")
      .select("weight_kg")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("finanse_podsumowanie"),
    supabase.from("workout_sessions").select("date").eq("user_id", user.id).gte("date", odMin),
    supabase
      .from("books")
      .select("finished_at")
      .eq("user_id", user.id)
      .eq("status", "read")
      .not("finished_at", "is", null),
    supabase.from("nauka_sesje").select("data, minuty, temat_id").eq("user_id", user.id).gte("data", odMin),
    supabase.from("habit_logs").select("habit_id, date, count").eq("user_id", user.id).gte("date", odMin),
    supabase
      .from("habits")
      .select("id, name, icon, target_per_day")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("order_index"),
    supabase
      .from("nauka_tematy")
      .select("id, nazwa, ikona")
      .eq("user_id", user.id)
      .eq("archiwalny", false),
  ]);

  const fin = finPods as FinansePodsumowanie | null;
  const cele_ = new Map((nawyki ?? []).map((n) => [n.id, n.target_per_day]));

  /* Dzień nawyku liczy się, gdy zrobiony w pełni - tak samo jak na ekranie Nawyki. */
  const dniNawykow: Record<string, string[]> = {};
  for (const l of logi ?? []) {
    if (l.count >= (cele_.get(l.habit_id) ?? 1)) {
      (dniNawykow[l.habit_id] ??= []).push(l.date);
    }
  }

  const dane: DaneDoCelow = {
    dzis,
    waga: waga?.weight_kg != null ? Number(waga.weight_kg) : null,
    netto: fin?.netto_szacowany ?? fin?.netto ?? null,
    treningi: (sesje ?? []).map((s) => s.date),
    ksiazki: (ksiazki ?? []).map((k) => String(k.finished_at).slice(0, 10)),
    nauka: (nauka ?? []).map((s) => ({ data: s.data, minuty: s.minuty, temat_id: s.temat_id })),
    nawyki: dniNawykow,
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Cele</h1>
      <CeleScreen
        userId={user.id}
        dzis={dzis}
        cele={cele}
        kamienie={(kamienie ?? []) as CelKamien[]}
        dane={dane}
        nawyki={(nawyki ?? []).map((n) => ({ id: n.id, name: n.name, icon: n.icon }))}
        tematy={(tematy ?? []) as Array<{ id: string; nazwa: string; ikona: string }>}
      />
    </div>
  );
}
