import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { SearchResult } from '@/types';

const RECENT_KEY = '@ddm_sherpa/recent_searches';
const RECENT_DEST_KEY = '@ddm_sherpa/recent_destinations';

interface SearchState {
  recentQueries: string[];
  recentDestinations: SearchResult[];
  hydrate: () => Promise<void>;
  pushQuery: (q: string) => Promise<void>;
  pushDestination: (d: SearchResult) => Promise<void>;
  clearRecent: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  recentQueries: [],
  recentDestinations: [],

  hydrate: async () => {
    const [q, d] = await Promise.all([
      AsyncStorage.getItem(RECENT_KEY),
      AsyncStorage.getItem(RECENT_DEST_KEY),
    ]);
    set({
      recentQueries: q ? JSON.parse(q) : [],
      recentDestinations: d ? JSON.parse(d) : [],
    });
  },

  pushQuery: async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...get().recentQueries.filter((x) => x !== trimmed)].slice(0, 10);
    set({ recentQueries: next });
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  },

  pushDestination: async (d) => {
    const key = `${d.building}_${d.floor}_${d.unitNumber ?? d.category ?? d.facility ?? d.nodeId}`;
    const current = get().recentDestinations.filter(
      (x) => `${x.building}_${x.floor}_${x.unitNumber ?? x.category ?? x.facility ?? x.nodeId}` !== key,
    );
    const next = [d, ...current].slice(0, 10);
    set({ recentDestinations: next });
    await AsyncStorage.setItem(RECENT_DEST_KEY, JSON.stringify(next));
  },

  clearRecent: async () => {
    set({ recentQueries: [], recentDestinations: [] });
    await AsyncStorage.multiRemove([RECENT_KEY, RECENT_DEST_KEY]);
  },
}));
