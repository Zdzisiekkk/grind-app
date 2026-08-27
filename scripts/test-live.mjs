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

// Nagłówki do REST-a — potrzebne już przy sprawdzaniu kreatora.
const H = { apikey: KEY, Authorization: `Bearer ${li.access_token}`, "Content-Type": "application/json" };

const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();

// 5a. Świeże konto trafia najpierw do kreatora, a nie na pusty pulpit
const firstVisit = await fetch(APP + "/", { headers: { cookie }, redirect: "manual" });
check("nowe konto ląduje w kreatorze",
  firstVisit.status === 307 && (firstVisit.headers.get("location") || "").includes("/start"),
  `status ${firstVisit.status} → ${firstVisit.headers.get("location")}`);

const startPage = await fetch(APP + "/start", { headers: { cookie }, redirect: "manual" });
const startText = startPage.status === 200 ? text(await startPage.text()) : "";
check("kreator pyta o cel i staż",
  startPage.status === 200 && startText.includes("Zaczynamy") && startText.includes("Redukcja"),
  startPage.status !== 200 ? `status ${startPage.status}` : "");

// Gotowe plany muszą być widoczne dla każdego, nie tylko dla właściciela konta.
const tpls = await (await fetch(
  `${SB}/rest/v1/plans?select=name,days_per_week,level,equipment&is_template=eq.true&is_public=eq.true&user_id=is.null&order=days_per_week`,
  { headers: H })).json();
check("gotowe plany są do wyboru", Array.isArray(tpls) && tpls.length >= 5,
  `${tpls.length ?? 0} szablonów: ${(tpls || []).map(p => p.name).join(", ")}`);
check("każdy szablon mówi, ile dni i jaki sprzęt",
  (tpls || []).every(p => p.days_per_week && p.equipment && p.level));
check("jest plan bez sprzętu", (tpls || []).some(p => p.equipment === "home"));

// Dalsza część testu udaje, że kreator został przeszedł — resztę aplikacji
// sprawdzamy w stanie „konto już używane".
await fetch(`${SB}/rest/v1/profiles?id=eq.${li.user.id}`, { method: "PATCH", headers: H,
  body: JSON.stringify({ onboarded_at: new Date().toISOString(), weekly_workouts: 4 }) });

for (const [path, expect] of [["/","Dziś"],["/trening","Trening"],["/dieta","Dieta"],["/progres","Postępy"],["/plan","Plany"],["/cwiczenia","Katalog"],["/kalendarz","Kalendarz"],["/profil","Profil"],["/aktywnosci","Aktywno"],["/sen","Sen"]]) {
  const r = await fetch(APP + path, { headers: { cookie }, redirect: "manual" });
  const t = r.status === 200 ? text(await r.text()) : "";
  check(`${path.padEnd(13)} po zalogowaniu`, r.status === 200 && t.includes(expect), r.status !== 200 ? `status ${r.status}` : "");
}

// 6. Bez sesji nie wolno wejść
const anon = await fetch(APP + "/dieta", { redirect: "manual" });
check("bez sesji przekierowanie na logowanie", anon.status === 307);

// 7. Skopiowanie szablonu planu i zapis serii — najważniejsza ścieżka aplikacji
const [tpl] = await (await fetch(`${SB}/rest/v1/plans?select=id&is_template=eq.true`, { headers: H })).json();
const planId = await (await fetch(`${SB}/rest/v1/rpc/clone_plan`, { method:"POST", headers:H,
  body: JSON.stringify({ p_source_plan_id: tpl.id, p_new_name: "Mój plan", p_activate: true }) })).json();
check("skopiowanie szablonu planu", typeof planId === "string");

const days = await (await fetch(`${SB}/rest/v1/workout_days?select=id,name,phases!inner(plan_id)&phases.plan_id=eq.${planId}`, { headers: H })).json();
// Liczbę dni bierzemy z szablonu, nie z głowy — plan bywa zmieniany.
const tplDays = await (await fetch(`${SB}/rest/v1/workout_days?select=id,phases!inner(plan_id)&phases.plan_id=eq.${tpl.id}`, { headers: H })).json();
check("kopia ma tyle dni co szablon", days.length === tplDays.length && days.length > 0,
  `kopia ${days.length}, szablon ${tplDays.length}`);

