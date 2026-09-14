import { create } from 'zustand';
import {
  Review,
  ReviewAggregate,
  subscribeAggregate,
  subscribeReviews,
} from '@/lib/reviews';

interface ReviewsState {
  byShop: Record<string, Review[]>;
  aggBy: Record<string, ReviewAggregate>;
  unsubsList: Record<string, (() => void) | undefined>;
  unsubsAgg: Record<string, (() => void) | undefined>;
  watch: (shopCode: string) => void;
  unwatch: (shopCode: string) => void;
  unwatchAll: () => void;
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  byShop: {},
  aggBy: {},
  unsubsList: {},
  unsubsAgg: {},

  watch: (shopCode) => {
    if (get().unsubsList[shopCode]) return;
    const unsubL = subscribeReviews(shopCode, (reviews) => {
      set((s) => ({ byShop: { ...s.byShop, [shopCode]: reviews } }));
    });
    const unsubA = subscribeAggregate(shopCode, (agg) => {
      set((s) => ({ aggBy: { ...s.aggBy, [shopCode]: agg } }));
    });
    set((s) => ({
      unsubsList: { ...s.unsubsList, [shopCode]: unsubL },
      unsubsAgg: { ...s.unsubsAgg, [shopCode]: unsubA },
    }));
  },

  unwatch: (shopCode) => {
    get().unsubsList[shopCode]?.();
    get().unsubsAgg[shopCode]?.();
    set((s) => {
      const { [shopCode]: _l, ...l } = s.unsubsList;
      const { [shopCode]: _a, ...a } = s.unsubsAgg;
      return { unsubsList: l, unsubsAgg: a };
    });
  },

  unwatchAll: () => {
    Object.values(get().unsubsList).forEach((u) => u?.());
    Object.values(get().unsubsAgg).forEach((u) => u?.());
    set({ unsubsList: {}, unsubsAgg: {} });
  },
}));
