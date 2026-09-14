import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminEntry {
  uid: string;
  email?: string;
  displayName?: string;
  addedAt?: number;
}

/** 본인 uid 가 admins/{uid} 에 존재하면 어드민. 실시간 구독. */
export function subscribeIsAdmin(
  uid: string,
  cb: (isAdmin: boolean) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => cb(snap.exists()),
    (err) => {
      console.error('subscribeIsAdmin failed:', err);
      cb(false);
    },
  );
}
