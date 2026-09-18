import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE } from '@vanstack/shared';
import en from './locales/en.json';
import zh from './locales/zh.json';

i18n.use(LanguageDetector).use(initReactI18next);
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.split('-')[0];
});

void i18n.init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: ['zh', 'en'],
  interpolation: { escapeValue: false },
  detection: {
    order: ['querystring', 'navigator'],
    lookupQuerystring: 'lang',
    caches: [],
  },
});

export default i18n;
