/**
 * 웹용 stub.
 * Metro 는 `.web.ts` 를 base `.ts` 보다 우선 로드 → 웹 빌드는 expo-notifications 를
 * 임포트하지 않고 이 파일이 채택됨. 웹은 native push 미지원이라 모든 함수 noop.
 */

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export function addNotificationResponseListener(
  _cb: (data: Record<string, unknown>) => void,
): () => void {
  return () => {};
}

export function addNotificationReceivedListener(
  _cb: (data: Record<string, unknown>) => void,
): () => void {
  return () => {};
}
