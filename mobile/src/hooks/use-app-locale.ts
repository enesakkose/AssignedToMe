import { APP_LOCALES, type AppLocale, getDeviceLocale, resolveAppLocale } from "@/lib/localization";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useAppLocale() {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const deviceLocale = getDeviceLocale();
    const resolvedLocale = resolveAppLocale(i18n.language);

    return {
      availableLocales: APP_LOCALES,
      deviceLanguageCode: deviceLocale?.languageCode ?? null,
      deviceLocale,
      locale: resolvedLocale,
      setLocale: (locale: AppLocale) => i18n.changeLanguage(locale),
    };
  }, [i18n]);
}
