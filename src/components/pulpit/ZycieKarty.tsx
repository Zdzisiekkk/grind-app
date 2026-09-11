import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ETAP_OPANOWANE } from "@/lib/nauka";
import { METRYKI } from "@/lib/cele";

/**
 * Głowa, Nauka i Cele na pulpicie.
 *
 * Osobny komponent z własnymi zapytaniami, a nie kolejne pozycje w wielkim
 * Promise.all pulpitu: to trzy małe pytania, a pulpit i tak ma ich już
 * dwadzieścia cztery. Zasada ta sama co przy Finansach - karta odzywa się,
 * gdy czegoś od Ciebie chce (brak wpisu nastroju, powtórki na dziś),
 * a nie po to, żeby pokazać statystykę.
 */
export async function ZycieKarty({
  userId,
  dzis,
  pokazGlowe,
  pokazCele,
}: {
  userId: string;
  dzis: string;
  pokazGlowe: boolean;
  pokazCele: boolean;
}) {
  const supabase = await createClient();

  const [{ data: nastroj }, { count: powtorek }, { data: cele }] = await Promise.all([
    supabase.from("glowa_dzien").select("id").eq("user_id", userId).eq("data", dzis).maybeSingle(),
    supabase
      .from("nauka_powtorki")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lt("etap", ETAP_OPANOWANE)
      .lte("nastepna", dzis),
    supabase
      .from("cele")
      .select("id, tytul, metryka, termin")
      .eq("user_id", userId)
      .eq("status", "aktywny")
      .order("termin")
      .limit(3),
  ]);

  const dniDo = (termin: string) =>
    Math.round(
      (new Date(termin + "T00:00:00Z").getTime() - new Date(dzis + "T00:00:00Z").getTime()) / 86_400_000,
    );

  return (
    <>
      {pokazGlowe && !nastroj && (
        <Card title="Jak dziś?" subtitle="Nastrój i stres - dziesięć sekund, raz dziennie">
          <Link href="/glowa">
            <Button block>🧠 Zapisz nastrój</Button>
          </Link>
        </Card>
      )}

      {(powtorek ?? 0) > 0 && (
        <Card
          title={`${powtorek} ${powtorek === 1 ? "powtórka czeka" : (powtorek ?? 0) < 5 ? "powtórki czekają" : "powtórek czeka"} na dziś`}
          subtitle="Pominięta dziś wraca trudniejsza"
        >
          <Link href="/nauka">
            <Button variant="primary" block>
              Powtórz
            </Button>
          </Link>
        </Card>
      )}

      {pokazCele && (cele ?? []).length > 0 && (
        <Card
          title="Cele"
          action={
            <Link href="/cele" className="text-[13px] font-medium text-accent">
              Postęp
            </Link>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {(cele ?? []).map((c) => {
              const dni = dniDo(c.termin);
              return (
                <li key={c.id} className="flex items-center gap-2 text-[14px]">
                  <span aria-hidden>{METRYKI[c.metryka]?.ikona ?? "🎯"}</span>
                  <span className="min-w-0 flex-1 truncate">{c.tytul}</span>
                  <span className={dni < 0 ? "text-[12px] font-semibold text-danger" : "text-[12px] text-muted"}>
                    {dni > 0 ? `${dni} dni` : dni === 0 ? "dziś" : "po terminie"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
