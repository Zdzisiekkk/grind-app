import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Trasy dostępne bez sesji.
 *
 * „/offline" musi tu być, bo service worker pokazuje ją dokładnie wtedy, gdy
 * nie ma jak sprawdzić sesji — przekierowanie na logowanie dawałoby wtedy
 * ekran, którego też nie da się pobrać.
 *
 * Dwie trasy API sprawdzają tożsamość SAME i z definicji przychodzą bez
 * ciasteczka: webhook Stripe'a (podpis zdarzenia) i wysyłka powiadomień
 * (sekret budzika). Bez tego wyjątku ich żądania POST lądowały na /login,
 * gdzie nie ma obsługi POST — czyli opłacona subskrypcja nigdy nie zostałaby
 * zapisana, a powiadomienia nigdy nie wyszły. Obie usterki są niewidoczne
 * z poziomu aplikacji, bo nic w niej nie klika w te adresy.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/offline",
  "/api/stripe/webhook",
  "/api/push/send",
  // Regulamin i polityka prywatności muszą być czytelne PRZED założeniem konta —
  // inaczej zgoda przy rejestracji byłaby zgodą na coś, czego nie dało się zobaczyć.
  "/regulamin",
  "/prywatnosc",
];

/**
 * Odświeża sesję Supabase przy każdym żądaniu i pilnuje, żeby niezalogowany
 * użytkownik nie wszedł na żaden ekran z danymi.
 *
 * Next.js 16 zastąpił konwencję `middleware` plikiem `proxy` (runtime Node.js,
 * bez wariantu edge) — stąd nazwa pliku i funkcji.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Brak konfiguracji: przepuszczamy, żeby pokazać ekran z instrukcją zamiast błędu 500.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Wszystko poza plikami statycznymi i ikonami.
     *
     * sw.js jest tu wymieniony osobno: przeglądarka pobiera go bez ciasteczek
     * przy każdej aktualizacji, więc przepuszczenie go przez sprawdzanie sesji
     * kończyło się przekierowaniem na logowanie i martwym trybem offline.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
