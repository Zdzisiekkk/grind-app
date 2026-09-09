import { redirect } from "next/navigation";
import { KasaScreen } from "@/components/finanse/KasaScreen";
import { createClient } from "@/lib/supabase/server";
import { poczatekMiesiaca } from "@/lib/finanse";
import type {
  FinanseAnaliza,
  FinanseBilans,
  FinansePodsumowanie,
  FinanseRozliczeniePodglad,
} from "@/lib/database.types";

export const metadata = { title: "Kasa" };

export default async function KasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /*
   * Dwa wywołania, które coś zmieniają, przed odczytem: naliczenie rachunków
   * na bieżący miesiąc i domknięcie punktów za minione dni. Oba są
   * idempotentne (klucze unikalne po stronie bazy), więc powtórne wejście na
   * ekran niczego nie dubluje. Alternatywą byłby cron - koszt utrzymania
   * niewspółmierny do zysku przy jednym ekranie.
   */
  await Promise.all([
    supabase.rpc("finanse_nalicz_stale", {}),
    supabase.rpc("finanse_xp_rozlicz", {}),
  ]);

  const [
    { data: podsumowanie },
    { data: bilans },
    { data: analiza },
    { data: pozycje },
    { data: zrodla },
    { data: wplywy },
    { data: stale },
    { data: naliczenia },
    { data: cele },
    { data: wydatki },
  ] = await Promise.all([
    // Majątek, poduszka i budżet jednym zapytaniem zamiast czterema -
    // każda z tych liczb potrzebuje innego okna czasu i łączenie ich
    // po stronie klienta znaczyłoby cztery rundy do bazy.
    supabase.rpc("finanse_podsumowanie"),
    supabase.rpc("finanse_bilans", {}),
    supabase.rpc("finanse_analiza", {}),
    // Ze schowanymi włącznie - arkusz pozwala je przywrócić, a karta i tak
    // filtruje. Drugie zapytanie tylko po to byłoby rundą do bazy za nic.
    supabase
      .from("finanse_pozycje")
      .select("*")
      .eq("user_id", user.id)
      .order("archiwalna")
      .order("order_index"),
    supabase.from("finanse_zrodla").select("*").eq("user_id", user.id).order("order_index"),
    supabase
      .from("finanse_wplywy")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })
      .limit(30),
    supabase.from("finanse_stale").select("*").eq("user_id", user.id).order("dzien_miesiaca"),
    supabase
      .from("finanse_naliczenia")
      .select("*, finanse_stale (nazwa, kategoria)")
      .eq("user_id", user.id)
      .gte("okres", poczatekMiesiaca())
      .order("termin"),
    supabase
      .from("v_finanse_cele")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "aktywny")
      .order("order_index")
      .order("created_at"),
    supabase
      .from("finanse_wydatki")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pods = podsumowanie as FinansePodsumowanie;

  // Podgląd rozliczenia ma sens tylko wtedy, gdy jest co rozliczać.
  const { data: rozliczenie } = pods?.rozliczenie_okres
    ? await supabase.rpc("finanse_rozliczenie_podglad", { p_okres: pods.rozliczenie_okres })
    : { data: null };

  return (
    <KasaScreen
      userId={user.id}
      podsumowanie={pods}
      bilans={bilans as FinanseBilans}
      analiza={analiza as FinanseAnaliza}
      pozycje={pozycje ?? []}
      zrodla={zrodla ?? []}
      wplywy={wplywy ?? []}
      stale={stale ?? []}
      naliczenia={(naliczenia ?? []) as never}
      rozliczenie={rozliczenie as FinanseRozliczeniePodglad | null}
      cele={cele ?? []}
      wydatki={wydatki ?? []}
    />
  );
}
