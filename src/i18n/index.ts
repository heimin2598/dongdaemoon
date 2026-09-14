import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import ko from './locales/ko.json';
import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import ja from './locales/ja.json';

export type AppLanguage = 'ko' | 'en' | 'zh-Hans' | 'ja';

export const SUPPORTED_LANGUAGES: { code: AppLanguage; nativeName: string }[] = [
  { code: 'ko', nativeName: '한국어' },
  { code: 'en', nativeName: 'English' },
  { code: 'zh-Hans', nativeName: '简体中文' },
  { code: 'ja', nativeName: '日本語' },
];

const STORAGE_KEY = 'app.language';

/**
 * 디바이스 언어 추정.
 * 한국어/영어/중국어 간체/일본어 만 매핑. 그 외는 한국어 디폴트.
 */
function detectDeviceLanguage(): AppLanguage {
  try {
    const locales = Localization.getLocales?.();
    const first = locales?.[0];
    const tag = (first?.languageTag ?? first?.languageCode ?? 'ko').toLowerCase();
    if (tag.startsWith('zh')) return 'zh-Hans';
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('en')) return 'en';
    return 'ko';
  } catch {
    return 'ko';
  }
}

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  initialized = true;

  let stored: AppLanguage | null = null;
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v && ['ko', 'en', 'zh-Hans', 'ja'].includes(v)) {
      stored = v as AppLanguage;
    }
  } catch {
    // ignore
  }
  const lang: AppLanguage = stored ?? 'ko';

  try {
    await i18n.use(initReactI18next).init({
      resources: {
        ko: { translation: ko },
        en: { translation: en },
        'zh-Hans': { translation: zhHans },
        ja: { translation: ja },
      },
      lng: lang,
      fallbackLng: 'ko',
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    });
  } catch (e) {
    // init 실패해도 앱은 동작해야 함 — t() 는 key 그대로 반환됨
    console.warn('[i18n] init failed:', e);
  }
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export function getAppLanguage(): AppLanguage {
  return (i18n.language as AppLanguage) ?? 'ko';
}

export { detectDeviceLanguage };
export default i18n;
