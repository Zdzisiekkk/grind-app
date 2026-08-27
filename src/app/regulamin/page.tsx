import { LegalPage, Section, ToFill } from "@/components/legal/LegalPage";

export const metadata = { title: "Regulamin" };

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin" updated="28 sierpnia 2026">
      <Section title="Kto świadczy usługę">
        <p>
          Usługodawcą jest <ToFill>nazwa firmy</ToFill>, NIP <ToFill>NIP</ToFill>. Kontakt:{" "}
          <ToFill>adres e-mail</ToFill>.
        </p>
      </Section>

      <Section title="Czym jest Grind">
        <p>
          Grind to dziennik treningów, diety, snu i nawyków. Pomaga zapisywać i rozumieć
          własne dane. Wersja podstawowa jest bezpłatna i pozostaje bezpłatna.
        </p>
      </Section>

      <Section title="To nie jest porada medyczna">
        <p>
          <strong>
            Grind nie jest wyrobem medycznym i nie zastępuje lekarza, fizjoterapeuty ani
            dietetyka.
          </strong>{" "}
          Plany treningowe, wyliczone cele kaloryczne i podpowiedzi trenera AI są
          informacją ogólną, a nie zaleceniem dla Twojego przypadku. Przy kontuzji, chorobie,
          w ciąży i przy przyjmowaniu leków skonsultuj się ze specjalistą, zanim cokolwiek
          zmienisz. Trenujesz na własną odpowiedzialność.
        </p>
      </Section>

      <Section title="Konto">
        <p>
          Do korzystania potrzebne jest konto. Podaj prawdziwy adres e-mail i nie udostępniaj
          hasła. Konto jest osobiste. Możesz je usunąć w każdej chwili w profilu — usunięcie
          jest natychmiastowe i nieodwracalne.
        </p>
      </Section>

      <Section title="Wersja płatna">
        <p>
          Trener AI jest funkcją płatną, rozliczaną w cyklu miesięcznym przez Stripe. Cena
          i ewentualny okres próbny są widoczne przed zakupem. Subskrypcję możesz wypowiedzieć
          w dowolnym momencie w panelu płatności — dostęp trwa wtedy do końca opłaconego
          okresu i nie odnawia się.
        </p>
        <p>
          Korzystanie z trenera jest ograniczone dziennym limitem zapytań, żeby usługa była
          dostępna dla wszystkich. Limit widać na ekranie trenera.
        </p>
        <p>
          Kupując dostęp do treści cyfrowych i zaczynając z nich korzystać przed upływem
          14 dni, rezygnujesz z prawa odstąpienia od umowy w tym zakresie — o czym informujemy
          przed płatnością.
        </p>
      </Section>

      <Section title="Czego nie wolno">
        <ul className="list-disc pl-5">
          <li>udostępniać konta innym osobom,</li>
          <li>obchodzić limitów ani zabezpieczeń płatności,</li>
          <li>
            wykorzystywać aplikacji do zbierania cudzych danych ani do celów niezgodnych
            z prawem.
          </li>
        </ul>
      </Section>

      <Section title="Odpowiedzialność i dostępność">
        <p>
          Staramy się, żeby aplikacja działała bez przerw, ale nie gwarantujemy
          nieprzerwanej dostępności. Twoje dane możesz w każdej chwili pobrać na własny
          dysk (Profil → „Pobierz swoje dane”) i zalecamy z tego korzystać.
        </p>
      </Section>

      <Section title="Zmiany regulaminu">
        <p>
          O istotnych zmianach poinformujemy w aplikacji i poprosimy o ponowną akceptację.
          Jeśli się nie zgodzisz, możesz usunąć konto — a wcześniej pobrać swoje dane.
        </p>
      </Section>

      <Section title="Spory">
        <p>
          Prawem właściwym jest prawo polskie. Konsument może korzystać z pozasądowych
          sposobów rozpatrywania reklamacji, w tym z platformy ODR Komisji Europejskiej.
        </p>
      </Section>
    </LegalPage>
  );
}
