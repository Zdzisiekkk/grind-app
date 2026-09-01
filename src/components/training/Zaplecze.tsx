import Link from "next/link";

/**
 * Zaplecze treningu: pięć ekranów, które obsługują trening, ale nie są nim.
 *
 * DLACZEGO TUTAJ, A NIE W "WIĘCEJ". Plan, katalog ćwiczeń, trener, aktywności
 * i kontuzje wchodzą się z jedną myślą w głowie - "trenuję". Trzymanie ich
 * w liście ustawień znaczyło, że trzeba pamiętać, gdzie leżą, zamiast po
 * prostu je zobaczyć.
 *
 * DLACZEGO NIŻEJ, A NIE NAD PLANEM. Ekran Treningu ma jedno główne zadanie:
 * zacząć dzisiejszy trening. Kafelki nad listą dni odsuwałyby ten przycisk
 * poniżej zgięcia ekranu - wygoda znajdowania rzadszych rzeczy kosztem
 * czynności wykonywanej codziennie.
 *
 * DLACZEGO SIATKA, A NIE PASEK PRZEWIJANY W BOK. Pięć kafelków w siatce widać
 * naraz. Pasek przewijany pokazałby trzy i pół i kazałby zgadywać, że dalej
 * coś jeszcze jest.
 */

const SKROTY = [
  { href: "/plan", icon: "📋", label: "Plany", desc: "Twórz, kopiuj, poproś AI" },
  { href: "/cwiczenia", icon: "📚", label: "Ćwiczenia", desc: "Technika i historia" },
  { href: "/aktywnosci", icon: "🏃", label: "Aktywności", desc: "Bieg, rower, sparingi" },
  { href: "/kontuzje", icon: "🩹", label: "Kontuzje", desc: "Ból w skali 0-10" },
  { href: "/trener", icon: "✨", label: "Trener AI", desc: "Analizy i propozycje" },
] as const;

export function Zaplecze() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[15px] font-semibold">Zaplecze</h2>

      <div className="grid grid-cols-2 gap-2">
        {SKROTY.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            className={[
              "flex items-center gap-3 rounded-[var(--radius)] border border-border",
              "bg-surface px-3 py-3 shadow-[var(--shadow)] active:scale-[0.99]",
              // Nieparzysta piątka: ostatni kafelek bierze całą szerokość,
              // żeby w siatce nie została dziura.
              i === SKROTY.length - 1 && SKROTY.length % 2 === 1 ? "col-span-2" : "",
            ].join(" ")}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
              {s.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold leading-tight">
                {s.label}
              </span>
              <span className="block truncate text-[12px] text-muted">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
