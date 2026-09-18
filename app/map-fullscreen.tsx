import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, RotateCw } from 'lucide-react-native';
import { MapCanvas } from '@/components/map/MapCanvas';
import { ImageOverlayMap } from '@/components/map/ImageOverlayMap';
import { SimpleZoomableMap as ZoomableMap, SimpleZoomableMapHandle as ZoomableMapHandle } from '@/components/map/SimpleZoomableMap';
import { MapControls } from '@/components/map/MapControls';
import { LandscapeLock } from '@/components/common/LandscapeLock';
import { useMapStore } from '@/stores/mapStore';
import { Colors, BuildingColors } from '@/constants/colors';
import { FLOOR_LABEL } from '@/constants/floors';
import { getFloorMap } from '@/data/maps';
import { getHotspots } from '@/data/floors/hotspots_index';
import { getFloorImage } from '@/data/floors/images';
import { getFloorSvg } from '@/data/floors/svgs';
import { BuildingCode, FloorCode } from '@/types';

export default function MapFullscreenScreen() {
  const params = useLocalSearchParams<{ b?: string; f?: string; unit?: string; overlay?: string }>();
  const building = (params.b ?? 'B') as BuildingCode;
  const floor = (params.f ?? '6F') as FloorCode;
  const unit = params.unit || null;
  const showOverlay = params.overlay === '1';
  // 현재 지도 모드(세로/가로)에 따라 전체보기 방향 결정
  const orientation = useMapStore((s) => s.orientation);
  const setOrientation = useMapStore((s) => s.setOrientation);
  const isLandscape = orientation === 'landscape';
  const insets = useSafeAreaInsets();

  const zoomRef = useRef<ZoomableMapHandle>(null);
  const hotspots = useMemo(() => getHotspots(floor), [floor]);
  const image = useMemo(() => getFloorImage(floor), [floor]);
  const svgBg = useMemo(() => getFloorSvg(floor), [floor]);
  const legacyMap = useMemo(() => getFloorMap(building, floor), [building, floor]);
  const color = BuildingColors[building];

  const canHybrid = !!(hotspots && image);

  // 뷰포트가 가로로 넓은데 세로 모드를 선택한 경우 (주로 웹 데스크톱),
  // LandscapeLock 은 회전을 안 하므로 세로/가로 차이가 안 보인다 → 세로 비율(9:16) 프레임으로 시뮬레이션.
  const { width: winW, height: winH } = useWindowDimensions();
  const simulatePortrait = orientation === 'portrait' && winW > winH;

  return (
    <View style={styles.outer}>
    <View style={simulatePortrait ? styles.portraitFrame : styles.landscapeFrame}>
    <LandscapeLock enabled={orientation === 'landscape'}>
    <View style={styles.fullscreen}>
      <ZoomableMap ref={zoomRef} minScale={0.3} maxScale={10} landscape={isLandscape}>
        {showOverlay && canHybrid ? (
          <ImageOverlayMap
            image={image!}
            svg={svgBg}
            data={hotspots!}
            focusBuilding="ALL"
            highlightedCode={unit}
          />
        ) : canHybrid ? (
          <ImageOverlayMap
            image={image!}
            svg={svgBg}
            data={hotspots!}
            focusBuilding={building}
            highlightedCode={unit}
          />
        ) : (
          <MapCanvas map={legacyMap} highlightedUnit={unit} />
        )}
      </ZoomableMap>

      {/* 좌측 상단: 뒤로가기 (가로모드일 때 옆에 세로로 보기 토글 함께 표시) */}
      <View style={[styles.topLeftRow, { top: 14 + insets.top, left: 14 + insets.left }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/map-building'))}
        >
          <ChevronLeft size={20} color={Colors.text} strokeWidth={2} />
          <Text style={styles.backText}>뒤로</Text>
        </Pressable>
        {isLandscape && (
          <Pressable
            style={styles.orientToggleBtn}
            onPress={() => setOrientation('portrait')}
          >
            <RotateCw size={14} color={Colors.text} strokeWidth={2} />
            <Text style={styles.orientToggleText}>세로로 보기</Text>
          </Pressable>
        )}
      </View>

      {/* 우측 상단: 동·층 뱃지 */}
      <View
        style={[
          styles.badge,
          { backgroundColor: color.primary, top: 14 + insets.top, right: 14 + insets.right },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.badgeText, { color: color.text }]}>
          {showOverlay ? '전체' : `${building}동`} · {FLOOR_LABEL[floor]}
        </Text>
      </View>

      {/* 하단 중앙 (세로모드 전체보기일 때만): 가로로 보기 토글 */}
      {!isLandscape && (
        <View style={[styles.bottomCenter, { bottom: 12 + insets.bottom }]} pointerEvents="box-none">
          <Pressable
            style={styles.orientToggleBtn}
            onPress={() => setOrientation('landscape')}
          >
            <Text style={styles.orientToggleIcon}>⟲</Text>
            <Text style={styles.orientToggleText}>가로로 보기</Text>
          </Pressable>
        </View>
      )}

      <MapControls
        showZoomButtons={false}
        edgeToEdge
        onZoomIn={() => zoomRef.current?.zoomIn()}
        onZoomOut={() => zoomRef.current?.zoomOut()}
        onReset={() => zoomRef.current?.reset()}
        onExitFullscreen={() => (router.canGoBack() ? router.back() : router.replace('/map-building'))}
      />
    </View>
    </LandscapeLock>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitFrame: {
    aspectRatio: 9 / 16,
    height: '100%',
    maxWidth: '100%',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  landscapeFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
  },
  fullscreen: { flex: 1, backgroundColor: '#fff' },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    opacity: 0.7,
  },
  badgeText: { fontSize: 14, fontWeight: '800' },
  topLeftRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    gap: 8,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.7,
  },
  backText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bottomCenter: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  orientToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.7,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  orientToggleIcon: { fontSize: 14, color: Colors.text, fontWeight: '700' },
  orientToggleText: { fontSize: 13, color: Colors.text, fontWeight: '700' },
});
