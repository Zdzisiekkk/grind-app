/**
 * Treść samouczka.
 *
 * Osobno od komponentu, bo to jest tekst produktu, a nie kod: zmienia się
 * częściej niż jakikolwiek widok i powinno dać się go przeczytać jednym
 * ciągiem, bez przedzierania się przez JSX.
 *
 * Zasada doboru: samouczek nie tłumaczy przycisków - tłumaczy, PO CO tu
 * wchodzić. Kto rozumie po co, znajdzie przycisk; kto zna przycisk, ale nie
 * wie po co, i tak nie wróci.
 */

export type KrokSamouczka = {
  id: string;
  ikona: string;
  tytul: string;
  tresc: string;
  /** Dokąd prowadzi ta część aplikacji - pokazywane jako podpis, nie odnośnik. */
  gdzie?: string;
};

export const KROKI_SAMOUCZKA: readonly KrokSamouczka[] = [
  {
    id: "witaj",
    ikona: "⚡",
    tytul: "To jest Grind",
    tresc:
      "Jedno miejsce na wszystko, co składa się na formę: trening, jedzenie, sen, nawyki, wygląd i pieniądze. " +
      "Nie musisz używać wszystkiego naraz - zacznij od jednej rzeczy, reszta poczeka.",
  },
  {
    id: "dzis",
    ikona: "📋",
    tytul: "Ekran Dziś to punkt wyjścia",
    tresc:
      "Pokazuje tylko to, co dotyczy dzisiaj: trening z planu, kalorie, nawyki do odhaczenia. " +
      "Karty wybierasz sam - jeśli czegoś nie śledzisz, po prostu tego nie włączaj.",
    gdzie: "Dziś",
  },
  {
    id: "wpisy",
    ikona: "⚡",
    tytul: "Wpisywanie ma trwać sekundy",
    tresc:
      "Waga, ból, wydatek - trzy przyciski na dole ekranu Dziś. " +
      "Jeśli wpisanie czegoś zajmuje więcej niż chwilę, to znaczy, że zrobiliśmy to źle. Napisz nam o tym.",
    gdzie: "Dziś",
  },
  {
    id: "trening",
    ikona: "🏋️",
    tytul: "Trening z planu albo na luzie",
    tresc:
      "Możesz wybrać gotowy plan i odhaczać serie w trakcie, albo zapisać, co akurat zrobiłeś. " +
      "Aplikacja pamięta Twoje ciężary i podpowiada je przy następnym razie.",
    gdzie: "Trening",
  },
  {
    id: "dieta",
    ikona: "🍽️",
    tytul: "Jedzenie bez liczenia w głowie",
    tresc:
      "Skanujesz kod kreskowy, szukasz w bazie albo opisujesz posiłek słowami - a nawet robisz mu zdjęcie. " +
      "Woda ma osobny licznik z przypomnieniami.",
    gdzie: "Dieta",
  },
  {
    id: "reszta",
    ikona: "🌙",
    tytul: "Sen, nawyki i reszta życia",
    tresc:
      "W zakładce Więcej znajdziesz sen, nawyki z passami, zadania, wygląd i finanse - a także Głowę " +
      "(nastrój i wyciszenie), Naukę (powtórki) i Cele, które liczą postęp z całej reszty same.",
    gdzie: "Więcej",
  },
  {
    id: "kasa",
    ikona: "💰",
    tytul: "Finanse też są częścią formy",
    tresc:
      "Poduszka liczona w miesiącach przeżycia, budżet na bieżąco i majątek, który sam się aktualizuje. " +
      "Raz w miesiącu aplikacja poprosi o rozliczenie i pokaże, ile pieniędzy wyciekło poza rejestrem.",
    gdzie: "Więcej → Finanse",
  },
  {
    id: "xp",
    ikona: "⭐",
    tytul: "Punkty za to, co naprawdę zrobiłeś",
    tresc:
      "Za trening, przespaną noc, odhaczony nawyk i dzień w budżecie dostajesz XP i wbijasz poziomy. " +
      "Nie ma punktów za samo klikanie - to byłaby gra z aplikacją zamiast pracy nad sobą.",
  },
  {
    id: "prywatnosc",
    ikona: "🔒",
    tytul: "Twoje dane są tylko Twoje",
    tresc:
      "Nikt poza Tobą nie widzi Twoich wpisów - ani inni użytkownicy, ani wyszukiwarki. " +
      "W każdej chwili możesz pobrać wszystko albo skasować konto z całą historią.",
    gdzie: "Profil",
  },
  {
    id: "pomoc",
    ikona: "🆘",
    tytul: "Coś nie działa? Napisz",
    tresc:
      "W Pomocy zgłosisz błąd albo zaproponujesz zmianę, a odpowiedź wróci w tym samym miejscu. " +
      "Znajdziesz tam też ten samouczek i wszystkie dokumenty: regulamin, prywatność, ciasteczka.",
    gdzie: "Więcej → Pomoc",
  },
];

export const OSTATNI_KROK = KROKI_SAMOUCZKA.length - 1;
