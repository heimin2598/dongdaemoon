import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BusinessHourEntry, OperatingStatus, PartsCategory, PaymentMethod, Shop, ShopPhoto } from '@/types';

interface ShopDoc {
  ownerUid: string;
  storeCodes: string[];
  displayName: string;
  phone: string;
  businessHours: string;
  description: string;
  categories?: PartsCategory[];
  operatingStatus?: OperatingStatus;
  operatingStatusUntil?: number | null;
  paymentMethods?: PaymentMethod[];
  photos?: ShopPhoto[];
  businessHoursSchedule?: BusinessHourEntry[];
  verified?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function snapToShop(id: string, data: ShopDoc): Shop {
  return {
    id,
    ownerUid: data.ownerUid,
    storeCodes: Array.isArray(data.storeCodes) ? data.storeCodes : [],
    displayName: data.displayName ?? '',
    phone: data.phone ?? '',
    businessHours: data.businessHours ?? '',
    description: data.description ?? '',
    categories: Array.isArray(data.categories) ? data.categories : undefined,
    operatingStatus: data.operatingStatus,
    operatingStatusUntil:
      typeof data.operatingStatusUntil === 'number' ? data.operatingStatusUntil : null,
    paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : undefined,
    photos: Array.isArray(data.photos) ? data.photos : undefined,
    businessHoursSchedule: Array.isArray(data.businessHoursSchedule)
      ? data.businessHoursSchedule
      : undefined,
    verified: data.verified === true,
  };
}

/** 운영자: 매장 인증 여부 토글. */
export async function setShopVerified(shopId: string, verified: boolean): Promise<void> {
  await updateDoc(doc(db, 'shops', shopId), {
    verified,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 사장님: 매장 영업 상태를 빠르게 변경.
 * untilMs 가 지정되면 그 시각이 지난 후 자동으로 'open' 으로 간주 (UI 측에서 표시 시 비교).
 */
export async function setOperatingStatus(
  shopId: string,
  status: OperatingStatus,
  untilMs?: number | null,
): Promise<void> {
  await updateDoc(doc(db, 'shops', shopId), {
    operatingStatus: status,
    operatingStatusUntil: untilMs ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function createShop(input: Omit<Shop, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'shops'), {
    ownerUid: input.ownerUid,
    storeCodes: input.storeCodes,
    displayName: input.displayName,
    phone: input.phone,
    businessHours: input.businessHours,
    description: input.description,
    categories: input.categories ?? [],
    paymentMethods: input.paymentMethods ?? [],
    businessHoursSchedule: input.businessHoursSchedule ?? [],
    verified: false, // 사장님 직접 등록은 미인증 상태로 시작 — 운영자 승인 필요
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateShop(
  shopId: string,
  input: Partial<Omit<Shop, 'id' | 'ownerUid'>>,
): Promise<void> {
  await updateDoc(doc(db, 'shops', shopId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteShop(shopId: string): Promise<void> {
  await deleteDoc(doc(db, 'shops', shopId));
}

export async function getShop(shopId: string): Promise<Shop | null> {
  const snap = await getDoc(doc(db, 'shops', shopId));
  if (!snap.exists()) return null;
  return snapToShop(snap.id, snap.data() as ShopDoc);
}

/** 본인이 소유한 shops 전체 조회 */
export async function listMyShops(ownerUid: string): Promise<Shop[]> {
  const q = query(collection(db, 'shops'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => snapToShop(d.id, d.data() as ShopDoc));
}

/** 본인이 소유한 shops 실시간 구독 */
export function subscribeMyShops(
  ownerUid: string,
  cb: (shops: Shop[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'shops'), where('ownerUid', '==', ownerUid));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => snapToShop(d.id, d.data() as ShopDoc)));
  });
}

/**
 * 특정 storeCode가 어떤 shop에 속하는지 조회.
 * 매장 상세 페이지에서 사장님 overlay 데이터를 가져올 때 사용.
 * 한 storeCode는 최대 1개의 shop에 포함된다고 가정 (UI에서 중복 검증).
 */
export async function getShopByStoreCode(storeCode: string): Promise<Shop | null> {
  const q = query(
    collection(db, 'shops'),
    where('storeCodes', 'array-contains', storeCode),
    fsLimit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return snapToShop(d.id, d.data() as ShopDoc);
}

/** 전체 shops 조회 — 운영자 콘솔 삭제관리 탭용 */
export async function listAllShops(): Promise<Shop[]> {
  const snap = await getDocs(collection(db, 'shops'));
  return snap.docs.map((d) => snapToShop(d.id, d.data() as ShopDoc));
}

/** 전체 shops 실시간 구독 — 매장 검색 화면에서 신규 매장 합쳐 보여줄 때 사용. */
export function subscribeAllShops(cb: (shops: Shop[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'shops'),
    (snap) => cb(snap.docs.map((d) => snapToShop(d.id, d.data() as ShopDoc))),
    (err) => {
      console.error('[shops] subscribeAllShops error:', err);
      cb([]);
    },
  );
}

/** storeCode → shop 실시간 구독 (매장 상세에서 변경사항 즉시 반영) */
export function subscribeShopByStoreCode(
  storeCode: string,
  cb: (shop: Shop | null) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'shops'),
    where('storeCodes', 'array-contains', storeCode),
    fsLimit(1),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      cb(null);
      return;
    }
    const d = snap.docs[0];
    cb(snapToShop(d.id, d.data() as ShopDoc));
  });
}
