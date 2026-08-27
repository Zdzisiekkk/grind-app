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

const VERSION = "grind-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;

/** Zasoby, bez których nie da się narysować nic sensownego. */
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
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
