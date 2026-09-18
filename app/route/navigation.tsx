import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ZoomableMap, ZoomableMapHandle } from '@/components/map/ZoomableMap';
import { MapControls } from '@/components/map/MapControls';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { getFloorMap } from '@/data/maps';
import { useRouteStore } from '@/stores/routeStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { maybeShowInterstitial } from '@/lib/ads';
import { BuildingCode, FloorCode } from '@/types';

export default function NavigationScreen() {
  const { origin, destination, route, reset } = useRouteStore();
  const { isPremium } = useEntitlement();
  const [viewIndex, setViewIndex] = useState(0);

  // 경로가 거치는 (building, floor) 조합 목록
  const floorSegments = useMemo(() => {
    if (!route) return [] as Array<{ building: BuildingCode; floor: FloorCode }>;
    const seen = new Set<string>();
    const result: Array<{ building: BuildingCode; floor: FloorCode }> = [];
    for (const n of route.nodes) {
      const k = `${n.building}_${n.floor}`;
      if (!seen.has(k)) {
        seen.add(k);
        result.push({ building: n.building, floor: n.floor });
      }
    }
    return result;
  }, [route]);

  const activeSegment =
    floorSegments[viewIndex] ??
    (destination ? { building: destination.building, floor: destination.floor } : { building: 'B' as BuildingCode, floor: '6F' as FloorCode });

  const zoomRef = useRef<ZoomableMapHandle>(null);
  const map = getFloorMap(activeSegment.building, activeSegment.floor);
  const color = BuildingColors[activeSegment.building];

  if (!destination) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="길안내" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>목적지 정보가 없습니다.</Text>
          <Button label="홈으로" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="길안내"
        subtitle={`${origin?.label ?? '출발지'} → ${destination.name ?? destination.unitNumber ?? '목적지'}`}
      />

      {floorSegments.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segRow}
        >
          {floorSegments.map((s, idx) => {
            const active = idx === viewIndex;
            const c = BuildingColors[s.building];
            return (
              <Pressable
                key={`${s.building}_${s.floor}_${idx}`}
                onPress={() => setViewIndex(idx)}
                style={[
                  styles.segChip,
                  active && { backgroundColor: c.primary, borderColor: c.primary },
                ]}
              >
                <Text style={[styles.segText, active && { color: c.text }]}>
                  {s.building}동 {FLOOR_LABEL[s.floor]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.mapWrap, { borderColor: color.primary }]}>
        <ZoomableMap ref={zoomRef}>
          <MapCanvas
            map={map}
            highlightedUnit={destination.unitNumber}
            routeNodes={route?.nodes}
          />
        </ZoomableMap>
        <MapControls
          onZoomIn={() => zoomRef.current?.zoomIn()}
          onZoomOut={() => zoomRef.current?.zoomOut()}
          onReset={() => zoomRef.current?.reset()}
          onFullscreen={() =>
            router.push({
              pathname: '/map-fullscreen',
              params: { b: activeSegment.building, f: activeSegment.floor, unit: destination.unitNumber ?? '' },
            })
          }
        />
      </View>

      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>출발</Text>
          <Text style={styles.infoValue}>{origin?.label ?? '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>도착</Text>
          <Text style={styles.infoValue}>
            {destination.name ?? destination.unitNumber ?? '목적지'} ({destination.building}동 {FLOOR_LABEL[destination.floor]})
          </Text>
        </View>
        {route && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>예상 이동 비용</Text>
            <Text style={styles.infoValue}>{route.totalWeight}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.steps} contentContainerStyle={{ paddingBottom: 16 }}>
        <Text style={styles.stepsTitle}>단계 안내</Text>
        {route && route.steps.length > 0 ? (
          route.steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepDotText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepText}>{s.text}</Text>
                <Text style={styles.stepMeta}>
                  {s.building}동 · {FLOOR_LABEL[s.floor]}{s.mode ? ` · ${modeLabel(s.mode)}` : ''}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.stepRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepDotText}>·</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>
                길찾기 네트워크가 아직 준비되지 않은 구간입니다. 아래 정보를 참고해 이동해 주세요.
              </Text>
              <Text style={styles.stepMeta}>
                {destination.building}동 · {FLOOR_LABEL[destination.floor]}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="안내 종료" variant="secondary" onPress={() => {
          // 길안내가 끝난 시점 = 사용자가 화면을 떠나는 자연스러운 전환점.
          // 안내 "도중"에는 절대 띄우지 않는다 — 이 앱의 핵심 동선이다.
          if (!isPremium) {
            maybeShowInterstitial('routeEnd', 1).catch(() => {});
          }
          reset();
          router.replace('/(tabs)/home');
        }} />
      </View>
    </SafeAreaView>
  );
}

function modeLabel(mode: string) {
  switch (mode) {
    case 'walk': return '도보';
    case 'elevator': return '엘리베이터';
    case 'escalator': return '에스컬레이터';
    case 'stairs': return '계단';
    case 'corridor': return '연결통로';
    default: return mode;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  segRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 6 },
  segChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segText: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  mapWrap: {
    height: 260,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: Colors.surface,
  },
  info: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { width: 100, color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  infoValue: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  steps: { flex: 1, paddingHorizontal: 16 },
  stepsTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  stepRow: { flexDirection: 'row', paddingVertical: 10, gap: 10, alignItems: 'flex-start' },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepDotText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stepText: { fontSize: 14, color: Colors.text, fontWeight: '600', lineHeight: 20 },
  stepMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
});
