import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 매장 사장님이 등록한 고객.
 * 컬렉션 경로: `shops/{shopId}/customers/{customerUid}` (doc id = 고객 uid)
 *
 * 사장님(shop.ownerUid) 만 read/write. 메모는 사장님 전용.
 * 고객 개인정보(전화번호 등) 는 저장하지 않음 — 표시 이름 + shortId 만 캐시.
 * 연락은 메신저로만.
 */

export interface CustomerRecord {
  uid: string;                    // doc id == 고객 uid
  shopId: string;                 // 부모 shop id
  customerShortId: string | null;
  customerDisplayName: string;
  memo: string;
  addedAt: number;
  updatedAt: number;
}

interface CustomerDoc {
  customerShortId?: string | null;
  customerDisplayName?: string;
  memo?: string;
  addedAt?: Timestamp;
  updatedAt?: Timestamp;
}

function snapToCustomer(shopId: string, id: string, d: CustomerDoc): CustomerRecord {
  return {
    uid: id,
    shopId,
    customerShortId: d.customerShortId ?? null,
    customerDisplayName: d.customerDisplayName ?? '',
    memo: d.memo ?? '',
    addedAt: d.addedAt?.toMillis?.() ?? Date.now(),
    updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

export async function addCustomer(input: {
  shopId: string;
  customerUid: string;
  customerShortId?: string | null;
  customerDisplayName: string;
}): Promise<void> {
  const ref = doc(db, 'shops', input.shopId, 'customers', input.customerUid);
  await setDoc(
    ref,
    {
      customerShortId: input.customerShortId ?? null,
      customerDisplayName: input.customerDisplayName,
      memo: '',
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }, // 이미 있어도 덮어쓰지 않도록 (memo 보존) — addedAt/updatedAt 은 갱신됨
  );
}

export async function updateCustomerMemo(
  shopId: string,
  customerUid: string,
  memo: string,
): Promise<void> {
  const ref = doc(db, 'shops', shopId, 'customers', customerUid);
  await setDoc(
    ref,
    {
      memo,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removeCustomer(shopId: string, customerUid: string): Promise<void> {
  await deleteDoc(doc(db, 'shops', shopId, 'customers', customerUid));
}

export async function listCustomers(shopId: string): Promise<CustomerRecord[]> {
  const snap = await getDocs(collection(db, 'shops', shopId, 'customers'));
  const list = snap.docs.map((d) => snapToCustomer(shopId, d.id, d.data() as CustomerDoc));
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}

export function subscribeCustomers(
  shopId: string,
  cb: (list: CustomerRecord[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'shops', shopId, 'customers'),
    (snap) => {
      const list = snap.docs.map((d) => snapToCustomer(shopId, d.id, d.data() as CustomerDoc));
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      cb(list);
    },
    (err) => {
      console.error('[customers] subscribe error:', err);
      cb([]);
    },
  );
}

/**
 * 사장님의 모든 shops 의 customers 합치기.
 * 한 사장님이 여러 매장을 운영하는 경우 합쳐서 표시.
 */
export function subscribeMyAllCustomers(
  shopIds: string[],
  cb: (list: CustomerRecord[]) => void,
): Unsubscribe {
  if (shopIds.length === 0) {
    cb([]);
    return () => {};
  }
  const map = new Map<string, CustomerRecord[]>();
  const unsubs: Unsubscribe[] = shopIds.map((sid) =>
    subscribeCustomers(sid, (list) => {
      map.set(sid, list);
      const merged: CustomerRecord[] = [];
      for (const arr of map.values()) merged.push(...arr);
      merged.sort((a, b) => b.updatedAt - a.updatedAt);
      cb(merged);
    }),
  );
  return () => {
    unsubs.forEach((u) => u());
  };
}
