import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { Entitlement, EntitlementSource } from '@/types';

export const DEFAULT_ENTITLEMENT: Entitlement = {
  plan: 'free',
  expiresAt: null,
  grandfathered: false,
  source: 'free',
};

interface EntitlementDoc {
  plan: 'free' | 'premium';
  expiresAt: number | null;
  grandfathered: boolean;
  source: EntitlementSource;
  productId?: string | null;
  environment?: 'PRODUCTION' | 'SANDBOX' | null;
  updatedAt?: unknown;
}

/**
 * 프리미엄 활성 판정.
 *
 * 불변식: **영구 권한 신호는 `grandfathered` 하나뿐이다.**
 * 기간제 프리미엄(구독)은 반드시 숫자 expiresAt 을 가져야 한다.
 * 예전에는 `expiresAt == null` 을 영구로 봤는데, webhook 이 만료일 없는 갱신 이벤트를
 * 받으면 구독자가 조용히 영구 프리미엄이 되는 구멍이었다.
 */
export function isActivePremium(e: Entitlement | undefined | null): boolean {
  if (!e) return false;
  if (e.plan !== 'premium') return false;
  if (e.grandfathered) return true;
  if (typeof e.expiresAt !== 'number') return false;
  return e.expiresAt > Date.now();
}

/** 기간제 프리미엄 남은 일수 (영구/만료/free 면 0). */
export function premiumDaysRemaining(e: Entitlement | undefined | null): number {
  if (!e || e.plan !== 'premium' || e.grandfathered || typeof e.expiresAt !== 'number') return 0;
  const ms = e.expiresAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function entitlementFromDoc(data: EntitlementDoc): Entitlement {
  return {
    plan: data.plan ?? 'free',
    expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
    grandfathered: !!data.grandfathered,
    source: data.source ?? 'free',
    productId: data.productId ?? null,
    environment: data.environment ?? null,
  };
}

/**
 * 서버(RevenueCat) 를 진실로 삼아 내 entitlement 를 다시 계산시킨다.
 *
 * webhook 이 유일한 경로일 때 생기는 구멍을 메운다:
 *  - 복원(restore) 은 새 트랜잭션이 아니라 webhook 이 오지 않는다
 *  - webhook 이 실패/지연되면 결제했는데 권한이 안 생긴 상태로 남는다
 * 결제·복원 직후, 그리고 프리미엄인데 권한이 안 보일 때 호출한다.
 */
export async function syncEntitlementFromServer(): Promise<Entitlement> {
  const call = httpsCallable<unknown, { entitlement: EntitlementDoc }>(functions, 'syncEntitlement');
  const res = await call({});
  return entitlementFromDoc(res.data.entitlement);
}

export async function readEntitlement(uid: string): Promise<Entitlement> {
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'entitlement'));
  if (!snap.exists()) return { ...DEFAULT_ENTITLEMENT };
  return entitlementFromDoc(snap.data() as EntitlementDoc);
}

export function subscribeEntitlement(
  uid: string,
  cb: (e: Entitlement) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid, 'meta', 'entitlement'), (snap) => {
    if (!snap.exists()) {
      cb({ ...DEFAULT_ENTITLEMENT });
      return;
    }
    cb(entitlementFromDoc(snap.data() as EntitlementDoc));
  });
}

/**
 * 신규 가입 직후 entitlement doc 생성 — 항상 free 로 시작한다.
 * 프리미엄으로의 전환은 전부 서버(Cloud Function) 경로다. firestore.rules 도 free create 만 허용한다.
 */
export async function ensureEntitlementDoc(uid: string): Promise<Entitlement> {
  const ref = doc(db, 'users', uid, 'meta', 'entitlement');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return entitlementFromDoc(snap.data() as EntitlementDoc);
  }
  const fresh: Entitlement = {
    plan: 'free',
    expiresAt: null,
    grandfathered: false,
    source: 'free',
  };
  await setDoc(ref, { ...fresh, updatedAt: serverTimestamp() });
  return fresh;
}

