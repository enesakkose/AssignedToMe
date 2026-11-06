/** The site's public origin for absolute URLs (canonical, Open Graph, sitemap). Set WEB_ORIGIN in production. */
export const siteOrigin = () =>
  (process.env.WEB_ORIGIN ?? "http://localhost:3100").replace(/\/+$/, "");
