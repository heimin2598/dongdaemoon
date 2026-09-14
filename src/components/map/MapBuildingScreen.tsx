import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ImageOverlayMap } from '@/components/map/ImageOverlayMap';
import { SimpleZoomableMap, SimpleZoomableMapHandle } from '@/components/map/SimpleZoomableMap';
import { MapControls } from '@/components/map/MapControls';
import { ChevronLeft } from 'lucide-react-native';
import { LandscapeLock } from '@/components/common/LandscapeLock';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOORS, FLOOR_LABEL } from '@/constants/floors';
import { BUILDING_ORDER } from '@/constants/buildings';
import { useMapStore } from '@/stores/mapStore';
import type { BuildingTabValue } from '@/stores/mapStore';
import { getFloorMap } from '@/data/maps';
import { getHotspots, hasHotspots } from '@/data/floors/hotspots_index';
import { getFloorImage } from '@/data/floors/images';
import { getFloorSvg } from '@/data/floors/svgs';
import { getStoreByCode } from '@/data/stores';
import { BuildingCode, FloorCode } from '@/types';

/**
 * 지도 화면 본체. expo-router 의 두 라우트가 이 컴포넌트를 공유 렌더한다:
 *  - app/(tabs)/map.tsx    — 탭 진입 (tabBar 숨김)
 *  - app/map-building.tsx  — 다른 화면(매장 상세 등) 에서 deep link
 *
 * 분리된 이유: (tabs)/map 에서 root /map-building 으로 cross-navigator transition 하면
 * release 빌드에서 native crash 발생. 두 라우트가 같은 컴포넌트를 직접 렌더하면 navigator
 * 경계를 넘는 transition 자체가 일어나지 않으므로 crash 회피.
 */
