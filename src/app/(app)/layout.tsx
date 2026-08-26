import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/SetupNotice";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/*
        Aplikacja rysuje pod paskiem stanu (viewport-fit=cover + black-translucent),
        więc górny odstęp musi uwzględniać wcięcie notcha. Bez tego na iPhonie
        nagłówek ekranu ląduje pod zegarkiem.
      */}
      <main className="safe-top flex-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