const ex = await (await fetch(`${SB}/rest/v1/workout_exercises?select=id,catalog_exercise_id&workout_day_id=eq.${days[0].id}&limit=1`, { headers: H })).json();
const sess = await (await fetch(`${SB}/rest/v1/workout_sessions`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, workout_day_id: days[0].id, date: new Date().toISOString().slice(0,10) }) })).json();
check("start sesji treningowej", Array.isArray(sess) && sess[0]?.id);

const log = await (await fetch(`${SB}/rest/v1/workout_logs`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, session_id: sess[0].id, workout_exercise_id: ex[0].id,
    catalog_exercise_id: ex[0].catalog_exercise_id, exercise_name: "test", date: new Date().toISOString().slice(0,10),
    set_number: 1, weight_kg: 60, reps: 8 }) })).json();
check("zapis serii 60 kg x 8", Array.isArray(log) && log[0]?.id);

// 7b. Kontuzje: dodanie, ocena bólu, obecność w podsumowaniu
const inj = await (await fetch(`${SB}/rest/v1/injuries`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, name: "Lewe kolano", body_part: "knee", side: "left" }) })).json();
check("dodanie kontuzji", Array.isArray(inj) && inj[0]?.id);

const pain = await (await fetch(`${SB}/rest/v1/pain_logs`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, injury_id: inj[0].id, date: new Date().toISOString().slice(0,10), level: 4 }) })).json();
check("ocena bólu 4/10", Array.isArray(pain) && pain[0]?.level === 4);

const kontuzje = await fetch(APP + "/kontuzje", { headers: { cookie }, redirect: "manual" });
const kontuzjeText = kontuzje.status === 200 ? text(await kontuzje.text()) : "";
check("/kontuzje pokazuje dodaną kontuzję",
  kontuzje.status === 200 && kontuzjeText.includes("Lewe kolano"),
  kontuzje.status !== 200 ? `status ${kontuzje.status}` : "");

// 7c. Nawyki i woda
const habit = await (await fetch(`${SB}/rest/v1/habits`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, name: "Kreatyna", icon: "💊", target_per_day: 2, reminder_at: "09:00" }) })).json();
check("dodanie nawyku", Array.isArray(habit) && habit[0]?.id);

const hlog = await (await fetch(`${SB}/rest/v1/habit_logs`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, habit_id: habit[0].id, date: new Date().toISOString().slice(0,10), count: 2 }) })).json();
check("odhaczenie nawyku 2/2", Array.isArray(hlog) && hlog[0]?.count === 2);

for (const ml of [500, 330]) {
  await fetch(`${SB}/rest/v1/water_logs`, { method:"POST", headers:H,
    body: JSON.stringify({ user_id: li.user.id, date: new Date().toISOString().slice(0,10), ml }) });
}
const wsum = await (await fetch(`${SB}/rest/v1/v_daily_water?select=ml`, { headers: H })).json();
check("suma wody 830 ml", wsum?.[0]?.ml === 830, `ml=${wsum?.[0]?.ml}`);

const nawyki = await fetch(APP + "/nawyki", { headers: { cookie }, redirect: "manual" });
const nawykiText = nawyki.status === 200 ? text(await nawyki.text()) : "";
check("/nawyki pokazuje dodany nawyk", nawyki.status === 200 && nawykiText.includes("Kreatyna"),
  nawyki.status !== 200 ? `status ${nawyki.status}` : "");

const dieta2 = await fetch(APP + "/dieta", { headers: { cookie }, redirect: "manual" });
const dietaText = dieta2.status === 200 ? text(await dieta2.text()) : "";
check("/dieta pokazuje nawodnienie", dieta2.status === 200 && dietaText.includes("Nawodnienie"));

// 7d. Zadania
const list = await (await fetch(`${SB}/rest/v1/todo_lists`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, name: "Sprzęt", icon: "🛒" }) })).json();
check("dodanie listy zadań", Array.isArray(list) && list[0]?.id);

const todo = await (await fetch(`${SB}/rest/v1/todos`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, list_id: list[0].id, title: "Opaska na nadgarstek", priority: 1,
    due_date: new Date().toISOString().slice(0,10) }) })).json();
check("dodanie zadania", Array.isArray(todo) && todo[0]?.id);

