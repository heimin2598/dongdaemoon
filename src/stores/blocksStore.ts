import { create } from 'zustand';
import { auth } from '@/lib/firebase';
import { BlockedEntry, subscribeBlocked } from '@/lib/blocks';

interface BlocksState {
  list: BlockedEntry[];
  blockedSet: Set<string>;     // uid set — 빠른 lookup
  unsub?: () => void;
  watch: () => void;
  unwatch: () => void;
  isBlocked: (uid: string) => boolean;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  list: [],
  blockedSet: new Set(),
  unsub: undefined,

  watch: () => {
    if (get().unsub) return;
    if (!auth.currentUser) return;
    const unsub = subscribeBlocked((list) => {
      set({
        list,
        blockedSet: new Set(list.map((b) => b.blockedUid)),
      });
    });
    set({ unsub });
  },

  unwatch: () => {
    get().unsub?.();
    set({ unsub: undefined, list: [], blockedSet: new Set() });
  },

  isBlocked: (uid: string) => get().blockedSet.has(uid),
}));
