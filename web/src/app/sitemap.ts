import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteOrigin()}/`, changeFrequency: "monthly", priority: 1 }];
}
