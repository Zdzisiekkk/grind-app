/**
 * Biblioteka protokołów - treść stała, bez modelu.
 *
 * Mewing i ćwiczenia twarzy to obszar, w którym w internecie obiecuje się
 * przebudowę czaszki u dorosłego. Dlatego opisy są tutaj, w kodzie, a nie
 * generowane za każdym razem: raz napisana uczciwa wersja nie zmieni się
 * w zależności od tego, co model akurat wylosuje.
 */

export type ProtokolKlucz =
  | "mewing"
  | "cwiczenia_twarzy"
  | "postawa"
  | "spf"
  | "nic_dentystyczna"
  | "nawodnienie";

export type Krok = {
  nazwa: string;
  opis: string;
  /** Czas albo powtórzenia. Null tam, gdzie to nawyk, a nie ćwiczenie. */
  ile?: string;
};

export type Protokol = {
  klucz: ProtokolKlucz;
  nazwa: string;
  ikona: string;
  /** Jedno zdanie: co to daje. Bez obietnic, których nie da się dotrzymać. */
  obietnica: string;
  /** Co to NIE daje. Osobne pole, bo to jest najczęściej przemilczane. */
  czego_nie_daje?: string;
  horyzont: string;
  kroki: Krok[];
  /** Trasa w aplikacji, gdzie protokół ma swoje naturalne przedłużenie. */
  powiazane?: { href: string; label: string };
};

