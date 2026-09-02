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
 */
export function notify(title: string, body: string, tag: string): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  new Notification(title, { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
  return true;
}
