import { BuildingCode, FloorCode, FloorMap, FacilityPoint, StoreShape } from '@/types';
import { BUILDING_ORDER } from '@/constants/buildings';
import { FLOORS } from '@/constants/floors';
import { autoLayoutStores } from './_autoLayout';

/**
 * 단일 소스 지도 설정.
 * - 실제 점포(src/data/stores/directory.json)는 autoLayoutStores가 자동 배치.
 * - 각 (동,층) 별 커스텀 요구사항(옥상 영역, 연결통로, 정형외과 등 이름 붙은 큰 공간)만
 *   이 파일의 FLOOR_CONFIG에 선언한다.
 */

interface FloorConfig {
  viewBox?: { width: number; height: number };
  /** true면 실제 점포 자동 배치 (default). false면 점포는 그리지 않고 regions만 사용 */
  autoStores?: boolean;
  regions?: FloorMap['regions'];
  facilities?: FacilityPoint[];
  /** autoLayoutStores에 전달할 padding/컬럼 옵션 */
  autoLayoutOpts?: {
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    cols?: number;
    minCellW?: number;
    minCellH?: number;
  };
  /** 특정 호수에 고유 커스텀 위치가 있으면 추가 (대표 공간 등) */
  extraStores?: StoreShape[];
}

// 기본값: 적절한 viewBox + 좌측 세로 시설 컬럼 공간 확보
const DEFAULT_VIEWBOX = { width: 1000, height: 620 };
const DEFAULT_PAD = { paddingLeft: 60, paddingRight: 40, paddingTop: 40, paddingBottom: 40 };