export const PROTOKOLY: Protokol[] = [
  {
    klucz: "mewing",
    nazwa: "Mewing",
    ikona: "👅",
    obietnica:
      "Praca nad pozycją języka, oddychaniem nosem i ustawieniem żuchwy. Przy niskim poziomie tkanki tłuszczowej daje umiarkowaną poprawę napięcia i linii żuchwy.",
    czego_nie_daje:
      "U dorosłego NIE przebudowuje kości twarzy. Zdjęcia \"przed i po\" krążące w sieci to zwykle zmiana wagi, oświetlenia i kąta aparatu. Kto obiecuje inaczej, sprzedaje kurs.",
    horyzont: "12-24 tygodnie, i to głównie jako nawyk, nie efekt wizualny",
    kroki: [
      {
        nazwa: "Pozycja języka",
        opis:
          "Cały język przylega do podniebienia - nie tylko czubek. Czubek tuż za zębami, nie na nich.",
        ile: "docelowo cały dzień, w tle",
      },
      {
        nazwa: "Oddychanie nosem",
        opis:
          "Usta zamknięte, oddech przez nos. To jest ta część, która faktycznie ma znaczenie - dla snu, suchości jamy ustnej i próchnicy.",
        ile: "cały dzień, także w nocy",
      },
      {
        nazwa: "Zęby razem, bez zaciskania",
        opis: "Górne i dolne w lekkim kontakcie. Zaciskanie to inny problem, nie cel.",
        ile: "w tle",
      },
      {
        nazwa: "Sprawdzenie",
        opis:
          "Raz dziennie świadomie ustaw wszystkie trzy rzeczy naraz i wytrzymaj minutę. Z czasu przestaje być ćwiczeniem, a staje się pozycją domyślną.",
        ile: "1 minuta dziennie",
      },
    ],
  },
  {
    klucz: "cwiczenia_twarzy",
    nazwa: "Ćwiczenia mięśni twarzy",
    ikona: "😬",
    obietnica:
      "Mięśnie twarzy reagują na pracę jak każde inne - rośnie ich napięcie spoczynkowe.",
    czego_nie_daje: "Nie usuwają tkanki tłuszczowej z twarzy. Miejscowego spalania nie ma.",
    horyzont: "8-16 tygodni",
    kroki: [
      { nazwa: "Wysuwanie żuchwy", opis: "Żuchwa do przodu, wytrzymaj, wróć powoli.", ile: "3 × 10" },
      {
        nazwa: "Napinanie mięśnia szerokiego szyi",
        opis: "Kąciki ust w dół i na boki, szyja napięta. Zobaczysz pasma na szyi.",
        ile: "3 × 10 sekund",
      },
      {
        nazwa: "Podbródek do klatki i z powrotem",
        opis: "Powolny ruch, bez szarpania. Rozciąga przód szyi.",
        ile: "2 × 10",
      },
      {
        nazwa: "Cofanie głowy (chin tuck)",
        opis:
          "Głowa prosto do tyłu, jakbyś robił drugi podbródek. To samo ćwiczenie leczy wysunięcie głowy do przodu.",
        ile: "3 × 10",
      },
      {
        nazwa: "Nadmuchiwanie policzków",
        opis: "Powietrze przetaczane z policzka na policzek.",
        ile: "2 × 30 sekund",
      },
    ],
  },
  {
    klucz: "postawa",
    nazwa: "Postawa - 5 minut",
    ikona: "🧍",
    obietnica:
      "Wysunięta do przodu głowa i zaokrąglone barki zmieniają linię szczęki i szyi na każdym zdjęciu. To najszybszy widoczny efekt z całej listy.",
    horyzont: "2-6 tygodni",
    kroki: [
      { nazwa: "Otwarcie klatki w drzwiach", opis: "Przedramiona na framudze, krok do przodu.", ile: "2 × 30 s" },
      { nazwa: "Cofanie głowy", opis: "Chin tuck, plecami do ściany.", ile: "10 powtórzeń" },
      { nazwa: "Ściąganie łopatek", opis: "Łopatki w dół i do siebie, bez unoszenia barków.", ile: "15 powtórzeń" },
      { nazwa: "Rozciąganie zginaczy bioder", opis: "Wykrok, miednica podwinięta.", ile: "2 × 30 s na stronę" },
      { nazwa: "Koci grzbiet", opis: "Naprzemiennie zgięcie i wyprost kręgosłupa.", ile: "10 powtórzeń" },
    ],
    powiazane: { href: "/kontuzje", label: "Zapisz ból, jeśli któryś ruch boli" },
  },
  {
    klucz: "spf",
    nazwa: "Filtr przeciwsłoneczny",
    ikona: "🧴",
    obietnica:
      "Największa pojedyncza rzecz, jaką da się zrobić dla wyglądu skóry w perspektywie lat. Nie zmienia nic w tym tygodniu i wszystko w ciągu dekady.",
    horyzont: "efekt jest zapobiegawczy - nie zobaczysz go, tylko nie zobaczysz jego braku",
    kroki: [
      { nazwa: "Rano, po nawilżeniu", opis: "SPF 30+ na twarz, szyję i uszy.", ile: "codziennie" },
      { nazwa: "Także zimą i w chmury", opis: "UVA przechodzi przez chmury i szyby." },
      {
        nazwa: "Obowiązkowo przy retinoidzie",
        opis: "Retinoid uwrażliwia skórę na słońce. Bez filtru robi więcej szkody niż pożytku.",
      },
    ],
  },
  {
    klucz: "nic_dentystyczna",
    nazwa: "Nić dentystyczna",
    ikona: "🦷",
    obietnica: "Czyści to, czego szczoteczka nie dosięga - czyli miejsca, gdzie zaczyna się próchnica.",
    horyzont: "dziąsła przestają krwawić po 1-2 tygodniach",
    kroki: [
      { nazwa: "Wieczorem, przed szczotkowaniem", opis: "Każda przerwa, łuk wokół zęba.", ile: "codziennie" },
      { nazwa: "Krwawienie na starcie jest normalne", opis: "Znika po kilkunastu dniach. Jeśli nie znika - dentysta." },
    ],
  },
  {
    klucz: "nawodnienie",
    nazwa: "Nawodnienie",
    ikona: "💧",
    obietnica: "Odwodniona skóra wygląda na cieńszą i bardziej zmęczoną. To działa w obie strony w ciągu dni, nie tygodni.",
    horyzont: "kilka dni",
    kroki: [
      { nazwa: "Cel dzienny", opis: "Licznik wody masz już w dzienniku diety." },
      { nazwa: "Szklanka od razu po wstaniu", opis: "Po nocy zawsze jesteś na minusie." },
    ],
    powiazane: { href: "/dieta", label: "Licznik wody" },
  },
];

export const PROTOKOL_WG_KLUCZA = new Map(PROTOKOLY.map((p) => [p.klucz, p]));
