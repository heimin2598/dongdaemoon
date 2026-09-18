import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { FloorSelector } from '@/components/map/FloorSelector';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ZoomableMap, ZoomableMapHandle } from '@/components/map/ZoomableMap';
import { MapControls } from '@/components/map/MapControls';
import { Colors, BuildingColors } from '@/constants/colors';
import { BUILDING_ORDER } from '@/constants/buildings';
import { FLOOR_LABEL } from '@/constants/floors';
import { useMapStore } from '@/stores/mapStore';
import { useEntitlement } from '@/hooks/useEntitlement';
import { maybeShowInterstitial } from '@/lib/ads';
import { getFloorMap } from '@/data/maps';
import { BuildingCode } from '@/types';

export default function MapFloorScreen() {
  const { selectedFloor, setFloor, setBuilding } = useMapStore();
  const { isPremium } = useEntitlement();
  const [visibleBuilding, setVisibleBuilding] = useState<BuildingCode>('B');
  const [pageWidth, setPageWidth] = useState(Dimensions.get('window').width);
  const listRef = useRef<FlatList<BuildingCode>>(null);
  const zoomRefs = useRef<Record<BuildingCode, ZoomableMapHandle | null>>({ A: null, B: null, C: null, N: null });

  const onBack = useCallback(() => {
    if (!isPremium) {
      maybeShowInterstitial('mapFloorBack', 3).catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [isPremium]);

  // 헤더 화살표와 Android 하드웨어 ◁ 가 같은 경로를 타야 슬롯 카운트가 정확하다.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );

  const onScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    const b = BUILDING_ORDER[idx];
    if (b) {
      setVisibleBuilding(b);
      setBuilding(b);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={26} color={Colors.text} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>층별 보기 · {FLOOR_LABEL[selectedFloor]}</Text>
          <Text style={styles.headerSub}>{visibleBuilding}동 (좌우 스와이프)</Text>
        </View>
        <Pressable style={styles.homeBtn} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.homeBtnText}>홈</Text>
        </Pressable>
      </View>

      <FloorSelector value={selectedFloor} onChange={setFloor} direction="horizontal" />

      <View style={styles.dots}>
        {BUILDING_ORDER.map((b) => (
          <View
            key={b}
            style={[
              styles.dot,
              { backgroundColor: visibleBuilding === b ? BuildingColors[b].primary : Colors.border },
            ]}
          />
        ))}
      </View>

      <View
        style={{ flex: 1 }}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        <FlatList
          ref={listRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={BUILDING_ORDER}
          keyExtractor={(b) => b}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item }) => {
            const map = getFloorMap(item, selectedFloor);
            const color = BuildingColors[item];
            return (
              <View style={[styles.page, { width: pageWidth }]}>
                <View style={[styles.buildingBadge, { backgroundColor: color.primary }]}>
                  <Text style={{ color: color.text, fontWeight: '800', fontSize: 16 }}>{item}동</Text>
                </View>
                <View style={[styles.mapWrap, { borderColor: color.primary }]}>
                  <ZoomableMap ref={(r) => { zoomRefs.current[item] = r; }}>
                    <MapCanvas map={map} />
                  </ZoomableMap>
                  <MapControls
                    onZoomIn={() => zoomRefs.current[item]?.zoomIn()}
                    onZoomOut={() => zoomRefs.current[item]?.zoomOut()}
                    onReset={() => zoomRefs.current[item]?.reset()}
                    onFullscreen={() =>
                      router.push({
                        pathname: '/map-fullscreen',
                        params: { b: item, f: selectedFloor },
                      })
                    }
                  />
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, color: Colors.text, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  homeBtn: { paddingHorizontal: 12, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.divider },
  homeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  page: { flex: 1, padding: 10 },
  buildingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
  mapWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: Colors.surface,
  },
});
