/*
 * Service worker Grinda.
 *
 * Ma jedno zadanie: żeby aplikacja OTWIERAŁA SIĘ bez zasięgu. Za to, żeby
 * zapisy nie przepadały, odpowiada kolejka w IndexedDB (src/lib/offline).
 *
 * Pisany ręcznie, bez Workboksa — całość to sto linijek, a każda dodatkowa
 * zależność w service workerze to rzecz, która potrafi zablokować aktualizację
 * aplikacji u ludzi, którzy już ją mają zainstalowaną.
 */

const VERSION = "grind-v3";

const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;

/** Zasoby, bez których nie da się narysować nic sensownego. */
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

/*
 * Na maszynie deweloperskiej workera nie ma.
 *
 * Poniżej trzymamy pliki z `/_next/static/` w pamięci NA ZAWSZE, bo w gotowej
 * aplikacji nazwa takiego pliku zawiera skrót jego treści: inna treść to inna
 * nazwa, więc stara nigdy nie zostanie użyta ponownie. Turbopack podczas pracy
 * nazywa je zupełnie inaczej — ta sama nazwa, co chwilę nowa zawartość. Worker
 * podawał wtedy do świeżej strony kawałek kodu sprzed kilku dni i przeglądarka
 * wywalała się na module, którego już nie ma w projekcie.
 *
 * Rozbroić musi się sam, bo strona z takim błędem nie wykonuje ANI JEDNEJ
 * linijki kodu aplikacji — więc nikt inny go o to nie poprosi.
 *
 * Cena: pracy bez zasięgu nie sprawdzimy pod localhostem, tylko na wdrożonej
 * wersji. Tam i tak sprawdza ją test „strona zastępcza bez zasięgu działa".
 */
const DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

if (DEV) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) client.navigate(client.url);
      })(),
    );
  });
}

self.addEventListener("install", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Wyczyszczenie po wylogowaniu — na telefonie zostają dane konkretnej osoby. */
self.addEventListener("message", (event) => {
  if (event.data === "grind:clear-cache") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

/** Czego nie wolno tknąć: dane, sesja, wyszukiwarka produktów, AI. */
function isNetworkOnly(url) {
  return (
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/auth/v1/") ||
    url.pathname.startsWith("/api/") ||
    url.hostname.endsWith("supabase.co")
  );
}

self.addEventListener("fetch", (event) => {
  if (DEV) return;
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isNetworkOnly(url)) return;

  // Pliki z hashem w nazwie nie zmieniają treści — można je brać z pamięci
  // od razu, bez pytania sieci.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Strony: najpierw sieć (dane mają być świeże), a gdy jej nie ma — ostatnia
  // znana wersja. Lepiej pokazać wczorajszy pulpit z widocznym ostrzeżeniem
  // niż komunikat o błędzie połączenia.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match("/offline"))
            .then((hit) => hit ?? new Response("Brak połączenia", { status: 503 })),
        ),
    );
  }
});

/* ------------------------- Powiadomienia w tle ---------------------------- */

/*
 * Push dociera nawet przy zamkniętej aplikacji — na iPhonie pod warunkiem,
 * że apka została dodana do ekranu głównego. Tego ograniczenia nie da się
 * obejść, to decyzja Apple.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Grind", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Grind";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Tag sprawia, że powtórka tego samego przypomnienia podmienia
      // poprzednie zamiast układać stos powiadomień.
      tag: payload.key || title,
      data: { url: payload.url || "/" },
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  // Jeśli apka jest już gdzieś otwarta, przenosimy tam widok zamiast
  // otwierać drugą kartę.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
