/**
 * 어드민 멤버십은 Firestore `admins/{uid}` doc 으로 관리합니다.
 * 클라이언트 측 검사는 `useAdminsStore` 또는 `subscribeIsAdmin(uid, cb)` 를 사용하세요.
 *
 * 아래 ADMIN_EMAILS 는 Storage Rules 의 어드민 화이트리스트와만 동기화하기 위해 남아있습니다.
 * (Storage Rules 는 Firestore exists() 호출 불가 → 이메일 기반 체크 유지)
 *
 * 어드민 추가 절차:
 *  1. Firebase Console → Authentication → 신규 어드민의 UID 복사
 *  2. Firestore → admins/{uid} doc 추가 (email, displayName 필드)
 *  3. (배너 이미지 업로드 등 Storage 쓰기 필요하면) 이 파일 + storage.rules 의 이메일 화이트리스트에도 추가 후 재배포
 */
export const ADMIN_EMAILS: readonly string[] = ['heimin2598@gmail.com'];
