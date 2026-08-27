import { Card } from "@/components/ui";

export const metadata = { title: "Brak połączenia" };

/**
 * Ostatnia deska ratunku service workera: pokazujemy ją tylko wtedy, gdy nie
 * ma ani sieci, ani zapamiętanej wersji strony, na którą ktoś wchodzi.
 */
export default function OfflinePage() {
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <div className="text-center">
        <div className="text-5xl" aria-hidden>
          📡
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight">Brak połączenia</h1>
        <p className="mt-1 text-[14px] text-muted">
          Tego ekranu nie było jeszcze na tym telefonie, więc nie mam czego pokazać.
        </p>
      </div>

      <Card>
        <p className="text-[14px] leading-relaxed">
          <span className="font-semibold">Twoje zapisy są bezpieczne.</span> Wszystko, co wpiszesz
          bez zasięgu — serie, wodę, nawyki, sen — czeka w telefonie i wyśle się samo, gdy sieć
          wróci. Nie musisz nic klikać ani trzymać aplikacji otwartej.
        </p>
        <p className="mt-3 text-[13px] text-muted">
          Ekrany, które już odwiedziłeś, otworzą się normalnie. Wróć do nich przyciskiem wstecz.
        </p>
      </Card>
    </div>
  );
}
