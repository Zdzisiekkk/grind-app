import { PartnerScreen } from "@/components/partner/PartnerScreen";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import type {
  PartnerDzien,
  PartnerStan,
  PartnerTydzienWiersz,
  PartnerWiadomosc,
  PartnerWspolny,
  PartnerWspolnyLog,
} from "@/lib/database.types";

export const metadata = { title: "Partner" };

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();
  const { d } = await searchParams;
  // Tylko dziś albo wczoraj: to jest ekran "co dziś robimy", nie archiwum.
  const dzien = d === addDaysISO(dzis, -1) ? d : dzis;

  const { data: stanRaw } = await supabase.rpc("partner_stan");
  const stan = (stanRaw ?? { w_parze: false, kod: null, wygasa: null }) as PartnerStan;

  if (!stan.w_parze) {
    return <PartnerScreen stan={stan} userId={user.id} dzis={dzis} dzien={dzien} />;
  }

  const [{ data: partner }, { data: tydzien }, { data: wspolne }, { data: logi }, { data: wiadomosci }] = await Promise.all([
    supabase.rpc("partner_dzien", { p_data: dzien }),
    // Bez migracji 0081 zwraca błąd: ekran działa dalej, tylko bez serii i pojedynku.
    supabase.rpc("partner_tydzien", { p_do: dzis }),
    supabase.from("partner_wspolne").select("*").order("created_at"),
    supabase
      .from("partner_wspolne_log")
      .select("*")
      .gte("data", addDaysISO(dzis, -60))
      .order("data", { ascending: false }),
    supabase.from("partner_wiadomosci").select("*").order("created_at", { ascending: false }).limit(15),
  ]);

  return (
    <PartnerScreen
      stan={stan}
      userId={user.id}
      dzis={dzis}
      dzien={dzien}
      partner={(partner ?? null) as PartnerDzien | null}
      tydzien={Array.isArray(tydzien) ? (tydzien as PartnerTydzienWiersz[]) : null}
      wspolne={(wspolne ?? []) as PartnerWspolny[]}
      logiWspolne={(logi ?? []) as PartnerWspolnyLog[]}
      wiadomosci={(wiadomosci ?? []) as PartnerWiadomosc[]}
    />
  );
}
