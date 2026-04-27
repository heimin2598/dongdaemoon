import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ImageOverlayMap } from '@/components/map/ImageOverlayMap';
import { ZoomableMap, ZoomableMapHandle } from '@/components/map/ZoomableMap';
import { MapControls } from '@/components/map/MapControls';
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

export default function MapBuildingScreen() {
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
  const zoomRef = useRef<ZoomableMapHandle>(null);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  const onMapLayout = (e: LayoutChangeEvent) => {
    setMapSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

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
    }
  }, [params.highlight, setBuilding, setFloor, setHighlight, setTab]);

  const hotspots = useMemo(() => getHotspots(selectedFloor), [selectedFloor]);
  const image = useMemo(() => getFloorImage(selectedFloor), [selectedFloor]);
  const svgBg = useMemo(() => getFloorSvg(selectedFloor), [selectedFloor]);
  const legacyMap = useMemo(
    () => getFloorMap(selectedBuilding, selectedFloor),
    [selectedBuilding, selectedFloor],
  );

  const isHybridMode = !!(hotspots && image);
  const tabsValue: BuildingTabValue = isHybridMode ? selectedTab : selectedBuilding;

  // 동 탭 또는 층 변경 시 해당 동 영역으로 줌/팬. 뷰박스 크롭 대신 transform만 적용해 나머지 동도 화면 밖에 계속 존재.
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
    // 레터박스 계산: ImageOverlayMap 은 컨테이너 안에서 imgAspect 로 fit
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
    // 아주 작은 영역(매칭 셀 1개 등)은 지나치게 확대되므로 최소 크기 보장
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
      <ZoomableMap ref={zoomRef}>
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
      </ZoomableMap>

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

  // ═════════════════════════════════════════════════════════════
  //  세로 (portrait) 레이아웃 — 기본
  // ═════════════════════════════════════════════════════════════
  if (orientation === 'portrait') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* 상단 헤더 */}
        <View style={styles.pHeader}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.pTitle} numberOfLines={1}>
            {headerBuildingLabel} {FLOOR_LABEL[selectedFloor]}
          </Text>
        </View>

        {/* 동 탭 — View 행 (스크롤 없음, 5개 고정) */}
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

        {/* 층 셀렉터 (가로 스크롤, 높이 고정, B1F → 9F 순) */}
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

        {/* 지도 */}
        <View style={styles.pMap}>{mapContent}</View>

        {/* 하단 액션 바 */}
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

  // ═════════════════════════════════════════════════════════════
  //  가로 (landscape) 레이아웃
  // ═════════════════════════════════════════════════════════════
  return (
    <LandscapeLock>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.row}>
          {/* 좌측 사이드바: 뒤로가기 + 층 그리드 + 세로보기 */}
          <View style={styles.leftSide}>
            <View style={styles.sideHeader}>
              <Pressable
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
                }
                hitSlop={10}
                style={styles.backBtn}
              >
                <Text style={styles.backText}>‹</Text>
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

            {/* 하단 액션 */}
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

          {/* 중앙 지도 */}
          {mapContent}

          {/* 우측 사이드바: 동 선택 */}
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

  // ── 공통 ──
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  backText: { fontSize: 28, color: Colors.text, fontWeight: '300', marginTop: -6 },

  // ── 세로 레이아웃 (지도 70% 이상) ──
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
    paddingVertical: 6,
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

  // ── 가로 좌측 사이드바 ──
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

  // ── 중앙 지도 ──
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

  // ── 가로 우측 사이드바 (동 선택) ──
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
