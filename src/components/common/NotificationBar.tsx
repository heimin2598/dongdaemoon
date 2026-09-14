import React, { useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Bell, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAppNotifications } from '@/lib/notifications';

/**
 * 홈 알림바 — 48h 이내 알림을 가로 marquee 로 표시.
 * 알림 없으면 null 반환.
 * 사용자가 우측 ChevronRight 누르면 가장 최신 알림 link 로 이동.
 * 텍스트 전체를 누르면 동일.
 */
export function NotificationBar() {
  const notifs = useAppNotifications();

  if (notifs.length === 0) return null;

  return (
    <Pressable
      style={styles.wrap}
      onPress={() => {
        const first = notifs[0];
        if (first?.link) router.push(first.link as any);
      }}
    >
      <View style={styles.iconBadge}>
        <Bell size={14} color={Colors.primary} strokeWidth={2.4} />
      </View>
      <View style={styles.marqueeArea}>
        <Marquee
          // 알림 사이 dot
          text={notifs.map((n) => `${n.emoji} ${n.text}`).join('   ·   ') + '   ·   '}
        />
      </View>
      {notifs.length > 1 && (
        <View style={styles.countPill}>
          <Text style={styles.countText}>{notifs.length}</Text>
        </View>
      )}
      <ChevronRight size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const SCREEN_W = Dimensions.get('window').width;

function Marquee({ text }: { text: string }) {
  const tx = useSharedValue(SCREEN_W);
  const [contentW, setContentW] = useState(0);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    if (contentW === 0 || containerW === 0) return;
    // 컨테이너 우측에서 시작 → 텍스트 끝이 좌측 밖으로 사라질 때까지
    tx.value = containerW;
    const distance = containerW + contentW;
    const speed = 40; // px/sec
    const durationMs = (distance / speed) * 1000;
    tx.value = withRepeat(
      withTiming(-contentW, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(tx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentW, containerW, text]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <View
      style={styles.marqueeContainer}
      onLayout={(e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.marqueeContent, animStyle]}
        onLayout={(e: LayoutChangeEvent) => setContentW(e.nativeEvent.layout.width)}
      >
        <Text style={styles.marqueeText} numberOfLines={1}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F0F4FB',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  marqueeArea: { flex: 1, overflow: 'hidden' },
  marqueeContainer: { width: '100%', overflow: 'hidden', height: 18 },
  marqueeContent: { flexDirection: 'row' },
  marqueeText: { fontSize: 12, color: Colors.text, fontWeight: '600', lineHeight: 18 },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    minWidth: 18,
    alignItems: 'center',
  },
  countText: { fontSize: 10, color: '#fff', fontWeight: '800' },
});
