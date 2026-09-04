import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Więcej" };

/*
 * Odkąd dolna nawigacja ma pięć pozycji zamiast siedmiu, to jest jedyna
 * droga do snu, nawyków i zadań - dlatego stoją na samej górze listy,
 * przed ekranami przeglądowymi. Kolejność odpowiada temu, jak często
 * człowiek tam wchodzi, a nie temu, jak powstawały.
 */
const LINKS = [
  { href: "/nawyki", icon: "🔥", label: "Nawyki i nałogi", desc: "Codzienne odhaczanie, passy, wpadki" },
  { href: "/sen", icon: "😴", label: "Sen", desc: "Godziny, jakość, drzemki i wynik nocy" },
  { href: "/zadania", icon: "☑️", label: "Zadania", desc: "Lista rzeczy do zrobienia z terminami" },
  { href: "/wyglad", icon: "🪪", label: "Wygląd", desc: "Skan twarzy, pielęgnacja, postawa, progres" },
  { href: "/progres", icon: "📈", label: "Postępy", desc: "Wykresy siły, wagi, bólu i objętości" },
  { href: "/kalendarz", icon: "📅", label: "Kalendarz", desc: "Co robiłeś danego dnia" },
  { href: "/subskrypcja", icon: "💳", label: "Subskrypcja", desc: "Co darmowe, co płatne, płatności" },
  { href: "/profil", icon: "👤", label: "Profil i cele", desc: "Cele kaloryczne, waga, wylogowanie" },
] as const;

export default async function WiecejPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role, email").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Więcej</h1>

      <Card padded={false}>
        <ul className="divide-y divide-border">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
                  {l.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{l.label}</span>
                  <span className="block truncate text-[12px] text-muted">{l.desc}</span>
                </span>
                <span className="text-faint" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-[12px] text-faint">
        Zalogowany jako {profile?.email ?? user?.email}
        {profile?.role === "admin" && " · administrator"}
      </p>

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        Dane produktów spożywczych pochodzą z{" "}
        <a className="underline" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
          Open Food Facts
        </a>{" "}
        (licencja ODbL). Część ćwiczeń i zdjęć pochodzi z projektu{" "}
        <a className="underline" href="https://wger.de" target="_blank" rel="noreferrer">
          wger
        </a>{" "}
        (CC-BY-SA).
      </p>
    </div>
  );
}
