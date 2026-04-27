import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useMapStore } from '@/stores/mapStore';

/**
 * 지도 탭 — 탭이 포커스될 때마다 지도 화면으로 전환한다.
 * 동/층은 마지막 선택 유지, 방향은 항상 "세로"로 리셋.
 * 탭바는 map-building 경로에서는 보이지 않는다.
 */
export default function MapTab() {
  const setOrientation = useMapStore((s) => s.setOrientation);

  useFocusEffect(
    React.useCallback(() => {
      setOrientation('portrait');
      router.replace('/map-building');
    }, [setOrientation]),
  );

  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
