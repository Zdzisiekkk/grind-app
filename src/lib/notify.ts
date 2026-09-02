/**
 * Powiadomienie systemowe z przeglądarki.
 *
 * Działa tylko, gdy aplikacja jest otwarta (na iPhonie - dodana do ekranu
 * głównego i uruchomiona) - prawdziwe powiadomienia w tle idą osobną drogą,
 * przez Web Push (`src/components/reminders/NotificationSettings.tsx`).
 *
 * Ten sam `tag` podmienia poprzednie powiadomienie zamiast układać stos -
 * dzięki temu "widget" w postaci powiadomienia (stan dnia, minutnik przerwy)
 * zawsze pokazuje jeden, aktualny wiersz, a nie historię wszystkich odświeżeń.
 *
 * Na telefonach (Android Chrome, iPhone jako PWA) konstruktor
 * `new Notification()` jest zabroniony - rzuca "Illegal constructor" -
 * i jedyną dozwoloną drogą jest `registration.showNotification()` przez
 * service workera. Dlatego rejestrację trzymamy w module i preferujemy ją;
 * konstruktor zostaje jako zapas dla przeglądarek bez service workera.
 */
let rejestracja: ServiceWorkerRegistration | null = null;

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.ready
    .then((r) => {
      rejestracja = r;
    })
    .catch(() => {});
}

export function notify(title: string, body: string, tag: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;

  const opcje = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };

  if (rejestracja) {
    // Asynchroniczne, ale świadomie nie czekamy: dla wywołujących liczy się
    // "czy była zgoda i próba", nie moment fizycznego pojawienia się dymka.
    rejestracja.showNotification(title, opcje).catch(() => {});
    return true;
  }

  try {
    new Notification(title, opcje);
    return true;
  } catch {
    // Mobile bez gotowej rejestracji SW - lepiej nic nie pokazać niż wywalić
    // cały interwał przypomnień nieobsłużonym wyjątkiem.
    return false;
  }
}
