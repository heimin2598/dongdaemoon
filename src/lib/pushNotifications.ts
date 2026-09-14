import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/**
 * 푸시 알림 인프라.
 *
 * Expo Go(SDK 53+)는 push notifications native 코드가 제거됨 — `expo-notifications`
 * 를 import 만 해도 에러/경고가 출력되므로 dev/standalone build 에서만 require 로 lazy 로딩.
 *
 * 서버 발송은 Cloud Functions + Expo Push Service (또는 FCM 직접) 별도 구현 필요.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';
const canUseNotifications = !isExpoGo && !isWeb;

type NotificationsModule = typeof import('expo-notifications');

let _notifications: NotificationsModule | null = null;
function loadNotifications(): NotificationsModule | null {
  if (!canUseNotifications) return null;
  if (_notifications) return _notifications;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _notifications = require('expo-notifications') as NotificationsModule;
  // 포그라운드 알림 표시 동작 — 알림 도착 시 배너/사운드/배지 모두 ON
  _notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  return _notifications;
}

interface SaveTokenInput {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

async function saveTokenToFirestore(uid: string, input: SaveTokenInput): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'meta', 'pushToken'),
    {
      token: input.token,
      platform: input.platform,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * 권한 요청 + 토큰 발급 + Firestore 저장.
 * 로그인 후 호출. Expo Go / 웹 / 시뮬레이터 / 권한 거부는 silent skip.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Device = require('expo-device') as typeof import('expo-device');
  if (!Device.isDevice) return null;

  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0B2E5A',
    });
  }

  const existingPerm = await Notifications.getPermissionsAsync();
  let granted = existingPerm.granted;
  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.granted;
  }
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    await saveTokenToFirestore(uid, {
      token,
      platform: Platform.OS as 'ios' | 'android',
    });
    return token;
  } catch (e) {
    console.error('getExpoPushTokenAsync failed:', e);
    return null;
  }
}

/**
 * 사용자가 알림을 탭(터치)해서 앱이 열렸을 때 호출되는 핸들러.
 */
export function addNotificationResponseListener(
  cb: (data: Record<string, unknown>) => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    cb(data);
  });
  return () => sub.remove();
}

/**
 * 포그라운드 상태에서 알림이 새로 도착했을 때 호출.
 */
export function addNotificationReceivedListener(
  cb: (data: Record<string, unknown>) => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationReceivedListener((notif) => {
    const data = notif.request.content.data ?? {};
    cb(data);
  });
  return () => sub.remove();
}
