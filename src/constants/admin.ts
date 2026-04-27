/**
 * 어드민 이메일 화이트리스트.
 * 이 목록의 이메일로 로그인한 사용자에게만 어드민 메뉴가 노출되고,
 * Firestore 보안 규칙도 같은 이메일을 어드민으로 인식하도록 설정해야 한다.
 *
 * 추후 어드민이 늘어나면 여기와 보안 규칙 양쪽에 같은 이메일을 추가한다.
 */
export const ADMIN_EMAILS: readonly string[] = ['heimin2598@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
