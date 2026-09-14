import * as ImageManipulator from 'expo-image-manipulator';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { PartsCategory, PartsPhoto, PartsReply, PartsRequest, Shop } from '@/types';

export const MAX_PHOTOS_PER_REQUEST = 5;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_CATEGORIES_PER_REQUEST = 3;

interface PartsRequestDoc {
  authorUid: string;
  authorName: string;
  categories?: PartsCategory[];
  text: string;
  photos?: PartsPhoto[];
  status: 'open' | 'closed';
  replyCount?: number;
  createdAt: { toMillis?: () => number } | number | null;
  updatedAt: { toMillis?: () => number } | number | null;
}

interface PartsReplyDoc {
  ownerUid: string;
  shopDisplayName: string;
  shopStoreCodes: string[];
  message: string;
  createdAt: { toMillis?: () => number } | number | null;
  updatedAt: { toMillis?: () => number } | number | null;
}

function reqsCol() {
  return collection(db, 'partsRequests');
}

function reqRef(id: string) {
  return doc(db, 'partsRequests', id);
}

function repliesCol(id: string) {
  return collection(db, 'partsRequests', id, 'replies');
}

function replyRef(id: string, shopId: string) {
  return doc(db, 'partsRequests', id, 'replies', shopId);
}

function toMillis(v: PartsRequestDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function requireUser(): { uid: string; displayName: string } {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  return {
    uid: u.uid,
    displayName: u.displayName?.trim() || '익명',
  };
}

async function compress(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

function snapToRequest(id: string, data: PartsRequestDoc): PartsRequest {
  return {
    id,
    authorUid: data.authorUid,
    authorName: data.authorName ?? '익명',
    categories: Array.isArray(data.categories) ? data.categories : undefined,
    text: data.text ?? '',
    photos: Array.isArray(data.photos) ? data.photos : [],
    status: data.status ?? 'open',
    replyCount: data.replyCount ?? 0,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function snapToReply(shopId: string, data: PartsReplyDoc): PartsReply {
  return {
    shopId,
    ownerUid: data.ownerUid,
    shopDisplayName: data.shopDisplayName ?? '',
    shopStoreCodes: Array.isArray(data.shopStoreCodes) ? data.shopStoreCodes : [],
    message: data.message ?? '',
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

/** 요청 작성 — categories(최대 3개), text, photoUris 받아 사진 압축·업로드 후 Firestore 저장. */
export async function createPartsRequest(input: {
  categories: PartsCategory[];
  text: string;
  photoUris: string[];
}): Promise<string> {
  const { uid, displayName } = requireUser();
  const trimmed = input.text.trim();
  const uris = input.photoUris.slice(0, MAX_PHOTOS_PER_REQUEST);
  const categories = input.categories.slice(0, MAX_CATEGORIES_PER_REQUEST);

  // 1) 먼저 요청 doc 생성 (photos = [])
  const reqDoc = await addDoc(reqsCol(), {
    authorUid: uid,
    authorName: displayName,
    categories,
    text: trimmed,
    photos: [],
    status: 'open',
    replyCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2) 사진 업로드 후 photos 갱신
  const photos: PartsPhoto[] = [];
  for (let i = 0; i < uris.length; i++) {
    try {
      const compressed = await compress(uris[i]);
      const photoId = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
      const storagePath = `partsRequests/${reqDoc.id}/${photoId}.jpg`;
      const blob = await uriToBlob(compressed.uri);
      await uploadBytes(ref(storage, storagePath), blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(ref(storage, storagePath));
      photos.push({
        url,
        storagePath,
        width: compressed.width,
        height: compressed.height,
      });
    } catch {
      // 한 장 실패해도 나머지 진행
    }
  }
  if (photos.length > 0) {
    await updateDoc(reqRef(reqDoc.id), {
      photos,
      updatedAt: serverTimestamp(),
    });
  }
  return reqDoc.id;
}

/** 요청 + 그 안의 답글 + Storage 사진 모두 삭제 (작성자 본인만). */
export async function deletePartsRequest(id: string): Promise<void> {
  const { uid } = requireUser();
  const snap = await getDoc(reqRef(id));
  if (!snap.exists()) return;
  const data = snap.data() as PartsRequestDoc;
  if (data.authorUid !== uid) throw new Error('본인 글만 삭제할 수 있습니다.');

  // 1) Storage 사진 정리
  const photos = Array.isArray(data.photos) ? data.photos : [];
  await Promise.all(
    photos.map(async (p) => {
      try {
        await deleteObject(ref(storage, p.storagePath));
      } catch {
        // 이미 없는 파일은 무시
      }
    }),
  );

  // 2) 답글 서브컬렉션 삭제
  const repliesSnap = await getDocs(repliesCol(id));
  await Promise.all(repliesSnap.docs.map((d) => deleteDoc(d.ref)));

  // 3) 요청 본문 삭제
  await deleteDoc(reqRef(id));
}

/** 요청 목록 실시간 구독 (최신순, 최근 100개). */
export function subscribePartsRequests(
  cb: (list: PartsRequest[]) => void,
): Unsubscribe {
  const q = query(reqsCol(), orderBy('createdAt', 'desc'), fsLimit(100));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => snapToRequest(d.id, d.data() as PartsRequestDoc)));
  });
}

/** 요청 단건 실시간 구독. */
export function subscribePartsRequest(
  id: string,
  cb: (req: PartsRequest | null) => void,
): Unsubscribe {
  return onSnapshot(reqRef(id), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snapToRequest(snap.id, snap.data() as PartsRequestDoc));
  });
}

/** 답글 목록 실시간 구독 (오래된 순 — 대화 흐름). */
export function subscribePartsReplies(
  id: string,
  cb: (list: PartsReply[]) => void,
): Unsubscribe {
  const q = query(repliesCol(id), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => snapToReply(d.id, d.data() as PartsReplyDoc)));
  });
}

