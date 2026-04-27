import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, BuildingColors } from '@/constants/colors';
import { useMapStore } from '@/stores/mapStore';
import { BuildingCode, FloorCode } from '@/types';
import { ZoomableMap, ZoomableMapHandle } from '@/components/map/ZoomableMap';

/**
 * 한눈에 보기 — 항상 "가로보기 UI"로 고정.
 *
 * 동작 방식
 * - 원본 이미지(1170×827)는 가로형이므로, UI 전체도 가로 레이아웃으로 설계.
 * - 세로 뷰포트(폰 세로)에서는 SafeAreaView 내부 전체를 90° 회전 → 사용자는 폰을 가로로 돌려 봄.
 * - 가로 뷰포트에서는 회전 없이 그대로 풀스크린 이용.
 * - 타이틀·원위치·전체보기 버튼 모두 가로 레이아웃의 정해진 자리에 고정 (UI가 orientation에 따라 바뀌지 않음).
 */

const IMG_W = 1170;
const IMG_H = 827;

const FLOOR_ROWS: Array<{ floor: FloorCode; y: number; h: number }> = [
  { floor: '9F',  y: 115, h: 75 },
  { floor: '8F',  y: 195, h: 75 },
  { floor: '7F',  y: 272, h: 65 },
  { floor: '6F',  y: 340, h: 70 },
  { floor: '5F',  y: 412, h: 65 },
  { floor: '4F',  y: 480, h: 70 },
  { floor: '3F',  y: 552, h: 65 },
  { floor: '2F',  y: 620, h: 75 },
  { floor: '1F',  y: 698, h: 75 },
  { floor: 'B1F', y: 775, h: 55 },
];

const BUILDING_COLS: Array<{ building: BuildingCode; x: number; w: number }> = [
  { building: 'B', x: 72,   w: 285 },
  { building: 'A', x: 358,  w: 263 },
  { building: 'C', x: 622,  w: 243 },
  { building: 'N', x: 867,  w: 300 },
];

