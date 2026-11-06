import "server-only";

/**
 * The address the OAuth providers send people back to. Set WEB_ORIGIN in production; in development the request's own
 * origin is used.
 */
export function appOrigin(requestOrigin: string): string {
  const origin = process.env.WEB_ORIGIN;
  if (origin) return origin.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production")
    throw new Error("WEB_ORIGIN must be set in production");
  return requestOrigin;
}
