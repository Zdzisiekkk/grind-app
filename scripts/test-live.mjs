/**
 * Test end-to-end na żywym wdrożeniu: rejestracja, logowanie, wszystkie ekrany,
 * skopiowanie planu, zapis serii i podsumowanie. Na koniec kasuje konto testowe.
 *
 *   GRIND_URL=https://... \
 *   NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run test:live
 *
 * Service role key jest potrzebny wyłącznie do usunięcia konta testowego —
 * nigdy nie wrzucaj go do repozytorium ani na Vercela.
 */

const APP = process.env.GRIND_URL;
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!APP || !SB || !KEY || !SR) {
  console.error("Brakuje zmiennych: GRIND_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const REF = new URL(SB).hostname.split(".")[0];
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASS = "TestoweHaslo123";

const ok = (b) => (b ? "✅" : "❌");
let fails = 0;
const check = (label, cond, extra = "") => { if (!cond) fails++; console.log(`  ${ok(cond)} ${label}${extra ? " — " + extra : ""}`); };

// 1. Rejestracja przez publiczne API — dokładnie to robi formularz
const su = await (await fetch(`${SB}/auth/v1/signup`, {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})).json();
check("rejestracja daje sesję od razu, bez maila", Boolean(su.access_token));
check("adres od razu potwierdzony", Boolean(su.user?.email_confirmed_at));

// 2. Duplikat
const dup = await (await fetch(`${SB}/auth/v1/signup`, {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})).json();
check("powtórna rejestracja rozpoznana", (dup.msg || "").includes("already registered"), dup.msg);

// 3. Wylogowanie i ponowne zalogowanie
const li = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})).json();
check("logowanie tym samym hasłem", Boolean(li.access_token));

// 4. Złe hasło musi zostać odrzucone
const bad = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "zle-haslo" }),
})).json();
check("złe hasło odrzucone", !bad.access_token);

// 5. Chodzenie po aplikacji na produkcji z prawdziwą sesją
const enc = "base64-" + Buffer.from(JSON.stringify(li)).toString("base64url");
const C = 3180;
const cookie = (enc.length <= C
  ? [`sb-${REF}-auth-token=${enc}`]
  : Array.from({ length: Math.ceil(enc.length / C) }, (_, i) => `sb-${REF}-auth-token.${i}=${enc.slice(i*C,(i+1)*C)}`)
).join("; ");

const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
for (const [path, expect] of [["/","Dziś"],["/trening","Trening"],["/dieta","Dieta"],["/progres","Postępy"],["/plan","Plany"],["/cwiczenia","Katalog"],["/kalendarz","Kalendarz"],["/profil","Profil"],["/aktywnosci","Aktywno"]]) {
  const r = await fetch(APP + path, { headers: { cookie }, redirect: "manual" });
  const t = r.status === 200 ? text(await r.text()) : "";
  check(`${path.padEnd(13)} po zalogowaniu`, r.status === 200 && t.includes(expect), r.status !== 200 ? `status ${r.status}` : "");
}

// 6. Bez sesji nie wolno wejść
const anon = await fetch(APP + "/dieta", { redirect: "manual" });
check("bez sesji przekierowanie na logowanie", anon.status === 307);

// 7. Skopiowanie szablonu planu i zapis serii — najważniejsza ścieżka aplikacji
const H = { apikey: KEY, Authorization: `Bearer ${li.access_token}`, "Content-Type": "application/json" };
const [tpl] = await (await fetch(`${SB}/rest/v1/plans?select=id&is_template=eq.true`, { headers: H })).json();
const planId = await (await fetch(`${SB}/rest/v1/rpc/clone_plan`, { method:"POST", headers:H,
  body: JSON.stringify({ p_source_plan_id: tpl.id, p_new_name: "Mój plan", p_activate: true }) })).json();
check("skopiowanie szablonu planu", typeof planId === "string");

const days = await (await fetch(`${SB}/rest/v1/workout_days?select=id,name,phases!inner(plan_id)&phases.plan_id=eq.${planId}`, { headers: H })).json();
check("kopia ma 7 dni", days.length === 7, `${days.length} dni`);

const ex = await (await fetch(`${SB}/rest/v1/workout_exercises?select=id,catalog_exercise_id&workout_day_id=eq.${days[0].id}&limit=1`, { headers: H })).json();
const sess = await (await fetch(`${SB}/rest/v1/workout_sessions`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, workout_day_id: days[0].id, date: new Date().toISOString().slice(0,10) }) })).json();
check("start sesji treningowej", Array.isArray(sess) && sess[0]?.id);

const log = await (await fetch(`${SB}/rest/v1/workout_logs`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, session_id: sess[0].id, workout_exercise_id: ex[0].id,
    catalog_exercise_id: ex[0].catalog_exercise_id, exercise_name: "test", date: new Date().toISOString().slice(0,10),
    set_number: 1, weight_kg: 60, reps: 8 }) })).json();
check("zapis serii 60 kg x 8", Array.isArray(log) && log[0]?.id);

const summ = await (await fetch(`${SB}/rest/v1/rpc/period_summary`, { method:"POST", headers:H,
  body: JSON.stringify({ p_from: new Date(Date.now()-7*864e5).toISOString().slice(0,10), p_to: new Date().toISOString().slice(0,10) }) })).json();
check("podsumowanie liczy objętość 480 kg", summ?.volume_kg === 480, `volume_kg=${summ?.volume_kg}`);

// 8. Sprzątanie
await fetch(`${SB}/auth/v1/admin/users/${li.user.id}`, { method:"DELETE", headers:{ apikey: SR, Authorization:`Bearer ${SR}` } });
const left = await (await fetch(`${SB}/auth/v1/admin/users`, { headers:{ apikey: SR, Authorization:`Bearer ${SR}` } })).json();
check("konto testowe usunięte, baza pusta", (left.users || []).length === 0, `${(left.users||[]).length} kont`);

console.log(fails === 0 ? "\n  WSZYSTKO PRZESZŁO" : `\n  BŁĘDÓW: ${fails}`);
process.exit(fails ? 1 : 0);
