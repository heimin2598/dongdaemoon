/**
 * 앱 내 QR 코드 페이로드 표준.
 *
 * QR 의 raw 값은 단일 라인 JSON. 두 종류:
 *   - user: { t: 'u', i: '<uid>', s: '<shortId>' }
 *   - shop: { t: 's', i: '<shopId>', s: '<shortId>' }
 *
 * 짧게 인코딩하기 위해 `type/id/shortId` 대신 `t/i/s` 키 사용.
 */

export type QrPayloadKind = 'u' | 's';

export interface QrUserPayload {
  t: 'u';
  i: string;       // uid
  s?: string;      // shortId
  n?: string;      // displayName (캐시; QR 생성 시점 값)
}

export interface QrShopPayload {
  t: 's';
  i: string;       // shopId
  s?: string;      // shortId
  n?: string;      // displayName (매장명; QR 생성 시점 값)
  c?: string;      // storeCode (대표 코드)
}

export type QrPayload = QrUserPayload | QrShopPayload;

export function encodeUserQr(uid: string, shortId?: string, name?: string): string {
  const p: QrUserPayload = { t: 'u', i: uid };
  if (shortId) p.s = shortId;
  if (name) p.n = name;
  return JSON.stringify(p);
}

export function encodeShopQr(
  shopId: string,
  shortId?: string,
  name?: string,
  storeCode?: string,
): string {
  const p: QrShopPayload = { t: 's', i: shopId };
  if (shortId) p.s = shortId;
  if (name) p.n = name;
  if (storeCode) p.c = storeCode;
  return JSON.stringify(p);
}

export function decodeQr(raw: string): QrPayload | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && typeof obj.i === 'string') {
      if (obj.t === 'u' || obj.t === 's') {
        return obj as QrPayload;
      }
    }
  } catch {
    // 디코드 실패 시 일반 텍스트로 취급
  }
  return null;
}
