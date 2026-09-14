import * as ImageManipulator from 'expo-image-manipulator';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

/**
 * 홈 롤링 배너.
 * - 시작일/종료일은 일자 단위 (date)
 * - 노출 시작/종료 시간은 시:분 단위 (time of day, 매일 그 시간대만 노출)
 * - 둘 다 비어있으면 항상 노출 (active 만 true 면)
 */
export interface HomeBanner {
  id: string;
  subCopy: string;          // 서브 카피 (메인카피 바로 위, 작은 글씨)
  mainCopy: string;         // 메인 카피 (큰 글씨)
  subColor: string;         // 서브 카피 hex 컬러 (예: '#FFFFFF')
  mainColor: string;        // 메인 카피 hex 컬러
  landingUrl: string;       // 클릭 시 이동
  imageUrl?: string;        // 배너 배경 이미지 (선택)
  imageStoragePath?: string;
  order: number;
  active: boolean;
  startsAt: number | null;  // ms epoch (날짜만, 자정 기준), null = 즉시
  endsAt: number | null;    // ms epoch (날짜만, 종료일 23:59:59), null = 무기한
  startTimeOfDay: string | null;  // "HH:mm" (예: "09:00"), null = 종일
  endTimeOfDay: string | null;    // "HH:mm" (예: "22:00"), null = 종일
}

export const BANNER_COPY_COLORS = [
  { key: 'white', label: '하양', value: '#FFFFFF' },
  { key: 'black', label: '검정', value: '#000000' },
  { key: 'yellow', label: '노랑', value: '#FFD700' },
  { key: 'red', label: '빨강', value: '#FF3B30' },
  { key: 'blue', label: '파랑', value: '#1E90FF' },
  { key: 'purple', label: '보라', value: '#8B5CF6' },
] as const;

export const DEFAULT_SUB_COLOR = '#FFFFFF';
export const DEFAULT_MAIN_COLOR = '#FFFFFF';

/**
 * 배너 종류 — 같은 스키마를 두 컬렉션으로 분리해서 관리:
 *  - 'home'   → homeBanners   (홈 화면)
 *  - 'search' → searchBanners (매장 찾기 화면)
 */
export type BannerKind = 'home' | 'search';

export const BANNER_KIND_LABEL: Record<BannerKind, string> = {
  home: '홈 배너',
  search: '매장 배너',
};

function bannerColPath(kind: BannerKind): string {
  return kind === 'search' ? 'searchBanners' : 'homeBanners';
}

interface HomeBannerDoc {
  subCopy?: string;
  mainCopy?: string;
  subColor?: string;
  mainColor?: string;
  landingUrl?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  order?: number;
  active?: boolean;
  startsAt?: { toMillis?: () => number } | number | null;
  endsAt?: { toMillis?: () => number } | number | null;
  startTimeOfDay?: string | null;
  endTimeOfDay?: string | null;
  // 레거시 필드 호환 — 이전 빌드의 label/title/route 도 읽음
  label?: string;
  title?: string;
  route?: string;
}

function toMillis(v: HomeBannerDoc['startsAt']): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : null;
}

function snapToBanner(id: string, data: HomeBannerDoc): HomeBanner {
  return {
    id,
    subCopy: data.subCopy ?? data.label ?? '',
    mainCopy: data.mainCopy ?? data.title ?? '',
    subColor: data.subColor || DEFAULT_SUB_COLOR,
    mainColor: data.mainColor || DEFAULT_MAIN_COLOR,
    landingUrl: data.landingUrl ?? data.route ?? '',
    imageUrl: data.imageUrl,
    imageStoragePath: data.imageStoragePath,
    order: typeof data.order === 'number' ? data.order : 0,
    active: data.active !== false,
    startsAt: toMillis(data.startsAt),
    endsAt: toMillis(data.endsAt),
    startTimeOfDay: data.startTimeOfDay ?? null,
    endTimeOfDay: data.endTimeOfDay ?? null,
  };
}

function timeOfDayToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

export function isBannerLive(b: HomeBanner, now: Date = new Date()): boolean {
  if (!b.active) return false;
  const ts = now.getTime();
  if (b.startsAt && b.startsAt > ts) return false;
  if (b.endsAt && b.endsAt < ts) return false;
  const start = timeOfDayToMinutes(b.startTimeOfDay);
  const end = timeOfDayToMinutes(b.endTimeOfDay);
  if (start !== null || end !== null) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const s = start ?? 0;
    const e = end ?? 24 * 60 - 1;
    if (s <= e) {
      if (cur < s || cur > e) return false;
    } else {
      // 자정 넘는 범위 (예: 22:00 ~ 03:00)
      if (cur < s && cur > e) return false;
    }
  }
  return true;
}

