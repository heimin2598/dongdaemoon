import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type AdInquiryStatus =
  | 'pending'    // 확인전
  | 'contacted'  // 안내완료
  | 'confirmed'  // 광고진행확정
  | 'rejected';  // 광고미진행

export const AD_INQUIRY_STATUS_LABEL: Record<AdInquiryStatus, string> = {
  pending: '확인전',
  contacted: '안내완료',
  confirmed: '광고진행확정',
  rejected: '광고미진행',
};

export const AD_INQUIRY_STATUS_ORDER: AdInquiryStatus[] = [
  'pending',
  'contacted',
  'confirmed',
  'rejected',
];

export interface AdInquiry {
  id: string;
  authorUid: string;
  company: string;
  contact: string;     // 담당자명
  phone: string;
  email: string;
  status: AdInquiryStatus;
  adminNote: string;
  createdAt: number;
  updatedAt: number;
}

interface AdInquiryDoc {
  authorUid: string;
  company?: string;
  contact?: string;
  phone?: string;
  email?: string;
  status?: AdInquiryStatus;
  adminNote?: string;
  createdAt?: { toMillis?: () => number } | number | null;
  updatedAt?: { toMillis?: () => number } | number | null;
}

function toMillis(v: AdInquiryDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function snapToAdInquiry(id: string, data: AdInquiryDoc): AdInquiry {
  return {
    id,
    authorUid: data.authorUid,
    company: data.company ?? '',
    contact: data.contact ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    status: data.status ?? 'pending',
    adminNote: data.adminNote ?? '',
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export async function createAdInquiry(input: {
  company: string;
  contact: string;
  phone: string;
  email: string;
}): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  const ref = await addDoc(collection(db, 'adInquiries'), {
    authorUid: u.uid,
    company: input.company.trim(),
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    status: 'pending',
    adminNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setAdInquiryStatus(
  id: string,
  status: AdInquiryStatus,
  adminNote?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (adminNote !== undefined) patch.adminNote = adminNote.trim();
  // updateDoc 의 두번째 인자는 strict 한 UpdateData 를 요구하지만, 동적 patch 는 Record 로 받는 게 자연스러움.
  await updateDoc(doc(db, 'adInquiries', id), patch as Record<string, never>);
}

export function subscribeAllAdInquiries(
  cb: (list: AdInquiry[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'adInquiries'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToAdInquiry(d.id, d.data() as AdInquiryDoc)));
    },
    (err) => {
      console.error('[adInquiries] subscribeAllAdInquiries error:', err);
      cb([]);
    },
  );
}

export function subscribeMyAdInquiries(
  cb: (list: AdInquiry[]) => void,
): Unsubscribe {
  const u = auth.currentUser;
  if (!u) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, 'adInquiries'),
    where('authorUid', '==', u.uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToAdInquiry(d.id, d.data() as AdInquiryDoc)));
    },
    (err) => {
      console.error('[adInquiries] subscribeMyAdInquiries error:', err);
      cb([]);
    },
  );
}
