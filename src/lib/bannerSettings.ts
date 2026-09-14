import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BannerKind } from '@/lib/homeBanners';

export type BannerDisplayMode = 'fixed' | 'random';

export interface BannerSettings {
  displayMode: BannerDisplayMode;
}

interface SettingsGlobalDoc {
  banners?: {
    home?: { displayMode?: string };
    search?: { displayMode?: string };
  };
}

const SETTINGS_GLOBAL = doc(db, 'settings', 'global');

export function subscribeBannerSettings(
  kind: BannerKind,
  cb: (s: BannerSettings) => void,
): Unsubscribe {
  return onSnapshot(
    SETTINGS_GLOBAL,
    (snap) => {
      const data = snap.exists() ? (snap.data() as SettingsGlobalDoc) : {};
      const mode = data.banners?.[kind]?.displayMode;
      cb({ displayMode: mode === 'random' ? 'random' : 'fixed' });
    },
    (err) => {
      console.error(`subscribeBannerSettings(${kind}) failed:`, err);
      cb({ displayMode: 'fixed' });
    },
  );
}

export async function setBannerDisplayMode(
  kind: BannerKind,
  mode: BannerDisplayMode,
): Promise<void> {
  // setDoc + merge:true 는 nested map 도 깊이 머지 → 다른 kind 의 설정은 보존됨
  await setDoc(
    SETTINGS_GLOBAL,
    {
      banners: { [kind]: { displayMode: mode } },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Fisher-Yates shuffle — 새 배열 반환. */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
