import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  MerchantClaim,
  MerchantClaimNewStore,
  MerchantClaimStatus,
  MerchantClaimType,
} from '@/types';
import { getStoreByCode } from '@/data/stores';

/**
 * 매장 사장님 매칭 신청 (`merchantClaims/{claimId}`) CRUD.
 *
 * - 본인 신청 read/create 가능, 본인 update 불가 (운영자만 status 변경).
 * - 운영자(admins) 는 전체 read + update.
 * - shortId: 사용자에게 보여줄 5자리 영숫자 (`G98XQ`). 충돌 우려 작아 별도 인덱스 없음.
 */

interface ClaimDoc {
  uid: string;
  shortId: string;
  claimType: MerchantClaimType;
  storeCode?: string;
  newStore?: MerchantClaimNewStore;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  status: MerchantClaimStatus;
  rejectReason?: string;
  createdAt?: Timestamp;
  reviewedAt?: Timestamp | null;
  reviewerUid?: string | null;
}

function snapToClaim(id: string, data: ClaimDoc): MerchantClaim {
  return {
    id,
    uid: data.uid,
    shortId: data.shortId,
    claimType: data.claimType,
    storeCode: data.storeCode,
    newStore: data.newStore,
    applicantName: data.applicantName ?? '',
    applicantEmail: data.applicantEmail ?? '',
    applicantPhone: data.applicantPhone ?? '',
    status: data.status,
    rejectReason: data.rejectReason,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    reviewedAt: data.reviewedAt?.toMillis?.() ?? null,
    reviewerUid: data.reviewerUid ?? null,
  };
}

const SHORT_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동되는 0/O, 1/I 제외
function generateShortId(): string {
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += SHORT_ID_CHARS[Math.floor(Math.random() * SHORT_ID_CHARS.length)];
  }
  return out;
}

export interface CreateClaimInput {
  uid: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  claimType: MerchantClaimType;
  storeCode?: string;
  newStore?: MerchantClaimNewStore;
}

export async function createMerchantClaim(input: CreateClaimInput): Promise<MerchantClaim> {
  const shortId = generateShortId();
  const payload: ClaimDoc = {
    uid: input.uid,
    shortId,
    claimType: input.claimType,
    applicantName: input.applicantName,
    applicantEmail: input.applicantEmail,
    applicantPhone: input.applicantPhone,
    status: 'pending',
    createdAt: serverTimestamp() as unknown as Timestamp,
    reviewedAt: null,
    reviewerUid: null,
  };
  if (input.claimType === 'existing' && input.storeCode) {
    payload.storeCode = input.storeCode;
  }
  if (input.claimType === 'new' && input.newStore) {
    payload.newStore = input.newStore;
  }
  const ref = await addDoc(collection(db, 'merchantClaims'), payload);
  return {
    id: ref.id,
    uid: input.uid,
    shortId,
    claimType: input.claimType,
    storeCode: input.storeCode,
    newStore: input.newStore,
    applicantName: input.applicantName,
    applicantEmail: input.applicantEmail,
    applicantPhone: input.applicantPhone,
    status: 'pending',
    createdAt: Date.now(),
    reviewedAt: null,
    reviewerUid: null,
  };
}

/** 본인 신청 단건 (pending 또는 가장 최근 1건) */
export async function getMyLatestClaim(uid: string): Promise<MerchantClaim | null> {
  const q = query(collection(db, 'merchantClaims'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const all = snap.docs.map((d) => snapToClaim(d.id, d.data() as ClaimDoc));
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all[0] ?? null;
}

export function subscribeMyLatestClaim(
  uid: string,
  cb: (claim: MerchantClaim | null) => void,
): Unsubscribe {
  const q = query(collection(db, 'merchantClaims'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        cb(null);
        return;
      }
      const all = snap.docs.map((d) => snapToClaim(d.id, d.data() as ClaimDoc));
      all.sort((a, b) => b.createdAt - a.createdAt);
      cb(all[0] ?? null);
    },
    (err) => {
      console.error('[merchantClaims] subscribe error:', err);
      cb(null);
    },
  );
}

/** 운영자: 상태별 목록 */
export async function listClaimsByStatus(status: MerchantClaimStatus): Promise<MerchantClaim[]> {
  const q = query(collection(db, 'merchantClaims'), where('status', '==', status));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => snapToClaim(d.id, d.data() as ClaimDoc));
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

export function subscribeClaimsByStatus(
  status: MerchantClaimStatus,
  cb: (claims: MerchantClaim[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'merchantClaims'), where('status', '==', status));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => snapToClaim(d.id, d.data() as ClaimDoc));
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    (err) => {
      console.error('[merchantClaims] subscribeByStatus error:', err);
      cb([]);
    },
  );
}