export function subscribeActiveBanners(
  kind: BannerKind,
  cb: (banners: HomeBanner[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, bannerColPath(kind)),
    where('active', '==', true),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => snapToBanner(d.id, d.data() as HomeBannerDoc))
        .filter((b) => isBannerLive(b))
        .sort((a, b) => a.order - b.order);
      cb(list);
    },
    (err) => {
      console.error(`subscribeActiveBanners(${kind}) failed:`, err);
      cb([]);
    },
  );
}

/** 어드민용 — 모든 배너 (활성/비활성 모두) 실시간 구독. */
export function subscribeAllBanners(
  kind: BannerKind,
  cb: (banners: HomeBanner[]) => void,
): Unsubscribe {
  const q = query(collection(db, bannerColPath(kind)), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToBanner(d.id, d.data() as HomeBannerDoc)));
    },
    (err) => {
      console.error(`subscribeAllBanners(${kind}) failed:`, err);
      cb([]);
    },
  );
}

async function compress(uri: string) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

/** 배너 이미지 업로드 — Storage path 와 download URL 반환. */
export async function uploadBannerImage(
  kind: BannerKind,
  bannerId: string,
  sourceUri: string,
): Promise<{ url: string; storagePath: string }> {
  const compressed = await compress(sourceUri);
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${bannerColPath(kind)}/${bannerId}/${photoId}.jpg`;
  const blob = await uriToBlob(compressed.uri);
  await uploadBytes(ref(storage, storagePath), blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(ref(storage, storagePath));
  return { url, storagePath };
}

/** 신규 배너 생성 — placeholder 후 이미지 업로드 흐름. */
export interface BannerInput {
  subCopy: string;
  mainCopy: string;
  subColor: string;
  mainColor: string;
  landingUrl: string;
  order: number;
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  startTimeOfDay: string | null;
  endTimeOfDay: string | null;
  imageUrl?: string;
  imageStoragePath?: string;
}

export async function createBanner(kind: BannerKind, input: BannerInput): Promise<string> {
  const ref = await addDoc(collection(db, bannerColPath(kind)), {
    subCopy: input.subCopy,
    mainCopy: input.mainCopy,
    subColor: input.subColor,
    mainColor: input.mainColor,
    landingUrl: input.landingUrl,
    imageUrl: input.imageUrl ?? '',
    imageStoragePath: input.imageStoragePath ?? '',
    order: input.order,
    active: input.active,
    startsAt: input.startsAt ? Timestamp.fromMillis(input.startsAt) : null,
    endsAt: input.endsAt ? Timestamp.fromMillis(input.endsAt) : null,
    startTimeOfDay: input.startTimeOfDay,
    endTimeOfDay: input.endTimeOfDay,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBanner(
  kind: BannerKind,
  bannerId: string,
  patch: Partial<BannerInput>,
): Promise<void> {
  const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.subCopy !== undefined) next.subCopy = patch.subCopy;
  if (patch.mainCopy !== undefined) next.mainCopy = patch.mainCopy;
  if (patch.subColor !== undefined) next.subColor = patch.subColor;
  if (patch.mainColor !== undefined) next.mainColor = patch.mainColor;
  if (patch.landingUrl !== undefined) next.landingUrl = patch.landingUrl;
  if (patch.imageUrl !== undefined) next.imageUrl = patch.imageUrl;
  if (patch.imageStoragePath !== undefined) next.imageStoragePath = patch.imageStoragePath;
  if (patch.order !== undefined) next.order = patch.order;
  if (patch.active !== undefined) next.active = patch.active;
  if (patch.startsAt !== undefined) {
    next.startsAt = patch.startsAt ? Timestamp.fromMillis(patch.startsAt) : null;
  }
  if (patch.endsAt !== undefined) {
    next.endsAt = patch.endsAt ? Timestamp.fromMillis(patch.endsAt) : null;
  }
  if (patch.startTimeOfDay !== undefined) next.startTimeOfDay = patch.startTimeOfDay;
  if (patch.endTimeOfDay !== undefined) next.endTimeOfDay = patch.endTimeOfDay;
  await updateDoc(
    doc(db, bannerColPath(kind), bannerId),
    next as Record<string, never>,
  );
}

export async function deleteBanner(
  kind: BannerKind,
  bannerId: string,
  imageStoragePath?: string | null,
): Promise<void> {
  if (imageStoragePath) {
    try {
      await deleteObject(ref(storage, imageStoragePath));
    } catch {
      // 이미 없는 파일은 무시
    }
  }
  await deleteDoc(doc(db, bannerColPath(kind), bannerId));
}

/** 배너 단건 한 번 가져오기 (편집 화면 prefill 용). */
export async function getBanner(
  kind: BannerKind,
  bannerId: string,
): Promise<HomeBanner | null> {
  const snap = await getDoc(doc(db, bannerColPath(kind), bannerId));
  if (!snap.exists()) return null;
  return snapToBanner(snap.id, snap.data() as HomeBannerDoc);
}
