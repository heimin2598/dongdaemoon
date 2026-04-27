/**
 * 소셜 로그인용 OAuth Client ID.
 * 이 값들은 클라이언트에 노출되어도 안전한 공개 식별자이며, 보안은 Firebase 보안 규칙과
 * 승인된 도메인 / 번들 ID 검증에 의해 유지된다.
 *
 * - WEB_CLIENT_ID: Firebase Console이 자동 생성하는 OAuth 2.0 Web 클라이언트 ID
 *                   (웹 브라우저 + Expo Go 양쪽 모두에서 사용)
 * - IOS_CLIENT_ID / ANDROID_CLIENT_ID: 네이티브 EAS Build로 출시할 때 추가 (현재는 미사용)
 */
export const GOOGLE_WEB_CLIENT_ID =
  '387030473505-j6u3q7b7cekjfgh4oqjevbvusocc59rp.apps.googleusercontent.com';

export const GOOGLE_IOS_CLIENT_ID: string | undefined = undefined;
export const GOOGLE_ANDROID_CLIENT_ID: string | undefined = undefined;
