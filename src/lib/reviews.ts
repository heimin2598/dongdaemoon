import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export interface Review {
  id: string;             // = uid (1인 1리뷰)
  rating: number;
  text: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewAggregate {
  ratingSum: number;
  ratingCount: number;
  average: number;        // 계산 결과 (저장은 sum/count만)
}

interface ReviewDoc {
  rating: number;
  text: string;
  displayName: string;
  createdAt: { toMillis?: () => number } | number | null;
  updatedAt: { toMillis?: () => number } | number | null;
}

interface AggregateDoc {
  ratingSum?: number;
  ratingCount?: number;
}

function toMillis(v: ReviewDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function entriesCol(shopCode: string) {
  return collection(db, 'reviews', shopCode, 'entries');
}

function aggregateRef(shopCode: string) {
  return doc(db, 'reviews', shopCode);
}

function entryRef(shopCode: string, uid: string) {
  return doc(db, 'reviews', shopCode, 'entries', uid);
}

function clampRating(r: number): number {
  if (!Number.isFinite(r)) return RATING_MIN;
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(r)));
}

function requireUser(): { uid: string; displayName: string } {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  return {
    uid: u.uid,
    displayName: u.displayName?.trim() || '익명',
  };
}

export async function submitReview(
  shopCode: string,
  rating: number,
  text: string,
): Promise<void> {
  const { uid, displayName } = requireUser();
  const newRating = clampRating(rating);
  const trimmed = text.trim();

  await runTransaction(db, async (tx) => {
    const aggSnap = await tx.get(aggregateRef(shopCode));
    const entrySnap = await tx.get(entryRef(shopCode, uid));

    const oldRating = entrySnap.exists()
      ? (entrySnap.data() as ReviewDoc).rating ?? 0
      : 0;

    const oldAgg: AggregateDoc = aggSnap.exists() ? (aggSnap.data() as AggregateDoc) : {};
    const oldSum = oldAgg.ratingSum ?? 0;
    const oldCount = oldAgg.ratingCount ?? 0;

    const nextSum = entrySnap.exists()
      ? oldSum - oldRating + newRating
      : oldSum + newRating;
    const nextCount = entrySnap.exists() ? oldCount : oldCount + 1;

    tx.set(
      aggregateRef(shopCode),
      { ratingSum: nextSum, ratingCount: nextCount, updatedAt: serverTimestamp() },
      { merge: true },
    );

    tx.set(
      entryRef(shopCode, uid),
      {
        rating: newRating,
        text: trimmed,
        displayName,
        ...(entrySnap.exists() ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function deleteMyReview(shopCode: string): Promise<void> {
  const { uid } = requireUser();
  await runTransaction(db, async (tx) => {
    const entrySnap = await tx.get(entryRef(shopCode, uid));
    if (!entrySnap.exists()) return;
    const oldRating = (entrySnap.data() as ReviewDoc).rating ?? 0;

    const aggSnap = await tx.get(aggregateRef(shopCode));
    const oldAgg: AggregateDoc = aggSnap.exists() ? (aggSnap.data() as AggregateDoc) : {};
    const nextSum = (oldAgg.ratingSum ?? 0) - oldRating;
    const nextCount = Math.max(0, (oldAgg.ratingCount ?? 1) - 1);

    tx.set(
      aggregateRef(shopCode),
      { ratingSum: nextSum, ratingCount: nextCount, updatedAt: serverTimestamp() },
      { merge: true },
    );
    tx.delete(entryRef(shopCode, uid));
  });
  // tx.delete 가 transaction 내부에서 동작하지만, 안전하게 확인
  try {
    await deleteDoc(entryRef(shopCode, uid));
  } catch {
    // 이미 트랜잭션에서 삭제된 경우
  }
}

export async function getMyReview(shopCode: string): Promise<Review | null> {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await getDoc(entryRef(shopCode, u.uid));
  if (!snap.exists()) return null;
  const d = snap.data() as ReviewDoc;
  return {
    id: snap.id,
    rating: d.rating,
    text: d.text ?? '',
    displayName: d.displayName ?? '익명',
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function subscribeReviews(
  shopCode: string,
  cb: (reviews: Review[]) => void,
): Unsubscribe {
  const q = query(entriesCol(shopCode), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const list: Review[] = snap.docs.map((d) => {
      const data = d.data() as ReviewDoc;
      return {
        id: d.id,
        rating: data.rating,
        text: data.text ?? '',
        displayName: data.displayName ?? '익명',
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
    });
    cb(list);
  });
}

export function subscribeAggregate(
  shopCode: string,
  cb: (agg: ReviewAggregate) => void,
): Unsubscribe {
  return onSnapshot(aggregateRef(shopCode), (snap) => {
    const data: AggregateDoc = snap.exists() ? (snap.data() as AggregateDoc) : {};
    const ratingSum = data.ratingSum ?? 0;
    const ratingCount = data.ratingCount ?? 0;
    cb({
      ratingSum,
      ratingCount,
      average: ratingCount > 0 ? ratingSum / ratingCount : 0,
    });
  });
}