export async function getClaim(claimId: string): Promise<MerchantClaim | null> {
  const snap = await getDoc(doc(db, 'merchantClaims', claimId));
  if (!snap.exists()) return null;
  return snapToClaim(snap.id, snap.data() as ClaimDoc);
}

export async function approveClaim(claimId: string, reviewerUid: string): Promise<void> {
  await updateDoc(doc(db, 'merchantClaims', claimId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewerUid,
  });
}

/**
 * 클레임 승인 + 사용자 활성화 + 매장(shops) 등록을 한 번에.
 * - claim.status='approved', reviewedAt, reviewerUid
 * - users/{uid}.status='active', approvedAt
 * - shops/{shopId} 신규 doc 생성 (ownerUid = claim.uid)
 *   - existing: storeCodes=[claim.storeCode], displayName/phone 은 directory + applicant 정보로 채움
 *   - new: storeCodes=[`NEW-${claim.shortId}`], displayName/phone 은 newStore 데이터로 채움
 */
export async function approveAndActivateClaim(
  claim: MerchantClaim,
  reviewerUid: string,
): Promise<{ shopId: string }> {
  const batch = writeBatch(db);

  const claimRef = doc(db, 'merchantClaims', claim.id);
  batch.update(claimRef, {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewerUid,
  });

  const userRef = doc(db, 'users', claim.uid);
  batch.update(userRef, {
    status: 'active',
    approvedAt: serverTimestamp(),
  });

  // shops doc 생성
  const shopRef = doc(collection(db, 'shops')); // auto id
  let displayName = '';
  let phone = claim.applicantPhone || '';
  let storeCodes: string[] = [];
  let description = '';

  if (claim.claimType === 'existing' && claim.storeCode) {
    storeCodes = [claim.storeCode];
    const dir = getStoreByCode(claim.storeCode);
    displayName = dir?.name ?? claim.storeCode;
    if (!phone && dir?.phone) phone = dir.phone;
  } else if (claim.claimType === 'new' && claim.newStore) {
    storeCodes = [claim.shortId];
    displayName = claim.newStore.name ?? '';
    if (!phone && claim.newStore.phone) phone = claim.newStore.phone;
    description = claim.newStore.description ?? '';
  }

  batch.set(shopRef, {
    ownerUid: claim.uid,
    storeCodes,
    displayName,
    phone,
    businessHours: '',
    description,
    categories: [],
    verified: true, // 운영자 승인을 거친 매장 → 인증 매장
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sourceClaimId: claim.id,
    sourceClaimType: claim.claimType,
  });

  await batch.commit();
  return { shopId: shopRef.id };
}

/**
 * 운영자가 매장(shops) 을 직접 새로 등록.
 * - ownerUid=adminUid (시스템 보유), storeCodes=['ADMIN-<random>']
 */
export async function adminCreateStore(input: {
  adminUid: string;
  displayName: string;
  phone: string;
  address?: string;
  description?: string;
  storeCode?: string; // 운영자가 명시한 코드가 있으면 사용
}): Promise<string> {
  const code = input.storeCode ?? generateShortId();
  const ref = doc(collection(db, 'shops'));
  await setDoc(ref, {
    ownerUid: input.adminUid,
    storeCodes: [code],
    displayName: input.displayName,
    phone: input.phone,
    businessHours: '',
    description: input.description ?? '',
    categories: [],
    address: input.address ?? '',
    verified: true, // 운영자가 직접 등록한 매장 → 인증
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    adminCreated: true,
  });
  return ref.id;
}

export async function rejectClaim(
  claimId: string,
  reviewerUid: string,
  reason?: string,
): Promise<void> {
  await updateDoc(doc(db, 'merchantClaims', claimId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewerUid,
    ...(reason ? { rejectReason: reason } : {}),
  });
}

export async function resetClaimToPending(claimId: string): Promise<void> {
  await updateDoc(doc(db, 'merchantClaims', claimId), {
    status: 'pending',
    reviewedAt: null,
    reviewerUid: null,
  });
}
