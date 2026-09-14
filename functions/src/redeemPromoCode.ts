import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * 프로모션 코드 사용 (사용자용 callable).
 *
 * 흐름:
 *   1) 사용자 인증 확인 (Firebase Auth token)
 *   2) 코드 정규화 (하이픈 제거, 대문자, 16자리 검증)
 *   3) 일일 시도 횟수 체크 (5회 초과 시 거부)
 *   4) 코드 조회 → 존재 X or 이미 사용됨 → 실패 (시도 카운트 +1)
 *   5) 유효 → 트랜잭션: 코드 usedBy 기록 + entitlement grandfathered=true 부여
 *   6) 성공 응답
 *
 * 반환:
 *   { ok: true } — 코드 유효, 프리미엄 부여됨
 *   throws HttpsError('resource-exhausted') — 일일 5회 초과
 *   throws HttpsError('not-found') — 코드 없음/사용됨
 *   throws HttpsError('invalid-argument') — 코드 포맷 오류
 *   throws HttpsError('failed-precondition') — 이미 프리미엄
 */

if (!admin.apps.length) admin.initializeApp();

const MAX_ATTEMPTS_PER_DAY = 5;

function todayKey(): string {
  // YYYY-MM-DD (UTC) — 시간대 무관하게 자정 단위 롤오버
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 코드 정규화 — 하이픈/공백 제거, 대문자, 16자리 알파벳+숫자만 허용. */
function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cleaned)) return null;
  return cleaned;
}

interface RedeemInput {
  code?: unknown;
}

export const redeemPromoCode = onCall<RedeemInput>(
  {
    region: 'us-central1',
    cors: false,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const code = normalizeCode(request.data?.code);
    // 포맷 자체가 틀리면 시도 카운트에도 넣지 않음 — 실수/오타 방지
    if (!code) {
      throw new HttpsError('invalid-argument', '코드 형식이 올바르지 않습니다. (알파벳/숫자 16자리)');
    }

    const db = admin.firestore();
    const attemptsRef = db.doc(`users/${uid}/meta/promoAttempts`);
    const codeRef = db.doc(`promoCodes/${code}`);
    const entRef = db.doc(`users/${uid}/meta/entitlement`);

    // 일일 시도 횟수 사전 체크 (트랜잭션 밖에서 빠른 거부)
    const attemptsSnap = await attemptsRef.get();
    const today = todayKey();
    const attemptsData = attemptsSnap.exists ? (attemptsSnap.data() as { date?: string; count?: number }) : null;
    const currentCount = attemptsData?.date === today ? (attemptsData.count ?? 0) : 0;
    if (currentCount >= MAX_ATTEMPTS_PER_DAY) {
      throw new HttpsError('resource-exhausted', `하루에 ${MAX_ATTEMPTS_PER_DAY}회까지만 시도 가능합니다. 내일 다시 시도해 주세요.`);
    }

    // 이미 프리미엄이면 거부 (시도는 카운트하지 않음)
    const entSnap = await entRef.get();
    if (entSnap.exists) {
      const e = entSnap.data() as { plan?: string; grandfathered?: boolean; expiresAt?: number | null };
      const activeGrandfather = e.plan === 'premium' && e.grandfathered === true;
      const activeTimed = e.plan === 'premium' && typeof e.expiresAt === 'number' && e.expiresAt > Date.now();
      if (activeGrandfather || activeTimed) {
        throw new HttpsError('failed-precondition', '이미 프리미엄 회원입니다.');
      }
    }

    // 트랜잭션 — 코드 유효성 + 사용 처리 + entitlement 부여를 원자적으로.
    try {
      await db.runTransaction(async (tx) => {
        const codeSnap = await tx.get(codeRef);
        const attemptsSnap2 = await tx.get(attemptsRef);
        const attemptsData2 = attemptsSnap2.exists ? (attemptsSnap2.data() as { date?: string; count?: number }) : null;
        const currentCount2 = attemptsData2?.date === today ? (attemptsData2.count ?? 0) : 0;
        if (currentCount2 >= MAX_ATTEMPTS_PER_DAY) {
          throw new HttpsError('resource-exhausted', `하루에 ${MAX_ATTEMPTS_PER_DAY}회까지만 시도 가능합니다.`);
        }

        // 코드 검증
        const codeData = codeSnap.exists ? (codeSnap.data() as { usedBy?: string; usedAt?: unknown }) : null;
        const codeInvalidOrUsed = !codeSnap.exists || !!codeData?.usedBy;
        if (codeInvalidOrUsed) {
          // 시도 카운트 +1 (틀린 시도도 카운트)
          tx.set(
            attemptsRef,
            { date: today, count: currentCount2 + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true },
          );
          throw new HttpsError('not-found', '유효하지 않은 코드입니다.');
        }

        // 코드 사용 처리
        tx.update(codeRef, {
          usedBy: uid,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // entitlement 영구 부여
        tx.set(
          entRef,
          {
            plan: 'premium',
            expiresAt: null,
            grandfathered: true,
            source: 'promo',
            productId: null,
            periodType: null,
            lastEventType: 'PROMO_REDEEM',
            lastEventAt: Date.now(),
            promoCode: code,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        // 성공 시에도 시도 카운트 증가 (남용 방지 일관성)
        tx.set(
          attemptsRef,
          { date: today, count: currentCount2 + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('redeemPromoCode transaction failed', err);
      throw new HttpsError('internal', '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    return { ok: true };
  },
);