export default function OverviewScreen() {
  const setBuilding = useMapStore((s) => s.setBuilding);
  const setFloor = useMapStore((s) => s.setFloor);
  const { width: winW, height: winH } = useWindowDimensions();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const zoomRef = useRef<ZoomableMapHandle>(null);

  const goTo = (building: BuildingCode, floor: FloorCode) => {
    setBuilding(building);
    setFloor(floor);
    router.push('/map-building');
  };

  // 가로 레이아웃 기준 크기 (화면이 세로면 swap)
  const isPortraitViewport = winH > winW;
  const landW = isPortraitViewport ? winH : winW;
  const landH = isPortraitViewport ? winW : winH;

  return (
    <View style={styles.root}>
      {/* 항상 가로 기준 컨테이너 — 세로 뷰포트에선 90° 회전 */}
      <View
        style={[
          styles.landscapeContainer,
          {
            width: landW,
            height: landH,
            left: isPortraitViewport ? (winW - landW) / 2 : 0,
            top: isPortraitViewport ? (winH - landH) / 2 : 0,
            transform: isPortraitViewport ? [{ rotate: '90deg' }] : undefined,
          },
        ]}
      >
        <SafeAreaView style={styles.innerSafe} edges={isFullscreen ? [] : ['top']}>
          {!isFullscreen && (
            <View style={styles.landscapeHeader}>
              <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <Text style={styles.title}>한눈에 보기</Text>
              <Text style={styles.hint}>탭하면 해당 지도로 이동</Text>
            </View>
          )}

          <View style={styles.mapArea}>
            <MapArea
              zoomRef={zoomRef}
              availW={landW}
              availH={isFullscreen ? landH : landH - 44}
              goTo={goTo}
            />

            {/* 좌하단: 줌 인/아웃 (가로 레이아웃 기준 왼쪽 아래) */}
            <View style={styles.zoomControls} pointerEvents="box-none">
              <Pressable style={styles.zoomBtn} onPress={() => zoomRef.current?.zoomIn()}>
                <Text style={styles.zoomBtnText}>＋</Text>
              </Pressable>
              <View style={styles.zoomDivider} />
              <Pressable style={styles.zoomBtn} onPress={() => zoomRef.current?.zoomOut()}>
                <Text style={styles.zoomBtnText}>－</Text>
              </Pressable>
            </View>

            {/* 우하단: 원위치 + 전체보기 */}
            <View style={styles.rightBtnStack} pointerEvents="box-none">
              <Pressable
                style={styles.resetBtn}
                onPress={() => zoomRef.current?.reset()}
                accessibilityLabel="원위치"
              >
                <Text style={styles.resetBtnIcon}>⟲</Text>
                <Text style={styles.resetBtnText}>원위치</Text>
              </Pressable>
              <Pressable
                style={styles.fitBtn}
                onPress={() => setIsFullscreen((v) => !v)}
              >
                <Text style={styles.fitBtnIcon}>{isFullscreen ? '✕' : '⛶'}</Text>
                <Text style={styles.fitBtnText}>{isFullscreen ? '닫기' : '전체보기'}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

function MapArea({
  zoomRef,
  availW,
  availH,
  goTo,
}: {
  zoomRef: React.RefObject<ZoomableMapHandle>;
  availW: number;
  availH: number;
  goTo: (b: BuildingCode, f: FloorCode) => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale =
    box.w > 0 && box.h > 0 ? Math.min(box.w / IMG_W, box.h / IMG_H) : 0;
  const dispW = IMG_W * scale;
  const dispH = IMG_H * scale;
  const offsetX = (box.w - dispW) / 2;
  const offsetY = (box.h - dispH) / 2;

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}
      onLayout={(e) =>
        setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {scale > 0 && (
        <ZoomableMap ref={zoomRef} minScale={0.8} maxScale={5}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                position: 'absolute',
                left: offsetX,
                top: offsetY,
                width: dispW,
                height: dispH,
              }}
            >
              <Image
                source={require('@assets/maps/floors/overview_categories.png')}
                style={{ width: dispW, height: dispH }}
                resizeMode="contain"
              />
              {FLOOR_ROWS.map((fr) =>
                BUILDING_COLS.map((bc) => {
                  const c = BuildingColors[bc.building];
                  return (
                    <Pressable
                      key={`${bc.building}_${fr.floor}`}
                      onPress={() => goTo(bc.building, fr.floor)}
                      style={({ pressed }) => [
                        styles.hotspot,
                        {
                          left: bc.x * scale,
                          top: fr.y * scale,
                          width: bc.w * scale,
                          height: fr.h * scale,
                          borderColor: pressed ? c.primary : 'transparent',
                          backgroundColor: pressed ? c.primary + '33' : 'transparent',
                        },
                      ]}
                    />
                  );
                }),
              )}
            </View>
          </View>
        </ZoomableMap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', overflow: 'hidden' },
  landscapeContainer: {
    position: 'absolute',
    backgroundColor: Colors.background,
  },
  innerSafe: { flex: 1, backgroundColor: Colors.background },

  landscapeHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 26, color: Colors.text, fontWeight: '300', marginTop: -4 },
  title: { fontSize: 15, fontWeight: '800', color: Colors.text, marginRight: 10 },
  hint: { fontSize: 11, color: Colors.textMuted, flex: 1 },

  mapArea: { flex: 1, position: 'relative' },
  hotspot: { position: 'absolute', borderWidth: 2, borderRadius: 4 },

  zoomControls: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  zoomBtnText: { fontSize: 22, fontWeight: '700', color: Colors.text },
  zoomDivider: { height: 1, backgroundColor: Colors.divider },

  rightBtnStack: { position: 'absolute', right: 12, bottom: 12, gap: 8, alignItems: 'flex-end' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetBtnIcon: { fontSize: 16, color: Colors.text, fontWeight: '700' },
  resetBtnText: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  fitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fitBtnIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
  fitBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
