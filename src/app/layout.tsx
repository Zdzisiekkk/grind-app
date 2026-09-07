import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-app",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Grind", template: "%s · Grind" },
  description: "Trening, dieta i aktywności w jednym miejscu.",
  applicationName: "Grind",
  // Drugi zamek obok robots.txt. Plik robots.txt to prośba na poziomie
  // całej witryny, a ten nagłówek jedzie z każdą stroną z osobna - łącznie
  // z tymi, do których robot trafiłby z linku, nie od korzenia.
  robots: { index: false, follow: false, nocache: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Grind",
    // "default" każe iOS zarezerwować miejsce na pasek stanu i samemu dobrać
    // kolor zegarka do tła. Przy "black-translucent" tekst paska jest zawsze
    // biały - w jasnym motywie znikał, a treść wchodziła pod notch.
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
