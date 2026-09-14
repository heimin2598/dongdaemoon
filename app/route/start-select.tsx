import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { BUILDING_ORDER } from '@/constants/buildings';
import { NAV_NODES } from '@/data/navigation';
import { useRouteStore } from '@/stores/routeStore';
import { findNearestNode, findRoute } from '@/features/navigation/pathfinding';
import { BuildingCode, NavNode } from '@/types';

const PRESET_TYPES: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'entrance', label: '각 동 1층 입구', types: ['entrance'] },
  { key: 'elevator', label: '엘리베이터 앞', types: ['elevator'] },
  { key: 'corridor', label: '연결통로', types: ['corridor'] },
  { key: 'subway', label: '지하철 연결', types: ['subway'] },
  { key: 'parking', label: '주차장', types: ['parking'] },
];

export default function StartSelectScreen() {
  const { destination, setOrigin, setRoute } = useRouteStore();
  const [typeFilter, setTypeFilter] = useState<string>('entrance');
  const [buildingFilter, setBuildingFilter] = useState<BuildingCode | 'ALL'>('ALL');

  const activeTypes = useMemo(
    () => PRESET_TYPES.find((p) => p.key === typeFilter)?.types ?? ['entrance'],
    [typeFilter],
  );

  const candidates: NavNode[] = useMemo(() => {
    return NAV_NODES.filter((n) => activeTypes.includes(n.type)).filter((n) =>
      buildingFilter === 'ALL' ? true : n.building === buildingFilter,
    );
  }, [activeTypes, buildingFilter]);

  const confirm = (origin: NavNode) => {
    if (!destination) return;
    const destNodeId =
      destination.nodeId ??
      findNearestNode(destination.building, destination.floor)?.id ??
      null;

    if (!destNodeId) {
      // 경로 노드를 찾을 수 없더라도 목적지 정보만으로 안내
      setOrigin({ nodeId: origin.id, label: origin.label ?? origin.id });
      setRoute(null);
      router.push('/route/navigation');
      return;
    }

    const route = findRoute(origin.id, destNodeId);
    setOrigin({ nodeId: origin.id, label: origin.label ?? origin.id });
    setRoute(route);
    router.push('/route/navigation');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="현재 위치 선택" subtitle="가까운 기준점을 골라주세요" />

      <View style={styles.group}>
        <Text style={styles.groupTitle}>유형</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PRESET_TYPES}
          keyExtractor={(x) => x.key}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          renderItem={({ item }) => {
            const active = typeFilter === item.key;
            return (
              <Pressable
                onPress={() => setTypeFilter(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>동</Text>
        <View style={styles.bRow}>
          <Pressable
            onPress={() => setBuildingFilter('ALL')}
            style={[styles.bChip, buildingFilter === 'ALL' && styles.bChipActive]}
          >
            <Text style={[styles.bLabel, buildingFilter === 'ALL' && styles.bLabelActive]}>전체</Text>
          </Pressable>
          {BUILDING_ORDER.map((b) => {
            const active = buildingFilter === b;
            const color = BuildingColors[b];
            return (
              <Pressable
                key={b}
                onPress={() => setBuildingFilter(b)}
                style={[
                  styles.bChip,
                  active && { backgroundColor: color.primary, borderColor: color.primary },
                ]}
              >
                <Text style={[styles.bLabel, active && { color: color.text }]}>{b}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={candidates}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>해당 조건의 기준점이 없습니다.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: BuildingColors[item.building].primary }]}>
              <Text style={{ color: BuildingColors[item.building].text, fontWeight: '800' }}>
                {item.building}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.label ?? item.id}</Text>
              <Text style={styles.rowSub}>
                {item.building}동 · {FLOOR_LABEL[item.floor]}
              </Text>
            </View>
            <Button label="여기" onPress={() => confirm(item)} style={{ height: 38, paddingHorizontal: 16 }} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  group: { paddingTop: 12 },
  groupTitle: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', paddingHorizontal: 16, marginBottom: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  chipTextActive: { color: Colors.textInverse },
  bRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  bChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 54,
    alignItems: 'center',
  },
  bChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  bLabelActive: { color: Colors.textInverse },
  sep: { height: 1, backgroundColor: Colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  badge: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
