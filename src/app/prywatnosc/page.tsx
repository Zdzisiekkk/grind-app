import { LegalPage, Section, ToFill } from "@/components/legal/LegalPage";

export const metadata = { title: "Polityka prywatności" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Polityka prywatności" updated="28 sierpnia 2026">
      <Section title="Kto przetwarza Twoje dane">
        <p>
          Administratorem danych jest <ToFill>nazwa firmy</ToFill>, <ToFill>adres</ToFill>,
          NIP <ToFill>NIP</ToFill>. Kontakt: <ToFill>adres e-mail</ToFill>.
        </p>
      </Section>

      <Section title="Jakie dane zbieramy">
        <p>
          Tylko te, które sam wpiszesz albo które są potrzebne do działania konta:
        </p>
        <ul className="list-disc pl-5">
          <li>adres e-mail i hasło (hasło w postaci nieodwracalnego skrótu),</li>
          <li>
            <strong>dane o zdrowiu</strong>: waga, wzrost, wiek, płeć, sen, ból, kontuzje,
            spożyte posiłki, treningi i aktywności,
          </li>
          <li>
            <strong>zdjęcia twarzy i sylwetki</strong>, jeżeli korzystasz z modułu Wygląd -
            razem z ocenami i opisami, które model z nich wygenerował,
          </li>
          <li>ustawienia aplikacji: cele, przypomnienia, strefa czasowa,</li>
          <li>
            przy subskrypcji: identyfikator klienta w Stripe i status płatności. Numeru
            karty nie widzimy ani nie przechowujemy.
          </li>
        </ul>
        <p>
          Nie zbieramy Twojej lokalizacji, nie korzystamy z reklam ani z zewnętrznych
          narzędzi śledzących.
        </p>
      </Section>

      <Section title="Dane o zdrowiu i osobna zgoda">
        <p>
          Sen, ból, kontuzje i waga to dane szczególnej kategorii w rozumieniu art. 9 RODO.
          Przetwarzamy je wyłącznie na podstawie Twojej wyraźnej i odrębnej zgody, wyrażonej
          przy zakładaniu konta. Zgodę możesz wycofać w każdej chwili w ustawieniach profilu
          - wtedy usuwamy te dane, a reszta aplikacji działa dalej.
        </p>
      </Section>

      <Section title="Zdjęcia w module Wygląd">
        <p>
          Moduł Wygląd jest dobrowolny i włącza się osobną zgodą, przy której potwierdzasz,
          że masz ukończone 16 lat. Bez niej nie da się zapisać żadnego zdjęcia - pilnuje tego
          sama baza danych, nie tylko ekran.
        </p>
        <ul className="list-disc pl-5">
          <li>
            Zdjęcia leżą w <strong>prywatnym magazynie</strong>. Nie istnieje adres, pod którym
            dałoby się je otworzyć bez Twojego zalogowania; linki do podglądu są podpisywane
            i wygasają po godzinie.
          </li>
          <li>
            Przy każdym skanie zdjęcie jest wysyłane do <strong>Anthropic</strong>, żeby model
            je opisał. Wysyłamy je wyłącznie w momencie, w którym sam uruchomisz skan.
          </li>
          <li>
            Zdjęcia zostają <strong>bezterminowo</strong> - po to, żeby dało się porównać
            wygląd sprzed miesięcy. Możesz je usunąć pojedynczo w każdej chwili, a wszystkie
            znikają razem z kontem.
          </li>
          <li>
            Trafiają też do eksportu danych, więc da się je pobrać i zabrać ze sobą.
          </li>
        </ul>
        <p>
          Ocena wyglądu <strong>nie jest poradą medyczną ani diagnozą dermatologiczną</strong>.
          Przy niepokojącej zmianie skórnej idź do lekarza.
        </p>
      </Section>

      <Section title="Po co ich używamy">
        <ul className="list-disc pl-5">
          <li>żeby pokazywać Ci Twoje własne dane i liczyć z nich wykresy oraz Health Score,</li>
          <li>
            żeby wysyłać przypomnienia, o które poprosiłeś (nawyki, woda, pora snu) - nigdy
            innych,
          </li>
          <li>
            w płatnej wersji: żeby trener AI mógł je przeanalizować i zaproponować zmianę.
          </li>
        </ul>
      </Section>

      <Section title="Komu je powierzamy">
        <p>Podmiotom, bez których aplikacja nie mogłaby działać:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Supabase</strong> - baza danych i logowanie. Serwery w Unii Europejskiej
            (Frankfurt).
          </li>
          <li>
            <strong>Vercel</strong> - hosting aplikacji.
          </li>
          <li>
            <strong>Stripe</strong> - obsługa płatności; tylko dane rozliczeniowe.
          </li>
          <li>
            <strong>Anthropic</strong> - model językowy trenera AI oraz oceny wyglądu. Dane
            trafiają tam wyłącznie wtedy, gdy sam uruchomisz analizę, napiszesz do trenera albo
            zrobisz skan, i tylko w wersji płatnej. W przypadku skanu jest to również zdjęcie.
          </li>
        </ul>
      </Section>

      <Section title="Jak długo je trzymamy">
        <p>
          Do czasu usunięcia konta - dotyczy to także zdjęć z modułu Wygląd. Usunięcie jest
          natychmiastowe i nieodwracalne: kasujemy wszystko, co do Ciebie należy, razem
          z plikami w magazynie, bez żadnych kopii zapasowych.
        </p>
      </Section>

      <Section title="Twoje prawa">
        <p>
          Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia
          przetwarzania, przeniesienia oraz wniesienia sprzeciwu. Dwa z nich działają
          w aplikacji od ręki, bez pisania do nikogo:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Pobranie kopii</strong> - Profil → Pobierz swoje dane. Dostajesz plik
            JSON ze wszystkim.
          </li>
          <li>
            <strong>Usunięcie konta</strong> - Profil → Usuń konto. Działa od razu.
          </li>
        </ul>
        <p>
          Przysługuje Ci też skarga do Prezesa Urzędu Ochrony Danych Osobowych.
        </p>
      </Section>

      <Section title="Ciasteczka">
        <p>
          Używamy wyłącznie ciasteczek niezbędnych do utrzymania sesji logowania. Nie ma
          ciasteczek reklamowych ani analitycznych, więc nie ma też okienka z prośbą o zgodę
          na nie.
        </p>
      </Section>
    </LegalPage>
  );
}
