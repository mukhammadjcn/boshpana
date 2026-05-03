import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";

import { SafeAreaBlur } from "@/components/safe-area-blur";
import { TelegramBootstrap } from "@/components/telegram-bootstrap";
import { ToastViewport } from "@/components/toast-viewport";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://jamoaviy.uz";
const SITE_TITLE = "Jamoaviy.uz — Jamoaviy o'yinlar";
const SITE_DESCRIPTION =
  "Telegramda birga o'ynaladigan Bunker, Mafia va boshqa jamoaviy o'yinlar platformasi.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"]
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Jamoaviy.uz",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "Jamoaviy.uz — Jamoaviy o'yinlar"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/banner.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#0b0d12"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className={`${display.variable} ${mono.variable}`}>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramBootstrap />
        {children}
        <SafeAreaBlur />
        <ToastViewport />
      </body>
    </html>
  );
}
