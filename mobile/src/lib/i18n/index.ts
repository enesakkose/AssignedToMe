import { resolveAppLocale } from "@/lib/localization";
import { usePersistStore } from "@/stores/persist-store";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

export const resources = {
  en: { translation: en },
  tr: { translation: tr },
};

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  // MMKV hydrates synchronously, so the saved choice is known before the first render.
  lng: usePersistStore.getState().locale ?? resolveAppLocale(),
  resources,
});

/** The UI language as core's Locale, for provider labels and guides. */
export const currentLocale = () => resolveAppLocale(i18n.language);

export { i18n };
