import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RATING_MAX } from '@/lib/reviews';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  muted?: boolean;
}

export function StarRow({ value, onChange, size = 20, muted = false }: Props) {
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= RATING_MAX; i++) {
    const filled = value >= i - 0.25;
    const half = !filled && value >= i - 0.75;
    const symbol = filled ? '★' : '☆';
    const node = (
      <Text
        key={i}
        style={[
          styles.starText,
          {
            fontSize: size,
            color: filled || half ? '#F5A623' : muted ? '#D1D5DB' : '#D1D5DB',
          },
        ]}
      >
        {symbol}
      </Text>
    );
    if (onChange) {
      stars.push(
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          {node}
        </Pressable>,
      );
    } else {
      stars.push(node);
    }
  }
  return <View style={styles.row}>{stars}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  starText: { lineHeight: 24 },
});