const doneTodo = await (await fetch(`${SB}/rest/v1/todos?id=eq.${todo[0].id}`, { method:"PATCH", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ done_at: new Date().toISOString() }) })).json();
check("odhaczenie zadania", Array.isArray(doneTodo) && Boolean(doneTodo[0]?.done_at));

const zadania = await fetch(APP + "/zadania", { headers: { cookie }, redirect: "manual" });
const zadaniaText = zadania.status === 200 ? text(await zadania.text()) : "";
check("/zadania pokazuje listę", zadania.status === 200 && zadaniaText.includes("Sprzęt"),
  zadania.status !== 200 ? `status ${zadania.status}` : "");

// 7e. Sen i Health Score
const nightDate = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const night = await (await fetch(`${SB}/rest/v1/sleep_logs`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, date: nightDate, bedtime: "23:30", wake_time: "07:00",
    fell_asleep_min: 20, awakenings: 1, awake_min: 15, quality: 4, morning_energy: 4,
    factors: ["ekran", "magnez"] }) })).json();
check("zapis nocy 23:30 → 07:00", Array.isArray(night) && night[0]?.id);

// Kolumna generowana liczy przez północ: 450 min w łóżku, 415 realnego snu.
check("czas w łóżku liczony przez północ", night[0]?.time_in_bed_min === 450,
  `time_in_bed_min=${night[0]?.time_in_bed_min}`);

const vsleep = await (await fetch(`${SB}/rest/v1/v_sleep?select=sleep_min,quality&date=eq.${nightDate}`, { headers: H })).json();
check("realny sen po odjęciu zasypiania i pobudek", vsleep?.[0]?.sleep_min === 415,
  `sleep_min=${vsleep?.[0]?.sleep_min}`);

const badFactor = await fetch(`${SB}/rest/v1/sleep_logs`, { method:"POST", headers:H,
  body: JSON.stringify({ user_id: li.user.id, date: "2000-01-01", bedtime: "23:00", wake_time: "07:00",
    quality: 3, factors: ["cos_wymyslonego"] }) });
check("baza odrzuca nieznany czynnik snu", badFactor.status >= 400, `status ${badFactor.status}`);

const sen = await fetch(APP + "/sen", { headers: { cookie }, redirect: "manual" });
const senText = sen.status === 200 ? text(await sen.text()) : "";
check("/sen pokazuje ocenę nocy", sen.status === 200 && /23:30/.test(senText) && /6 h 55 min/.test(senText),
  sen.status !== 200 ? `status ${sen.status}` : "");

const pulpit = await fetch(APP + "/", { headers: { cookie }, redirect: "manual" });
const pulpitText = pulpit.status === 200 ? text(await pulpit.text()) : "";
check("pulpit pokazuje Health Score", pulpit.status === 200 && pulpitText.includes("Health Score"),
  pulpit.status !== 200 ? `status ${pulpit.status}` : "");

// Regresja: pulpit koloruje ikonkę oceny bólu po stronie serwera. Gdy paleta
// statusów siedzi w module oznaczonym "use client", ten render wysypuje całą
// stronę — a status i tak jest 200, więc sam kod odpowiedzi tego nie łapie.
// Luźne odstępy, bo React rozbija sąsiadujące wyrażenia komentarzami HTML,
// a nasz zdejmowacz tagów zamienia je na spacje.
check("pulpit renderuje ocenę bólu z dzisiaj", /Lewe kolano\s*:\s*4\s*\/\s*10/.test(pulpitText),
  pulpitText.length < 400 ? "strona zwróciła sam szkielet ładowania" : "");

// 7f. Paywall — najważniejsze jest to, czego NIE da się zrobić
const proBefore = await (await fetch(`${SB}/rest/v1/rpc/has_pro`, { method:"POST", headers:H, body:"{}" })).json();
check("nowe konto nie ma dostępu do funkcji płatnych", proBefore === false, `has_pro=${proBefore}`);

// Gdyby to przeszło, każdy przyznałby sobie subskrypcję jednym żądaniem
// z konsoli przeglądarki.
const selfGrant = await fetch(`${SB}/rest/v1/subscriptions`, { method:"POST", headers:H,
  body: JSON.stringify({ user_id: li.user.id, status: "active" }) });
check("nie można sobie samemu wpisać subskrypcji", selfGrant.status >= 400, `status ${selfGrant.status}`);

