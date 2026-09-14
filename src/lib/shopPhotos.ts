import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { ShopPhoto } from '@/types';

/**
 * 매장 사장님이 올리는 매장 갤러리 사진 (간이 카탈로그).
 * Firestore: shops/{shopId}.photos (배열)
 * Storage: shops/{shopId}/photos/{filename}.jpg
 */

export const MAX_SHOP_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

/** 사진 한 장 업로드 → Storage + Firestore photos 배열에 append. */
export async function uploadShopPhoto(
  shopId: string,
  uri: string,
  caption?: string,
): Promise<ShopPhoto> {
  const shopSnap = await getDoc(doc(db, 'shops', shopId));
  if (!shopSnap.exists()) throw new Error('매장이 존재하지 않습니다.');
  const existing = (shopSnap.data().photos as ShopPhoto[] | undefined) ?? [];
  if (existing.length >= MAX_SHOP_PHOTOS) {
    throw new Error(`매장당 최대 ${MAX_SHOP_PHOTOS}장까지 업로드 가능합니다.`);
  }

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `shops/${shopId}/photos/${filename}`;
  const sref = storageRef(storage, path);

  const blob = await uriToBlob(uri);
  await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(sref);

  const photo: ShopPhoto = {
    url,
    storagePath: path,
    uploadedAt: Date.now(),
  };
  const captionTrim = caption?.trim();
  if (captionTrim) photo.caption = captionTrim;
  await updateDoc(doc(db, 'shops', shopId), {
    photos: [...existing, photo],
    updatedAt: serverTimestamp(),
  });
  return photo;
}

/** Storage 의 사진 한 장 + Firestore photos 배열에서 함께 제거. */
export async function deleteShopPhoto(shopId: string, photo: ShopPhoto): Promise<void> {
  const shopSnap = await getDoc(doc(db, 'shops', shopId));
  if (!shopSnap.exists()) return;
  const existing = (shopSnap.data().photos as ShopPhoto[] | undefined) ?? [];
  const next = existing.filter((p) => p.storagePath !== photo.storagePath);
  await updateDoc(doc(db, 'shops', shopId), {
    photos: next,
    updatedAt: serverTimestamp(),
  });
  try {
    await deleteObject(storageRef(storage, photo.storagePath));
  } catch {
    // 이미 없거나 권한 문제는 무시 (Firestore 측은 이미 정리됨)
  }
}

/** 사진의 caption 만 수정. */
export async function updateShopPhotoCaption(
  shopId: string,
  storagePath: string,
  caption: string,
): Promise<void> {
  const shopSnap = await getDoc(doc(db, 'shops', shopId));
  if (!shopSnap.exists()) return;
  const existing = (shopSnap.data().photos as ShopPhoto[] | undefined) ?? [];
  const next = existing.map((p) => {
    if (p.storagePath !== storagePath) return p;
    const trimmed = caption.trim();
    if (!trimmed) {
      const { caption: _omit, ...rest } = p;
      return rest;
    }
    return { ...p, caption: trimmed };
  });
  await updateDoc(doc(db, 'shops', shopId), {
    photos: next,
    updatedAt: serverTimestamp(),
  });
}
