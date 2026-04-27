import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@ddm_sherpa/favorites';

interface FavoritesState {
  codes: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (code: string) => Promise<void>;
  remove: (code: string) => Promise<void>;
  toggle: (code: string) => Promise<void>;
  clear: () => Promise<void>;
  has: (code: string) => boolean;
  reorder: (next: string[]) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  codes: [],
  hydrated: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const codes = raw ? (JSON.parse(raw) as string[]) : [];
    set({ codes, hydrated: true });
  },

  add: async (code) => {
    if (get().codes.includes(code)) return;
    const next = [code, ...get().codes];
    set({ codes: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  remove: async (code) => {
    const next = get().codes.filter((c) => c !== code);
    set({ codes: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  toggle: async (code) => {
    if (get().codes.includes(code)) {
      await get().remove(code);
    } else {
      await get().add(code);
    }
  },

  clear: async () => {
    set({ codes: [] });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  has: (code) => get().codes.includes(code),

  reorder: async (next) => {
    set({ codes: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
}));
