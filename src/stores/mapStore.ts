import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { BuildingCode, FloorCode } from '@/types';

export type BuildingTabValue = BuildingCode | 'ALL';
export type MapOrientation = 'portrait' | 'landscape';

const STORAGE_KEY = '@ddm_sherpa/map_state';

interface MapState {
  selectedBuilding: BuildingCode;
  selectedFloor: FloorCode;
  /** 지도 탭 선택 상태 (개별 동 또는 'ALL' 전체) */
  selectedTab: BuildingTabValue;
  /** 지도 화면 레이아웃 방향 */
  orientation: MapOrientation;
  highlightedUnit: string | null;
  highlightedFacilityId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setBuilding: (b: BuildingCode) => void;
  setFloor: (f: FloorCode) => void;
  setTab: (t: BuildingTabValue) => void;
  setOrientation: (o: MapOrientation) => void;
  setHighlight: (unit: string | null, facilityId?: string | null) => void;
  clearHighlight: () => void;
}

interface Persisted {
  selectedBuilding: BuildingCode;
  selectedFloor: FloorCode;
  selectedTab: BuildingTabValue;
  orientation: MapOrientation;
}

async function persist(state: Persisted) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 UX에 영향 주지 않음
  }
}

export const useMapStore = create<MapState>((set, get) => ({
  selectedBuilding: 'B',
  selectedFloor: '6F',
  selectedTab: 'ALL',
  orientation: 'portrait',
  highlightedUnit: null,
  highlightedFacilityId: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        set({
          selectedBuilding: saved.selectedBuilding ?? 'B',
          selectedFloor: saved.selectedFloor ?? '6F',
          selectedTab: saved.selectedTab ?? 'ALL',
          orientation: saved.orientation ?? 'portrait',
          hydrated: true,
        });
        return;
      }
    } catch {
      // ignore
    }
    set({ hydrated: true });
  },

  setBuilding: (b) => {
    set({ selectedBuilding: b });
    const s = get();
    persist({ selectedBuilding: b, selectedFloor: s.selectedFloor, selectedTab: s.selectedTab, orientation: s.orientation });
  },

  setFloor: (f) => {
    set({ selectedFloor: f });
    const s = get();
    persist({ selectedBuilding: s.selectedBuilding, selectedFloor: f, selectedTab: s.selectedTab, orientation: s.orientation });
  },

  setTab: (t) => {
    set({ selectedTab: t });
    const s = get();
    persist({ selectedBuilding: s.selectedBuilding, selectedFloor: s.selectedFloor, selectedTab: t, orientation: s.orientation });
  },

  setOrientation: (o) => {
    set({ orientation: o });
    const s = get();
    persist({ selectedBuilding: s.selectedBuilding, selectedFloor: s.selectedFloor, selectedTab: s.selectedTab, orientation: o });
  },

  setHighlight: (unit, facilityId = null) =>
    set({ highlightedUnit: unit, highlightedFacilityId: facilityId }),

  clearHighlight: () => set({ highlightedUnit: null, highlightedFacilityId: null }),
}));
