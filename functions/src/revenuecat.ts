import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

/**
 * RevenueCat 를 "진실"로 삼는 entitlement 해석 + Firestore 반영.
 *
 * webhook 이벤트 payload 만 믿으면 다음이 전부 깨진다:
 *  - 이벤트 순서 역전 (상품 변경 시 구 상품 EXPIRATION 이 신규 RENEWAL 뒤에 도착)
 *  - 중복 전달 (RC 는 5xx 에 재시도한다)
 *  - 만료일 누락 payload
 * 그래서 이벤트는 "다시 계산하라"는 신호로만 쓰고, 실제 상태는 매번 REST 로 되읽는다.
 *
 * 필요한 키: RevenueCat **V1 시크릿 키** (sk_...).
 *   firebase functions:secrets:set REVENUECAT_API_KEY
 */

export const RC_API_KEY = defineSecret('REVENUECAT_API_KEY');

const RC_BASE = 'https://api.revenuecat.com/v1';
const ENTITLEMENT_ID = 'premium';

/** 1회 결제(영구) 상품. 평생 여부는 이벤트 타입이 아니라 상품 id 로 판정한다. */
const LIFETIME_PRODUCT_IDS = new Set(['premium_lifetime']);

/** RC 가 로그인 전 자동 생성하는 식별자 — 이게 app_user_id 로 오면 결제가 미아가 된 것이다. */
export function isAnonymousAppUserId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:') || id.startsWith('$RCPlaceholder');
}

export type EntitlementSource = 'free' | 'apple' | 'google' | 'manual' | 'promo';

export interface ResolvedEntitlement {
  plan: 'free' | 'premium';
  expiresAt: number | null;
  grandfathered: boolean;
  source: EntitlementSource;
  productId: string | null;
  environment: 'PRODUCTION' | 'SANDBOX' | null;
  store: string | null;
  willRenew: boolean | null;
}

export const FREE_ENTITLEMENT: ResolvedEntitlement = {
  plan: 'free',
  expiresAt: null,
  grandfathered: false,
  source: 'free',
  productId: null,
  environment: null,
  store: null,
  willRenew: null,
};

interface RcSubscriptionEntry {
  expires_date?: string | null;
  purchase_date?: string | null;
  store?: string;
  is_sandbox?: boolean;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  period_type?: string;
}

interface RcNonSubscriptionEntry {
  id?: string;
  purchase_date?: string | null;
  store?: string;
  is_sandbox?: boolean;
}

interface RcSubscriber {
  entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string } | undefined>;
  subscriptions?: Record<string, RcSubscriptionEntry | undefined>;
  non_subscriptions?: Record<string, RcNonSubscriptionEntry[] | undefined>;
  original_app_user_id?: string;
  management_url?: string | null;
}

export class RevenueCatUnavailable extends Error {}

