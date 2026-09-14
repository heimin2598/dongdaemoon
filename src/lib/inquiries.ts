import * as ImageManipulator from 'expo-image-manipulator';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

export type InquiryStatus = 'open' | 'answered';

export interface InquiryAttachment {
  url: string;
  storagePath: string;
  kind: 'image' | 'pdf' | 'other';
  name?: string;
}

export interface Inquiry {
  id: string;
  authorUid: string;
  authorName?: string;
  authorEmail?: string;
  title: string;
  content: string;
  attachments: InquiryAttachment[];
  status: InquiryStatus;
  reply: string;
  replyAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface InquiryDoc {
  authorUid: string;
  authorName?: string;
  authorEmail?: string;
  title: string;
  content: string;
  attachments?: InquiryAttachment[];
  status?: InquiryStatus;
  reply?: string;
  replyAt?: { toMillis?: () => number } | number | null;
  createdAt?: { toMillis?: () => number } | number | null;
  updatedAt?: { toMillis?: () => number } | number | null;
}

function toMillis(v: InquiryDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function snapToInquiry(id: string, data: InquiryDoc): Inquiry {
  return {
    id,
    authorUid: data.authorUid,
    authorName: data.authorName,
    authorEmail: data.authorEmail,
    title: data.title ?? '',
    content: data.content ?? '',
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    status: data.status ?? 'open',
    reply: data.reply ?? '',
    replyAt: toMillis(data.replyAt) || null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

async function compress(uri: string) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

export async function uploadInquiryAttachment(
  inquiryId: string,
  sourceUri: string,
): Promise<InquiryAttachment> {
  const compressed = await compress(sourceUri);
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `inquiries/${inquiryId}/${photoId}.jpg`;
  const blob = await uriToBlob(compressed.uri);
  await uploadBytes(ref(storage, storagePath), blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(ref(storage, storagePath));
  return { url, storagePath, kind: 'image' };
}

export async function createInquiry(input: {
  title: string;
  content: string;
  attachmentUris: string[];
}): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  const ref = await addDoc(collection(db, 'inquiries'), {
    authorUid: u.uid,
    authorName: u.displayName ?? '',
    authorEmail: u.email ?? '',
    title: input.title.trim(),
    content: input.content.trim(),
    attachments: [],
    status: 'open',
    reply: '',
    replyAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (input.attachmentUris.length > 0) {
    const uploaded: InquiryAttachment[] = [];
    for (const uri of input.attachmentUris.slice(0, 5)) {
      try {
        const a = await uploadInquiryAttachment(ref.id, uri);
        uploaded.push(a);
      } catch {
        // 한 장 실패해도 나머지 진행
      }
    }
    if (uploaded.length > 0) {
      await updateDoc(ref, { attachments: uploaded, updatedAt: serverTimestamp() });
    }
  }
  return ref.id;
}

export async function replyInquiry(inquiryId: string, reply: string): Promise<void> {
  await updateDoc(doc(db, 'inquiries', inquiryId), {
    reply: reply.trim(),
    status: 'answered',
    replyAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeMyInquiries(
  cb: (list: Inquiry[]) => void,
): Unsubscribe {
  const u = auth.currentUser;
  if (!u) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, 'inquiries'),
    where('authorUid', '==', u.uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToInquiry(d.id, d.data() as InquiryDoc)));
    },
    (err) => {
      console.error('[inquiries] subscribeMyInquiries error:', err);
      cb([]);
    },
  );
}

export function subscribeAllInquiries(
  cb: (list: Inquiry[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => snapToInquiry(d.id, d.data() as InquiryDoc)));
    },
    (err) => {
      console.error('[inquiries] subscribeAllInquiries error:', err);
      cb([]);
    },
  );
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const snap = await getDoc(doc(db, 'inquiries', id));
  if (!snap.exists()) return null;
  return snapToInquiry(snap.id, snap.data() as InquiryDoc);
}

export function subscribeInquiry(
  id: string,
  cb: (inquiry: Inquiry | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'inquiries', id), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snapToInquiry(snap.id, snap.data() as InquiryDoc));
  });
}
