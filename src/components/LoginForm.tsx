"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/** Komunikaty Supabase są po angielsku — tłumaczymy te, które user faktycznie zobaczy. */
function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("email not confirmed")) return "Potwierdź adres e-mail — link jest w skrzynce.";
  if (m.includes("user already registered")) return "Konto z tym adresem już istnieje. Zaloguj się.";
  if (m.includes("password should be at least")) return "Hasło musi mieć co najmniej 6 znaków.";
  if (m.includes("unable to validate email")) return "To nie wygląda na poprawny adres e-mail.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.";
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Gdy w projekcie włączone jest potwierdzanie e-maila, sesji jeszcze nie ma.
        if (!data.session) {
          setInfo("Konto założone. Kliknij link potwierdzający, który wysłaliśmy na Twój e-mail.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace(next as never);
      router.refresh();
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="E-mail">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ty@example.com"
        />
      </Field>

      <Field label="Hasło" hint={mode === "signup" ? "Minimum 6 znaków." : undefined}>
        <Input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <Button type="submit" variant="primary" size="lg" block loading={loading}>
        {mode === "signin" ? "Zaloguj się" : "Załóż konto"}
      </Button>

      <button
        type="button"
        className="text-[14px] text-muted underline underline-offset-4"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
      >
        {mode === "signin" ? "Nie masz konta? Załóż nowe" : "Masz już konto? Zaloguj się"}
      </button>
    </form>
  );
}
