import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/(auth)/title');
      return;
    }
    if (user.role === 'merchant' && user.status !== 'active') {
      router.replace('/(auth)/pending-approval');
      return;
    }
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
