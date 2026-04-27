import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export type AppleAuthOutcome =
  | { kind: 'idToken'; idToken: string; rawNonce: string }
  | { kind: 'webPopup' } // 웹은 Firebase signInWithPopup으로 처리
  | { kind: 'cancelled' }
  | { kind: 'unsupported' };

/**
 * Apple 로그인 가용성 + 트리거.
 *
 * - iOS: AppleAuthentication.isAvailableAsync()로 사용 가능 여부 확인 → signInAsync로 idToken 획득
 * - 웹: signInWithPopup 사용 (Firebase Console에 Apple Service ID 등록되어 있을 때만 동작)
 * - Android: 미지원 (Apple 정책)
 */
export function useAppleAuth() {
  const [available, setAvailable] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const promptAppleSignIn = useCallback(async (): Promise<AppleAuthOutcome> => {
    if (Platform.OS === 'web') return { kind: 'webPopup' };
    if (Platform.OS !== 'ios') return { kind: 'unsupported' };

    try {
      // 재전송 방지를 위한 nonce — Firebase는 서버에서 hashedNonce를 검증
      const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return { kind: 'cancelled' };
      }

      return { kind: 'idToken', idToken: credential.identityToken, rawNonce };
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return { kind: 'cancelled' };
      }
      throw e;
    }
  }, []);

  return { promptAppleSignIn, available };
}
