import Link from "next/link";
import { Card, Chip, ScoreRing } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { healthBand, weakestPillar, type HealthResult } from "@/lib/health";
import { STATUS } from "@/lib/viz";

/**
 * Health Score na pulpicie: jedna liczba, pasmo słowne i podpowiedź, co
 * podnieść najpierw. Pełne rozbicie na filary jest w Postępach - tutaj
 * wystarczy kierunek, żeby karta nie zjadła całego ekranu.
 */
export function HealthCard({
  result,
  previous,
}: {
  result: HealthResult;
  /** Wynik z poprzedniego takiego samego okna - do strzałki trendu. */
  previous?: number | null;
}) {
  if (result.total == null) {
    return (
      <Card title="Health Score" subtitle="Twoja forma z ostatnich 7 dni">
        <p className="text-[13px] text-muted">
          Wynik pojawi się, gdy pojawią się pierwsze dane - wystarczy jedna noc,
          jeden trening albo jeden dzień dziennika.
        </p>
      </Card>
    );
  }

  const band = healthBand(result.total);
  const weakest = weakestPillar(result);
  const delta = previous != null ? result.total - previous : null;

  return (
    <Card
      title="Health Score"
      subtitle="Ostatnie 7 dni"
      action={
        <Link href="/progres" className="text-[13px] font-medium text-accent">
          Rozbicie
        </Link>
      }
    >
      <div className="flex items-center gap-4">
        <ScoreRing score={result.total} color={band.color} size={84} caption="na 100" />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[17px] font-bold leading-tight" style={{ color: band.color }}>
            <span aria-hidden>{band.icon}</span>
            {band.label}
          </p>

          {delta != null && delta !== 0 && (
            <p className="mt-1 text-[13px] text-muted">
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pkt względem poprzedniego tygodnia
            </p>
          )}

          {weakest && (
            <p className="mt-1 text-[13px] text-muted">
              Najsłabszy filar: <span className="font-semibold text-text">{weakest.label}</span> (
              {weakest.score}/100)
            </p>
          )}

          <p className="mt-1 text-[11px] text-faint">
            Liczony z {result.covered} z {result.possible} filarów - puste nie obniżają wyniku.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Pełne rozbicie: wszystkie filary, także te bez danych. */
export function HealthBreakdown({ result, days }: { result: HealthResult; days: number }) {
  return (
    <div className="flex flex-col gap-3">
      {result.total != null && (
        <div className="flex items-center gap-4">
          <ScoreRing
            score={result.total}
            color={healthBand(result.total).color}
            size={72}
            caption="na 100"
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-[15px] font-bold leading-tight"
              style={{ color: healthBand(result.total).color }}
            >
              {healthBand(result.total).label}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Średnia ważona z {result.covered} filarów, okno {days} dni.
            </p>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {result.pillars.map((p) => (
          <li key={p.key}>
            <div className="flex items-baseline gap-2">
              <span aria-hidden>{p.icon}</span>
              <span className="flex-1 text-[14px] font-medium">{p.label}</span>
              <span className="text-[11px] text-faint">waga {p.weight}%</span>
              <span
                className={clsx(
                  "tabular w-12 text-right text-[14px] font-bold",
                  p.score == null && "text-faint",
                )}
              >
                {p.score ?? "-"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              {p.score != null && (
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${p.score}%`, background: pillarColor(p.score) }}
                />
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-faint">{p.detail}</p>
          </li>
        ))}
      </ul>

      {result.covered < result.possible && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-faint">Poza wynikiem:</span>
          {result.pillars
            .filter((p) => p.score == null)
            .map((p) => (
              <Chip key={p.key}>
                <span aria-hidden>{p.icon}</span>
                {p.label}
              </Chip>
            ))}
        </div>
      )}
    </div>
  );
}

/** Ten sam podział na pasma co w Health Score i w ocenie snu. */
function pillarColor(score: number): string {
  if (score >= 80) return STATUS.good;
  if (score >= 65) return STATUS.warning;
  if (score >= 50) return STATUS.serious;
  return STATUS.critical;
}
