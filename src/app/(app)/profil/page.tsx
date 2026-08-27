import { Button, Card, Chip, Field, Input } from "@/components/ui";
import { BodyWeightChart } from "@/components/charts/Charts";
import { NotificationSettings } from "@/components/reminders/NotificationSettings";
import { DEFAULT_SLEEP_GOAL_MIN } from "@/lib/sleep";
import { createClient } from "@/lib/supabase/server";
import { saveProfile, signOut } from "./actions";
import { addDaysISO, num, todayISO } from "@/lib/format";
import { DEFAULT_WATER_GOAL_ML, DEFAULT_WATER_PORTION_ML } from "@/lib/constants";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: weights }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .eq("user_id", user.id)
      .gte("date", addDaysISO(todayISO(), -365))
      .order("date"),
  ]);

  const weightData = (weights ?? []).map((w) => ({ date: w.date, weight: Number(w.weight_kg) }));
  const latest = weightData.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Profil</h1>
        {profile?.role === "admin" && <Chip tone="accent">administrator</Chip>}
      </header>

      <form action={saveProfile} className="flex flex-col gap-4">
        <Card title="O mnie">
          <div className="flex flex-col gap-3">
            <Field label="Imię">
              <Input name="display_name" defaultValue={profile?.display_name ?? ""} placeholder="Jak Cię witać" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Wzrost (cm)">
                <Input name="height_cm" inputMode="numeric" defaultValue={profile?.height_cm ?? ""} />
              </Field>
              <Field label="Rok urodzenia">
                <Input name="birth_year" inputMode="numeric" defaultValue={profile?.birth_year ?? ""} />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="Dzienne cele"
          subtitle="Do nich apka porównuje Twój dziennik posiłków."
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kalorie (kcal)">
              <Input name="daily_kcal" inputMode="numeric" defaultValue={profile?.daily_kcal ?? ""} placeholder="2600" />
            </Field>
            <Field label="Białko (g)">
              <Input name="daily_protein_g" inputMode="numeric" defaultValue={profile?.daily_protein_g ?? ""} placeholder="160" />
            </Field>
            <Field label="Węglowodany (g)">
              <Input name="daily_carbs_g" inputMode="numeric" defaultValue={profile?.daily_carbs_g ?? ""} placeholder="300" />
            </Field>
            <Field label="Tłuszcz (g)">
              <Input name="daily_fat_g" inputMode="numeric" defaultValue={profile?.daily_fat_g ?? ""} placeholder="80" />
            </Field>
          </div>
        </Card>

        <Card
          title="Nawodnienie"
          subtitle="Cel dnia i wielkość porcji przy przycisku „+” w zakładce Dieta."
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cel dzienny (ml)">
              <Input
                name="daily_water_ml"
                inputMode="numeric"
                defaultValue={profile?.daily_water_ml ?? DEFAULT_WATER_GOAL_ML}
                placeholder="2500"
              />
            </Field>
            <Field label="Porcja (ml)">
              <Input
                name="water_portion_ml"
                inputMode="numeric"
                defaultValue={profile?.water_portion_ml ?? DEFAULT_WATER_PORTION_ML}
                placeholder="250"
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Field label="Od godziny">
              <Input type="time" name="water_reminder_from" defaultValue={profile?.water_reminder_from?.slice(0, 5) ?? "08:00"} />
            </Field>
            <Field label="Do godziny">
              <Input type="time" name="water_reminder_to" defaultValue={profile?.water_reminder_to?.slice(0, 5) ?? "22:00"} />
            </Field>
            <Field label="Co ile minut">
              <Input
                name="water_reminder_every_min"
                inputMode="numeric"
                defaultValue={profile?.water_reminder_every_min ?? ""}
                placeholder="90"
              />
            </Field>
          </div>
          <p className="mt-1 text-[12px] text-faint">
            Zostaw „co ile minut” puste, żeby wyłączyć przypomnienia o wodzie.
          </p>
        </Card>

        <Card
          title="Sen"
          subtitle="Cel i docelowa pora snu — z nich liczy się długość i regularność w Sleep Score."
        >
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cel (godziny)">
              <Input
                name="sleep_goal_h"
                inputMode="decimal"
                defaultValue={((profile?.sleep_goal_min ?? DEFAULT_SLEEP_GOAL_MIN) / 60).toFixed(1)}
                placeholder="8"
              />
            </Field>
            <Field label="Kładę się o">
              <Input
                type="time"
                name="sleep_target_bedtime"
                defaultValue={profile?.sleep_target_bedtime?.slice(0, 5) ?? ""}
              />
            </Field>
            <Field label="Przypomnienie">
              <Input
                type="time"
                name="sleep_reminder_at"
                defaultValue={profile?.sleep_reminder_at?.slice(0, 5) ?? ""}
              />
            </Field>
          </div>
          <p className="mt-1 text-[12px] text-faint">
            Docelową porę snu możesz zostawić pustą — wtedy punktem odniesienia
            regularności jest mediana Twoich ostatnich dwóch tygodni.
          </p>
        </Card>

        <Button type="submit" variant="primary" size="lg" block>
          Zapisz zmiany
        </Button>
      </form>

      <NotificationSettings vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <Card
        title="Waga ciała"
        subtitle={latest ? `Ostatni pomiar: ${num(latest.weight, 1)} kg` : "Brak pomiarów"}
      >
        <BodyWeightChart data={weightData} />
        <p className="mt-2 text-[12px] text-faint">
          Wagę dodajesz jednym tapnięciem z ekranu „Dziś”.
        </p>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="danger" block>
          Wyloguj się
        </Button>
      </form>
    </div>
  );
}
