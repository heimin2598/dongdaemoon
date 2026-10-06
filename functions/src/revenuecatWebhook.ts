import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import {
  ApplyMeta,
  RC_API_KEY,
  ResolvedEntitlement,
  RevenueCatUnavailable,
  applyEntitlement,
  isAnonymousAppUserId,
  reconcileFromRevenueCat,
} from './revenuecat';

/**
 * RevenueCat → Firestore entitlement 동기화 webhook.
 *
 * 진입: RC 대시보드에서 이 함수 URL 을 webhook 으로 등록.
 * 인증: RC 가 요청 header `Authorization: Bearer {secret}` 로 보내면 그 값을 검증.
 *
 * 설계 — **이벤트는 신호, 상태는 RC REST 가 진실.**
 *   payload 로 바로 쓰면 이벤트 순서 역전(상품 변경 시 구 상품 EXPIRATION 이 뒤늦게 도착),
 *   중복 전달, 만료일 누락 payload 에 그대로 당한다. 그래서 어떤 이벤트가 오든
 *   `GET /v1/subscribers/{uid}` 로 현재 상태를 되읽어 재계산한다. 자연히 멱등해진다.
 *
 * app_user_id = Firebase Auth uid (앱 identifyPurchaseUser 결과)
 * 도큐먼트 경로: users/{uid}/meta/entitlement
 * 이벤트 이력: users/{uid}/subscriptionEvents/{eventId}
 */

// RC 대시보드에서 설정한 인증 헤더 값 — Firebase Secret Manager 에 저장.
// 배포 전: `firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET`
const RC_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');
const SEED_ADMIN_SECRET = defineSecret('SEED_ADMIN_SECRET');

if (!admin.apps.length) admin.initializeApp();

type RcEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'TRIAL_STARTED'
  | 'TRIAL_CONVERTED'
  | 'TRIAL_CANCELLED'
  | 'SUBSCRIPTION_PAUSED'
  | 'NON_RENEWING_PURCHASE'
  | 'TRANSFER'
  | 'SUBSCRIBER_ALIAS'
  | 'TEST';

interface RcEvent {
  id?: string;
  type: RcEventType;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
  environment?: 'PRODUCTION' | 'SANDBOX';
  period_type?: 'NORMAL' | 'TRIAL' | 'INTRO';
  store?: 'APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE' | 'MAC_APP_STORE' | 'PROMOTIONAL';
  entitlement_ids?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
}

interface RcWebhookBody {
  event: RcEvent;
  api_version?: string;
}

/** 재계산이 필요한 이벤트. 나머지는 이력만 남긴다. */
const RECONCILE_EVENTS: RcEventType[] = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRIAL_STARTED',
  'TRIAL_CONVERTED',
  'NON_RENEWING_PURCHASE',
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
  'BILLING_ISSUE',
  'CANCELLATION',
  'TRIAL_CANCELLED',
  'TRANSFER',
];

