import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

/**
 * RevenueCat → Firestore entitlement 동기화 webhook.
 *
 * 진입: RC 대시보드에서 이 함수 URL 을 webhook 으로 등록.
 * 인증: RC 가 요청 header `Authorization: Bearer {secret}` 로 보내면 그 값을 검증.
 * 처리:
 *   - active 이벤트 (INITIAL_PURCHASE / RENEWAL / TRIAL_STARTED / TRIAL_CONVERTED /
 *     PRODUCT_CHANGE / UNCANCELLATION / NON_RENEWING_PURCHASE) → premium 부여
 *   - inactive 이벤트 (EXPIRATION / BILLING_ISSUE / SUBSCRIPTION_PAUSED) → 상태에 따라 유지 or 회수
 *   - CANCELLATION 은 auto-renew off 신호일 뿐 만료 시점까지 유지 → 무처리
 *   - 그 외 SUBSCRIBER_ALIAS / TEST 등은 무시
 *
 * app_user_id = Firebase Auth uid (앱 initPurchases 후 identifyPurchaseUser 호출 결과)
 * 도큐먼트 경로: users/{uid}/meta/entitlement
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
  type: RcEventType;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  environment?: 'PRODUCTION' | 'SANDBOX';
  period_type?: 'NORMAL' | 'TRIAL' | 'INTRO';
  store?: 'APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE' | 'MAC_APP_STORE' | 'PROMOTIONAL';
  entitlement_ids?: string[];
}

interface RcWebhookBody {
  event: RcEvent;
  api_version?: string;
}

const GRANT_EVENTS: RcEventType[] = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRIAL_STARTED',
  'TRIAL_CONVERTED',
  'NON_RENEWING_PURCHASE',
];

const REVOKE_EVENTS: RcEventType[] = [
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
  // BILLING_ISSUE 는 유예 기간 (grace period) 동안 유지되므로 여기서 즉시 회수 X.
  // 유예 후 EXPIRATION 이 별도로 오면 그때 회수.
];

const NOOP_EVENTS: RcEventType[] = [
  'CANCELLATION',           // auto-renew off — 만료 전까지 유지
  'BILLING_ISSUE',          // 유예 기간 — 만료 전까지 유지
  'TRIAL_CANCELLED',        // 트라이얼 취소 — TRIAL 만료 시 EXPIRATION 별도
  'SUBSCRIBER_ALIAS',       // 계정 병합 — 별도 로직 필요 시 확장
  'TRANSFER',               // 이관 — 별도 처리 필요
  'TEST',                   // 대시보드 테스트
];

export const revenuecatWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [RC_WEBHOOK_SECRET, SEED_ADMIN_SECRET],
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
      const seedBody = req.body as { action?: string; email?: string; password?: string; note?: string };
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
      return;
    }

    const body = req.body as RcWebhookBody | undefined;
    const event = body?.event;
    if (!event?.type) {
      res.status(400).send({ error: 'invalid-payload' });
      return;
    }

    const uid = event.app_user_id ?? event.original_app_user_id;
    if (!uid) {
      // TEST 이벤트 등은 uid 없이 오기도 함 — silent ok
      res.status(200).send({ ok: true, skipped: 'no-uid' });
      return;
    }

    // TEST 이벤트는 실제 사용자 데이터 갱신 없이 ok 반환 (RC 대시보드 검증용)
    if (event.type === 'TEST') {
      res.status(200).send({ ok: true, kind: 'test' });
      return;
    }

    const db = admin.firestore();
    const ref = db.doc(`users/${uid}/meta/entitlement`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const source = event.store === 'APP_STORE' || event.store === 'MAC_APP_STORE'
      ? 'apple'
      : 'google';

    try {
      if (GRANT_EVENTS.includes(event.type)) {
        const isLifetime = event.type === 'NON_RENEWING_PURCHASE';
        const expiresAt = isLifetime
          ? null
          : (typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null);

        await ref.set(
          {
            plan: 'premium',
            expiresAt,
            grandfathered: isLifetime,
            source,
            productId: event.product_id ?? null,
            periodType: event.period_type ?? null,
            lastEventType: event.type,
            lastEventAt: Date.now(),
            environment: event.environment ?? 'PRODUCTION',
            updatedAt: now,
          },
          { merge: true },
        );
        res.status(200).send({ ok: true, kind: 'granted', event: event.type });
        return;
      }

      if (REVOKE_EVENTS.includes(event.type)) {
        await ref.set(
          {
            plan: 'free',
            expiresAt: null,
            grandfathered: false,
            source: 'free',
            productId: null,
            periodType: null,
            lastEventType: event.type,
            lastEventAt: Date.now(),
            updatedAt: now,
          },
          { merge: true },
        );
        res.status(200).send({ ok: true, kind: 'revoked', event: event.type });
        return;
      }

      // 무처리 이벤트
      if (NOOP_EVENTS.includes(event.type)) {
        await ref.set(
          {
            lastEventType: event.type,
            lastEventAt: Date.now(),
            updatedAt: now,
          },
          { merge: true },
        );
        res.status(200).send({ ok: true, kind: 'noop', event: event.type });
        return;
      }

      // 알 수 없는 이벤트 타입 — 로그만 남기고 ok 반환 (RC 재시도 방지)
      console.warn('Unknown RC event type', event.type);
      res.status(200).send({ ok: true, kind: 'unknown', event: event.type });
    } catch (err) {
      console.error('revenuecatWebhook failed', err);
      // 5xx 반환 시 RC 가 재시도 (최대 몇 회) — 일시 오류엔 재시도 도움됨
      res.status(500).send({ error: 'internal', message: (err as Error).message });
    }
  },
);
