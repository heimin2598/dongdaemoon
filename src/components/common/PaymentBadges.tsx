import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PAYMENT_METHODS, getPaymentMethodInfo } from '@/lib/paymentMethods';
import type { PaymentMethod } from '@/types';
import { Colors } from '@/constants/colors';

interface Props {
  methods?: PaymentMethod[] | null;
  /** 비어있을 때 노출 텍스트 (null 이면 컴포넌트 자체 표시 안 함) */
  emptyText?: string | null;
}

/** 매장이 받는 결제 수단을 배지 줄로 표시. */
export function PaymentBadges({ methods, emptyText = '결제 수단 미등록' }: Props) {
  if (!methods || methods.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {methods.map((m) => {
        const info = getPaymentMethodInfo(m);
        if (!info) return null;
        return (
          <View key={m} style={[styles.badge, { backgroundColor: info.bg }]}>
            <Text style={[styles.badgeEmoji]}>{info.emoji}</Text>
            <Text style={[styles.badgeLabel, { color: info.color }]}>{info.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** PAYMENT_METHODS 노출용 export */
export { PAYMENT_METHODS };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeEmoji: { fontSize: 11 },
  badgeLabel: { fontSize: 11, fontWeight: '800' },
  emptyWrap: { paddingVertical: 2 },
  emptyText: { fontSize: 11, color: Colors.textMuted },
});
