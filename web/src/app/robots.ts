import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

/** The landing page is public; the app and its API are one person's tasks and stay out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
