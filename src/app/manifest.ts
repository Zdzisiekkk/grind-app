import type { MetadataRoute } from "next";

/** Next generuje z tego plik /manifest.webmanifest - pozwala "dodać do ekranu głównego". */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grind - trening, dieta, aktywności",
    short_name: "Grind",
    description:
      "Plan treningowy, dziennik serii, dieta z Open Food Facts i wykresy postępów - wszystko w jednym miejscu.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    lang: "pl",
    dir: "ltr",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Zacznij trening", short_name: "Trening", url: "/trening" },
      { name: "Dziennik posiłków", short_name: "Dieta", url: "/dieta" },
    ],
  };
}
