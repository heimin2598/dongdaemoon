import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@ddm_sherpa/memos';

interface MemosState {
  /** code → memo text */
  memos: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  get: (code: string) => string;
  set: (code: string, text: string) => Promise<void>;
  remove: (code: string) => Promise<void>;
}

export const useMemosStore = create<MemosState>((setState, getState) => ({
  memos: {},
  hydrated: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const memos = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    setState({ memos, hydrated: true });
  },

  get: (code) => getState().memos[code] ?? '',

  set: async (code, text) => {
    const trimmed = text ?? '';
    const next = { ...getState().memos };
    if (trimmed.trim().length === 0) {
      delete next[code];
    } else {
      next[code] = trimmed;
    }
    setState({ memos: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  remove: async (code) => {
    const next = { ...getState().memos };
    delete next[code];
    setState({ memos: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
}));
