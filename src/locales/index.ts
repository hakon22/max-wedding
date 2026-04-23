import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en';
import ru from '@/locales/ru';

export const i18nResources = {
  ru,
  en,
} as const;

/** Ключ localStorage; при пустом env — стабильный дефолт, чтобы переключатель работал без настройки */
export const getWeddingLanguageStorageKey = (): string =>
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LANGUAGE_KEY?.trim()) || 'max-wedding-lang';

const getInitialLanguage = (): string => {
  const defaultLng = process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE ?? 'ru';
  if (typeof window === 'undefined') {
    return defaultLng;
  }
  const storageKey = getWeddingLanguageStorageKey();
  return window.localStorage.getItem(storageKey) ?? defaultLng;
};

i18next.use(initReactI18next).init({
  returnNull: false,
  lng: getInitialLanguage(),
  resources: i18nResources,
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
