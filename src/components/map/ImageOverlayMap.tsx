import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  SvgProps,
} from 'react-native-svg';
import { BuildingCode, FloorCode, NavNode } from '@/types';
import { FloorImageMeta } from '@/data/floors/images';
import { Colors } from '@/constants/colors';

export interface StoreHotspot {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FacilityHotspot {
  id: string;
  type: 'elevator' | 'escalator' | 'stairs' | 'toilet' | 'atm' | 'parking' | 'corridor' | 'subway' | 'entrance';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildingRegion {
  building: BuildingCode;
  polygon: Array<[number, number]>;
}

export interface FloorHotspotData {
  floor: FloorCode;
  imageWidth: number;
  imageHeight: number;
  regions: BuildingRegion[];
  stores: StoreHotspot[];
  facilities?: FacilityHotspot[];
}

interface Props {
  image: FloorImageMeta;
  svg?: React.FC<SvgProps> | null;
  data: FloorHotspotData;
  focusBuilding?: BuildingCode | 'ALL';
  highlightedCode?: string | null;
  routeNodes?: NavNode[];
  onSelectStore?: (code: string) => void;
  onSelectFacility?: (id: string) => void;
  /** 핫스팟 전역 오프셋 (디버깅용 정렬 보정) */
  offsetX?: number;
  offsetY?: number;
  /** true면 핫스팟 영역을 눈에 보이게 표시 (디버깅용) */
  debugVisible?: boolean;
}

export function ImageOverlayMap({
  image,
  svg: SvgBackground,
  data,
  focusBuilding = 'ALL',
  highlightedCode,
  routeNodes,
  onSelectStore,
  onSelectFacility,
  offsetX = 0,
  offsetY = 0,
  debugVisible = false,
}: Props) {
  const w = data.imageWidth;
  const h = data.imageHeight;
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const view = useMemo(() => {
    if (focusBuilding === 'ALL') return { x: 0, y: 0, w, h };
    const region = data.regions.find((r) => r.building === focusBuilding);
    if (!region) return { x: 0, y: 0, w, h };
    const xs = region.polygon.map(([x]) => x);
    const ys = region.polygon.map(([, y]) => y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const pad = Math.min(w, h) * 0.02;
    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      w: Math.min(w, maxX - minX + pad * 2),
      h: Math.min(h, maxY - minY + pad * 2),
    };
  }, [focusBuilding, data.regions, w, h]);

  const boxAspect = view.w / view.h;

  // 이미지 원본을 view 영역이 박스에 꽉 차도록 스케일/오프셋
  const imgScalePct = {
    width: `${(w / view.w) * 100}%` as const,
    height: `${(h / view.h) * 100}%` as const,
    left: `${(-view.x / view.w) * 100}%` as const,
    top: `${(-view.y / view.h) * 100}%` as const,
  };

  // 핫스팟 좌표를 view 기준 % 로 변환
  const pct = (val: number, total: number) => `${(val / total) * 100}%` as const;

  return (
    <View style={styles.container}>
      <View style={[styles.ratioBox, { aspectRatio: boxAspect }]}>
        {/* 배경 (SVG 또는 PNG) — pointer 이벤트 무시 */}
        {SvgBackground ? (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <SvgBackground
              width="100%"
              height="100%"
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              preserveAspectRatio="xMidYMid meet"
              pointerEvents="none"
            />
          </View>
        ) : (
          <View
            style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}
            pointerEvents="none"
          >
            <Image
              source={image.source}
              onError={(e) => setImgError(e?.nativeEvent?.error ?? 'load failed')}
              onLoad={() => setImgLoaded(true)}
              style={[{ position: 'absolute' }, imgScalePct]}
              resizeMode="stretch"
            />
          </View>
        )}

        {/* 클릭 가능한 Pressable 오버레이 — SVG 위 */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {data.stores.map((s) => {
            const isHi = s.code === highlightedCode;
            return (
              <Pressable
                key={s.code}
                onPress={() => onSelectStore?.(s.code)}
                style={[
                  {
                    position: 'absolute',
                    left: pct(s.x - view.x + offsetX, view.w),
                    top: pct(s.y - view.y + offsetY, view.h),
                    width: pct(s.width, view.w),
                    height: pct(s.height, view.h),
                  },
                  isHi && styles.hotspotHighlight,
                  debugVisible && !isHi && styles.hotspotDebug,
                ]}
              />
            );
          })}

          {data.facilities?.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => onSelectFacility?.(f.id)}
              style={[
                {
                  position: 'absolute',
                  left: pct(f.x - view.x + offsetX, view.w),
                  top: pct(f.y - view.y + offsetY, view.h),
                  width: pct(f.width, view.w),
                  height: pct(f.height, view.h),
                },
                debugVisible && styles.facilityDebug,
              ]}
            />
          ))}
        </View>

        {/* 경로 오버레이 (SVG, 이벤트 없음) */}
        {routeNodes && routeNodes.length > 1 && (
          <Svg
            style={StyleSheet.absoluteFillObject}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          >
            <G>
              {routeNodes.slice(1).map((n, i) => {
                const prev = routeNodes[i];
                return (
                  <Line
                    key={`${prev.id}-${n.id}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={Colors.accent}
                    strokeWidth={Math.max(8, w / 200)}
                    strokeDasharray={`${w / 60},${w / 100}`}
                  />
                );
              })}
              {routeNodes.map((n, i) => (
                <Circle
                  key={`node-${n.id}`}
                  cx={n.x}
                  cy={n.y}
                  r={Math.max(12, w / 150)}
                  fill={i === 0 ? Colors.success : i === routeNodes.length - 1 ? Colors.accent : '#fff'}
                  stroke={Colors.text}
                  strokeWidth={Math.max(2, w / 500)}
                />
              ))}
            </G>
          </Svg>
        )}

        {!SvgBackground && !imgLoaded && !imgError && (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>지도 이미지 로딩중...</Text>
          </View>
        )}

        {!SvgBackground && imgError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>이미지 로드 실패</Text>
            <Text style={styles.errorTextSub}>{imgError}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratioBox: {
    width: '100%',
    maxHeight: '100%',
    position: 'relative',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  hotspotHighlight: {
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderWidth: 1.5,
    borderColor: '#FFC800',
  },
  hotspotDebug: {
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 0, 0, 0.35)',
  },
  facilityDebug: {
    backgroundColor: 'rgba(0, 200, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 0, 0.6)',
  },
  loadingBox: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  errorBox: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    backgroundColor: 'rgba(214, 69, 69, 0.95)',
    borderRadius: 8,
  },
  errorText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorTextSub: { color: '#fff', fontSize: 11, marginTop: 4 },
});
