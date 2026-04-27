import React from 'react';
import { SvgProps } from 'react-native-svg';
import { FloorCode } from '@/types';
import Floor2F from '@assets/maps/floors/floor_2F.svg';

/**
 * 층별 벡터 배경 지도. 아직 SVG 없는 층은 null — 호출부가 PNG fallback.
 */
const SVG_MAP: Partial<Record<FloorCode, React.FC<SvgProps>>> = {
  '2F': Floor2F,
};

export function getFloorSvg(floor: FloorCode): React.FC<SvgProps> | null {
  return SVG_MAP[floor] ?? null;
}

export function hasFloorSvg(floor: FloorCode): boolean {
  return floor in SVG_MAP;
}
