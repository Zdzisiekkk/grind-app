import { CoachScreen } from "@/components/coach/CoachScreen";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/subscription";
import { stanBudzetu } from "@/lib/ai/budzet";
import { todayISO } from "@/lib/format";
import type { CoachMessage, CoachProposal } from "@/lib/database.types";

export const metadata = { title: "Trener AI" };

/** Musi się zgadzać z limitem w trasie /api/ai/coach. */
const DAILY_LIMIT = 10;

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [access, budzet, { data: proposals }, { data: past }, { data: messages }, { data: usage }] =
    await Promise.all([
    getAccess(),
    // Ile zostało z miesięcznego budżetu. Ekran musi to napisać, ZANIM ktoś
    // napisze pytanie — odmowa po fakcie jest zwykłym marnowaniem czyjegoś czasu.
    stanBudzetu(supabase),
    supabase
      .from("coach_proposals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    // Rady, które już zapadły albo zostały zastąpione. Do tej pory znikały
    // bezpowrotnie przy każdej nowej analizie (migracja 0033) — a to właśnie
    // one pokazują, czy trener miał rację.
    supabase
      .from("coach_proposals")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("ai_usage")
      .select("calls")
      .eq("user_id", user.id)
      .eq("date", todayISO())
      .maybeSingle(),
  ]);

  return (
    <CoachScreen
      pro={access.pro}
      proposals={(proposals ?? []) as CoachProposal[]}
      past={(past ?? []) as CoachProposal[]}
      history={[...((messages ?? []) as CoachMessage[])].reverse()}
      callsToday={usage?.calls ?? 0}
      dailyLimit={DAILY_LIMIT}
      budzet={budzet}
      configured={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
