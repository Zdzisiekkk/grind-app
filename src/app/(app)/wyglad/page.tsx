import { LooksScreen, type LooksDane } from "@/components/looks/LooksScreen";
import type { SkanWGalerii } from "@/components/looks/GaleriaSkanow";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import type { WygladAnalysis } from "@/lib/ai/wygladSchema";
import type {
  Ujecie,
  WygladLimit,
  WygladProdukt,
  WygladProtokol,
  WygladRutyna,
  WygladSkan,
  WygladZdjecie,
} from "@/lib/database.types";

export const metadata = { title: "Wygląd" };

/**
 * Zbieranie danych do zakładki "Wygląd".
 *
 * Zdjęć tu NIE podpisujemy. Galeria prosi o linki sama (akcja `linkiDoZdjec`),
 * kiedy ktoś ją otworzy - przeglądarka nigdy nie dostaje ścieżki w kubełku,
 * tylko gotowy link z terminem ważności.
 */
export default async function WygladPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();

  const [
    { data: zgoda },
    { data: pro },
    { data: skanyRaw },
    { data: rutyny },
    { data: logi },
    { data: protokoly },
    { data: produkty },
    { data: limit },
    { data: zdjecia },
  ] = await Promise.all([
    supabase.from("wyglad_zgoda").select("wiek_potwierdzony").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("has_pro", {}),
    supabase
      .from("wyglad_skany")
      .select("*")
      .eq("user_id", user.id)
      .order("utworzono", { ascending: false }),
    supabase.from("wyglad_rutyny").select("*").eq("user_id", user.id).order("pora"),
    supabase.from("wyglad_rutyna_log").select("rutyna_id").eq("user_id", user.id).eq("data", dzis),
    supabase.from("wyglad_protokoly").select("*").eq("user_id", user.id),
    supabase.from("wyglad_produkty").select("*").eq("user_id", user.id).order("pora"),
    supabase.rpc("wyglad_limit", {}),
    supabase.from("wyglad_zdjecia").select("skan_id, ujecie").eq("user_id", user.id),
  ]);

  const skany = (skanyRaw ?? []) as WygladSkan[];

  /*
   * Skany bez oceny (nieudana analiza) nie trafiają na wykres ani do wyniku.
   * Wcześniej taki skan na szczycie listy chował ostatni prawdziwy wynik
   * i ekran pisał "Brak skanu", choć skanów było kilka.
   */
  const ocenione = skany.filter((s) => s.ocena_ogolna != null);

  const ujeciaSkanu = new Map<string, Ujecie[]>();
  for (const z of (zdjecia ?? []) as Pick<WygladZdjecie, "skan_id" | "ujecie">[]) {
    ujeciaSkanu.set(z.skan_id, [...(ujeciaSkanu.get(z.skan_id) ?? []), z.ujecie]);
  }

  // W galerii także skany bez oceny - ich zdjęcia istnieją i da się dokończyć analizę.
  const galeria: SkanWGalerii[] = skany
    .filter((s) => ujeciaSkanu.has(s.id))
    .map((s) => ({
      id: s.id,
      utworzono: s.utworzono,
      ocena_ogolna: s.ocena_ogolna,
      jakosc_ok: s.jakosc_ok,
      ujecia: ujeciaSkanu.get(s.id) ?? [],
      raport: (s.raport as WygladAnalysis | null) ?? null,
    }));

  const ostatni = ocenione[0];
  const odniesienie = ostatni?.skan_odniesienia
    ? skany.find((s) => s.id === ostatni.skan_odniesienia)
    : undefined;

  /* --------------------- Dane do zestawień, liczone tutaj -------------------- */

  const chronologicznie = [...ocenione].sort((a, b) => a.utworzono.localeCompare(b.utworzono));

  const [{ data: sen }, { data: wagi }, { data: wpadki }] = await Promise.all([
    // v_sleep, bo realny sen (po odjęciu zasypiania i pobudek) liczy widok, nie tabela.
    supabase.from("v_sleep").select("date, sleep_min").eq("user_id", user.id),
    supabase.from("body_weight_logs").select("date, weight_kg").eq("user_id", user.id),
    supabase.from("vice_events").select("occurred_at, kind").eq("user_id", user.id).eq("kind", "lapse"),
  ]);

  /** Średni sen w tygodniu poprzedzającym każdy skan. */
  const senPrzedSkanem = chronologicznie.map((s) => {
    const do_ = s.utworzono.slice(0, 10);
    const od = addDaysISO(do_, -7);
    const noce = (sen ?? []).filter((n) => n.date > od && n.date <= do_);
    if (!noce.length) return null;
    return noce.reduce((a, n) => a + (n.sleep_min ?? 0), 0) / noce.length;
  });

  /** Ile z siedmiu dni przed skanem było bez wpadki. */
  const czysteDniPrzedSkanem = chronologicznie.map((s) => {
    const do_ = s.utworzono.slice(0, 10);
    const od = addDaysISO(do_, -7);
    const zWpadka = new Set(
      (wpadki ?? [])
        .map((w) => String(w.occurred_at).slice(0, 10))
        .filter((d) => d > od && d <= do_),
    );
    return 7 - zWpadka.size;
  });

  /** Waga najbliższa dacie skanu - pomiar bywa co kilka dni, nie codziennie. */
  const wagaPrzySkanie = chronologicznie.map((s) => {
    const dzien = s.utworzono.slice(0, 10);
    const wczesniejsze = (wagi ?? []).filter((w) => w.date <= dzien);
    const ostatnia = wczesniejsze[wczesniejsze.length - 1];
    return ostatnia ? Number(ostatnia.weight_kg) : null;
  });

  const dane: LooksDane = {
    maZgode: Boolean(zgoda?.wiek_potwierdzony),
    maPro: Boolean(pro),
    skany: ocenione.map((s) => ({
      id: s.id,
      utworzono: s.utworzono,
      ocena_ogolna: s.ocena_ogolna,
      oceny: s.oceny,
      jakosc_ok: s.jakosc_ok,
    })),
    ostatniRaport: (ostatni?.raport as WygladAnalysis | undefined) ?? null,
    ostatniOdniesienieData: odniesienie?.utworzono ?? null,
    galeria,
    rutyny: (rutyny ?? []) as WygladRutyna[],
    odhaczoneDzis: (logi ?? []).map((l) => l.rutyna_id),
    protokoly: (protokoly ?? []) as WygladProtokol[],
    produkty: (produkty ?? []) as WygladProdukt[],
    limit: (limit as WygladLimit | null) ?? null,
    senPrzedSkanem,
    czysteDniPrzedSkanem,
    wagaPrzySkanie,
  };

  return <LooksScreen {...dane} />;
}
