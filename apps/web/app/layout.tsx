import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  Space_Grotesk,
  Special_Gothic_Expanded_One,
} from "next/font/google";
import Script from "next/script";

import { SafeAreaBlur } from "@/components/safe-area-blur";
import { TelegramBootstrap } from "@/components/telegram-bootstrap";
import { TelegramGestures } from "@/components/telegram-gestures";
import { TelegramTopBrand } from "@/components/telegram-top-brand";
import { ToastViewport } from "@/components/toast-viewport";
import { I18nProvider } from "@/lib/i18n";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// Wide display logotype font for the top safe-area branding (matches dasyor).
const brand = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand",
});

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
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "uz_UZ",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Jamoaviy.uz — Jamoaviy o'yinlar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#0b0d12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      className={`${display.variable} ${mono.variable} ${brand.variable}`}
      suppressHydrationWarning
    >
      <body>
        <I18nProvider>
          <Script
            src="https://telegram.org/js/telegram-web-app.js"
            strategy="beforeInteractive"
          />
          <Script id="telegram-safearea-bootstrap" strategy="beforeInteractive">
            {`(function () {
            var apply = function () {
              var wa = window.Telegram && window.Telegram.WebApp;
              if (!wa) return false;
              try {
                wa.ready && wa.ready();
                wa.expand && wa.expand();
                var version = parseFloat(wa.version || "0");
                var platform = (wa.platform || "").toLowerCase();
                // Fullscreen faqat mobil Telegram'da (android/ios) — desktop/web
                // Telegram'da scroll buziladi (bottom oxirigacha tushmaydi).
                if (version >= 7.0 && wa.requestFullscreen && (platform === "android" || platform === "ios")) {
                  wa.requestFullscreen();
                }
                wa.disableVerticalSwipes && wa.disableVerticalSwipes();
                wa.enableClosingConfirmation && wa.enableClosingConfirmation();
                wa.setHeaderColor && wa.setHeaderColor("#0b0d12");
                wa.setBackgroundColor && wa.setBackgroundColor("#0b0d12");
                wa.setBottomBarColor && wa.setBottomBarColor("#0b0d12");
              } catch (e) {}

              var sa = wa.safeAreaInset || {};
              var csa = wa.contentSafeAreaInset || {};
              var root = document.documentElement;
              root.style.setProperty("--tg-safe-top", ((sa.top || 0) + (csa.top || 0)) + "px");
              root.style.setProperty("--tg-safe-bottom", ((sa.bottom || 0) + (csa.bottom || 0)) + "px");
              root.style.setProperty("--tg-safe-left", ((sa.left || 0) + (csa.left || 0)) + "px");
              root.style.setProperty("--tg-safe-right", ((sa.right || 0) + (csa.right || 0)) + "px");
              if (typeof wa.viewportStableHeight === "number" && wa.viewportStableHeight > 0) {
                root.style.setProperty("--tg-viewport-height", wa.viewportStableHeight + "px");
              }
              return true;
            };

            if (apply()) return;
            var tries = 0;
            var timer = setInterval(function () {
              tries += 1;
              if (apply() || tries > 80) clearInterval(timer);
            }, 25);
          })();`}
          </Script>
          <TelegramBootstrap />
          <TelegramGestures />
          {children}
          <SafeAreaBlur />
          <TelegramTopBrand />
          <ToastViewport />
        </I18nProvider>
      </body>
    </html>
  );
}
