import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/games/bunker", "/games/mafia"],
        disallow: [
          "/dashboard/",
          "/room/",
          "/game/",
          "/login",
          "/telegram",
          "/admin/"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}

