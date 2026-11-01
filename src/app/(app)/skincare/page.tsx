import { SkinCareScreen } from "@/components/prosty/SkinCareScreen";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { WygladProdukt, WygladProtokol, WygladRutyna } from "@/lib/database.types";

export const metadata = { title: "Skin care" };

/**
 * Pielęgnacja bez skanu twarzy: lista na dziś i edytor rutyn. Skan z AI,
 * zdjęcia i pomiary zostają w pełnym trybie w zakładce "Wygląd" - ta strona
 * czyta te same tabele, więc rutyna ułożona tu jest widoczna tam i odwrotnie.
 */
export default async function SkinCarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dzis = todayISO();
  const [{ data: rutyny }, { data: logi }, { data: protokoly }, { data: produkty }] = await Promise.all([
    supabase.from("wyglad_rutyny").select("*").eq("user_id", user.id).order("pora"),
    supabase
      .from("wyglad_rutyna_log")
      .select("rutyna_id")
      .eq("user_id", user.id)
      .eq("data", dzis)
      .eq("wykonano", true),
    supabase.from("wyglad_protokoly").select("*").eq("user_id", user.id),
    supabase.from("wyglad_produkty").select("*").eq("user_id", user.id).order("pora"),
  ]);

  return (
    <SkinCareScreen
      rutyny={(rutyny ?? []) as WygladRutyna[]}
      odhaczoneDzis={(logi ?? []).map((l) => l.rutyna_id)}
      protokoly={(protokoly ?? []) as WygladProtokol[]}
      produkty={(produkty ?? []) as WygladProdukt[]}
    />
  );
}
