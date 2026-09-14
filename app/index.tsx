import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (user && user.role === 'merchant' && user.status !== 'active') {
      router.replace('/(auth)/pending-approval');
      return;
    }
    // 비로그인 사용자도 홈 진입 가능 (Apple 정책 5.1.1(v) — 계정 기반이 아닌 기능은 비회원도 접근 가능)
    router.replace('/(tabs)/home');
  }, [hydrated, user]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