// return=representation, bo PostgREST na PATCH bez tego oddaje puste 204 —
// i „udało się" nie da się odróżnić od „nic nie pasowało".
const selfPatch = await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${li.user.id}`,
  { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify({ status: "active" }) });
const patched = await selfPatch.json().catch(() => null);
check("nie można podmienić cudzego ani własnego statusu",
  !selfPatch.ok || (Array.isArray(patched) && patched.length === 0), `status ${selfPatch.status}`);

// Furtka webhooka bez sekretu musi milczeć.
const badSecret = await (await fetch(`${SB}/rest/v1/rpc/apply_subscription`, { method:"POST", headers:H,
  body: JSON.stringify({ p_secret: "zgaduje", p_user_id: li.user.id, p_status: "active",
    p_customer_id: null, p_subscription_id: null, p_price_id: null,
    p_period_end: null, p_cancel_at_period_end: false, p_trial_end: null }) })).json();
check("furtka webhooka odrzuca zły sekret", badSecret === false, `zwróciło ${JSON.stringify(badSecret)}`);

const proAfter = await (await fetch(`${SB}/rest/v1/rpc/has_pro`, { method:"POST", headers:H, body:"{}" })).json();
check("po tych próbach nadal brak dostępu", proAfter === false, `has_pro=${proAfter}`);

// Ustawienia cennika czyta każdy (ekran musi pokazać kwotę), ale zmienia tylko admin.
const priceWrite = await fetch(`${SB}/rest/v1/app_settings?key=eq.pricing`,
  { method:"PATCH", headers:{...H, Prefer:"return=representation"},
    body: JSON.stringify({ value: { amount: 1, currency: "PLN", enabled: true } }) });
const priceRows = await priceWrite.json().catch(() => null);
check("zwykły użytkownik nie zmieni cennika",
  !priceWrite.ok || (Array.isArray(priceRows) && priceRows.length === 0), `status ${priceWrite.status}`);

const sub = await fetch(APP + "/subskrypcja", { headers: { cookie }, redirect: "manual" });
const subText = sub.status === 200 ? text(await sub.text()) : "";
check("/subskrypcja mówi, co jest darmowe, a co nie",
  sub.status === 200 && subText.includes("Darmowe na zawsze") && subText.includes("wersja darmowa"),
  sub.status !== 200 ? `status ${sub.status}` : "");

// 7g. Zapis produktu z Open Food Facts do wspólnego cache'u
// Regresja: indeks na off_id był częściowy, więc ON CONFLICT nie miał go jak
// dopasować i KAŻDE dodanie produktu z OFF do posiłku kończyło się błędem.
const offCode = `test-${Date.now()}`;
const cacheOff = () => fetch(`${SB}/rest/v1/foods?on_conflict=off_id`, {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({ user_id: null, source: "off", off_id: offCode,
    name: "Masło testowe", kcal_100g: 750, protein_100g: 0.5, carbs_100g: 0.5, fat_100g: 82 }),
});

const off1 = await cacheOff();
const off1Body = await off1.json().catch(() => null);
check("produkt z OFF zapisuje się do cache'u", off1.ok,
  off1.ok ? "" : JSON.stringify(off1Body).slice(0, 160));

// Drugie dodanie tego samego kodu — tak wygląda wpisanie tego produktu jutro.
const off2 = await cacheOff();
check("ten sam produkt drugi raz nie wywala błędu", off2.ok,
  off2.ok ? "" : JSON.stringify(await off2.json().catch(() => null)).slice(0, 160));

const offRows = await (await fetch(`${SB}/rest/v1/foods?select=id&off_id=eq.${offCode}`, { headers: H })).json();
check("w cache'u zostaje jeden wiersz, nie dwa",
  Array.isArray(offRows) && offRows.length === 1, `wierszy: ${offRows?.length}`);

// 7h. Prawa użytkownika — muszą działać, a nie być obietnicą w regulaminie
const regulamin = await fetch(APP + "/regulamin", { redirect: "manual" });
const regulaminText = regulamin.status === 200 ? text(await regulamin.text()) : "";
check("regulamin czytelny BEZ logowania",
  regulamin.status === 200 && regulaminText.includes("nie zastępuje lekarza"),
  `status ${regulamin.status}`);

const prywatnosc = await fetch(APP + "/prywatnosc", { redirect: "manual" });
const prywatnoscText = prywatnosc.status === 200 ? text(await prywatnosc.text()) : "";
check("polityka prywatności czytelna BEZ logowania",
  prywatnosc.status === 200 && prywatnoscText.includes("art. 9"), `status ${prywatnosc.status}`);

const eksport = await fetch(APP + "/api/dane/eksport", { headers: { cookie }, redirect: "manual" });
const eksportBody = eksport.status === 200 ? await eksport.json() : null;
check("eksport danych oddaje plik do pobrania",
  eksport.status === 200 && (eksport.headers.get("content-disposition") || "").includes("attachment"),
  `status ${eksport.status}`);
check("w eksporcie są dane ze wszystkich dzienników",
  eksportBody?.dane?.workout_logs?.length > 0 &&
  eksportBody?.dane?.sleep_logs?.length > 0 &&
  eksportBody?.dane?.books?.length > 0,
  eksportBody ? `tabel: ${Object.keys(eksportBody.dane).length}` : "");

const eksportAnon = await fetch(APP + "/api/dane/eksport", { redirect: "manual" });
check("bez sesji nie da się pobrać cudzych danych", eksportAnon.status !== 200,
  `status ${eksportAnon.status}`);

// 7i. Czytanie i gotowe dania
const dishes = await (await fetch(`${SB}/rest/v1/foods?select=name,serving_size_g&kind=eq.dish&user_id=is.null&limit=200`, { headers: H })).json();
check("gotowe dania są dostępne dla każdego", Array.isArray(dishes) && dishes.length >= 40,
  `${dishes.length ?? 0} dań`);
check("każde danie ma typową porcję", (dishes || []).every((d) => d.serving_size_g > 0));
check("są dania, których nie ma w Open Food Facts",
  (dishes || []).some((d) => /schabowy/i.test(d.name)) && (dishes || []).some((d) => /bigos/i.test(d.name)));

const book = await (await fetch(`${SB}/rest/v1/books`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, title: "Atomowe nawyki", author: "James Clear",
    status: "reading", pages: 320, current_page: 40 }) })).json();
check("dodanie książki", Array.isArray(book) && book[0]?.id);

const bookNote = await (await fetch(`${SB}/rest/v1/book_notes`, { method:"POST", headers:{...H, Prefer:"return=representation"},
  body: JSON.stringify({ user_id: li.user.id, book_id: book[0].id, page: 37,
    quote: "Nie wznosisz się do poziomu celów, spadasz do poziomu systemów.", note: "To samo co z planem treningowym." }) })).json();
check("notatka z cytatem i stroną", Array.isArray(bookNote) && bookNote[0]?.page === 37);

// Notatka bez treści nie ma sensu — baza tego pilnuje.
const emptyNote = await fetch(`${SB}/rest/v1/book_notes`, { method:"POST", headers:H,
  body: JSON.stringify({ user_id: li.user.id, book_id: book[0].id, page: 10 }) });
check("pusta notatka odrzucona", emptyNote.status >= 400, `status ${emptyNote.status}`);

// Postęp nie może przekroczyć liczby stron.
const tooFar = await fetch(`${SB}/rest/v1/books?id=eq.${book[0].id}`, { method:"PATCH", headers:H,
  body: JSON.stringify({ current_page: 999 }) });
check("nie da się być na stronie 999 w książce o 320 stronach", tooFar.status >= 400, `status ${tooFar.status}`);

const ksiazki = await fetch(APP + "/nawyki/ksiazki", { headers: { cookie }, redirect: "manual" });
const ksiazkiText = ksiazki.status === 200 ? text(await ksiazki.text()) : "";
check("/nawyki/ksiazki pokazuje książkę i notatkę",
  ksiazki.status === 200 && ksiazkiText.includes("Atomowe nawyki"),
  ksiazki.status !== 200 ? `status ${ksiazki.status}` : "");

// 7j. Trener AI — bramka i limit
const coach = await fetch(APP + "/api/ai/coach", { method:"POST", headers:{ cookie, "Content-Type":"application/json" },
  body: JSON.stringify({ mode: "analyze" }) });
const coachBody = await coach.json().catch(() => ({}));
// Bez subskrypcji ma być 402; gdy klucz do modelu nie jest wpisany, 503 zapada
// wcześniej — obie odpowiedzi znaczą „model NIE został uruchomiony".
check("trener bez subskrypcji nie rusza modelu",
  coach.status === 402 || coach.status === 503,
  `status ${coach.status}, ${coachBody.code ?? coachBody.error ?? ""}`);

const noCalls = await (await fetch(`${SB}/rest/v1/ai_usage?select=calls`, { headers: H })).json();
check("odrzucone zapytanie nie zużywa limitu",
  Array.isArray(noCalls) && noCalls.length === 0, JSON.stringify(noCalls));

// Licznik musi być nietykalny — skasowanie albo wyzerowanie go zdejmowałoby
// dzienny limit. Najpierw tworzymy wiersz (przez tę samą funkcję, której używa
// aplikacja), bo kasowanie nieistniejącego wiersza „udaje się" zawsze.
await fetch(`${SB}/rest/v1/rpc/consume_ai_call`, { method:"POST", headers:H,
  body: JSON.stringify({ p_limit: 5 }) });

await fetch(`${SB}/rest/v1/ai_usage?user_id=eq.${li.user.id}`, { method:"DELETE", headers:H });
await fetch(`${SB}/rest/v1/ai_usage?user_id=eq.${li.user.id}`, { method:"PATCH", headers:H,
  body: JSON.stringify({ calls: 0 }) });

const counterRows = await (await fetch(`${SB}/rest/v1/ai_usage?select=calls`, { headers: H })).json();
check("licznika zapytań nie da się skasować ani wyzerować",
  Array.isArray(counterRows) && counterRows[0]?.calls === 1, JSON.stringify(counterRows));

// Uprawnienia tabelowe w Supabase są szerokie z definicji — całą ochronę
// niesie RLS. Tabela dodana bez niego jest otwarta dla niezalogowanych.
const noRls = await (await fetch(`${SB}/rest/v1/rpc/tables_without_rls`, { method:"POST", headers:H, body:"{}" })).json();
check("każda tabela ma włączone RLS", Array.isArray(noRls) && noRls.length === 0,
  Array.isArray(noRls) && noRls.length ? `bez RLS: ${noRls.join(", ")}` : "");

const trener = await fetch(APP + "/trener", { headers: { cookie }, redirect: "manual" });
const trenerText = trener.status === 200 ? text(await trener.text()) : "";
check("/trener bez subskrypcji pokazuje zaproszenie, nie błąd",
  trener.status === 200 && trenerText.includes("wersji płatnej"),
  trener.status !== 200 ? `status ${trener.status}` : "");

// 7k. Tryb offline — serwowane pliki, bez których apka nie wstanie bez zasięgu
// Bez ciasteczka celowo: przeglądarka pobiera service workera bez sesji,
// a strona zastępcza pokazuje się właśnie wtedy, gdy sesji nie da się sprawdzić.
// redirect:"manual", bo inaczej przekierowanie na logowanie udaje sukces.
const sw = await fetch(APP + "/sw.js", { redirect: "manual" });
const swBody = sw.status === 200 ? await sw.text() : "";
check("service worker jest serwowany", sw.status === 200 && swBody.includes("grind-v"),
  `status ${sw.status}`);
check("service worker nie cache'uje danych ani sesji",
  swBody.includes("/rest/v1/") && swBody.includes("/auth/v1/") && swBody.includes("isNetworkOnly"));
check("service worker obsługuje powiadomienia w tle",
  swBody.includes("addEventListener(\"push\"") && swBody.includes("notificationclick"));

const offlinePage = await fetch(APP + "/offline", { redirect: "manual" });
const offlineText = offlinePage.status === 200 ? text(await offlinePage.text()) : "";
check("strona zastępcza bez zasięgu działa bez logowania",
  offlinePage.status === 200 && offlineText.includes("Brak połączenia"), `status ${offlinePage.status}`);

// Wysyłka powiadomień jest chroniona sekretem — bez niego ani rusz.
// redirect:"manual", bo 307 na /login udaje sukces: fetch podąża za nim,
// POST trafia na stronę logowania i wraca 405 zamiast oczekiwanego 401.
const pushNoSecret = await fetch(APP + "/api/push/send", { method: "POST", redirect: "manual" });
check("wysyłka powiadomień odrzuca brak sekretu, a nie przekierowuje na logowanie",
  pushNoSecret.status === 401, `status ${pushNoSecret.status}`);

// Webhook Stripe'a przychodzi bez ciasteczka i sam sprawdza podpis — musi
// dojść do trasy, a nie na ekran logowania. Bez podpisu ma odpowiedzieć 400.
const hook = await fetch(APP + "/api/stripe/webhook", { method: "POST", redirect: "manual", body: "{}" });
check("webhook Stripe'a dociera do trasy, a nie na logowanie",
  hook.status !== 307 && hook.status !== 405, `status ${hook.status}`);

const pushBadSecret = await (await fetch(`${SB}/rest/v1/rpc/push_due`, { method: "POST", headers: H,
  body: JSON.stringify({ p_secret: "zgaduje" }) })).json();
check("kolejka powiadomień milczy przy złym sekrecie",
  Array.isArray(pushBadSecret) && pushBadSecret.length === 0, JSON.stringify(pushBadSecret).slice(0, 80));

// 7l. Wyszukiwarka produktów — realna ścieżka, nie tylko dostępność strony
const t0 = Date.now();
const food = await (await fetch(APP + "/api/food/search?q=" + encodeURIComponent("ryż"), { headers: { cookie } })).json();
const foodMs = Date.now() - t0;
check("wyszukiwarka produktów zwraca wyniki",
  Array.isArray(food.results) && food.results.length > 0 && !food.error,
  `${food.results?.length ?? 0} wyników w ${foodMs} ms${food.error ? " | " + food.error : ""}`);
check("wyszukiwarka odpowiada poniżej 5 s", foodMs < 5000, `${foodMs} ms`);

const summ = await (await fetch(`${SB}/rest/v1/rpc/period_summary`, { method:"POST", headers:H,
  body: JSON.stringify({ p_from: new Date(Date.now()-7*864e5).toISOString().slice(0,10), p_to: new Date().toISOString().slice(0,10) }) })).json();
check("podsumowanie liczy objętość 480 kg", summ?.volume_kg === 480, `volume_kg=${summ?.volume_kg}`);
check("podsumowanie zna wodę i nawyki",
  summ?.avg_water_ml === 830 && summ?.habit_days_done === 1,
  `woda=${summ?.avg_water_ml} nawyki=${summ?.habit_days_done}`);
check("podsumowanie zna sen", summ?.nights_logged === 1 && summ?.avg_sleep_min === 415,
  `nocy=${summ?.nights_logged} sen=${summ?.avg_sleep_min}`);
check("podsumowanie zna mianownik nawyków", summ?.habit_days_due > 0,
  `habit_days_due=${summ?.habit_days_due}`);
check("podsumowanie zna ból kontuzji", summ?.avg_pain === 4 && summ?.pain_by_injury?.[0]?.name === "Lewe kolano",
  `avg_pain=${summ?.avg_pain}`);

// 7m. Usunięcie konta własnymi siłami — prawo do bycia zapomnianym
const selfDelete = await fetch(`${SB}/rest/v1/rpc/delete_my_account`, { method:"POST", headers:H, body:"{}" });
check("konto da się usunąć bez proszenia kogokolwiek", selfDelete.ok, `status ${selfDelete.status}`);

const afterDelete = await (await fetch(`${SB}/rest/v1/workout_logs?select=id`, { headers: H })).json();
check("po usunięciu konta znikają też jego dane",
  !Array.isArray(afterDelete) || afterDelete.length === 0, JSON.stringify(afterDelete).slice(0, 80));

// 8. Sprzątanie
await fetch(`${SB}/auth/v1/admin/users/${li.user.id}`, { method:"DELETE", headers:{ apikey: SR, Authorization:`Bearer ${SR}` } });
const left = await (await fetch(`${SB}/auth/v1/admin/users`, { headers:{ apikey: SR, Authorization:`Bearer ${SR}` } })).json();
// Sprawdzamy tylko własne konto testowe — na żywej bazie są prawdziwi użytkownicy
// i ich obecność nie jest błędem.
const stillThere = (left.users || []).some((u) => u.id === li.user.id);
check("konto testowe posprzątane", !stillThere,
  `w bazie zostaje ${(left.users || []).length} prawdziwych kont`);

console.log(fails === 0 ? "\n  WSZYSTKO PRZESZŁO" : `\n  BŁĘDÓW: ${fails}`);
process.exit(fails ? 1 : 0);
