import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${SITE_URL}/games/bunker`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${SITE_URL}/games/mafia`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];
}

