import { resolveAppLocale } from "@/lib/localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const resources = {
  en: {
    translation: {
      home: "Home",
      login: "Login",
      playground: "Playground",
      settings: "Settings",
    },
  },
  tr: {
    translation: {
      home: "Ana sayfa",
      login: "Giris",
      playground: "Playground",
      settings: "Ayarlar",
    },
  },
};

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  lng: resolveAppLocale(),
  resources,
});

export { i18n };