export function MapBuildingScreen() {
  const params = useLocalSearchParams<{ highlight?: string }>();
  const {
    selectedBuilding,
    selectedFloor,
    selectedTab,
    orientation,
    highlightedUnit,
    highlightedFacilityId,
    setBuilding,
    setFloor,
    setTab,
    setOrientation,
    setHighlight,
  } = useMapStore();
  const zoomRef = useRef<SimpleZoomableMapHandle>(null);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  const onMapLayout = (e: LayoutChangeEvent) => {
    setMapSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

  // 지도 진입 시 항상 세로 모드로 초기화.
  useEffect(() => {
    setOrientation('portrait');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android 하드웨어 뒤로가기: stack history 없으면 홈 탭으로 replace.
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/home');
        }
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    if (hasHotspots(selectedFloor)) return;
    if (selectedTab === 'ALL') setTab(selectedBuilding);
  }, [selectedFloor, selectedBuilding, selectedTab, setTab]);

  useEffect(() => {
    if (!params.highlight) return;
    const store = getStoreByCode(params.highlight);
    if (store && store.building && store.floor) {
      setBuilding(store.building as BuildingCode);
      setFloor(store.floor as FloorCode);
      setHighlight(store.code ?? null);
      setTab(store.building as BuildingCode);
      setOrientation('portrait');
    }
  }, [params.highlight, setBuilding, setFloor, setHighlight, setTab, setOrientation]);

  const hotspots = useMemo(() => getHotspots(selectedFloor), [selectedFloor]);
  const image = useMemo(() => getFloorImage(selectedFloor), [selectedFloor]);
  const svgBg = useMemo(() => getFloorSvg(selectedFloor), [selectedFloor]);
  const legacyMap = useMemo(
    () => getFloorMap(selectedBuilding, selectedFloor),
    [selectedBuilding, selectedFloor],
  );

  const isHybridMode = !!(hotspots && image);
  const tabsValue: BuildingTabValue = isHybridMode ? selectedTab : selectedBuilding;

  useEffect(() => {
    if (!isHybridMode || !hotspots || !image) return;
    if (mapSize.w <= 0 || mapSize.h <= 0) return;
    if (selectedTab === 'ALL') {
      zoomRef.current?.reset();
      return;
    }
    const region = hotspots.regions.find((r) => r.building === selectedTab);
    if (!region || region.polygon.length === 0) {
      zoomRef.current?.reset();
      return;
    }
    const xs = region.polygon.map(([x]) => x);
    const ys = region.polygon.map(([, y]) => y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const imgW = hotspots.imageWidth;
    const imgH = hotspots.imageHeight;
    const imgAspect = imgW / imgH;
    const mapAspect = mapSize.w / mapSize.h;
    let contentW: number, contentH: number, contentX: number, contentY: number;
    if (mapAspect > imgAspect) {
      contentH = mapSize.h;
      contentW = mapSize.h * imgAspect;
      contentX = (mapSize.w - contentW) / 2;
      contentY = 0;
    } else {
      contentW = mapSize.w;
      contentH = mapSize.w / imgAspect;
      contentX = 0;
      contentY = (mapSize.h - contentH) / 2;
    }
    const sxr = contentW / imgW;
    const syr = contentH / imgH;
    const rx = contentX + minX * sxr;
    const ry = contentY + minY * syr;
    const rw = (maxX - minX) * sxr;
    const rh = (maxY - minY) * syr;
    const minDim = Math.min(mapSize.w, mapSize.h) * 0.2;
    const finalW = Math.max(rw, minDim);
    const finalH = Math.max(rh, minDim);
    const finalX = rx - (finalW - rw) / 2;
    const finalY = ry - (finalH - rh) / 2;
    zoomRef.current?.zoomToRect(finalX, finalY, finalW, finalH);
  }, [selectedTab, selectedFloor, isHybridMode, hotspots, image, mapSize]);

  const headerBuildingLabel =
    isHybridMode && selectedTab === 'ALL' ? '전체' : `${selectedBuilding}동`;
  const headerColor =
    tabsValue === 'ALL' ? BuildingColors.A : BuildingColors[tabsValue as BuildingCode];
  const TAB_ITEMS: Array<{ key: BuildingTabValue; label: string }> = isHybridMode
    ? [
        { key: 'ALL', label: '전체' },
        ...BUILDING_ORDER.map((b) => ({ key: b as BuildingTabValue, label: `${b}동` })),
      ]
    : BUILDING_ORDER.map((b) => ({ key: b as BuildingTabValue, label: `${b}동` }));

  const mapContent = (
    <View style={[styles.mapWrap, { borderColor: headerColor.primary }]} onLayout={onMapLayout}>
      <SimpleZoomableMap ref={zoomRef} landscape={orientation === 'landscape'}>
        {isHybridMode && hotspots && image ? (
          <ImageOverlayMap
            image={image}
            svg={null}
            data={hotspots}
            focusBuilding="ALL"
            highlightedCode={highlightedUnit}
          />
        ) : (
          <MapCanvas
            map={legacyMap}
            highlightedUnit={highlightedUnit}
            highlightedFacilityId={highlightedFacilityId}
          />
        )}
      </SimpleZoomableMap>

      <View style={styles.zoomHint} pointerEvents="none">
        <Text style={styles.zoomHintText}>확대, 축소, 이동 가능</Text>
      </View>

      <MapControls
        showZoomButtons={false}
        onZoomIn={() => zoomRef.current?.zoomIn()}
        onZoomOut={() => zoomRef.current?.zoomOut()}
        onReset={() => zoomRef.current?.reset()}
        onFullscreen={() =>
          router.push({
            pathname: '/map-fullscreen',
            params: {
              b: tabsValue === 'ALL' ? 'B' : (tabsValue as string),
              f: selectedFloor,
              unit: highlightedUnit ?? '',
              overlay: isHybridMode && selectedTab === 'ALL' ? '1' : '0',
            },
          })
        }
      />
    </View>
  );

  if (orientation === 'portrait') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.pHeader}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            hitSlop={10}
            style={styles.backBtn}
          >
            <ChevronLeft size={26} color={Colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.pTitle} numberOfLines={1}>
            {headerBuildingLabel} {FLOOR_LABEL[selectedFloor]}
          </Text>
        </View>

        <View style={styles.pTabRow}>
          {TAB_ITEMS.map(({ key, label }) => {
            const active = tabsValue === key;
            const color = key === 'ALL' ? BuildingColors.A : BuildingColors[key as BuildingCode];
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setTab(key);
                  if (key !== 'ALL') setBuilding(key);
                }}
                style={[
                  styles.pTab,
                  active && {
                    backgroundColor: key === 'ALL' ? Colors.primary : color.primary,
                    borderColor: key === 'ALL' ? Colors.primary : color.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pTabText,
                    active && { color: key === 'ALL' ? '#fff' : color.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pFloorRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pFloorRow}
          >
            {[...FLOORS].reverse().map((f) => {
              const active = selectedFloor === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFloor(f)}
                  style={[styles.pFloorChip, active && styles.pFloorChipActive]}
                >
                  <Text style={[styles.pFloorText, active && styles.pFloorTextActive]}>{f}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.pMap}>{mapContent}</View>

        <View style={styles.pBottomRow}>
          <Pressable
            style={[styles.pBottomPrimary, { flex: 1 }]}
            onPress={() => setOrientation('landscape')}
          >
            <Text style={styles.pBottomPrimaryIcon}>⟲</Text>
            <Text style={styles.pBottomPrimaryText}>가로로 보기 (권장)</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LandscapeLock>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.row}>
          <View style={styles.leftSide}>
            <View style={styles.sideHeader}>
              <Pressable
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
                }
                hitSlop={10}
                style={styles.backBtn}
              >
                <ChevronLeft size={26} color={Colors.text} strokeWidth={2} />
              </Pressable>
              <Text style={styles.sideTitle} numberOfLines={1}>
                {headerBuildingLabel} {FLOOR_LABEL[selectedFloor]}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.floorGrid}
              showsVerticalScrollIndicator={false}
            >
              {FLOORS.map((f) => {
                const active = selectedFloor === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFloor(f)}
                    style={[styles.floorChip, active && styles.floorChipActive]}
                  >
                    <Text style={[styles.floorChipText, active && styles.floorChipTextActive]}>
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.leftBottom}>
              <Pressable
                style={styles.leftBottomBtn}
                onPress={() => setOrientation('portrait')}
              >
                <Text style={styles.leftBottomIcon}>⟲</Text>
                <Text style={styles.leftBottomText}>세로로 보기</Text>
              </Pressable>
            </View>
          </View>

          {mapContent}

          <View style={styles.rightSide}>
            {TAB_ITEMS.map(({ key, label }) => {
              const active = tabsValue === key;
              const color =
                key === 'ALL' ? BuildingColors.A : BuildingColors[key as BuildingCode];
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setTab(key);
                    if (key !== 'ALL') setBuilding(key);
                  }}
                  style={[
                    styles.tabItem,
                    active && {
                      backgroundColor: key === 'ALL' ? Colors.primary : color.primary,
                      borderColor: key === 'ALL' ? Colors.primary : color.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      active && { color: key === 'ALL' ? '#fff' : color.text },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </LandscapeLock>
  );
}

const SIDEBAR_LEFT = 150;
const SIDEBAR_RIGHT = 84;
const FLOOR_CHIP_W = (SIDEBAR_LEFT - 24) / 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  row: { flex: 1, flexDirection: 'row' },

  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  backText: { fontSize: 28, color: Colors.text, fontWeight: '300', marginTop: -6 },

  pHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  pTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  pTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: Colors.surface,
  },
  pTab: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pTabText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  pFloorRowWrap: {
    height: 40,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pFloorRow: { paddingHorizontal: 10, paddingVertical: 5, gap: 4, alignItems: 'center' },
  pFloorChip: {
    minWidth: 40,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pFloorChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pFloorText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  pFloorTextActive: { color: '#fff' },
  pMap: { flex: 1 },
  pBottomRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pBottomPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
  pBottomPrimaryIcon: { fontSize: 17, color: '#fff', fontWeight: '700' },
  pBottomPrimaryText: { fontSize: 17, color: '#fff', fontWeight: '700' },

  leftSide: {
    width: SIDEBAR_LEFT,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sideHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sideTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 4 },
  floorGrid: {
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  floorChip: {
    width: FLOOR_CHIP_W,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floorChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  floorChipText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  floorChipTextActive: { color: '#fff' },
  leftBottom: {
    padding: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  leftBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.7,
  },
  leftBottomIcon: { fontSize: 14 },
  leftBottomText: { fontSize: 12, fontWeight: '700', color: Colors.text },

  mapWrap: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  zoomHint: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  zoomHintText: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '600',
  },

  rightSide: {
    width: SIDEBAR_RIGHT,
    padding: 8,
    gap: 8,
    backgroundColor: Colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  tabItem: {
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '800', color: Colors.text },
});
