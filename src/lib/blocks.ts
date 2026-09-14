import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface BlockedEntry {
  blockedUid: string;
  displayName?: string;
  reason?: string;
  createdAt: number;
}

interface BlockedDoc {
  displayName?: string;
  reason?: string;
  createdAt: { toMillis?: () => number } | number | null;
}

function blocksCol(uid: string) {
  return collection(db, 'users', uid, 'blocked');
}

function blockRef(uid: string, blockedUid: string) {
  return doc(db, 'users', uid, 'blocked', blockedUid);
}

function toMillis(v: BlockedDoc['createdAt']): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  return uid;
}

/** 사용자 차단. doc id == 차단 대상 uid (1:1). */
export async function blockUser(
  blockedUid: string,
  meta?: { displayName?: string; reason?: string },
): Promise<void> {
  const uid = requireUid();
  if (uid === blockedUid) throw new Error('자기 자신은 차단할 수 없습니다.');
  await setDoc(blockRef(uid, blockedUid), {
    displayName: meta?.displayName ?? '',
    reason: meta?.reason ?? '',
    createdAt: serverTimestamp(),
  });
}

/** 차단 해제. */
export async function unblockUser(blockedUid: string): Promise<void> {
  const uid = requireUid();
  await deleteDoc(blockRef(uid, blockedUid));
}

/** 본인 차단 목록 실시간 구독. */
export function subscribeBlocked(
  cb: (list: BlockedEntry[]) => void,
): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    cb([]);
    return () => {};
  }
  return onSnapshot(blocksCol(uid), (snap) => {
    const list: BlockedEntry[] = snap.docs.map((d) => {
      const data = d.data() as BlockedDoc;
      return {
        blockedUid: d.id,
        displayName: data.displayName,
        reason: data.reason,
        createdAt: toMillis(data.createdAt),
      };
    });
    cb(list);
  });
}
