import * as Sentry from '@sentry/react-native';

// Sentry 가장 먼저 초기화 — Apple 심사에서 반복 반려된 launch crash 의 정확한 stack trace 캡쳐 목적.
// JS / Native (Swift) 양쪽 모두 자동 수집. enableNative=true (기본) 가 iOS Swift Concurrency 크래시도 잡음.
Sentry.init({
  dsn: 'https://66079cc6a7ecbbb12690bd11dc93896d@o4511399735787520.ingest.us.sentry.io/4511500038701056',
  enableNative: true,
  // production 환경에서만 활성화 — Expo Go / 개발 빌드 잡지 않음 (노이즈 회피)
  enabled: !__DEV__,
  tracesSampleRate: 0.1,
  attachStacktrace: true,
});

import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { initI18n } from '@/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useMemosStore } from '@/stores/memosStore';
import { useMapStore } from '@/stores/mapStore';
import { useBlocksStore } from '@/stores/blocksStore';
import { useAdminsStore } from '@/stores/adminsStore';
import { ensureEntitlementDoc } from '@/lib/entitlement';
import { ensureUserLookup, subscribeToProfile } from '@/lib/auth/firebaseAuth';
import {
  addNotificationResponseListener,
  registerForPushNotificationsAsync,
} from '@/lib/pushNotifications';
import {
  identifyPurchaseUser,
  initPurchases,
  logoutPurchaseUser,
} from '@/lib/purchases';
import { initAds } from '@/lib/ads';
import { Colors } from '@/constants/colors';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PendingCustomerRequestModal } from '@/components/common/PendingCustomerRequestModal';
import { AppUpdateGate } from '@/components/common/AppUpdateGate';

function useProtectedRoute() {
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    if (!hydrated) return;
    const segs: string[] = segments as unknown as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const onApprovalFlow =
      inAuthGroup && (segs[1] === 'pending-approval' || segs[1] === 'signup-match');

    if (!user) {
      // 비로그인 사용자도 앱을 둘러볼 수 있음 (Apple 정책 5.1.1(v) 준수).
      // 계정 기반 기능 (관심 매장, 메모, 메신저, 부자재 신청) 은 각 화면에서 별도 처리.
      // auth flow 내라면 그대로 두기 (사용자가 자발적으로 로그인 시도 중).
      return;
    }

    // 운영자에 의해 차단된 회원 → 즉시 로그아웃 + 안내
    if (user.disabled) {
      (async () => {
        try {
          await signOut();
        } catch {}
        router.replace('/(auth)/title');
        // 토스트/alert 없이 라우팅만 — 추가 안내가 필요하면 별도 화면 분리
      })();
      return;
    }

    const isMerchantPending = user.role === 'merchant' && user.status !== 'active';

    if (isMerchantPending) {
      if (!onApprovalFlow) router.replace('/(auth)/pending-approval');
    } else if (inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, user, segments, signOut]);
}

function RootLayoutInner() {
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
  }, []);

  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSearch = useSearchStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const hydrateMemos = useMemosStore((s) => s.hydrate);
  const hydrateMap = useMapStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const watchBlocks = useBlocksStore((s) => s.watch);
  const unwatchBlocks = useBlocksStore((s) => s.unwatch);
  const watchAdmin = useAdminsStore((s) => s.watch);
  const unwatchAdmin = useAdminsStore((s) => s.unwatch);

  useEffect(() => {
    hydrateAuth();
    hydrateSearch();
    hydrateFavorites();
    hydrateMemos();
    hydrateMap();
    // 네이티브 SDK 부트는 첫 프레임 이후로 미룬다.
    // iOS 26.5 에서 AdMob/RevenueCat 가 cold-start 에 ATTrackingManager·NSBundle XPC 를 동기 호출하면
    // 시스템 라이브러리(MCRestrictionManager) 가 crash 하는 케이스가 확인됨 (App Store 반려 1.0(3)).
    const task = InteractionManager.runAfterInteractions(() => {
      initPurchases().catch(() => {});
      initAds().catch(() => {});
    });
    return () => task.cancel?.();
  }, [hydrateAuth, hydrateSearch, hydrateFavorites, hydrateMemos, hydrateMap]);

  // 로그인된 경우 차단 목록 + 어드민 멤버십 구독 + 트라이얼 entitlement 보장 + 푸시 토큰 등록
  useEffect(() => {
    if (user) {
      watchBlocks();
      watchAdmin(user.id);
      ensureEntitlementDoc(user.id).catch((e) => {
        console.error('ensureEntitlementDoc failed:', e);
      });
      // 푸시 토큰 발급 + Firestore 저장 (권한 거부/시뮬레이터/웹은 silent skip)
      registerForPushNotificationsAsync().catch((e) => {
        console.error('registerForPushNotificationsAsync failed:', e);
      });
      // userLookup 보장 — 이미 가입자 중 lookup doc 없는 경우를 위한 backfill
      ensureUserLookup(user.id, user.shortId, user.displayName ?? null).catch(() => {});
      // RevenueCat user identify — 같은 계정의 구매 이력이 기기 간 동기화되도록.
      // initPurchases 와 같은 interaction 창에서 돌린다. (cold-start 동기 호출 crash 회피 — 위 주석 참고)
      // identifyPurchaseUser 내부에서 init 완료를 await 하므로 두 호출의 순서는 상관없다.
      const idTask = InteractionManager.runAfterInteractions(() => {
        identifyPurchaseUser(user.id).then((ok) => {
          if (!ok) {
            // 실패해도 부팅은 막지 않는다. 결제 직전에 다시 시도하고, 그때도 실패하면 결제를 중단시킨다.
            console.error('[boot] RevenueCat identify failed for', user.id);
          }
        });
      });
      return () => idTask.cancel?.();
    } else {
      unwatchBlocks();
      unwatchAdmin();
      logoutPurchaseUser().catch(() => {});
    }
  }, [user, watchBlocks, unwatchBlocks, watchAdmin, unwatchAdmin]);

  // 본인 프로필 실시간 구독 — 운영자가 차단하면 즉시 반영
  const refreshUser = useAuthStore((s) => s.refreshUser);
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToProfile(user.id, (p) => {
      if (!p) return;
      // disabled / status 등이 바뀌면 authStore 의 user 도 새로고침 — useProtectedRoute 가 가드
      if (p.disabled !== !!user.disabled || p.status !== user.status) {
        refreshUser().catch(() => {});
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 알림 탭(터치) → 라우팅. data.route 가 있으면 그 경로로 이동.
  useEffect(() => {
    const off = addNotificationResponseListener((data) => {
      const target = typeof data.route === 'string' ? data.route : null;
      if (target) router.push(target as any);
    });
    return off;
  }, []);

  useProtectedRoute();

  if (!i18nReady) {
    // i18n init 전에 화면 렌더 차단 — 깜빡임 방지
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
            }}
          />
          <PendingCustomerRequestModal />
          <AppUpdateGate />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayoutInner);
