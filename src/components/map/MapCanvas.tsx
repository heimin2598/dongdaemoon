import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Polygon,
  Circle,
  Text as SvgText,
  Line,
  G,
} from 'react-native-svg';
import { FloorMap, NavNode } from '@/types';
import { BuildingColors, Colors } from '@/constants/colors';
import { FACILITY_ICON } from '@/constants/facilities';

interface Props {
  map: FloorMap;
  highlightedUnit?: string | null;
  highlightedFacilityId?: string | null;
  routeNodes?: NavNode[];
  onSelectStore?: (unit: string) => void;
  onSelectFacility?: (id: string) => void;
  onTapAny?: (x: number, y: number) => void;
}

export function MapCanvas({
  map,
  highlightedUnit,
  highlightedFacilityId,
  routeNodes,
  onSelectStore,
  onSelectFacility,
}: Props) {
  const bColor = BuildingColors[map.building];
  const { width, height } = map.viewBox;

  const routeOnFloor = useMemo(
    () =>
      (routeNodes ?? []).filter(
        (n) => n.building === map.building && n.floor === map.floor,
      ),
    [routeNodes, map.building, map.floor],
  );

  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect x={0} y={0} width={width} height={height} fill={Colors.background} />

        {/* 배경 영역 (region) */}
        {map.regions?.map((r) => (
          <G key={r.id}>
            <Polygon
              points={r.points.map((p) => p.join(',')).join(' ')}
              fill={r.color ?? bColor.primary}
              opacity={0.85}
            />
            <SvgText
              x={
                r.points.reduce((s, [px]) => s + px, 0) / r.points.length
              }
              y={
                r.points.reduce((s, [, py]) => s + py, 0) / r.points.length
              }
              fill="#fff"
              fontSize={22}
              fontWeight="700"
              textAnchor="middle"
            >
              {r.label}
            </SvgText>
          </G>
        ))}

        {/* 점포 */}
        {map.stores.map((s) => {
          const isHi = highlightedUnit === s.unitNumber;
          const fill = isHi ? Colors.accent : bColor.primary;
          if (s.shape === 'rect') {
            return (
              <G
                key={s.unitNumber}
                onPress={() => onSelectStore?.(s.unitNumber)}
              >
                <Rect
                  x={s.x}
                  y={s.y}
                  width={s.width ?? 40}
                  height={s.height ?? 30}
                  fill={fill}
                  stroke={isHi ? '#000' : 'rgba(0,0,0,0.15)'}
                  strokeWidth={isHi ? 2 : 0.6}
                  rx={3}
                />
                <SvgText
                  x={(s.x + (s.width ?? 40) / 2)}
                  y={(s.y + (s.height ?? 30) / 2 + 4)}
                  fill={isHi ? '#fff' : bColor.text}
                  fontSize={Math.min(11, ((s.height ?? 30) / 3))}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {s.label ?? s.unitNumber}
                </SvgText>
              </G>
            );
          }
          if (s.shape === 'polygon' && s.points) {
            return (
              <G
                key={s.unitNumber}
                onPress={() => onSelectStore?.(s.unitNumber)}
              >
                <Polygon
                  points={s.points.map((p) => p.join(',')).join(' ')}
                  fill={fill}
                  stroke={isHi ? '#000' : 'rgba(0,0,0,0.15)'}
                  strokeWidth={isHi ? 2 : 0.6}
                />
              </G>
            );
          }
          return null;
        })}

        {/* 시설 */}
        {map.facilities.map((f) => {
          const isHi = highlightedFacilityId === f.id;
          return (
            <G key={f.id} onPress={() => onSelectFacility?.(f.id)}>
              <Circle
                cx={f.x}
                cy={f.y}
                r={14}
                fill={isHi ? Colors.accent : '#fff'}
                stroke={isHi ? Colors.accent : Colors.text}
                strokeWidth={1.5}
              />
              <SvgText
                x={f.x}
                y={f.y + 4}
                fill={isHi ? '#fff' : Colors.text}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                {FACILITY_ICON[f.type]}
              </SvgText>
            </G>
          );
        })}

        {/* 경로 노드 & 라인 */}
        {routeOnFloor.length > 1 && (
          <G>
            {routeOnFloor.slice(1).map((n, i) => {
              const prev = routeOnFloor[i];
              return (
                <Line
                  key={`${prev.id}-${n.id}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={n.x}
                  y2={n.y}
                  stroke={Colors.accent}
                  strokeWidth={4}
                  strokeDasharray="6,4"
                />
              );
            })}
            {routeOnFloor.map((n, i) => (
              <G key={`node-${n.id}`}>
                <Circle
                  cx={n.x}
                  cy={n.y}
                  r={i === 0 ? 10 : i === routeOnFloor.length - 1 ? 10 : 6}
                  fill={i === 0 ? Colors.success : i === routeOnFloor.length - 1 ? Colors.accent : '#fff'}
                  stroke={Colors.text}
                  strokeWidth={1.5}
                />
                {(i === 0 || i === routeOnFloor.length - 1) && (
                  <SvgText
                    x={n.x}
                    y={n.y + 4}
                    fill="#fff"
                    fontSize={10}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {i === 0 ? '출' : '도'}
                  </SvgText>
                )}
              </G>
            ))}
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
