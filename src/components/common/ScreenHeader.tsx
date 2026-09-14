import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** 뒤로가기 동작 재정의 (예: 광고 호출 후 router.back). 미지정 시 기본 동작. */
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = true, onBack, rightSlot }: Props) {
  const defaultBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={onBack ?? defaultBack}
            hitSlop={10}
            style={styles.back}
          >
            <ChevronLeft size={28} color={Colors.text} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <View style={styles.right}>{rightSlot}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  back: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { fontSize: 30, color: Colors.text, fontWeight: '300', marginTop: -4 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  right: { minWidth: 42, paddingHorizontal: 4, alignItems: 'flex-end' },
});
