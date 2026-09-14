import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ZoomableMap, ZoomableMapHandle } from '@/components/map/ZoomableMap';
import { MapControls } from '@/components/map/MapControls';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { CATEGORY_LABEL } from '@/constants/categories';
import { FACILITY_LABEL } from '@/constants/facilities';
import { useRouteStore } from '@/stores/routeStore';
import { useSearchStore } from '@/stores/searchStore';
import { getFloorMap } from '@/data/maps';
import { BuildingCode, CategoryKey, FacilityType, FloorCode, SearchResult } from '@/types';

export default function DestinationSummaryScreen() {
  const params = useLocalSearchParams<{
    building?: string;
    floor?: string;
    unit?: string;
    name?: string;
    category?: string;
    facility?: string;
    nodeId?: string;
  }>();

  const building = (params.building ?? 'B') as BuildingCode;
  const floor = (params.floor ?? '6F') as FloorCode;
  const unit = params.unit || undefined;
  const name = params.name || undefined;
  const category = (params.category || undefined) as CategoryKey | undefined;
  const facility = (params.facility || undefined) as FacilityType | undefined;
  const nodeId = params.nodeId || undefined;

  const setDestination = useRouteStore((s) => s.setDestination);
  const pushDestination = useSearchStore((s) => s.pushDestination);

  const zoomRef = useRef<ZoomableMapHandle>(null);
  const map = useMemo(() => getFloorMap(building, floor), [building, floor]);
  const color = BuildingColors[building];

  const titleText = unit
    ? name
      ? `${unit}호 · ${name}`
      : `${unit}호`
    : name
      ? name
      : category
        ? CATEGORY_LABEL[category]
        : facility
          ? FACILITY_LABEL[facility]
          : '목적지';

  const dest: SearchResult = {
    kind: unit ? 'unit' : category ? 'category' : facility ? 'facility' : 'store',
    building,
    floor,
    unitNumber: unit,
    name,
    category,
    facility,
    nodeId,
  };

  const onStart = async () => {
    setDestination(dest);
    await pushDestination(dest);
    router.push('/route/start-select');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="목적지 요약" />
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: color.primary }]}>
          <Text style={{ color: color.text, fontWeight: '800', fontSize: 16 }}>{building}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.sub}>
            {building}동 · {FLOOR_LABEL[floor]}
          </Text>
        </View>
      </View>
      <View style={[styles.mapWrap, { borderColor: color.primary }]}>
        <ZoomableMap ref={zoomRef}>
          <MapCanvas map={map} highlightedUnit={unit} highlightedFacilityId={nodeId ?? null} />
        </ZoomableMap>
        <MapControls
          onZoomIn={() => zoomRef.current?.zoomIn()}
          onZoomOut={() => zoomRef.current?.zoomOut()}
          onReset={() => zoomRef.current?.reset()}
          onFullscreen={() => router.push({ pathname: '/map-fullscreen', params: { b: building, f: floor, unit: unit ?? '' } })}
        />
      </View>

      <View style={styles.actionArea}>
        <Pressable style={styles.linkRow} onPress={() => router.push('/map-building')}>
          <Text style={styles.linkText}>지도에서 크게 보기</Text>
          <ChevronRight size={20} color={Colors.textMuted} />
        </Pressable>
        <Button label="길찾기 시작" onPress={onStart} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: Colors.surface,
  },
  actionArea: { padding: 16, gap: 12 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  linkArrow: { fontSize: 22, color: Colors.textMuted },
});
