import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getShopStatusDisplay } from '@/lib/shopStatus';
import type { Shop } from '@/types';

interface Props {
  shop: Shop | null | undefined;
  /** small: 12pt 칩 (매장 카드용), large: 14pt (매장 상세용) */
  size?: 'small' | 'large';
}

/** 매장 영업 상태를 색상 칩으로 표시. */
export function ShopStatusPill({ shop, size = 'small' }: Props) {
  const d = getShopStatusDisplay(shop);
  const isLarge = size === 'large';
  return (
    <View style={[styles.pill, { backgroundColor: d.bg }, isLarge && styles.pillLarge]}>
      <Text style={[styles.dot, { color: d.color }, isLarge && styles.dotLarge]}>●</Text>
      <Text style={[styles.label, { color: d.color }, isLarge && styles.labelLarge]} numberOfLines={1}>
        {d.label}
        {d.untilLabel ? ` · ${d.untilLabel}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillLarge: { paddingHorizontal: 12, paddingVertical: 7 },
  dot: { fontSize: 10 },
  dotLarge: { fontSize: 12 },
  label: { fontSize: 13, fontWeight: '800' },
  labelLarge: { fontSize: 14 },
});
