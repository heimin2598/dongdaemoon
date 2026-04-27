import { BuildingCode, FloorCode, FloorMap, StoreShape } from '@/types';
import { getStoresByBuildingFloor } from '@/data/stores';
import { MAIN_CATEGORY_COLOR } from '@/data/stores/types';

interface AutoLayoutOptions {
  viewBox?: { width: number; height: number };
  /** 우측/하단 예약 공간 (시설 아이콘용) */
  paddingRight?: number;
  paddingLeft?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** 고정 컬럼 수 (옵션) */
  cols?: number;
  /** 최소 셀 너비/높이 */
  minCellW?: number;
  minCellH?: number;
}

/**
 * (building, floor)의 실제 점포 목록을 받아 가시성 좋게 격자로 자동 배치한다.
 * - 점포 수에 따라 cols를 자동 계산 (너비 대비 높이 비율 1.4~1.8 목표)
 * - 각 점포의 대카테고리에 따라 색상이 자동 매핑됨 (렌더링 단계에서 선택적 사용)
 */
export function autoLayoutStores(
  building: BuildingCode,
  floor: FloorCode,
  opts: AutoLayoutOptions = {},
): StoreShape[] {
  const stores = getStoresByBuildingFloor(building, floor);
  if (stores.length === 0) return [];

  const vb = opts.viewBox ?? { width: 1000, height: 620 };
  const padL = opts.paddingLeft ?? 60;
  const padR = opts.paddingRight ?? 60;
  const padT = opts.paddingTop ?? 60;
  const padB = opts.paddingBottom ?? 60;

  const availW = vb.width - padL - padR;
  const availH = vb.height - padT - padB;

  const count = stores.length;
  // 가로:세로 비율 ~ 1.5 기준으로 cols 추정
  const aspectRatio = availW / availH;
  const estCols = Math.round(Math.sqrt(count * aspectRatio));
  const cols = opts.cols ?? Math.max(4, Math.min(count, estCols));
  const rows = Math.ceil(count / cols);

  const cellW = Math.max(opts.minCellW ?? 28, availW / cols);
  const cellH = Math.max(opts.minCellH ?? 24, availH / rows);

  return stores.map((s, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const unit = s.unit ?? String(i + 1);
    const numericUnit = String(unit).replace(/^0+/, '') || unit;
    return {
      unitNumber: s.code ?? `${building}-${floor}-${unit}`,
      shape: 'rect' as const,
      x: padL + c * cellW,
      y: padT + r * cellH,
      width: cellW - 2,
      height: cellH - 2,
      label: numericUnit,
      name: s.name,
      category: undefined, // 대카테고리는 Store 객체에서 직접 읽음
    };
  });
}

export function buildFloorMap(
  building: BuildingCode,
  floor: FloorCode,
  opts: AutoLayoutOptions & {
    regions?: FloorMap['regions'];
    facilities?: FloorMap['facilities'];
    viewBox?: { width: number; height: number };
  } = {},
): FloorMap {
  const viewBox = opts.viewBox ?? { width: 1000, height: 620 };
  const stores = autoLayoutStores(building, floor, { ...opts, viewBox });
  return {
    building,
    floor,
    viewBox,
    stores,
    regions: opts.regions ?? [],
    facilities: opts.facilities ?? [],
  };
}

export { MAIN_CATEGORY_COLOR };
