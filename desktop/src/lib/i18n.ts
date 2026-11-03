import type { Locale } from '@mytask/core';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import tr from '@/locales/tr.json';
import { getStore } from './store';
import { broadcast } from './windows';

const KEY = 'language';

/** The UI language. English unless the user picks another in Settings. A live binding: importers see changes. */
export let locale: Locale = 'en';

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: locale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** An Intl formatter rebuilt only when the language changes. */
export function localized<T>(make: (locale: Locale) => T): () => T {
  let made: Locale | undefined;
  let value: T;
  return () => {
    if (made !== locale) {
      made = locale;
      value = make(locale);
    }
    return value;
  };
}

export async function applyLanguage(next: Locale) {
  locale = next;
  document.documentElement.lang = next;
  await i18n.changeLanguage(next);
}

export async function getLanguage(): Promise<Locale> {
  const saved = await getStore().get<string>(KEY);
  return saved === 'tr' ? 'tr' : 'en';
}

export async function setLanguage(next: Locale) {
  await applyLanguage(next);
  await getStore().set(KEY, next);
  broadcast('prefs-changed', null);
}

export { i18n };
