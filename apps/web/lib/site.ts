import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://jamoaviy.uz";
export const SITE_NAME = "Jamoaviy.uz";
export const SITE_TITLE = `${SITE_NAME} — Jamoaviy o'yinlar`;
export const SITE_DESCRIPTION =
  "Telegramda birga o'ynaladigan Bunker, Mafia va boshqa jamoaviy o'yinlar platformasi.";
export const SITE_OG_IMAGE = "/banner.png";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function buildPublicMetadata({
  title,
  description,
  path,
  image = SITE_OG_IMAGE,
  keywords
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: absoluteUrl(path)
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: "uz_UZ",
      images: [
        {
          url: image,
          alt: title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

