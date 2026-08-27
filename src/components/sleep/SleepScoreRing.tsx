"use client";

import { ScoreRing } from "@/components/ui";
import { sleepBand } from "@/lib/sleep";

/** Pierścień z oceną nocy — kolor z pasma, liczba zawsze widoczna w środku. */
export function SleepScoreRing({ score, size }: { score: number; size?: number }) {
  return <ScoreRing score={score} color={sleepBand(score).color} size={size} caption="score" />;
}
