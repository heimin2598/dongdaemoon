import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addCustomer } from '@/lib/customers';

/**
 * 사장 → 고객 등록 요청. shortId 검색으로 찾은 고객에게 등록 요청을 보내고,
 * 고객이 승인하면 사장 측에서 자동으로 customers 컬렉션에 추가.
 *
 * 컬렉션: `customerRequests/{requestId}` (auto id)
 *
 * status:
 *   - 'pending'  : 사장이 보낸 직후. 고객 승인 대기.
 *   - 'approved' : 고객이 승인. 사장 listener 가 감지해 customers add 후 doc 삭제.
 *   - 'rejected' : 고객이 거절. 사장 측에서 안내 후 삭제.
 */

export type CustomerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface CustomerRequest {
  id: string;
  merchantUid: string;
  merchantDisplayName?: string;
  shopId: string;
  shopDisplayName: string;
  customerUid: string;
  customerShortId: string;
  customerDisplayName: string;
  status: CustomerRequestStatus;
  createdAt: number;
  resolvedAt: number | null;
}

interface CustomerRequestDoc {
  merchantUid: string;
  merchantDisplayName?: string;
  shopId: string;
  shopDisplayName: string;
  customerUid: string;
  customerShortId: string;
  customerDisplayName: string;
  status: CustomerRequestStatus;
  createdAt?: Timestamp;
  resolvedAt?: Timestamp | null;
}

function snapToReq(id: string, d: CustomerRequestDoc): CustomerRequest {
  return {
    id,
    merchantUid: d.merchantUid,
    merchantDisplayName: d.merchantDisplayName,
    shopId: d.shopId,
    shopDisplayName: d.shopDisplayName,
    customerUid: d.customerUid,
    customerShortId: d.customerShortId,
    customerDisplayName: d.customerDisplayName,
    status: d.status,
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
    resolvedAt: d.resolvedAt?.toMillis?.() ?? null,
  };
}

/** 사장이 고객에게 등록 요청 보내기. */
export async function createCustomerRequest(input: {
  merchantUid: string;
  merchantDisplayName?: string;
  shopId: string;
  shopDisplayName: string;
  customerUid: string;
  customerShortId: string;
  customerDisplayName: string;
}): Promise<string> {
  const payload: CustomerRequestDoc = {
    merchantUid: input.merchantUid,
    shopId: input.shopId,
    shopDisplayName: input.shopDisplayName,
    customerUid: input.customerUid,
    customerShortId: input.customerShortId,
    customerDisplayName: input.customerDisplayName,
    status: 'pending',
    createdAt: serverTimestamp() as unknown as Timestamp,
    resolvedAt: null,
  };
  if (input.merchantDisplayName) payload.merchantDisplayName = input.merchantDisplayName;
  const ref = await addDoc(collection(db, 'customerRequests'), payload);
  return ref.id;
}

/** 사장 측: 본인이 보낸 요청 (pending/approved/rejected 모두) 구독. */
export function subscribeMerchantRequests(
  merchantUid: string,
  cb: (list: CustomerRequest[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'customerRequests'),
    where('merchantUid', '==', merchantUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => snapToReq(d.id, d.data() as CustomerRequestDoc));
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    (err) => {
      console.error('[customerRequests] merchant subscribe error:', err);
      cb([]);
    },
  );
}

/** 고객 측: 본인이 받은 pending 요청 구독. */
export function subscribeMyPendingRequests(
  customerUid: string,
  cb: (list: CustomerRequest[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'customerRequests'),
    where('customerUid', '==', customerUid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => snapToReq(d.id, d.data() as CustomerRequestDoc));
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    (err) => {
      console.error('[customerRequests] customer subscribe error:', err);
      cb([]);
    },
  );
}

/** 고객이 승인. status='approved' 로 변경. 사장 listener 가 자동 처리. */
export async function approveRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'customerRequests', requestId), {
    status: 'approved',
    resolvedAt: serverTimestamp(),
  });
}

/** 고객이 거절. status='rejected'. */
export async function rejectRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'customerRequests', requestId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
  });
}

/** 사장 측: 'approved' 요청 처리. customers 에 add 후 request doc 삭제. */
export async function processApprovedRequest(req: CustomerRequest): Promise<void> {
  if (req.status !== 'approved') return;
  try {
    await addCustomer({
      shopId: req.shopId,
      customerUid: req.customerUid,
      customerShortId: req.customerShortId,
      customerDisplayName: req.customerDisplayName,
    });
    await deleteDoc(doc(db, 'customerRequests', req.id));
  } catch (e) {
    console.error('[customerRequests] processApproved failed:', e);
  }
}

/** 사장 측: 'rejected' 요청 안내 후 삭제 (best-effort). */
export async function dismissRejectedRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customerRequests', requestId));
  } catch {
    // silent
  }
}

/** shortId 로 user lookup. 사장이 고객 검색 시 사용. */
export interface UserLookupResult {
  uid: string;
  shortId: string;
  displayName: string | null;
}

export async function lookupUserByShortId(shortId: string): Promise<UserLookupResult | null> {
  const id = shortId.trim().toUpperCase();
  if (!id) return null;
  const snap = await getDoc(doc(db, 'userLookup', id));
  if (!snap.exists()) return null;
  const d = snap.data() as { uid: string; shortId: string; displayName: string | null };
  return {
    uid: d.uid,
    shortId: d.shortId,
    displayName: d.displayName ?? null,
  };
}
