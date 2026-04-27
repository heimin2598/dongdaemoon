import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BUILDING_ORDER } from '@/constants/buildings';
import { BuildingColors, Colors } from '@/constants/colors';
import { BuildingCode } from '@/types';

export type BuildingTabValue = BuildingCode | 'ALL';

interface Props {
  value: BuildingTabValue;
  onChange: (b: BuildingTabValue) => void;
  /** "전체" 탭 노출 여부 (default true) */
  showAll?: boolean;
}

export function BuildingTabs({ value, onChange, showAll = true }: Props) {
  return (
    <View style={styles.row}>
      {showAll && (
        <Pressable
          onPress={() => onChange('ALL')}
          style={[
            styles.tab,
            styles.allTab,
            { backgroundColor: value === 'ALL' ? Colors.primary : Colors.surface },
          ]}
        >
          <Text style={[styles.label, { color: value === 'ALL' ? '#fff' : Colors.primary }]}>
            전체
          </Text>
        </Pressable>
      )}
      {BUILDING_ORDER.map((b) => {
        const active = value === b;
        const color = BuildingColors[b];
        return (
          <Pressable
            key={b}
            onPress={() => onChange(b)}
            style={[
              styles.tab,
              { backgroundColor: active ? color.primary : Colors.surface, borderColor: color.primary },
            ]}
          >
            <Text style={[styles.label, { color: active ? color.text : color.primary }]}>
              {b}동
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  allTab: {
    borderColor: Colors.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
