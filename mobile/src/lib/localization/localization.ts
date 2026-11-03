import { getLocales } from "expo-localization";

export const APP_LOCALES = ["en", "tr"] as const;
export const DEFAULT_LOCALE = "en";

export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value?: string | null): value is AppLocale {
  return APP_LOCALES.some((locale) => locale === value);
}

export function getDeviceLocale() {
  const [primaryLocale] = getLocales();

  return primaryLocale;
}

export function getDeviceLanguageCode() {
  return getDeviceLocale()?.languageCode ?? null;
}

export function resolveAppLocale(languageCode = getDeviceLanguageCode()): AppLocale {
  return isAppLocale(languageCode) ? languageCode : DEFAULT_LOCALE;
}