// ─────────────────────────────────────────────────────
// 운영자(어드민) 전용 — 임의로 회원 entitlement 수정
// firestore.rules 의 entitlement update 가 admin 만 허용하도록 갱신 필요.
// ─────────────────────────────────────────────────────
export type AdminGrantPreset = 'month' | 'year' | 'lifetime' | 'custom';

export async function adminGrantPremium(input: {
  uid: string;
  expiresAt: number | null;          // null = 평생 (grandfathered)
  source?: 'manual' | 'apple' | 'google';
}): Promise<void> {
  const ref = doc(db, 'users', input.uid, 'meta', 'entitlement');
  const grandfathered = input.expiresAt === null;
  await setDoc(
    ref,
    {
      plan: 'premium',
      expiresAt: input.expiresAt,
      grandfathered,
      source: input.source ?? 'manual',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function adminRevokePremium(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'meta', 'entitlement');
  await setDoc(
    ref,
    {
      plan: 'free',
      expiresAt: null,
      grandfathered: false,
      source: 'free',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export interface UserListItem {
  uid: string;
  email: string;
  displayName: string | null;
  shortId: string | null;
  role: 'visitor' | 'merchant';
  status: 'active' | 'pending' | 'rejected';
  createdAt: number | null;
  disabled: boolean;
  deletedAt: number | null;
  entitlement: Entitlement | null; // entitlement doc 조회 결과 (없으면 null)
}

/**
 * 운영자: 회원 차단(disable) — 다음 로그인부터 사용 불가.
 * Auth 계정 자체는 살아있으나, 클라이언트가 disabled=true 면 즉시 signOut 처리.
 */
export async function adminDisableUser(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { disabled: true });
}

/** 운영자: 차단 해제. */
export async function adminEnableUser(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { disabled: false });
}

/**
 * 운영자: 회원 doc 영구 삭제 + entitlement doc 삭제.
 * 주의: Firebase Auth 계정은 클라이언트에서 삭제 불가 — Firebase 콘솔 또는 Admin SDK 에서 별도 처리 필요.
 * 본 함수 호출 후 운영자에게 콘솔 안내 메시지를 함께 노출하는 것을 권장.
 */
export async function adminDeleteUserDoc(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'meta', 'entitlement'));
  } catch {
    // 없으면 무시
  }
  await deleteDoc(doc(db, 'users', uid));
}

/**
 * 운영자: 전체 회원 목록 + 각 회원의 entitlement.
 * 회원 수 늘어나면 페이지네이션 필요. 현재 단계는 전체 fetch.
 */
export async function listAllUsersWithEntitlement(): Promise<UserListItem[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const results: UserListItem[] = await Promise.all(
    usersSnap.docs.map(async (d) => {
      const data = d.data() as {
        email?: string;
        displayName?: string | null;
        shortId?: string;
        role?: 'visitor' | 'merchant';
        status?: 'active' | 'pending' | 'rejected';
        createdAt?: Timestamp;
        disabled?: boolean;
        deletedAt?: Timestamp;
      };
      // entitlement doc — 없으면 null
      let entitlement: Entitlement | null = null;
      try {
        const eSnap = await getDoc(doc(db, 'users', d.id, 'meta', 'entitlement'));
        if (eSnap.exists()) {
          const eData = eSnap.data() as EntitlementDoc;
          entitlement = entitlementFromDoc(eData);
        }
      } catch {
        // 권한 등 이슈 시 null 처리 — UI 에서 '-' 로 표시
      }
      const deletedAtMs =
        (data as { deletedAt?: { toMillis?: () => number } }).deletedAt?.toMillis?.() ?? null;
      return {
        uid: d.id,
        email: data.email ?? '',
        displayName: data.displayName ?? null,
        shortId: data.shortId ?? null,
        role: data.role ?? 'visitor',
        status: data.status ?? 'active',
        createdAt: data.createdAt?.toMillis?.() ?? null,
        disabled: !!(data as { disabled?: boolean }).disabled,
        deletedAt: deletedAtMs,
        entitlement,
      };
    }),
  );
  // 최신 가입 순
  results.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return results;
}
