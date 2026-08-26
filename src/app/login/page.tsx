import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/SetupNotice";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Logowanie" };

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <header className="text-center">
        <div className="text-5xl" aria-hidden>
          🏋️
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Grind</h1>
        <p className="mt-1 text-[14px] text-muted">Trening, dieta i aktywności w jednym miejscu.</p>
      </header>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
