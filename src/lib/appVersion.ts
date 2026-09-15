import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AppVersionPolicy {
  /** 스토어에 올라간 최신 버전. 이보다 낮으면 "나중에" 가 있는 권장 업데이트 안내. */
  latestVersion: string;
  /** 이 버전 미만은 사용을 막는다. 비워두면 강제 업데이트 없음. */
  minVersion: string;
  /** 업데이트 내용 한 줄 요약. 비어 있으면 기본 문구. */
  notes: string;
}

interface SettingsGlobalDoc {
  appVersion?: {
    latestVersion?: string;
    minVersion?: string;
    notes?: string;
  };
}

const SETTINGS_GLOBAL = doc(db, 'settings', 'global');

const ANDROID_PACKAGE = 'com.ddmsherpa.app';
const IOS_APP_ID = '6773212200';

export const STORE_URL =
  Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * 설치된 바이너리의 버전.
 *
 * runtimeVersion 정책이 appVersion 이라 OTA 번들은 같은 version 을 가진 바이너리에만
 * 내려간다. 따라서 번들에 박힌 expoConfig.version 은 항상 설치된 바이너리와 일치하고,
 * expo-application(네이티브 모듈) 없이도 정확하다. 이 전제가 깨지면(정책 변경 등)
 * expo-application 의 nativeApplicationVersion 으로 바꿔야 한다.
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** a < b 면 음수, 같으면 0, a > b 면 양수. 숫자가 아닌 조각은 0 으로 본다. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? '0', 10) || 0;
    const nb = parseInt(pb[i] ?? '0', 10) || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function subscribeAppVersionPolicy(
  cb: (p: AppVersionPolicy) => void,
): Unsubscribe {
  return onSnapshot(
    SETTINGS_GLOBAL,
    (snap) => {
      const data = snap.exists() ? (snap.data() as SettingsGlobalDoc) : {};
      cb({
        latestVersion: data.appVersion?.latestVersion?.trim() ?? '',
        minVersion: data.appVersion?.minVersion?.trim() ?? '',
        notes: data.appVersion?.notes?.trim() ?? '',
      });
    },
    (err) => {
      // 읽기 실패 시 업데이트 안내를 띄우지 않는다 — 네트워크 문제로 앱이 막히면 안 된다.
      console.error('subscribeAppVersionPolicy failed:', err);
      cb({ latestVersion: '', minVersion: '', notes: '' });
    },
  );
}

export async function setAppVersionPolicy(p: AppVersionPolicy): Promise<void> {
  await setDoc(
    SETTINGS_GLOBAL,
    {
      appVersion: {
        latestVersion: p.latestVersion.trim(),
        minVersion: p.minVersion.trim(),
        notes: p.notes.trim(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export type UpdateRequirement = 'none' | 'optional' | 'forced';

export function evaluateUpdate(
  current: string,
  policy: AppVersionPolicy,
): UpdateRequirement {
  if (policy.minVersion && compareVersions(current, policy.minVersion) < 0) return 'forced';
  if (policy.latestVersion && compareVersions(current, policy.latestVersion) < 0) {
    return 'optional';
  }
  return 'none';
}
