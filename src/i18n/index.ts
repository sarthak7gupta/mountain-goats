import { en } from './locales/en';

export type Locale = 'en';
export type TranslationKey = keyof typeof en;

const translations: Record<Locale, typeof en> = {
  en,
};

let currentLocale: Locale = 'en';

export const i18n = {
  setLocale: (locale: Locale) => {
    currentLocale = locale;
  },

  getLocale: (): Locale => {
    return currentLocale;
  },

  t: (key: TranslationKey, params?: Record<string, string | number>): string => {
    const translation = translations[currentLocale][key];

    if (typeof translation === 'string') {
      if (params) {
        return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey]?.toString() || match;
        });
      }
      return translation;
    }

    return String(translation);
  },

  // Helper to get array translations
  getArray: (key: TranslationKey): string[] => {
    const translation = translations[currentLocale][key];
    if (Array.isArray(translation)) {
      return translation;
    }
    return [];
  },
};

// Export default locale
export default i18n;
