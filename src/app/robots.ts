import type { MetadataRoute } from "next";

/**
 * Grind nie ma być indeksowany przez wyszukiwarki.
 *
 * Cała treść i tak siedzi za logowaniem, więc robot nie zobaczyłby danych
 * nikogo - ale bez tego pliku indeksowałby ekrany logowania i rejestracji,
 * a aplikacja z dziennikiem zdrowia, zdjęciami twarzy i wagą nie ma czego
 * szukać w wynikach wyszukiwania. Blokada jest tu na wypadek pomyłki:
 * gdyby kiedyś jakaś trasa przestała być chroniona, robot i tak jej nie tknie.
 *
 * Jeśli kiedyś powstanie strona sprzedażowa, wpuszczamy roboty POJEDYNCZO
 * na jej ścieżkę, a nie zdejmujemy tej reguły.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
