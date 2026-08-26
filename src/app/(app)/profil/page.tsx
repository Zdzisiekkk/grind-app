import { Button, Card, Chip, Field, Input } from "@/components/ui";
import { BodyWeightChart } from "@/components/charts/Charts";
import { createClient } from "@/lib/supabase/server";
import { saveProfile, signOut } from "./actions";
import { addDaysISO, num, todayISO } from "@/lib/format";

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

        <Button type="submit" variant="primary" size="lg" block>
          Zapisz zmiany
        </Button>
      </form>

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
