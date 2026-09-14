/**
 * 사용자/매장 등에 부여하는 사람-가독 5자리 영숫자 ID.
 * 알파벳 0/O, 1/I, 1/l 같은 혼동 문자 제외 — 전화 안내·QR 표시에 안전.
 * 공간 ≈ 32^5 = 33,554,432. 충돌은 검증 외 컬렉션에서 무시 가능 수준.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShortId(length = 5): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
