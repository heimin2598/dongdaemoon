import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@/constants/auth';

// 모듈 로드 시점에 1회만 실행 — OAuth 콜백 처리 활성화
WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthOutcome =
  | { kind: 'idToken'; idToken: string }
  | { kind: 'webPopup' } // 웹은 별도 idToken 없이 Firebase signInWithPopup으로 처리
  | { kind: 'cancelled' };

/**
 * Google 로그인 OAuth 흐름 트리거.
 * - 웹: 'webPopup'을 반환 → 호출자가 firebaseAuth.signInWithGoogle()을 idToken 없이 호출 (Firebase popup)
 * - 네이티브: expo-auth-session으로 idToken을 받아 반환 → 호출자가 idToken과 함께 호출
 *
 * 사용:
 *   const { promptGoogleSignIn, request } = useGoogleAuth();
 *   const outcome = await promptGoogleSignIn();
 *   if (outcome.kind === 'idToken') await signInGoogle('visitor', outcome.idToken);
 *   else if (outcome.kind === 'webPopup') await signInGoogle('visitor');
 */
export function useGoogleAuth() {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  const promptGoogleSignIn = useCallback(async (): Promise<GoogleAuthOutcome> => {
    if (Platform.OS === 'web') {
      return { kind: 'webPopup' };
    }
    const result = await promptAsync();
    if (!result || result.type !== 'success' || !result.params?.id_token) {
      return { kind: 'cancelled' };
    }
    return { kind: 'idToken', idToken: result.params.id_token };
  }, [promptAsync]);

  return { promptGoogleSignIn, request };
}
