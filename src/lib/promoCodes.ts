import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';

/**
 * 프로모션 코드 클라이언트 API.
 *  - 사용자: `redeemPromoCode({ code })` — Cloud Function 호출
 *  - 운영자: 생성 / 목록 조회 / 삭제 — Firestore 직접 (firestore.rules 로 admin 만 허용)
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리기 쉬운 문자 제외 (I, O, 0, 1)

export const PROMO_CODE_LENGTH = 16;
export const PROMO_CODE_FORMATTED_LENGTH = PROMO_CODE_LENGTH + 3; // 하이픈 3개 포함

/** 코드 정규화 — 하이픈/공백 제거, 대문자, 16자리 검증. 유효하지 않으면 null. */
export function normalizePromoCode(raw: string): string | null {
  const cleaned = raw.replace(/[-\s]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cleaned)) return null;
  return cleaned;
}

/** 4자리씩 하이픈 삽입해서 표시용 포맷. */
export function formatPromoCode(raw: string): string {
  const cleaned = raw.replace(/[-\s]/g, '').toUpperCase().slice(0, PROMO_CODE_LENGTH);
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }
  return groups.join('-');
}

/** 새 랜덤 코드 생성 (16자, 32자 알파벳 기반). */
export function generateRandomPromoCode(): string {
  let out = '';
  const buf = new Uint8Array(PROMO_CODE_LENGTH);
  // 브라우저/RN 양쪽에서 안전한 randomness
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < PROMO_CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return out;
}

// ─────────────────────────────────────────────────────
// 사용자용 — Cloud Function 통해서만 사용 (직접 read 차단)
// ─────────────────────────────────────────────────────

export interface RedeemResult {
  ok: true;
}

export type RedeemErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'not-found'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'internal';

export interface RedeemError {
  code: RedeemErrorCode;
  message: string;
}

/** 사용자가 코드 입력 후 호출. 성공 시 서버가 entitlement 자동 부여. */
export async function redeemPromoCode(code: string): Promise<RedeemResult> {
  const normalized = normalizePromoCode(code);
  if (!normalized) {
    throw { code: 'invalid-argument', message: '코드 형식이 올바르지 않습니다. (알파벳/숫자 16자리)' } as RedeemError;
  }
  try {
    const callable = httpsCallable<{ code: string }, RedeemResult>(functions, 'redeemPromoCode');
    const result = await callable({ code: normalized });
    return result.data;
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; details?: { code?: string } };
    // Firebase Functions callable 에러: err.code = 'functions/{httpsErrorCode}'
    const rawCode = (err?.code ?? '').replace(/^functions\//, '');
    const known: RedeemErrorCode[] = [
      'unauthenticated',
      'invalid-argument',
      'not-found',
      'resource-exhausted',
      'failed-precondition',
    ];
    const code2 = known.includes(rawCode as RedeemErrorCode) ? (rawCode as RedeemErrorCode) : 'internal';
    throw { code: code2, message: err?.message ?? '알 수 없는 오류' } as RedeemError;
  }
}

/**
 * 본인의 오늘 시도 횟수 (남은 횟수 UI 표시용).
 * 문서 없거나 오늘 자 아니면 0 반환.
 */
export async function getTodayPromoAttemptCount(uid: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'promoAttempts'));
    if (!snap.exists()) return 0;
    const data = snap.data() as { date?: string; count?: number };
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const todayKey = `${yyyy}-${mm}-${dd}`;
    if (data.date !== todayKey) return 0;
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────
// 운영자용 — Firestore 직접 (firestore.rules: admin 만 허용)
// ─────────────────────────────────────────────────────

export interface PromoCode {
  code: string;
  usedBy: string | null;
  usedAt: number | null;
  createdAt: number | null;
  createdBy: string;
  note: string;
}

interface PromoCodeDoc {
  usedBy?: string | null;
  usedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  createdBy?: string;
  note?: string;
}

/** 랜덤 코드 자동 생성해서 저장. 반환 = 저장된 코드 (하이픈 없는 원본). */
export async function adminCreatePromoCode(input: {
  createdBy: string;
  note?: string;
}): Promise<string> {
  // 중복 방지: 최대 5회까지 재시도 (실질 충돌 확률 거의 0)
  for (let i = 0; i < 5; i += 1) {
    const code = generateRandomPromoCode();
    const ref = doc(db, 'promoCodes', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, {
      usedBy: null,
      usedAt: null,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy,
      note: input.note ?? '',
    });
    return code;
  }
  throw new Error('코드 중복 회피 실패 — 다시 시도해 주세요.');
}

/** 특정 코드 수동 등록 (임의 문자열). */
export async function adminSetPromoCode(input: {
  code: string;
  createdBy: string;
  note?: string;
}): Promise<string> {
  const normalized = normalizePromoCode(input.code);
  if (!normalized) throw new Error('코드 형식 오류 — 알파벳/숫자 16자리여야 합니다.');
  const ref = doc(db, 'promoCodes', normalized);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('이미 존재하는 코드입니다.');
  await setDoc(ref, {
    usedBy: null,
    usedAt: null,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    note: input.note ?? '',
  });
  return normalized;
}

/** 전체 코드 목록 (최신순, 관리자 전용). */
export async function adminListPromoCodes(): Promise<PromoCode[]> {
  const q = query(collection(db, 'promoCodes'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as PromoCodeDoc;
    return {
      code: d.id,
      usedBy: data.usedBy ?? null,
      usedAt: data.usedAt?.toMillis?.() ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      createdBy: data.createdBy ?? '',
      note: data.note ?? '',
    };
  });
}

/** 미사용 코드 삭제 (사용된 코드는 감사 로그로 남김). */
export async function adminDeletePromoCode(code: string): Promise<void> {
  const normalized = normalizePromoCode(code);
  if (!normalized) throw new Error('코드 형식 오류');
  const ref = doc(db, 'promoCodes', normalized);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('존재하지 않는 코드');
  const data = snap.data() as PromoCodeDoc;
  if (data.usedBy) throw new Error('이미 사용된 코드는 삭제할 수 없습니다.');
  await deleteDoc(ref);
}

