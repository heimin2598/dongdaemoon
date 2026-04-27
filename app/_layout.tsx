import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useMemosStore } from '@/stores/memosStore';
import { useMapStore } from '@/stores/mapStore';
import { Colors } from '@/constants/colors';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function useProtectedRoute() {
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onPendingScreen = inAuthGroup && segments[1] === 'pending-approval';

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/title');
      return;
    }

    const isMerchantPending = user.role === 'merchant' && user.status !== 'active';

    if (isMerchantPending) {
      if (!onPendingScreen) router.replace('/(auth)/pending-approval');
    } else if (inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, user, segments]);
}

export default function RootLayout() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSearch = useSearchStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const hydrateMemos = useMemosStore((s) => s.hydrate);
  const hydrateMap = useMapStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateSearch();
    hydrateFavorites();
    hydrateMemos();
    hydrateMap();
  }, [hydrateAuth, hydrateSearch, hydrateFavorites, hydrateMemos, hydrateMap]);

  useProtectedRoute();

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
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
