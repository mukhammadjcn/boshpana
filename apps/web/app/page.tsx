import Script from "next/script";

import { HomePage } from "@/components/home-page";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  buildPublicMetadata,
  absoluteUrl
} from "@/lib/site";

export const metadata = buildPublicMetadata({
  title: "Jamoaviy.uz — Telegramdagi jamoaviy o'yinlar",
  description:
    "Bunker va Mafia kabi jamoaviy o'yinlarni Telegram ichida tanlang, qoidalarini ko'ring va room yaratishni boshlang.",
  path: "/",
  keywords: [
    "Jamoaviy.uz",
    "Telegram o'yinlari",
    "Bunker online",
    "Mafia online",
    "party game uzbekistan"
  ]
});

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "uz",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/android-chrome-512x512.png")
      }
    },
    hasPart: [
      {
        "@type": "WebPage",
        name: "Bunker",
        url: absoluteUrl("/games/bunker")
      },
      {
        "@type": "WebPage",
        name: "Mafia",
        url: absoluteUrl("/games/mafia")
      }
    ]
  };

  return (
    <>
      <Script
        id="home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  );
}