/** 사장님이 본인 매장으로 답글 작성/수정. 매장당 1개 — 두 번째 호출은 update. */
export async function submitReply(
  requestId: string,
  shop: Shop,
  message: string,
): Promise<void> {
  const { uid } = requireUser();
  if (shop.ownerUid !== uid) throw new Error('본인 매장으로만 답글을 달 수 있습니다.');
  const trimmed = message.trim();
  if (!trimmed) throw new Error('내용을 입력하세요.');

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef(requestId));
    if (!reqSnap.exists()) throw new Error('요청을 찾을 수 없습니다.');
    const replySnap = await tx.get(replyRef(requestId, shop.id));
    const isNew = !replySnap.exists();

    tx.set(
      replyRef(requestId, shop.id),
      {
        ownerUid: uid,
        shopDisplayName: shop.displayName,
        shopStoreCodes: shop.storeCodes,
        message: trimmed,
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (isNew) {
      const oldCount = (reqSnap.data() as PartsRequestDoc).replyCount ?? 0;
      tx.update(reqRef(requestId), {
        replyCount: oldCount + 1,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/** 답글 삭제 (작성자 본인만). */
export async function deleteReply(requestId: string, shopId: string): Promise<void> {
  const { uid } = requireUser();
  await runTransaction(db, async (tx) => {
    const replySnap = await tx.get(replyRef(requestId, shopId));
    if (!replySnap.exists()) return;
    const data = replySnap.data() as PartsReplyDoc;
    if (data.ownerUid !== uid) throw new Error('본인 답글만 삭제할 수 있습니다.');
    const reqSnap = await tx.get(reqRef(requestId));
    const oldCount = reqSnap.exists()
      ? (reqSnap.data() as PartsRequestDoc).replyCount ?? 1
      : 1;

    tx.delete(replyRef(requestId, shopId));
    if (reqSnap.exists()) {
      tx.update(reqRef(requestId), {
        replyCount: Math.max(0, oldCount - 1),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/** 요청 상태 토글 (작성자 본인만). */
export async function setRequestStatus(
  id: string,
  status: 'open' | 'closed',
): Promise<void> {
  const { uid } = requireUser();
  const snap = await getDoc(reqRef(id));
  if (!snap.exists()) return;
  if ((snap.data() as PartsRequestDoc).authorUid !== uid) {
    throw new Error('본인 글만 변경할 수 있습니다.');
  }
  await updateDoc(reqRef(id), { status, updatedAt: serverTimestamp() });
}
