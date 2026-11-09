/** The site's public origin for absolute URLs (canonical, Open Graph, sitemap). Set WEB_ORIGIN in production;
 * falls back to Vercel's own production URL so canonical/OG never leak localhost if the env is missing. */
export const siteOrigin = () => {
  const explicit = process.env.WEB_ORIGIN;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = explicit ?? (vercel ? `https://${vercel}` : "http://localhost:3100");
  return origin.replace(/\/+$/, "");
};
