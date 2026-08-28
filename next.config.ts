import type { NextConfig } from "next";

/**
 * Nagłówki bezpieczeństwa.
 *
 * Aplikacja renderuje sporo tekstu, którego sama nie napisała: nazwy produktów
 * z Open Food Facts, tytuły z Open Library, opisy ćwiczeń z wger i całe
 * odpowiedzi modelu. Dziś broni ich wyłącznie React, który domyślnie ucieka
 * znaki. Polityka treści jest drugą warstwą: nawet gdyby pierwsza kiedyś
 * przeciekła, przeglądarka i tak nie wykona cudzego skryptu ani nie wyśle
 * niczego pod obcy adres.
 */

/**
 * CSP idzie NA RAZIE w trybie samego raportowania.
 *
 * Włączenie jej od razu w trybie egzekwowania potrafi wygasić działającą
 * aplikację przez jedną przeoczoną domenę — a tego nie widać w testach, tylko
 * u ludzi. W trybie raportowania przeglądarka zgłasza naruszenia do konsoli,
 * niczego nie blokując; po kilku dniach bez zgłoszeń wystarczy zmienić nazwę
 * nagłówka na `Content-Security-Policy`.
 */
const csp = [
  "default-src 'self'",
  // Next wstrzykuje skrypty inline (ładunek RSC), stąd 'unsafe-inline'.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Zdjęcia produktów, ilustracje ćwiczeń i okładki książek przychodzą
  // z cudzych serwerów, których listy nie znamy z góry.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase: dane po HTTPS, zmiany na żywo po WebSockecie.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          // Nikt nie osadzi Grinda w swojej ramce.
          { key: "X-Frame-Options", value: "DENY" },
          // Przeglądarka ma wierzyć zadeklarowanemu typowi pliku, a nie zgadywać.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cudzy serwer nie dowie się, z jakiego ekranu Grinda ktoś przyszedł.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Kamera zostaje: skanuje kody kreskowe książek i produktów.
          // Reszta uprawnień jest wyłączona, bo aplikacja ich nie używa.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
