import { create } from 'zustand';
import { PhotoMemo, subscribePhotoMemos } from '@/lib/photoMemos';

interface PhotoMemosState {
  byShop: Record<string, PhotoMemo[]>;
  loading: Record<string, boolean>;
  unsubs: Record<string, (() => void) | undefined>;
  watch: (shopCode: string) => void;
  unwatch: (shopCode: string) => void;
  unwatchAll: () => void;
}

export const usePhotoMemosStore = create<PhotoMemosState>((set, get) => ({
  byShop: {},
  loading: {},
  unsubs: {},

  watch: (shopCode) => {
    const existing = get().unsubs[shopCode];
    if (existing) return;
    set((s) => ({ loading: { ...s.loading, [shopCode]: true } }));
    const unsub = subscribePhotoMemos(shopCode, (photos) => {
      set((s) => ({
        byShop: { ...s.byShop, [shopCode]: photos },
        loading: { ...s.loading, [shopCode]: false },
      }));
    });
    set((s) => ({ unsubs: { ...s.unsubs, [shopCode]: unsub } }));
  },

  unwatch: (shopCode) => {
    const unsub = get().unsubs[shopCode];
    if (unsub) unsub();
    set((s) => {
      const { [shopCode]: _u, ...restUnsubs } = s.unsubs;
      return { unsubs: restUnsubs };
    });
  },

  unwatchAll: () => {
    Object.values(get().unsubs).forEach((u) => u?.());
    set({ unsubs: {} });
  },
}));
