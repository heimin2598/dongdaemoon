import { create } from 'zustand';
import { PartsReply, PartsRequest } from '@/types';
import {
  subscribePartsReplies,
  subscribePartsRequest,
  subscribePartsRequests,
} from '@/lib/partsRequests';

interface PartsRequestsState {
  feed: PartsRequest[];
  feedUnsub?: () => void;
  byId: Record<string, PartsRequest | null>;
  reqUnsubs: Record<string, (() => void) | undefined>;
  repliesById: Record<string, PartsReply[]>;
  repliesUnsubs: Record<string, (() => void) | undefined>;

  watchFeed: () => void;
  unwatchFeed: () => void;

  watchRequest: (id: string) => void;
  unwatchRequest: (id: string) => void;

  watchReplies: (id: string) => void;
  unwatchReplies: (id: string) => void;

  unwatchAll: () => void;
}

export const usePartsRequestsStore = create<PartsRequestsState>((set, get) => ({
  feed: [],
  feedUnsub: undefined,
  byId: {},
  reqUnsubs: {},
  repliesById: {},
  repliesUnsubs: {},

  watchFeed: () => {
    if (get().feedUnsub) return;
    const unsub = subscribePartsRequests((list) => set({ feed: list }));
    set({ feedUnsub: unsub });
  },
  unwatchFeed: () => {
    get().feedUnsub?.();
    set({ feedUnsub: undefined });
  },

  watchRequest: (id) => {
    if (get().reqUnsubs[id]) return;
    const unsub = subscribePartsRequest(id, (req) => {
      set((s) => ({ byId: { ...s.byId, [id]: req } }));
    });
    set((s) => ({ reqUnsubs: { ...s.reqUnsubs, [id]: unsub } }));
  },
  unwatchRequest: (id) => {
    get().reqUnsubs[id]?.();
    set((s) => {
      const { [id]: _, ...rest } = s.reqUnsubs;
      return { reqUnsubs: rest };
    });
  },

  watchReplies: (id) => {
    if (get().repliesUnsubs[id]) return;
    const unsub = subscribePartsReplies(id, (list) => {
      set((s) => ({ repliesById: { ...s.repliesById, [id]: list } }));
    });
    set((s) => ({ repliesUnsubs: { ...s.repliesUnsubs, [id]: unsub } }));
  },
  unwatchReplies: (id) => {
    get().repliesUnsubs[id]?.();
    set((s) => {
      const { [id]: _, ...rest } = s.repliesUnsubs;
      return { repliesUnsubs: rest };
    });
  },

  unwatchAll: () => {
    get().feedUnsub?.();
    Object.values(get().reqUnsubs).forEach((u) => u?.());
    Object.values(get().repliesUnsubs).forEach((u) => u?.());
    set({ feedUnsub: undefined, reqUnsubs: {}, repliesUnsubs: {} });
  },
}));
