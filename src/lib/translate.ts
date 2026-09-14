import Constants from 'expo-constants';
import type { AppLanguage } from '@/i18n';

/**
 * DeepL 번역 API 래퍼.
 *
 * Key 는 app.json extra.deeplApiKey 로 주입. `:fx` 접미사가 있으면 Free plan endpoint 사용.
 * Free plan: api-free.deepl.com / Pro plan: api.deepl.com
 */

function getApiKey(): string | null {
  const k = (Constants.expoConfig?.extra as { deeplApiKey?: string } | undefined)?.deeplApiKey;
  return k && typeof k === 'string' ? k : null;
}

function getEndpoint(key: string): string {
  return key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
}

const LANG_MAP: Record<AppLanguage, string> = {
  ko: 'KO',
  en: 'EN',
  'zh-Hans': 'ZH',
  ja: 'JA',
};

export interface TranslateResult {
  text: string;
  detectedSourceLang?: string;
}

/**
 * 단일 텍스트 번역. 실패 시 null.
 */
export async function translateText(
  text: string,
  targetLang: AppLanguage,
  sourceLang?: AppLanguage,
): Promise<TranslateResult | null> {
  if (!text.trim()) return null;
  const key = getApiKey();
  if (!key) {
    console.warn('[translate] DeepL API key not configured');
    return null;
  }
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('target_lang', LANG_MAP[targetLang] ?? 'KO');
  if (sourceLang) params.append('source_lang', LANG_MAP[sourceLang]);

  try {
    const res = await fetch(getEndpoint(key), {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      console.warn('[translate] DeepL failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as {
      translations: Array<{ text: string; detected_source_language?: string }>;
    };
    const first = data.translations?.[0];
    if (!first) return null;
    return {
      text: first.text,
      detectedSourceLang: first.detected_source_language,
    };
  } catch (e) {
    console.warn('[translate] DeepL exception:', e);
    return null;
  }
}
