export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** The first language in an Accept-Language header that the app speaks. */
export function localeFromHeader(header: string | null): Locale {
  for (const part of (header ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
