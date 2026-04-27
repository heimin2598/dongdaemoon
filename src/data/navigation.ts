import { NavEdge, NavNode } from '@/types';

/**
 * 1차 MVP 길찾기 네트워크 — 핵심 교차점만 정의.
 * 추후 각 층별 지도 데이터화가 진행되면 노드/엣지를 세분화한다.
 */

export const NAV_NODES: NavNode[] = [
  // ── B동 ─────────────────────────────────────────────
  { id: 'B_1F_ENT', building: 'B', floor: '1F', x: 500, y: 550, type: 'entrance', label: 'B동 1층 출입구' },
  { id: 'B_1F_EV', building: 'B', floor: '1F', x: 60, y: 350, type: 'elevator' },
  { id: 'B_1F_ES', building: 'B', floor: '1F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_2F_EV', building: 'B', floor: '2F', x: 60, y: 350, type: 'elevator' },
  { id: 'B_2F_ES', building: 'B', floor: '2F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_3F_EV', building: 'B', floor: '3F', x: 60, y: 350, type: 'elevator' },
  { id: 'B_3F_ES', building: 'B', floor: '3F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_4F_EV', building: 'B', floor: '4F', x: 60, y: 350, type: 'elevator' },
  { id: 'B_4F_ES', building: 'B', floor: '4F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_5F_EV', building: 'B', floor: '5F', x: 60, y: 350, type: 'elevator' },
  { id: 'B_5F_ES', building: 'B', floor: '5F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_6F_EV', building: 'B', floor: '6F', x: 72, y: 500, type: 'elevator' },
  { id: 'B_6F_ATM', building: 'B', floor: '6F', x: 72, y: 400, type: 'atm' },
  { id: 'B_6F_WC', building: 'B', floor: '6F', x: 72, y: 575, type: 'toilet' },
  { id: 'B_6F_ES', building: 'B', floor: '6F', x: 260, y: 500, type: 'escalator' },
  { id: 'B_6F_FOOD', building: 'B', floor: '6F', x: 360, y: 540, type: 'junction', label: '식당가 중앙' },

  // ── A동 ─────────────────────────────────────────────
  { id: 'A_1F_ENT', building: 'A', floor: '1F', x: 500, y: 550, type: 'entrance', label: 'A동 1층 출입구' },
  { id: 'A_1F_EV', building: 'A', floor: '1F', x: 500, y: 400, type: 'elevator' },
  { id: 'A_2F_EV', building: 'A', floor: '2F', x: 500, y: 400, type: 'elevator' },
  { id: 'A_2F_CORRIDOR', building: 'A', floor: '2F', x: 900, y: 300, type: 'corridor', label: 'A-C 연결통로 2F' },
  { id: 'A_3F_EV', building: 'A', floor: '3F', x: 500, y: 400, type: 'elevator' },
  { id: 'A_3F_CORRIDOR', building: 'A', floor: '3F', x: 900, y: 300, type: 'corridor', label: 'A-C 연결통로 3F' },
  { id: 'A_6F_EV', building: 'A', floor: '6F', x: 60, y: 340, type: 'elevator' },
  { id: 'A_6F_WC', building: 'A', floor: '6F', x: 60, y: 260, type: 'toilet' },
  { id: 'A_6F_ES', building: 'A', floor: '6F', x: 940, y: 340, type: 'escalator' },
  { id: 'A_7F_EV', building: 'A', floor: '7F', x: 60, y: 340, type: 'elevator' },
  { id: 'A_7F_PHARMACY', building: 'A', floor: '7F', x: 700, y: 300, type: 'pharmacy', label: '약국' },
  { id: 'A_7F_MEDICAL', building: 'A', floor: '7F', x: 700, y: 460, type: 'junction', label: '내과·검진센터' },

  // ── C동 ─────────────────────────────────────────────
  { id: 'C_1F_ENT', building: 'C', floor: '1F', x: 500, y: 550, type: 'entrance', label: 'C동 1층 출입구' },
  { id: 'C_2F_CORRIDOR', building: 'C', floor: '2F', x: 100, y: 300, type: 'corridor', label: 'A-C 연결통로 2F' },
  { id: 'C_3F_CORRIDOR', building: 'C', floor: '3F', x: 100, y: 300, type: 'corridor', label: 'A-C 연결통로 3F' },
  { id: 'C_6F_EV', building: 'C', floor: '6F', x: 500, y: 20, type: 'elevator' },
  { id: 'C_6F_WC', building: 'C', floor: '6F', x: 420, y: 20, type: 'toilet' },
  { id: 'C_6F_ES', building: 'C', floor: '6F', x: 580, y: 20, type: 'escalator' },

  // ── N동 ─────────────────────────────────────────────
  { id: 'N_B1F_SUBWAY', building: 'N', floor: 'B1F', x: 500, y: 400, type: 'subway', label: '지하철 연결통로' },
  { id: 'N_1F_ENT', building: 'N', floor: '1F', x: 500, y: 300, type: 'entrance', label: 'N동 1층 옥상주차장 입·출구' },
  { id: 'N_6F_EV', building: 'N', floor: '6F', x: 40, y: 260, type: 'elevator' },
  { id: 'N_6F_WC', building: 'N', floor: '6F', x: 40, y: 340, type: 'toilet' },
  { id: 'N_6F_FOODCOURT', building: 'N', floor: '6F', x: 280, y: 270, type: 'junction', label: '푸드코트' },
  { id: 'N_6F_ATM', building: 'N', floor: '6F', x: 180, y: 450, type: 'atm' },
  { id: 'N_6F_MEDICAL', building: 'N', floor: '6F', x: 790, y: 310, type: 'junction', label: '치과' },
  { id: 'N_6F_CORRIDOR', building: 'N', floor: '6F', x: 560, y: 360, type: 'corridor' },
];

