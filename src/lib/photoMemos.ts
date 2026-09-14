import * as ImageManipulator from 'expo-image-manipulator';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

export const MAX_PHOTOS_PER_SHOP = 10;

export interface PhotoMemo {
  id: string;
  url: string;
  caption: string;
  storagePath: string;
  width?: number;
  height?: number;
  createdAt: number;
}

interface PhotoMemoDoc {
  url: string;
  caption?: string;
  storagePath: string;
  width?: number;
  height?: number;
  createdAt: { toMillis?: () => number } | number | null;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  return uid;
}

function photosCol(uid: string, shopCode: string) {
  return collection(db, 'users', uid, 'photoMemos', shopCode, 'photos');
}

function toMillis(v: PhotoMemoDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
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

export async function uploadPhotoMemo(
  shopCode: string,
  sourceUri: string,
  caption: string = '',
): Promise<PhotoMemo> {
  const uid = requireUid();
  const compressed = await compress(sourceUri);
  const ts = Date.now();
  const photoId = `${ts}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `users/${uid}/photoMemos/${shopCode}/${photoId}.jpg`;
  const blob = await uriToBlob(compressed.uri);
  const objRef = ref(storage, storagePath);
  await uploadBytes(objRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(objRef);

  await setDoc(doc(photosCol(uid, shopCode), photoId), {
    url,
    caption: caption.trim(),
    storagePath,
    width: compressed.width,
    height: compressed.height,
    createdAt: serverTimestamp(),
  });

  return {
    id: photoId,
    url,
    caption: caption.trim(),
    storagePath,
    width: compressed.width,
    height: compressed.height,
    createdAt: ts,
  };
}

export async function deletePhotoMemo(shopCode: string, photoId: string, storagePath: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(doc(photosCol(uid, shopCode), photoId));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Storage 객체가 이미 없으면 무시 — Firestore 메타는 위에서 이미 지움.
  }
}

export async function updatePhotoMemoCaption(
  shopCode: string,
  photoId: string,
  caption: string,
): Promise<void> {
  const uid = requireUid();
  await setDoc(
    doc(photosCol(uid, shopCode), photoId),
    { caption: caption.trim() },
    { merge: true },
  );
}

export function subscribePhotoMemos(
  shopCode: string,
  cb: (photos: PhotoMemo[]) => void,
): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    cb([]);
    return () => {};
  }
  const q = query(photosCol(uid, shopCode), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const list: PhotoMemo[] = snap.docs.map((d) => {
      const data = d.data() as PhotoMemoDoc;
      return {
        id: d.id,
        url: data.url,
        caption: data.caption ?? '',
        storagePath: data.storagePath,
        width: data.width,
        height: data.height,
        createdAt: toMillis(data.createdAt),
      };
    });
    cb(list);
  });
}
