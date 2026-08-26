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
      <main className="flex-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))] pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