export const revenuecatWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [RC_WEBHOOK_SECRET, SEED_ADMIN_SECRET, RC_API_KEY],
    cors: false,
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send({ error: 'method-not-allowed' });
      return;
    }

    // 인증 헤더 검증 — RC 대시보드 webhook 설정에서 Authorization 값을 지정.
    const authHeader = req.get('authorization') ?? '';
    const rcExpected = `Bearer ${RC_WEBHOOK_SECRET.value()}`;
    const seedExpected = `Bearer ${SEED_ADMIN_SECRET.value()}`;
    const isRc = authHeader === rcExpected;
    const isSeed = authHeader === seedExpected;
    if (!isRc && !isSeed) {
      res.status(401).send({ error: 'unauthorized' });
      return;
    }

    // 시드 모드 — 관리자 계정 seed action 처리 (RC 이벤트 아님)
    if (isSeed) {
      await handleSeed(req, res);
      return;
    }

    const body = req.body as RcWebhookBody | undefined;
    const event = body?.event;
    if (!event?.type) {
      res.status(400).send({ error: 'invalid-payload' });
      return;
    }

    // TEST 이벤트는 실제 사용자 데이터 갱신 없이 ok 반환 (RC 대시보드 검증용)
    if (event.type === 'TEST') {
      res.status(200).send({ ok: true, kind: 'test' });
      return;
    }

    const uid = event.app_user_id ?? event.original_app_user_id;
    if (!uid) {
      res.status(200).send({ ok: true, skipped: 'no-uid' });
      return;
    }

    const db = admin.firestore();

    // 익명 ID 로 들어온 결제 = 앱에서 RC 신원이 Firebase uid 로 안 맞은 채 결제된 것.
    // 사용자 문서에 쓰면 안 되고(엉뚱한 경로), 버려도 안 된다(돈은 빠졌다).
    // 운영자가 찾아서 수동 연결할 수 있게 격리 보관한다.
    if (isAnonymousAppUserId(uid)) {
      console.error('[rc-webhook] anonymous app_user_id — orphan purchase', uid, event.type);
      await db
        .doc(`orphanPurchases/${event.id ?? `${uid}_${event.event_timestamp_ms ?? Date.now()}`}`)
        .set(
          {
            appUserId: uid,
            eventType: event.type,
            productId: event.product_id ?? null,
            store: event.store ?? null,
            environment: event.environment ?? null,
            purchasedAtMs: event.purchased_at_ms ?? null,
            eventAtMs: event.event_timestamp_ms ?? Date.now(),
            resolved: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      res.status(200).send({ ok: true, kind: 'orphan' });
      return;
    }

    const eventAtMs = event.event_timestamp_ms ?? Date.now();
    const eventId = event.id ?? `${event.type}_${eventAtMs}`;

    try {
      // 이력 적재 — doc id 를 RC event id 로 두어 중복 전달이 덮어쓰기로 수렴한다.
      // "누가 언제 무엇을 결제/해지했는가" 를 외부 콘솔 없이 답하기 위한 기록이기도 하다.
      await db.doc(`users/${uid}/subscriptionEvents/${eventId}`).set(
        {
          type: event.type,
          productId: event.product_id ?? null,
          store: event.store ?? null,
          environment: event.environment ?? null,
          periodType: event.period_type ?? null,
          expirationAtMs: event.expiration_at_ms ?? null,
          purchasedAtMs: event.purchased_at_ms ?? null,
          eventAtMs,
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      if (!RECONCILE_EVENTS.includes(event.type)) {
        // SUBSCRIBER_ALIAS 등 — 이력만 남기고 상태는 건드리지 않는다.
        res.status(200).send({ ok: true, kind: 'logged', event: event.type });
        return;
      }

      const meta: ApplyMeta = {
        reason: 'webhook',
        eventType: event.type,
        eventId,
        eventAtMs,
      };

      const apiKey = RC_API_KEY.value();
      if (!apiKey) {
        // 키 미설정이면 RC 를 못 읽는다. 조용히 payload 로 쓰지 말고 알린다.
        console.error('[rc-webhook] REVENUECAT_API_KEY missing — falling back to payload');
        const fallback = resolveFromPayload(event);
        if (!fallback) {
          res.status(500).send({ error: 'no-api-key-and-unsafe-payload' });
          return;
        }
        const saved = await applyEntitlement(uid, fallback, meta);
        res.status(200).send({ ok: true, kind: 'fallback', plan: saved.plan });
        return;
      }

      const saved = await reconcileFromRevenueCat(uid, apiKey, meta);
      res.status(200).send({ ok: true, kind: 'reconciled', event: event.type, plan: saved.plan });
    } catch (err) {
      if (err instanceof RevenueCatUnavailable) {
        // 상태를 모르는 채로 권한을 바꾸지 않는다. 5xx 로 RC 재시도를 유도한다.
        console.error('[rc-webhook] RevenueCat unavailable:', err.message);
        res.status(503).send({ error: 'revenuecat-unavailable' });
        return;
      }
      console.error('revenuecatWebhook failed', err);
      res.status(500).send({ error: 'internal', message: (err as Error).message });
    }
  },
);

/**
 * RC REST 를 못 쓸 때의 보수적 fallback.
 * **확실히 부여해도 되는 경우만** 값을 돌려주고, 애매하면 null → 재시도에 맡긴다.
 * (만료일 없는 구독을 영구 권한으로 올리던 과거 동작을 여기서 끊는다)
 */
function resolveFromPayload(event: RcEvent): ResolvedEntitlement | null {
  const source =
    event.store === 'APP_STORE' || event.store === 'MAC_APP_STORE' ? 'apple' : 'google';
  const environment = event.environment ?? 'PRODUCTION';
  const expiresAt = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;

  if (event.type === 'NON_RENEWING_PURCHASE' && event.product_id === 'premium_lifetime') {
    return {
      plan: 'premium',
      expiresAt: null,
      grandfathered: true,
      source,
      productId: event.product_id,
      environment,
      store: event.store ?? null,
      willRenew: false,
    };
  }
  if (expiresAt !== null && expiresAt > Date.now()) {
    return {
      plan: 'premium',
      expiresAt,
      grandfathered: false,
      source,
      productId: event.product_id ?? null,
      environment,
      store: event.store ?? null,
      willRenew: null,
    };
  }
  // 만료/취소 계열은 RC 확인 없이 회수하지 않는다 — 상품 변경 중 구 상품 만료일 수 있다.
  return null;
}

async function handleSeed(
  req: { body: unknown },
  res: { status: (c: number) => { send: (b: unknown) => void } },
): Promise<void> {
  const seedBody = req.body as {
    action?: string;
    email?: string;
    password?: string;
    note?: string;
  };
  if (seedBody?.action !== 'seed-admin' || !seedBody.email || !seedBody.password) {
    res.status(400).send({ error: 'invalid-seed-payload' });
    return;
  }
  try {
    let uid: string;
    let created = false;
    try {
      const existing = await admin.auth().getUserByEmail(seedBody.email);
      uid = existing.uid;
    } catch (err) {
      const c = (err as { code?: string }).code ?? '';
      if (c === 'auth/user-not-found') {
        const nu = await admin.auth().createUser({
          email: seedBody.email,
          password: seedBody.password,
          emailVerified: true,
        });
        uid = nu.uid;
        created = true;
      } else {
        throw err;
      }
    }
    await admin
      .firestore()
      .doc(`admins/${uid}`)
      .set(
        {
          email: seedBody.email,
          note: seedBody.note ?? '',
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    res.status(200).send({ ok: true, uid, created });
  } catch (err) {
    console.error('seed-admin failed', err);
    const e = err as { code?: string; message?: string };
    res.status(500).send({ error: 'seed-internal', code: e.code ?? '', message: e.message ?? '' });
  }
}
