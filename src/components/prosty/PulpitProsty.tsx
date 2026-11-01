import Link from "next/link";
import { Button, Card, Chip } from "@/components/ui";
import { MacroSummary } from "@/components/diet/MacroSummary";
import { ChecklistaDnia } from "@/components/prosty/ChecklistaDnia";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WATER_GOAL_ML, habitDueOn } from "@/lib/constants";
import { duration, num, todayISO } from "@/lib/format";
import type { Habit, PartnerDzien, PartnerStan } from "@/lib/database.types";

/**
 * Pulpit trybu uproszczonego: kalorie, trening, nawyki, skin care i partner.
 * Własne zapytania zamiast przycinania pełnego pulpitu - tamten ma ponad
 * dwadzieścia zapytań, z których tu nie przydałoby się żadne z finansowych.
 */
export async function PulpitProsty({ userId }: { userId: string }) {
  const supabase = await createClient();
  const dzis = todayISO();

  const [
    { data: profil },
    { data: odzywianie },
    { data: sesje },
    { data: woda },
    { data: plan },
    { data: nawyki },
    { data: logiNawykow },
    { data: rutyny },
    { data: logiRutyn },
    { data: stanRaw },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, daily_kcal, daily_protein_g, daily_carbs_g, daily_fat_g, daily_water_ml")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("v_daily_nutrition").select("*").eq("user_id", userId).eq("date", dzis).maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", dzis)
      .order("started_at", { ascending: false }),
    supabase.from("water_logs").select("ml").eq("user_id", userId).eq("date", dzis),
    supabase.from("plans").select("name").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    supabase.from("habits").select("*").eq("user_id", userId).eq("is_archived", false).order("order_index"),
    supabase.from("habit_logs").select("habit_id, count").eq("user_id", userId).eq("date", dzis),
    supabase.from("wyglad_rutyny").select("id, nazwa, pora").eq("user_id", userId).eq("aktywna", true).order("pora"),
    supabase
      .from("wyglad_rutyna_log")
      .select("rutyna_id")
      .eq("user_id", userId)
      .eq("data", dzis)
      .eq("wykonano", true),
    supabase.rpc("partner_stan"),
  ]);

  const stan = (stanRaw ?? null) as PartnerStan | null;
  const { data: partnerRaw } = stan?.w_parze ? await supabase.rpc("partner_dzien", { p_data: dzis }) : { data: null };
  const partner = partnerRaw as PartnerDzien | null;

  const { count: nowe } = stan?.w_parze
    ? await supabase
        .from("partner_wiadomosci")
        .select("id", { count: "exact", head: true })
        .eq("do_id", userId)
        .is("odczytano", null)
    : { count: 0 };

  const zrobioneNawyki = new Map((logiNawykow ?? []).map((l) => [l.habit_id, l.count]));
  const nawykiDnia = ((nawyki ?? []) as Habit[])
    .filter((h) => habitDueOn(h.days_of_week, dzis))
    .map((h) => ({
      id: h.id,
      nazwa: h.name,
      ikona: h.icon,
      cel: h.target_per_day,
      zrobione: zrobioneNawyki.get(h.id) ?? 0,
    }));
  const zrobioneRutyny = new Set((logiRutyn ?? []).map((l) => l.rutyna_id));

  const otwarta = (sesje ?? []).find((s) => !s.finished_at);
  const wodaMl = (woda ?? []).reduce((suma, w) => suma + w.ml, 0);
  const celWody = profil?.daily_water_ml ?? DEFAULT_WATER_GOAL_ML;
  const imie = profil?.display_name ? `Cześć, ${profil.display_name}` : "Cześć";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{imie}</h1>
          <p className="text-[13px] text-muted">Lock-in: kalorie, trening, skin care, nawyki</p>
        </div>
        <Link
          href="/wiecej"
          aria-label="Ustawienia i więcej"
          className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-lg"
        >
          ⚙️
        </Link>
      </header>

      <Card title="Kalorie" action={<Link href="/dieta" className="text-[13px] text-accent">Dodaj posiłek</Link>}>
        <MacroSummary
          compact
          totals={{
            kcal: odzywianie?.kcal ?? 0,
            protein: odzywianie?.protein_g ?? 0,
            carbs: odzywianie?.carbs_g ?? 0,
            fat: odzywianie?.fat_g ?? 0,
          }}
          goals={{
            kcal: profil?.daily_kcal ?? null,
            protein: profil?.daily_protein_g ?? null,
            carbs: profil?.daily_carbs_g ?? null,
            fat: profil?.daily_fat_g ?? null,
          }}
        />
        <p className="mt-2 text-[12px] text-faint">
          Woda: {num(wodaMl)} z {num(celWody)} ml
        </p>
      </Card>

      <Card
        title="Trening"
        action={
          (sesje ?? []).length > 0 ? (
            <Chip tone={otwarta ? "accent" : "success"}>{otwarta ? "w trakcie" : "zrobiony"}</Chip>
          ) : null
        }
      >
        {otwarta ? (
          <Link href={`/trening/${otwarta.id}`}>
            <Button variant="primary" size="lg" block>
              Wróć do: {otwarta.day_label ?? "treningu"}
            </Button>
          </Link>
        ) : (sesje ?? []).length > 0 ? (
          <div className="flex flex-col gap-2">
            {(sesje ?? []).map((s) => (
              <Link key={s.id} href={`/trening/${s.id}`} className="flex items-center gap-2">
                <span className="flex-1 text-[15px] font-medium">{s.day_label ?? "Trening"}</span>
                <span className="text-[13px] text-muted">{duration(s.duration_min)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">
              {plan ? `Plan: ${plan.name}` : "Nie masz jeszcze aktywnego planu."}
            </p>
            <Link href={plan ? "/trening" : "/plan"}>
              <Button variant="primary" size="lg" block>
                {plan ? "Zacznij trening" : "Wybierz plan"}
              </Button>
            </Link>
          </div>
        )}
      </Card>

      <ChecklistaDnia
        userId={userId}
        nawyki={nawykiDnia}
        rutyny={(rutyny ?? []).map((r) => ({
          id: r.id,
          nazwa: r.nazwa,
          pora: r.pora,
          zrobione: zrobioneRutyny.has(r.id),
        }))}
      />

      <Link href="/partner" className="block">
        <Card
          title={stan?.w_parze ? `Partner: ${stan.imie}` : "Partner"}
          action={nowe ? <Chip tone="accent">{nowe} nowe</Chip> : null}
        >
          {partner ? (
            <p className="text-[13px] text-muted">
              Dziś: {num(partner.kcal)} kcal · trening {partner.treningi.length > 0 ? "tak" : "jeszcze nie"} · nawyki{" "}
              {partner.nawyki.filter((n) => n.zrobione >= n.cel).length}/{partner.nawyki.length} · skin care{" "}
              {partner.skincare.filter((s) => s.zrobione).length}/{partner.skincare.length}
            </p>
          ) : (
            <p className="text-[13px] text-muted">Połącz konta kodem i róbcie lock-in razem.</p>
          )}
        </Card>
      </Link>
    </div>
  );
}
