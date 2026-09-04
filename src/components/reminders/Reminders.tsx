"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/lib/notify";
import { slotPrzypomnienia, trescPrzypomnienia } from "@/lib/statusDnia";

export type HabitReminder = { id: string; name: string; icon: string; at: string; due: boolean };

/** Przypomnienie o pójściu spać. `loggedToday` gasi je, gdy noc już zapisana. */
export type SleepReminder = { at: string; goalLabel: string } | null;

export type WaterReminder = {
  from: string | null;
  to: string | null;
  everyMin: number | null;
  behind: boolean;
} | null;

const STORAGE_KEY = "grind:reminders-fired";
const CHECK_EVERY_MS = 30_000;

/** "14:30" → 870 minut od północy. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Co już dziś wystrzeliło - żeby nie powtarzać przy każdym sprawdzeniu. */
function readFired(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return raw.day === todayKey() ? new Set<string>(raw.keys ?? []) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeFired(keys: Set<string>) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ day: todayKey(), keys: [...keys] }),
  );
}

/** Stan dnia do "widgetu" powiadomienia - kalorie i woda na żywo. */
export type NutritionToday = {
  kcal: number;
  kcalGoal: number | null;
  waterMl: number;
  waterGoal: number;
} | null;

/**
 * Przypomnienia o nawykach i piciu wody.
 *
 * Powiadomienia wystrzeliwuje przeglądarka, więc docierają tylko wtedy, gdy
 * aplikacja jest otwarta (na iPhonie - gdy jest dodana do ekranu głównego i
 * uruchomiona). Prawdziwe powiadomienia w tle wymagają Web Push z serwerem
 * wysyłkowym; struktura danych jest na to gotowa, sama wysyłka to osobny krok.
 *
 * Niezależnie od powiadomień systemowych zaległe rzeczy widać w aplikacji -
 * na pulpicie i w zakładce z dietą.
 */
export function Reminders({
  habits,
  water,
  sleep,
  nutritionToday,
}: {
  habits: HabitReminder[];
  water: WaterReminder;
  sleep: SleepReminder;
  /** Brak = nie pokazujemy statusu dnia (np. brak celu skonfigurowanego). */
  nutritionToday?: NutritionToday;
}) {
  // Świeże dane bez restartowania interwału przy każdym renderze.
  // Ref aktualizujemy w efekcie - pisanie do niego w trakcie renderu
  // łamie reguły Reacta.
  const dataRef = useRef({ habits, water, sleep, nutritionToday });
  useEffect(() => {
    dataRef.current = { habits, water, sleep, nutritionToday };
  }, [habits, water, sleep, nutritionToday]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    function check() {
      if (Notification.permission !== "granted") return;
      if (document.visibilityState !== "visible") return;

      const fired = readFired();
      const before = fired.size;
      const minutes = nowMinutes();

      for (const habit of dataRef.current.habits) {
        if (!habit.due) continue;
        const at = toMinutes(habit.at);
        if (at === null) continue;
        // Okno 15 minut - jeśli apka była zamknięta o równej godzinie,
        // przypomnienie i tak dotrze przy najbliższym otwarciu.
        if (minutes < at || minutes > at + 15) continue;

        const key = `habit:${habit.id}`;
        if (fired.has(key)) continue;
        if (notify("Grind - nawyk", `${habit.icon} ${habit.name}`, key)) fired.add(key);
      }

      const w = dataRef.current.water;
      if (w?.everyMin && w.behind) {
        const from = w.from ? toMinutes(w.from) : 8 * 60;
        const to = w.to ? toMinutes(w.to) : 22 * 60;
        if (from !== null && to !== null && minutes >= from && minutes <= to) {
          // Kubełkujemy po interwale, żeby w oknie 8-22 co godzinę wyszło
          // dokładnie jedno przypomnienie.
          const slot = Math.floor((minutes - from) / w.everyMin);
          const key = `water:${slot}`;
          if (!fired.has(key) && notify("Grind - nawodnienie", "Czas na wodę 💧", key)) {
            fired.add(key);
          }
        }
      }

      // Pora spać. Okno jest szersze niż przy nawykach (60 minut), bo to
      // przypomnienie ma sens także wtedy, gdy sięgnąłeś po telefon później -
      // wtedy właśnie jest najbardziej na miejscu.
      const sleepReminder = dataRef.current.sleep;
      if (sleepReminder) {
        const at = toMinutes(sleepReminder.at);
        if (at !== null && minutes >= at && minutes <= at + 60 && !fired.has("sleep")) {
          if (notify("Grind - pora spać", `${sleepReminder.goalLabel} 😴`, "sleep")) {
            fired.add("sleep");
          }
        }
      }

      /*
       * Stan dnia - najwyżej raz na cztery godziny i tylko wtedy, gdy realnie
       * odstajesz od celu (reguła w src/lib/statusDnia.ts).
       *
       * Pierwsza wersja odświeżała to powiadomienie co 30 sekund, żeby
       * udawało widget. Efekt był odwrotny od zamierzonego: nieustanny ping
       * uczy wyłączać powiadomienia całkiem, a wtedy przepadają też te
       * naprawdę ważne. Prawdziwy widget na ekranie blokady wymaga natywnej
       * aplikacji - w przeglądarce nie ma go jak zrobić i lepiej to
       * powiedzieć wprost niż udawać spamem.
       */
      const n = dataRef.current.nutritionToday;
      if (n) {
        const slot = slotPrzypomnienia(minutes);
        if (slot !== null) {
          const key = `status:${slot}`;
          if (!fired.has(key)) {
            const tresc = trescPrzypomnienia(n, minutes);
            if (tresc && notify("Grind - stan dnia", tresc, "status-dnia")) fired.add(key);
          }
        }
      }

      if (fired.size !== before) writeFired(fired);
    }

    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return null;
}
