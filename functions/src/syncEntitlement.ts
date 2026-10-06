import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  RC_API_KEY,
  RevenueCatUnavailable,
  isAnonymousAppUserId,
  reconcileFromRevenueCat,
} from './revenuecat';

/**
 * 내 entitlement 를 RevenueCat 기준으로 다시 계산 (사용자용 callable).
 *
 * 왜 필요한가 — webhook 하나로는 다음을 못 메운다:
 *  - **복원(restore)**: 새 트랜잭션이 아니라 RC 가 webhook 을 보내지 않는다.
 *    기기를 바꾸거나 재설치한 유료 회원이 영영 무료로 남던 경로다.
 *  - **webhook 실패/지연**: 결제는 됐는데 권한이 안 붙은 상태를 사용자가 스스로 풀 수 없다.
 *
 * 호출 지점: 결제 직후 확인, 복원 직후, MY/페이월에서 "결제 내역 다시 확인".
 */

if (!admin.apps.length) admin.initializeApp();

// RC REST 호출 남용 방지 — 이 간격 안에 다시 부르면 저장된 상태를 그대로 돌려준다.
const SYNC_COOLDOWN_MS = 5000;

export const syncEntitlement = onCall(
  { region: 'us-central1', secrets: [RC_API_KEY], cors: false },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (isAnonymousAppUserId(uid)) {
      throw new HttpsError('invalid-argument', '잘못된 계정입니다.');
    }

    const db = admin.firestore();
    const ref = db.doc(`users/${uid}/meta/entitlement`);

    const snap = await ref.get();
    const current = snap.exists ? snap.data() : undefined;
    const lastSyncAt = typeof current?.lastClientSyncAt === 'number' ? current.lastClientSyncAt : 0;
    if (Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) {
      return { entitlement: toClient(current), throttled: true };
    }

    const apiKey = RC_API_KEY.value();
    if (!apiKey) {
      console.error('[syncEntitlement] REVENUECAT_API_KEY is not configured');
      throw new HttpsError('failed-precondition', '결제 서버 설정이 완료되지 않았습니다.');
    }

    try {
      const resolved = await reconcileFromRevenueCat(uid, apiKey, { reason: 'client-sync' });
      await ref.set({ lastClientSyncAt: Date.now() }, { merge: true });
      return { entitlement: toClient(resolved), throttled: false };
    } catch (err) {
      if (err instanceof RevenueCatUnavailable) {
        // 조회 실패로 권한을 건드리면 안 된다 — 현재 상태를 유지한 채 재시도를 안내한다.
        console.error('[syncEntitlement] RevenueCat unavailable:', err.message);
        throw new HttpsError('unavailable', '결제 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      console.error('[syncEntitlement] failed', err);
      throw new HttpsError('internal', '처리 중 오류가 발생했습니다.');
    }
  },
);

function toClient(data: FirebaseFirestore.DocumentData | undefined) {
  return {
    plan: data?.plan ?? 'free',
    expiresAt: typeof data?.expiresAt === 'number' ? data.expiresAt : null,
    grandfathered: !!data?.grandfathered,
    source: data?.source ?? 'free',
    productId: data?.productId ?? null,
    environment: data?.environment ?? null,
  };
}
