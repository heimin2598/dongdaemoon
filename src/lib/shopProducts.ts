import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { ShopPhoto, ShopProduct } from '@/types';

/**
 * 매장 상품 카탈로그.
 * Firestore: shops/{shopId}/products/{productId}
 * Storage: shops/{shopId}/products/{filename}.jpg
 */

export const MAX_PHOTOS_PER_PRODUCT = 3;
export const MAX_PRODUCTS_PER_SHOP = 50;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface ProductDoc {
  name?: string;
  description?: string;
  priceText?: string;
  photos?: ShopPhoto[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function snapToProduct(shopId: string, id: string, d: ProductDoc): ShopProduct {
  return {
    id,
    shopId,
    name: d.name ?? '',
    description: d.description,
    priceText: d.priceText,
    photos: Array.isArray(d.photos) ? d.photos : [],
    createdAt: d.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
  };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return await res.blob();
}

export async function uploadProductPhoto(
  shopId: string,
  uri: string,
): Promise<ShopPhoto> {
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `shops/${shopId}/products/${filename}`;
  const sref = storageRef(storage, path);
  const blob = await uriToBlob(uri);
  await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(sref);
  return { url, storagePath: path, uploadedAt: Date.now() };
}

export async function deleteProductPhoto(photo: ShopPhoto): Promise<void> {
  try {
    await deleteObject(storageRef(storage, photo.storagePath));
  } catch {
    // ignore — Firestore 측은 별도 처리
  }
}

export async function createProduct(
  shopId: string,
  data: Omit<ShopProduct, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'shops', shopId, 'products'), {
    name: data.name,
    description: data.description ?? '',
    priceText: data.priceText ?? '',
    photos: data.photos ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  shopId: string,
  productId: string,
  data: Partial<Omit<ShopProduct, 'id' | 'shopId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  // Firestore 는 undefined 값을 거부 — 명시적으로 빈 문자열/배열로 정규화
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description ?? '';
  if (data.priceText !== undefined) payload.priceText = data.priceText ?? '';
  if (data.photos !== undefined) payload.photos = data.photos;
  await setDoc(doc(db, 'shops', shopId, 'products', productId), payload, { merge: true });
}

export async function deleteProduct(shopId: string, productId: string): Promise<void> {
  // 사진 storage 정리는 호출 측에서 photos 알아서 정리 (또는 lazy)
  const snap = await getDoc(doc(db, 'shops', shopId, 'products', productId));
  if (snap.exists()) {
    const photos = (snap.data() as ProductDoc).photos ?? [];
    await Promise.all(photos.map((p) => deleteProductPhoto(p)));
  }
  await deleteDoc(doc(db, 'shops', shopId, 'products', productId));
}

export async function getProduct(
  shopId: string,
  productId: string,
): Promise<ShopProduct | null> {
  const snap = await getDoc(doc(db, 'shops', shopId, 'products', productId));
  if (!snap.exists()) return null;
  return snapToProduct(shopId, snap.id, snap.data() as ProductDoc);
}

export async function listProducts(shopId: string): Promise<ShopProduct[]> {
  const q = query(
    collection(db, 'shops', shopId, 'products'),
    orderBy('updatedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => snapToProduct(shopId, d.id, d.data() as ProductDoc));
}

export function subscribeProducts(
  shopId: string,
  cb: (products: ShopProduct[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'shops', shopId, 'products'),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => snapToProduct(shopId, d.id, d.data() as ProductDoc))),
    (err) => {
      console.error('[shopProducts] subscribe error:', err);
      cb([]);
    },
  );
}