export const NAV_EDGES: NavEdge[] = [
  // B동 층간 엘리베이터
  { from: 'B_1F_EV', to: 'B_2F_EV', weight: 15, mode: 'elevator' },
  { from: 'B_2F_EV', to: 'B_3F_EV', weight: 15, mode: 'elevator' },
  { from: 'B_3F_EV', to: 'B_4F_EV', weight: 15, mode: 'elevator' },
  { from: 'B_4F_EV', to: 'B_5F_EV', weight: 15, mode: 'elevator' },
  { from: 'B_5F_EV', to: 'B_6F_EV', weight: 15, mode: 'elevator' },
  // B동 층간 에스컬레이터
  { from: 'B_1F_ES', to: 'B_2F_ES', weight: 20, mode: 'escalator' },
  { from: 'B_2F_ES', to: 'B_3F_ES', weight: 20, mode: 'escalator' },
  { from: 'B_3F_ES', to: 'B_4F_ES', weight: 20, mode: 'escalator' },
  { from: 'B_4F_ES', to: 'B_5F_ES', weight: 20, mode: 'escalator' },
  { from: 'B_5F_ES', to: 'B_6F_ES', weight: 20, mode: 'escalator' },
  // B동 층내
  { from: 'B_1F_ENT', to: 'B_1F_EV', weight: 30, mode: 'walk' },
  { from: 'B_1F_ENT', to: 'B_1F_ES', weight: 25, mode: 'walk' },
  { from: 'B_6F_EV', to: 'B_6F_ATM', weight: 8, mode: 'walk' },
  { from: 'B_6F_EV', to: 'B_6F_WC', weight: 8, mode: 'walk' },
  { from: 'B_6F_EV', to: 'B_6F_FOOD', weight: 18, mode: 'walk' },
  { from: 'B_6F_ES', to: 'B_6F_FOOD', weight: 10, mode: 'walk' },

  // A동 층간
  { from: 'A_1F_EV', to: 'A_2F_EV', weight: 15, mode: 'elevator' },
  { from: 'A_2F_EV', to: 'A_3F_EV', weight: 15, mode: 'elevator' },
  { from: 'A_3F_EV', to: 'A_6F_EV', weight: 30, mode: 'elevator' },
  { from: 'A_6F_EV', to: 'A_7F_EV', weight: 15, mode: 'elevator' },
  // A동 층내
  { from: 'A_1F_ENT', to: 'A_1F_EV', weight: 25, mode: 'walk' },
  { from: 'A_2F_EV', to: 'A_2F_CORRIDOR', weight: 30, mode: 'walk' },
  { from: 'A_3F_EV', to: 'A_3F_CORRIDOR', weight: 30, mode: 'walk' },
  { from: 'A_6F_EV', to: 'A_6F_WC', weight: 10, mode: 'walk' },
  { from: 'A_6F_EV', to: 'A_6F_ES', weight: 40, mode: 'walk' },
  { from: 'A_7F_EV', to: 'A_7F_PHARMACY', weight: 25, mode: 'walk' },
  { from: 'A_7F_EV', to: 'A_7F_MEDICAL', weight: 30, mode: 'walk' },

  // A-C 연결통로
  { from: 'A_2F_CORRIDOR', to: 'C_2F_CORRIDOR', weight: 15, mode: 'corridor' },
  { from: 'A_3F_CORRIDOR', to: 'C_3F_CORRIDOR', weight: 15, mode: 'corridor' },

  // C동 층내/층간 (일부)
  { from: 'C_1F_ENT', to: 'C_2F_CORRIDOR', weight: 40, mode: 'walk' },
  { from: 'C_2F_CORRIDOR', to: 'C_3F_CORRIDOR', weight: 20, mode: 'escalator' },
  { from: 'C_3F_CORRIDOR', to: 'C_6F_EV', weight: 45, mode: 'elevator' },
  { from: 'C_6F_EV', to: 'C_6F_WC', weight: 8, mode: 'walk' },
  { from: 'C_6F_EV', to: 'C_6F_ES', weight: 10, mode: 'walk' },

  // N동 층간/층내
  { from: 'N_B1F_SUBWAY', to: 'N_1F_ENT', weight: 30, mode: 'escalator' },
  { from: 'N_1F_ENT', to: 'N_6F_EV', weight: 60, mode: 'elevator' },
  { from: 'N_6F_EV', to: 'N_6F_WC', weight: 8, mode: 'walk' },
  { from: 'N_6F_EV', to: 'N_6F_FOODCOURT', weight: 25, mode: 'walk' },
  { from: 'N_6F_FOODCOURT', to: 'N_6F_ATM', weight: 18, mode: 'walk' },
  { from: 'N_6F_FOODCOURT', to: 'N_6F_CORRIDOR', weight: 30, mode: 'walk' },
  { from: 'N_6F_CORRIDOR', to: 'N_6F_MEDICAL', weight: 25, mode: 'corridor' },

  // 1F 동 간 이동 (외부 보행로 가정)
  { from: 'B_1F_ENT', to: 'A_1F_ENT', weight: 50, mode: 'walk' },
  { from: 'A_1F_ENT', to: 'C_1F_ENT', weight: 40, mode: 'walk' },
  { from: 'C_1F_ENT', to: 'N_1F_ENT', weight: 40, mode: 'walk' },
];