/** RC V1 구독자 조회. 네트워크/5xx 는 RevenueCatUnavailable 로 올려 호출자가 보수적으로 처리하게 한다. */
export async function fetchSubscriber(uid: string, apiKey: string): Promise<RcSubscriber | null> {
  let res: Response;
  try {
    res = await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
  } catch (err) {
    throw new RevenueCatUnavailable(`RC fetch failed: ${(err as Error).message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    // 401/403 = 키 문제. 구독자 없음과 구분해서 올려야 조용한 권한 회수가 안 생긴다.
    throw new RevenueCatUnavailable(`RC ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { subscriber?: RcSubscriber };
  return body.subscriber ?? null;
}

function storeToSource(store: string | undefined | null): EntitlementSource {
  switch (store) {
    case 'app_store':
    case 'mac_app_store':
      return 'apple';
    case 'play_store':
    case 'amazon':
      return 'google';
    case 'promotional':
      return 'manual';
    default:
      return 'google';
  }
}

function ms(date: string | null | undefined): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : null;
}

/**
 * 구독자 응답 → 우리 entitlement.
 *
 * 영구(grandfathered) 로 올리는 조건은 하나뿐이다:
 *   만료일이 없고 **그 상품이 실제 1회 결제 상품** 일 것.
 * 만료일 없는 구독은 데이터 이상이므로 free 로 떨어뜨리고 로그를 남긴다.
 * (과거엔 만료일 없음을 영구로 해석해서 구독자가 조용히 평생 회원이 되는 구멍이 있었다)
 */
export function resolveEntitlement(sub: RcSubscriber | null, nowMs: number): ResolvedEntitlement {
  const ent = sub?.entitlements?.[ENTITLEMENT_ID];
  if (!sub || !ent) return { ...FREE_ENTITLEMENT };

  const productId = ent.product_identifier ?? null;
  const expiresAt = ms(ent.expires_date);
  const subEntry = productId ? sub.subscriptions?.[productId] : undefined;
  const nonSubEntries = productId ? sub.non_subscriptions?.[productId] : undefined;
  const lastNonSub = nonSubEntries?.length ? nonSubEntries[nonSubEntries.length - 1] : undefined;

  const store = subEntry?.store ?? lastNonSub?.store ?? null;
  const isSandbox = subEntry?.is_sandbox ?? lastNonSub?.is_sandbox ?? false;
  const environment: 'PRODUCTION' | 'SANDBOX' = isSandbox ? 'SANDBOX' : 'PRODUCTION';

  const isOneTimeProduct =
    (!!productId && LIFETIME_PRODUCT_IDS.has(productId)) || !!lastNonSub;

  if (expiresAt === null) {
    if (!isOneTimeProduct) {
      console.error('[rc] entitlement without expiry on a non-lifetime product', {
        productId,
        store,
      });
      return { ...FREE_ENTITLEMENT };
    }
    return {
      plan: 'premium',
      expiresAt: null,
      grandfathered: true,
      source: storeToSource(store),
      productId,
      environment,
      store: store ?? null,
      willRenew: false,
    };
  }

  if (expiresAt <= nowMs) return { ...FREE_ENTITLEMENT };

  return {
    plan: 'premium',
    expiresAt,
    grandfathered: false,
    source: storeToSource(store),
    productId,
    environment,
    store: store ?? null,
    willRenew: subEntry ? !subEntry.unsubscribe_detected_at : null,
  };
}

/**
 * 운영자 부여 / 프로모션 코드로 받은 **살아있는** 권한인지.
 * 이 둘은 RC 에 존재하지 않으므로, RC 결과로 덮어쓰면 그냥 사라진다.
 * 기간제 운영자 부여(예: 피해 보상으로 1년 보장) 도 같은 이유로 보호 대상이다.
 */
function isProtectedLocalGrant(
  data: FirebaseFirestore.DocumentData | undefined,
  nowMs: number,
): boolean {
  if (!data) return false;
  if (data.plan !== 'premium') return false;
  if (data.source !== 'promo' && data.source !== 'manual') return false;
  if (data.grandfathered === true) return true;
  return typeof data.expiresAt === 'number' && data.expiresAt > nowMs;
}

/** RC 결과가 로컬 부여보다 사용자에게 유리한가. 유리할 때만 덮어쓴다. */
function rcIsBetter(
  local: FirebaseFirestore.DocumentData,
  resolved: ResolvedEntitlement,
): boolean {
  if (resolved.plan !== 'premium') return false;
  if (resolved.grandfathered) return true;
  if (local.grandfathered === true) return false;
  const localExpires = typeof local.expiresAt === 'number' ? local.expiresAt : 0;
  return resolved.expiresAt !== null && resolved.expiresAt > localExpires;
}

export interface ApplyMeta {
  reason: string;
  eventType?: string;
  eventId?: string;
  eventAtMs?: number;
}

/**
 * entitlement 문서 반영. 트랜잭션으로 읽고 쓰며, 로컬 영구 부여는 절대 강등하지 않는다.
 * 반환값은 **실제로 저장된 상태**.
 */
export async function applyEntitlement(
  uid: string,
  resolved: ResolvedEntitlement,
  meta: ApplyMeta,
): Promise<ResolvedEntitlement> {
  const db = admin.firestore();
  const ref = db.doc(`users/${uid}/meta/entitlement`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : undefined;

    const bookkeeping = {
      lastSyncReason: meta.reason,
      lastEventType: meta.eventType ?? null,
      lastEventId: meta.eventId ?? null,
      lastEventAt: meta.eventAtMs ?? Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 운영자/프로모션 부여는 스토어 상태와 무관하게 유지한다.
    // RC 를 그대로 반영하면, 과거 구독이 만료됐다는 이벤트 하나로 보상·프로모션 권한이 사라진다.
    if (current && isProtectedLocalGrant(current, Date.now()) && !rcIsBetter(current, resolved)) {
      // RC 쪽 상태는 참고용으로만 남긴다 (문의 대응 시 두 값을 비교할 수 있게).
      tx.set(
        ref,
        { ...bookkeeping, rcPlan: resolved.plan, rcExpiresAt: resolved.expiresAt },
        { merge: true },
      );
      return {
        plan: 'premium',
        expiresAt: typeof current.expiresAt === 'number' ? current.expiresAt : null,
        grandfathered: current.grandfathered === true,
        source: current.source === 'promo' ? 'promo' : 'manual',
        productId: current.productId ?? null,
        environment: current.environment ?? null,
        store: current.store ?? null,
        willRenew: null,
      };
    }

    tx.set(
      ref,
      {
        plan: resolved.plan,
        expiresAt: resolved.expiresAt,
        grandfathered: resolved.grandfathered,
        source: resolved.source,
        productId: resolved.productId,
        environment: resolved.environment,
        store: resolved.store,
        willRenew: resolved.willRenew,
        ...bookkeeping,
      },
      { merge: true },
    );
    return resolved;
  });
}

/** RC 를 읽어 계산하고 반영까지. 호출자는 RevenueCatUnavailable 를 반드시 처리할 것. */
export async function reconcileFromRevenueCat(
  uid: string,
  apiKey: string,
  meta: ApplyMeta,
): Promise<ResolvedEntitlement> {
  const sub = await fetchSubscriber(uid, apiKey);
  const resolved = resolveEntitlement(sub, Date.now());
  return applyEntitlement(uid, resolved, meta);
}
