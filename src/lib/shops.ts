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
import { Shop } from '@/types';

interface ShopDoc {
  ownerUid: string;
  storeCodes: string[];
  displayName: string;
  phone: string;
  businessHours: string;
  description: string;
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
  };
}

export async function createShop(input: Omit<Shop, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'shops'), {
    ownerUid: input.ownerUid,
    storeCodes: input.storeCodes,
    displayName: input.displayName,
    phone: input.phone,
    businessHours: input.businessHours,
    description: input.description,
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