const CONFIGS: Partial<Record<string, FloorConfig>> = {
  // ── A동 ─────────────────────────────────────────────
  A_B1F: {
    regions: [
      { id: 'A_B1F_PARKING', label: '지하주차장 연결통로', color: '#555', points: [[40, 540], [960, 540], [960, 600], [40, 600]] },
    ],
    facilities: [
      { id: 'A_B1F_EV', type: 'elevator', x: 500, y: 570, label: 'EV' },
      { id: 'A_B1F_PARKING_ENT', type: 'parking', x: 700, y: 570, label: 'P' },
      { id: 'A_B1F_ES', type: 'escalator', x: 300, y: 570, label: 'ES' },
    ],
  },
  A_1F: {
    facilities: [
      { id: 'A_1F_ENT', type: 'entrance', x: 20, y: 300, label: 'A동 1F 입구' },
      { id: 'A_1F_EV', type: 'elevator', x: 20, y: 200, label: 'EV' },
      { id: 'A_1F_ES', type: 'escalator', x: 20, y: 400, label: 'ES' },
      { id: 'A_1F_WC', type: 'toilet', x: 980, y: 300, label: 'WC' },
    ],
  },
  A_2F: {
    facilities: [
      { id: 'A_2F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'A_2F_CORRIDOR', type: 'corridor', x: 980, y: 300, label: 'A-C 연결통로' },
    ],
  },
  A_3F: {
    facilities: [
      { id: 'A_3F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'A_3F_CORRIDOR', type: 'corridor', x: 980, y: 300, label: 'A-C 연결통로' },
    ],
  },
  A_4F: {
    autoStores: false,
    regions: [
      { id: 'A_4F_MUSINSA', label: '무신사 스튜디오', color: '#1F4FB0', points: [[120, 80], [880, 80], [880, 540], [120, 540]] },
    ],
    facilities: [
      { id: 'A_4F_EV', type: 'elevator', x: 40, y: 300, label: 'EV' },
      { id: 'A_4F_WC', type: 'toilet', x: 40, y: 220, label: 'WC' },
      { id: 'A_4F_ES', type: 'escalator', x: 960, y: 300, label: 'ES' },
    ],
  },
  A_5F: {
    facilities: [
      { id: 'A_5F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'A_5F_ES', type: 'escalator', x: 980, y: 300, label: 'ES' },
    ],
  },
  A_6F: {
    autoStores: false,
    regions: [
      { id: 'A_6F_OFFICE', label: '업무시설', color: '#1F4FB0', points: [[120, 80], [880, 80], [880, 540], [120, 540]] },
    ],
    facilities: [
      { id: 'A_6F_EV', type: 'elevator', x: 40, y: 300, label: 'EV' },
      { id: 'A_6F_WC', type: 'toilet', x: 40, y: 220, label: 'WC' },
      { id: 'A_6F_ES', type: 'escalator', x: 960, y: 300, label: 'ES' },
    ],
  },
  A_7F: {
    autoStores: true,
    autoLayoutOpts: { paddingLeft: 60, paddingRight: 60, paddingTop: 100, paddingBottom: 100, minCellW: 200, minCellH: 200, cols: 2 },
    regions: [
      { id: 'A_7F_OFFICE', label: '사무실', color: '#1F4FB0', points: [[80, 40], [920, 40], [920, 80], [80, 80]] },
    ],
    facilities: [
      { id: 'A_7F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'A_7F_WC', type: 'toilet', x: 20, y: 400, label: 'WC' },
    ],
  },
  A_8F: {
    autoStores: false,
    regions: [
      { id: 'A_8F_PARKING', label: '옥상주차장', color: '#444', points: [[120, 60], [880, 60], [880, 560], [120, 560]] },
    ],
    facilities: [
      { id: 'A_8F_EV', type: 'elevator', x: 40, y: 300, label: 'EV' },
      { id: 'A_8F_P', type: 'parking', x: 960, y: 300, label: 'P' },
    ],
  },
  A_9F: {
    autoStores: false,
    regions: [
      { id: 'A_9F_PARKING', label: '옥상주차장', color: '#444', points: [[120, 60], [880, 60], [880, 560], [120, 560]] },
    ],
    facilities: [{ id: 'A_9F_EV', type: 'elevator', x: 40, y: 300, label: 'EV' }],
  },

  // ── B동 ─────────────────────────────────────────────
  B_B1F: {
    facilities: [
      { id: 'B_B1F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'B_B1F_ES', type: 'escalator', x: 980, y: 300, label: 'ES' },
    ],
  },
  B_1F: {
    facilities: [
      { id: 'B_1F_ENT', type: 'entrance', x: 980, y: 560, label: 'B동 1F 입구' },
      { id: 'B_1F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'B_1F_ES', type: 'escalator', x: 500, y: 580, label: 'ES' },
    ],
  },
  B_2F: {
    facilities: [
      { id: 'B_2F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'B_2F_ES', type: 'escalator', x: 500, y: 580, label: 'ES' },
      { id: 'B_2F_WC', type: 'toilet', x: 20, y: 300, label: 'WC' },
    ],
  },
  B_3F: {
    facilities: [
      { id: 'B_3F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'B_3F_ES', type: 'escalator', x: 500, y: 20, label: 'ES' },
      { id: 'B_3F_WC', type: 'toilet', x: 20, y: 300, label: 'WC' },
    ],
  },
  B_4F: {
    autoStores: true,
    autoLayoutOpts: { paddingLeft: 80, paddingRight: 80, paddingTop: 140, paddingBottom: 140, minCellW: 180, minCellH: 120, cols: 2 },
    regions: [
      { id: 'B_4F_LOUNGE', label: '셰어라운지', color: '#D4345A', points: [[80, 40], [920, 40], [920, 120], [80, 120]] },
      { id: 'B_4F_SHOWROOM', label: '프로덕션 쇼룸 / 사진·방송 스튜디오', color: '#BFBFBF', points: [[80, 490], [920, 490], [920, 590], [80, 590]] },
    ],
    facilities: [
      { id: 'B_4F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'B_4F_WC', type: 'toilet', x: 20, y: 400, label: 'WC' },
      { id: 'B_4F_ES', type: 'escalator', x: 980, y: 300, label: 'ES' },
    ],
  },
  B_5F: {
    facilities: [
      { id: 'B_5F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'B_5F_ES', type: 'escalator', x: 20, y: 300, label: 'ES' },
    ],
  },
  B_6F: {
    autoStores: true,
    autoLayoutOpts: { paddingLeft: 80, paddingRight: 80, paddingTop: 60, paddingBottom: 80, minCellW: 140, minCellH: 80, cols: 4 },
    facilities: [
      { id: 'B_6F_ATM', type: 'atm', x: 20, y: 300, label: 'ATM' },
      { id: 'B_6F_EV', type: 'elevator', x: 20, y: 400, label: 'EV' },
      { id: 'B_6F_WC', type: 'toilet', x: 20, y: 500, label: 'WC' },
      { id: 'B_6F_ES', type: 'escalator', x: 980, y: 400, label: 'ES' },
    ],
  },
  B_7F: {
    autoStores: false,
    regions: [{ id: 'B_7F_PARKING', label: '옥상주차장', color: '#444', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [
      { id: 'B_7F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' },
      { id: 'B_7F_P', type: 'parking', x: 980, y: 300, label: 'P' },
    ],
  },
  B_8F: {
    autoStores: false,
    regions: [{ id: 'B_8F_ROOFTOP', label: '옥상', color: '#7A7A7A', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [{ id: 'B_8F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' }],
  },
  B_9F: {
    autoStores: false,
    regions: [{ id: 'B_9F_ROOFTOP', label: '옥상', color: '#7A7A7A', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [{ id: 'B_9F_EV', type: 'elevator', x: 20, y: 300, label: 'EV' }],
  },

  // ── C동 ─────────────────────────────────────────────
  C_B1F: {
    facilities: [
      { id: 'C_B1F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_B1F_ES', type: 'escalator', x: 980, y: 460, label: 'ES' },
      { id: 'C_B1F_CORRIDOR', type: 'corridor', x: 20, y: 300, label: '연결통로' },
    ],
  },
  C_1F: {
    facilities: [
      { id: 'C_1F_ENT', type: 'entrance', x: 500, y: 600, label: 'C동 1F 입구' },
      { id: 'C_1F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_1F_CORRIDOR', type: 'corridor', x: 980, y: 500, label: '연결통로' },
    ],
  },
  C_2F: {
    facilities: [
      { id: 'C_2F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_2F_CORRIDOR', type: 'corridor', x: 20, y: 300, label: '연결통로' },
    ],
  },
  C_3F: {
    facilities: [
      { id: 'C_3F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_3F_CORRIDOR', type: 'corridor', x: 20, y: 300, label: '연결통로' },
    ],
  },
  C_4F: {
    autoStores: true,
    autoLayoutOpts: { paddingLeft: 60, paddingRight: 60, paddingTop: 120, paddingBottom: 120, minCellW: 200, minCellH: 200, cols: 1 },
    regions: [
      { id: 'C_4F_MUSINSA', label: '무신사 스튜디오', color: '#2E8B57', points: [[80, 40], [920, 40], [920, 100], [80, 100]] },
    ],
    facilities: [
      { id: 'C_4F_EV', type: 'elevator', x: 980, y: 220, label: 'EV' },
      { id: 'C_4F_CORRIDOR', type: 'corridor', x: 20, y: 300, label: '연결통로' },
    ],
  },
  C_5F: {
    facilities: [
      { id: 'C_5F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_5F_ATM', type: 'atm', x: 980, y: 400, label: 'ATM' },
    ],
  },
  C_6F: {
    facilities: [
      { id: 'C_6F_EV', type: 'elevator', x: 500, y: 20, label: 'EV' },
      { id: 'C_6F_WC', type: 'toilet', x: 420, y: 20, label: 'WC' },
      { id: 'C_6F_ES', type: 'escalator', x: 580, y: 20, label: 'ES' },
    ],
  },
  C_7F: {
    autoStores: false,
    regions: [{ id: 'C_7F_PARKING', label: '옥상주차장', color: '#444', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [
      { id: 'C_7F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' },
      { id: 'C_7F_P', type: 'parking', x: 20, y: 300, label: 'P' },
    ],
  },
  C_8F: {
    autoStores: false,
    regions: [{ id: 'C_8F_ROOFTOP', label: '옥상', color: '#7A7A7A', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [{ id: 'C_8F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' }],
  },
  C_9F: {
    autoStores: false,
    regions: [{ id: 'C_9F_ROOFTOP', label: '옥상', color: '#7A7A7A', points: [[80, 60], [920, 60], [920, 560], [80, 560]] }],
    facilities: [{ id: 'C_9F_EV', type: 'elevator', x: 980, y: 300, label: 'EV' }],
  },

  // ── N동 ─────────────────────────────────────────────
  N_B1F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40 },
    regions: [
      { id: 'N_B1F_SUBWAY', label: '지하철 연결 통로', color: '#555', points: [[600, 40], [1060, 40], [1060, 220], [600, 220]] },
      { id: 'N_B1F_PARKING', label: '지하주차장', color: '#333', points: [[600, 240], [1060, 240], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_B1F_SUBWAY_NODE', type: 'subway', x: 830, y: 130, label: '지하철' },
      { id: 'N_B1F_PARKING_NODE', type: 'parking', x: 830, y: 350, label: 'P' },
      { id: 'N_B1F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
    ],
  },
  N_1F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40 },
    regions: [
      { id: 'N_1F_PARKING_IO', label: '옥상주차장 입·출구', color: '#E5B720', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_1F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
      { id: 'N_1F_ENT', type: 'entrance', x: 300, y: 480, label: 'N동 1F 출입구' },
      { id: 'N_1F_PARKING', type: 'parking', x: 830, y: 250, label: 'P' },
    ],
  },
  N_2F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 5 },
    regions: [
      { id: 'N_2F_BANK', label: '하나은행', color: '#E5B720', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_2F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
      { id: 'N_2F_ATM', type: 'atm', x: 830, y: 250, label: 'ATM' },
    ],
  },
  N_3F: {
    viewBox: { width: 1100, height: 500 },
    facilities: [
      { id: 'N_3F_EV', type: 'elevator', x: 540, y: 250, label: 'EV' },
      { id: 'N_3F_WC', type: 'toilet', x: 540, y: 340, label: 'WC' },
    ],
  },
  N_4F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40 },
    regions: [
      { id: 'N_4F_VACANT', label: '공실', color: '#BFBFBF', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_4F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
    ],
  },
  N_5F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 3 },
    regions: [
      { id: 'N_5F_ORTHO', label: '정형외과', color: '#16A085', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_5F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
      { id: 'N_5F_ATM', type: 'atm', x: 280, y: 480, label: 'ATM' },
    ],
  },
  N_6F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 1, minCellW: 400, minCellH: 300 },
    regions: [
      { id: 'N_6F_DENTAL', label: '치과', color: '#16A085', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_6F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
    ],
  },
  N_7F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 1, minCellW: 400, minCellH: 300 },
    regions: [
      { id: 'N_7F_PARKING_CORRIDOR', label: '옥상주차장 연결통로', color: '#444', points: [[600, 40], [1060, 40], [1060, 460], [600, 460]] },
    ],
    facilities: [
      { id: 'N_7F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' },
      { id: 'N_7F_P', type: 'parking', x: 830, y: 250, label: 'P' },
    ],
  },
  N_8F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 1, minCellW: 400, minCellH: 200 },
    regions: [
      { id: 'N_8F_FULFILLMENT', label: '동대문 풀필먼트 센터', color: '#E5B720', points: [[600, 40], [1060, 40], [1060, 240], [600, 240]] },
      { id: 'N_8F_MARU', label: '전통공연창작 「마루」', color: '#D4A017', points: [[600, 260], [1060, 260], [1060, 460], [600, 460]] },
    ],
    facilities: [{ id: 'N_8F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' }],
  },
  N_9F: {
    viewBox: { width: 1100, height: 500 },
    autoLayoutOpts: { paddingLeft: 40, paddingRight: 520, paddingTop: 40, paddingBottom: 40, cols: 1, minCellW: 400, minCellH: 200 },
    regions: [
      { id: 'N_9F_MARU_A', label: '전통공연창작 「마루」 (A)', color: '#E5B720', points: [[600, 40], [1060, 40], [1060, 240], [600, 240]] },
      { id: 'N_9F_MARU_B', label: '전통공연창작 「마루」 (B)', color: '#D4A017', points: [[600, 260], [1060, 260], [1060, 360], [600, 360]] },
      { id: 'N_9F_GARDEN', label: '옥상정원', color: '#7BB37A', points: [[600, 380], [1060, 380], [1060, 460], [600, 460]] },
    ],
    facilities: [{ id: 'N_9F_EV', type: 'elevator', x: 20, y: 250, label: 'EV' }],
  },
};

function buildMap(building: BuildingCode, floor: FloorCode): FloorMap {
  const key = `${building}_${floor}`;
  const cfg = CONFIGS[key] ?? {};
  const viewBox = cfg.viewBox ?? DEFAULT_VIEWBOX;

  const wantsStores = cfg.autoStores !== false;
  const layoutOpts = {
    viewBox,
    ...DEFAULT_PAD,
    ...(cfg.autoLayoutOpts ?? {}),
  };

  const stores: StoreShape[] = [];
  if (wantsStores) {
    stores.push(...autoLayoutStores(building, floor, layoutOpts));
  }
  if (cfg.extraStores) {
    stores.push(...cfg.extraStores);
  }

  return {
    building,
    floor,
    viewBox,
    stores,
    regions: cfg.regions ?? [],
    facilities: cfg.facilities ?? [],
  };
}

const MAP_CACHE = new Map<string, FloorMap>();

export function getFloorMap(building: BuildingCode, floor: FloorCode): FloorMap {
  const key = `${building}_${floor}`;
  if (!MAP_CACHE.has(key)) {
    MAP_CACHE.set(key, buildMap(building, floor));
  }
  return MAP_CACHE.get(key)!;
}

export function hasDetailedMap(_b: BuildingCode, _f: FloorCode): boolean {
  return true;
}

export function listAllMaps(): Array<{ building: BuildingCode; floor: FloorCode }> {
  const result: Array<{ building: BuildingCode; floor: FloorCode }> = [];
  for (const b of BUILDING_ORDER) {
    for (const f of FLOORS) {
      result.push({ building: b, floor: f });
    }
  }
  return result;
}
