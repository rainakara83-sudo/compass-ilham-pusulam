import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from './locales/tr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

const LANG_KEY = '@content-coach/language';

export type SupportedLng = 'tr' | 'en' | 'es' | 'de' | 'fr';
export const SUPPORTED_LANGUAGES: { code: SupportedLng; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

const SUPPORTED: SupportedLng[] = ['tr', 'en', 'es', 'de', 'fr'];

const isSupported = (lng: string | undefined | null): lng is SupportedLng =>
  typeof lng === 'string' && (SUPPORTED as string[]).includes(lng);

const detectInitialLanguage = (): SupportedLng => {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode?.toLowerCase();
    if (isSupported(code)) return code;
  } catch {}
  return 'en';
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export const setAppLanguage = async (lng: SupportedLng) => {
  if (!isSupported(lng)) return;
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANG_KEY, lng);
};

export const loadStoredLanguage = async (): Promise<SupportedLng | null> => {
  const v = await AsyncStorage.getItem(LANG_KEY);
  return isSupported(v) ? v : null;
};

export default i18n;
