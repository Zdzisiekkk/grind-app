"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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

/**
 * Ekran logowania jest jedynym miejscem, do którego trafia się po wylogowaniu
 * i po wygaśnięciu sesji — więc to tutaj czyścimy zapamiętane strony.
 * Zostawały tam pulpity i dzienniki konkretnej osoby, a na telefon zagląda
 * czasem ktoś jeszcze.
 */
function useClearedOfflineCache() {
  useEffect(() => {
    // Przez `ready`, a nie przez `controller`. Ten drugi bywa null przez chwilę
    // po twardym odświeżeniu i zaraz po aktualizacji workera — a wtedy
    // wiadomość przepadała bez śladu i zapamiętane strony poprzedniej osoby
    // zostawały na telefonie. Cichy brak, dokładnie w momencie, w którym
    // czyszczenie jest potrzebne.
    navigator.serviceWorker?.ready
      .then((rejestracja) => rejestracja.active?.postMessage("grind:clear-cache"))
      .catch(() => {
        // Brak workera (np. tryb prywatny) znaczy, że nie ma czego czyścić.
      });
  }, []);
}

/**
 * Wersja regulaminu, na którą zgadza się nowe konto.
 *
 * Numer, a nie samo „tak": przy zmianie dokumentów trzeba wiedzieć, kto widział
 * którą wersję i kogo zapytać ponownie.
 */
const TERMS_VERSION = 1;

export function LoginForm() {
  useClearedOfflineCache();

  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedHealth, setAcceptedHealth] = useState(false);

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

        // Na rejestrację istniejącego adresu Supabase odpowiada udawanym sukcesem
        // (żeby nie dało się sprawdzać, kto ma konto) — poznajemy to po pustej
        // liście tożsamości. Bez tego kazalibyśmy czekać na maila, którego nikt
        // nie wysłał.
        if (data.user && data.user.identities?.length === 0) {
          setMode("signin");
          throw new Error("Konto z tym adresem już istnieje. Zaloguj się.");
        }

        // Zgody zapisujemy dopiero po założeniu konta, bo wcześniej nie ma
        // profilu, do którego dałoby się je wpisać.
        if (data.session && data.user) {
          await supabase
            .from("profiles")
            .update({
              terms_version: TERMS_VERSION,
              terms_accepted_at: new Date().toISOString(),
              health_consent_at: acceptedHealth ? new Date().toISOString() : null,
            })
            .eq("id", data.user.id);
        }

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

      {mode === "signup" && (
        <div className="flex flex-col gap-2.5">
          <Consent checked={acceptedTerms} onChange={setAcceptedTerms} required>
            Akceptuję{" "}
            <a className="underline" href="/regulamin" target="_blank" rel="noreferrer">
              regulamin
            </a>{" "}
            i{" "}
            <a className="underline" href="/prywatnosc" target="_blank" rel="noreferrer">
              politykę prywatności
            </a>
            .
          </Consent>

          {/*
            Osobna zgoda, bo sen, ból, kontuzje i waga to dane szczególnej
            kategorii (art. 9 RODO) — nie wolno ich schować w akceptacji
            regulaminu. Bez niej apka działa dalej, tylko bez tych dzienników.
          */}
          <Consent checked={acceptedHealth} onChange={setAcceptedHealth}>
            Zgadzam się na zapisywanie moich danych o zdrowiu: snu, bólu, kontuzji i wagi.
            Bez tego reszta aplikacji działa normalnie, a zgodę mogę cofnąć w profilu.
          </Consent>
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        loading={loading}
        disabled={mode === "signup" && !acceptedTerms}
      >
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

/**
 * Pojedyncza zgoda.
 *
 * Cały wiersz jest klikalny, a pole ma 20 px — zgoda musi być łatwa do
 * zaznaczenia świadomie i trudna do zaznaczenia przypadkiem, dlatego nic tu
 * nie jest domyślnie włączone.
 */
function Consent({
  checked,
  onChange,
  required,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 text-muted">
        {children}
        {required && <span className="ml-1 font-semibold text-danger">wymagane</span>}
      </span>
    </label>
  );
}
