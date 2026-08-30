/** Ekran zastępczy, gdy projekt nie ma jeszcze podpiętego Supabase. */
export function SetupNotice() {
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">Grind - jeszcze jeden krok</h1>
      <p className="text-[15px] text-muted">
        Aplikacja nie ma podpiętej bazy. Utwórz projekt na{" "}
        <a className="text-accent underline" href="https://supabase.com/dashboard">
          supabase.com
        </a>
        , a potem:
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-[14px] text-muted">
        <li>
          Skopiuj <code className="rounded bg-surface-2 px-1">.env.example</code> do{" "}
          <code className="rounded bg-surface-2 px-1">.env.local</code>.
        </li>
        <li>
          Wklej <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code> i{" "}
          <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> z zakładki
          Project Settings → API.
        </li>
        <li>
          Wykonaj pliki z <code className="rounded bg-surface-2 px-1">supabase/migrations/</code> po
          kolei w SQL Editor.
        </li>
        <li>Zrestartuj serwer deweloperski.</li>
      </ol>
      <p className="text-[13px] text-faint">Pełna instrukcja krok po kroku jest w README.md.</p>
    </div>
  );
}
