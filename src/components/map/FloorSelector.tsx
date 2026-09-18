import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FLOORS, FLOOR_LABEL } from '@/constants/floors';
import { Colors } from '@/constants/colors';
import { FloorCode } from '@/types';

interface Props {
  value: FloorCode;
  onChange: (f: FloorCode) => void;
  direction?: 'vertical' | 'horizontal';
}

export function FloorSelector({ value, onChange, direction = 'vertical' }: Props) {
  if (direction === 'horizontal') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hContainer}
      >
        {FLOORS.map((f) => {
          const active = value === f;
          return (
            <Pressable
              key={f}
              onPress={() => onChange(f)}
              style={[styles.hChip, active && styles.hChipActive]}
            >
              <Text style={[styles.hLabel, active && styles.hLabelActive]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.vContainer}>
      {FLOORS.map((f) => {
        const active = value === f;
        return (
          <Pressable
            key={f}
            onPress={() => onChange(f)}
            style={[styles.vChip, active && styles.vChipActive]}
          >
            <Text style={[styles.vLabel, active && styles.vLabelActive]}>
              {f}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 가로 ScrollView 는 부모 column 안에서 세로로 늘어나고, 그러면 칩이 cross-axis
  // stretch 로 화면 절반까지 뻗는다. flexGrow:0 로 높이를 내용에 맞추고
  // alignItems:center 로 칩 자체도 내용 높이를 유지시킨다.
  hScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  hContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  hChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  hLabelActive: {
    color: Colors.textInverse,
  },
  vContainer: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
    alignItems: 'center',
  },
  vChip: {
    width: 44,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  vLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  vLabelActive: {
    color: Colors.textInverse,
  },
});
