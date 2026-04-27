import { BuildingCode } from '@/types';

export const BUILDINGS: Array<{
  code: BuildingCode;
  label: string;
  description: string;
}> = [
  { code: 'A', label: 'A동', description: '중앙/남쪽 블록 — JW Marriott 방향' },
  { code: 'B', label: 'B동', description: '서쪽 독립 블록 — 사다리꼴 구조' },
  { code: 'C', label: 'C동', description: 'A동 위쪽' },
  { code: 'N', label: 'N동', description: '북쪽 블록 — 동대문역 9번출구' },
];

export const BUILDING_ORDER: BuildingCode[] = ['B', 'A', 'C', 'N'];
