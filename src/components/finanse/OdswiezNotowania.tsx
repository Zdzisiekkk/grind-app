"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Ciche odświeżenie notowań raz na dobę.
 *
 * Świadomie NIE cron na serwerze: zadanie działające bez zalogowanego
 * człowieka potrzebuje klucza serwisowego, czyli kolejnego sekretu do
 * pilnowania i kolejnej drogi dostępu do wszystkich danych. Przy jednym
 * ekranie, który i tak trzeba otworzyć, żeby cokolwiek zobaczyć, to cena
 * bez pokrycia.
 *
 * Zamiast tego: pierwsze wejście danego dnia pobiera ceny w tle. Efekt jest
 * ten sam - portfel zawsze pokazuje kurs z ostatniej sesji - a nie przybywa
 * ani jednego sekretu.
 *
 * Wywołanie leci PO wyrenderowaniu i niczego nie blokuje: ekran pokazuje
 * ceny z wczoraj przez sekundę, zamiast kazać czekać na trzy zewnętrzne
 * serwisy, zanim pokaże cokolwiek.
 */
export function OdswiezNotowania({ nieaktualne }: { nieaktualne: boolean }) {
  const router = useRouter();
  // React montuje komponenty dwukrotnie w trybie deweloperskim, a to jest
  // wywołanie sieciowe - bez tej blokady leciałoby podwójnie.
  const wystartowano = useRef(false);

  useEffect(() => {
    if (!nieaktualne || wystartowano.current) return;
    wystartowano.current = true;

    fetch("/api/notowania", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json.zastosowane > 0) router.refresh();
      })
      // Cisza jest tu zamierzona: to odświeżanie w tle, o które nikt nie
      // prosił. Awaria źródła notowań nie ma prawa niczego zgłaszać.
      .catch(() => {});
  }, [nieaktualne, router]);

  return null;
}
