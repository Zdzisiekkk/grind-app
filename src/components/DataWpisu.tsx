"use client";

import { Field, Input } from "@/components/ui";
import { humanDate, todayISO } from "@/lib/format";
import { DNI_WSTECZ, najstarszaData } from "@/lib/wstecz";
import { clsx } from "@/lib/clsx";

/**
 * Pole daty dla arkuszy, w których nie ma miejsca na przełącznik dnia.
 *
 * Domyślnie stoi na dzisiaj i tak zostaje, dopóki nikt go nie ruszy - wpisanie
 * wagi ma dalej być dwoma tapnięciami. Gdy data przestaje być dzisiejsza, pole
 * zmienia kolor, żeby przy zapisie było widać, że wpis idzie w przeszłość.
 */
export function DataWpisu({
  value,
  onChange,
  label = "Data",
  dzis = todayISO(),
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  dzis?: string;
}) {
  const wPrzeszlosci = value !== dzis;

  return (
    <Field
      label={label}
      hint={
        wPrzeszlosci
          ? `Wpis trafi na ${humanDate(value)}, nie na dzisiaj.`
          : `Możesz cofnąć się o ${DNI_WSTECZ} dni.`
      }
    >
      <Input
        type="date"
        value={value}
        min={najstarszaData(dzis)}
        max={dzis}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className={clsx(wPrzeszlosci && "border-warn text-warn")}
      />
    </Field>
  );
}
