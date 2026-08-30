"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Toast } from "@/components/ui";
import type { SaveState } from "@/app/(app)/profil/actions";

/**
 * Formularz profilu z widocznym potwierdzeniem zapisu.
 *
 * Pola zostają na serwerze - wchodzą tu jako `children`, więc cała strona
 * profilu dalej renderuje się serwerowo. Klienta potrzebuje wyłącznie to,
 * czego serwer nie umie: stan "właśnie zapisano" i przycisk, który wie,
 * że trwa wysyłka.
 */
export function ProfileForm({
  action,
  children,
}: {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}

      {state && !state.ok && <Alert>{state.message}</Alert>}

      <SaveButton />

      {/* Klucz ze znacznikiem czasu - każdy zapis montuje toast od nowa. */}
      {state?.ok && <Toast key={state.at}>Zapisano zmiany</Toast>}
    </form>
  );
}

/**
 * Osobny komponent, bo useFormStatus czyta formularz z kontekstu - działa
 * tylko wewnątrz <form>, nie w komponencie, który ten formularz renderuje.
 */
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" block loading={pending}>
      {pending ? "Zapisuję..." : "Zapisz zmiany"}
    </Button>
  );
}
