import { LooksScreen, type LooksDane } from "@/components/looks/LooksScreen";
import type { ZdjecieDoPorownania } from "@/components/looks/ProgressTimeline";
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

/** Podpisany adres ważny godzinę — tyle, ile trwa oglądanie własnego progresu. */
const WAZNOSC_LINKU = 3600;

/**
 * Zbieranie danych do zakładki „Wygląd".
 *
 * Zdjęcia mają adresy podpisywane tutaj, na serwerze. Przeglądarka nigdy nie
 * dostaje ścieżki w kubełku, tylko gotowy link z terminem ważności — dzięki
 * temu nie ma czego skopiować i wysłać dalej „na stałe".
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
    supabase
      .from("wyglad_zdjecia")
      .select("*")
      .eq("user_id", user.id)
      .order("utworzono", { ascending: false }),
  ]);

  const skany = (skanyRaw ?? []) as WygladSkan[];
  const wszystkieZdjecia = (zdjecia ?? []) as WygladZdjecie[];

  /*
   * Duchy: ostatnie zdjęcie każdego ujęcia, nakładane w skanerze na podgląd.
   * Bez nich dwa skany różnią się głównie kątem trzymania telefonu.
   */
  const duchy: Partial<Record<Ujecie, string>> = {};
  for (const ujecie of ["front", "profil", "sylwetka"] as Ujecie[]) {
    const ostatnie = wszystkieZdjecia.find((z) => z.ujecie === ujecie);
    if (!ostatnie) continue;
    const { data } = await supabase.storage
      .from("wyglad")
      .createSignedUrl(ostatnie.storage_path, WAZNOSC_LINKU);
    if (data?.signedUrl) duchy[ujecie] = data.signedUrl;
  }

  /* Suwak przed/po — zawsze to samo ujęcie, inaczej porównanie nic nie znaczy. */
  const frontowe = wszystkieZdjecia.filter((z) => z.ujecie === "front");
  const podpisz = async (z?: WygladZdjecie): Promise<ZdjecieDoPorownania | null> => {
    if (!z) return null;
    const { data } = await supabase.storage
      .from("wyglad")
      .createSignedUrl(z.storage_path, WAZNOSC_LINKU);
    return data?.signedUrl ? { ujecie: z.ujecie, url: data.signedUrl, data: z.utworzono } : null;
  };

  const najnowszeZdjecie = frontowe.length >= 2 ? await podpisz(frontowe[0]) : null;
  const najstarszeZdjecie =
    frontowe.length >= 2 ? await podpisz(frontowe[frontowe.length - 1]) : null;

  /* --------------------- Dane do zestawień, liczone tutaj -------------------- */

  const chronologicznie = [...skany].sort((a, b) => a.utworzono.localeCompare(b.utworzono));

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

  /** Waga najbliższa dacie skanu — pomiar bywa co kilka dni, nie codziennie. */
  const wagaPrzySkanie = chronologicznie.map((s) => {
    const dzien = s.utworzono.slice(0, 10);
    const wczesniejsze = (wagi ?? []).filter((w) => w.date <= dzien);
    const ostatnia = wczesniejsze[wczesniejsze.length - 1];
    return ostatnia ? Number(ostatnia.weight_kg) : null;
  });

  const dane: LooksDane = {
    maZgode: Boolean(zgoda?.wiek_potwierdzony),
    maPro: Boolean(pro),
    skany: skany.map((s) => ({
      id: s.id,
      utworzono: s.utworzono,
      ocena_ogolna: s.ocena_ogolna,
      oceny: s.oceny,
      jakosc_ok: s.jakosc_ok,
    })),
    ostatniRaport: (skany.find((s) => s.raport)?.raport as WygladAnalysis | undefined) ?? null,
    rutyny: (rutyny ?? []) as WygladRutyna[],
    odhaczoneDzis: (logi ?? []).map((l) => l.rutyna_id),
    protokoly: (protokoly ?? []) as WygladProtokol[],
    produkty: (produkty ?? []) as WygladProdukt[],
    limit: (limit as WygladLimit | null) ?? null,
    duchy,
    najstarszeZdjecie,
    najnowszeZdjecie,
    senPrzedSkanem,
    czysteDniPrzedSkanem,
    wagaPrzySkanie,
  };

  return <LooksScreen {...dane} />;
}
