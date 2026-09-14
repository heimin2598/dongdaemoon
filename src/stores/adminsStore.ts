import { create } from 'zustand';
import { subscribeIsAdmin } from '@/lib/admins';

interface AdminsState {
  isAdmin: boolean;
  ready: boolean;             // 첫 응답 받았는지 (true 전엔 unknown 으로 취급)
  unsub?: () => void;
  watch: (uid: string | null | undefined) => void;
  unwatch: () => void;
}

export const useAdminsStore = create<AdminsState>((set, get) => ({
  isAdmin: false,
  ready: false,
  unsub: undefined,

  watch: (uid) => {
    get().unsub?.();
    if (!uid) {
      set({ isAdmin: false, ready: true, unsub: undefined });
      return;
    }
    set({ isAdmin: false, ready: false });
    const unsub = subscribeIsAdmin(uid, (isAdmin) => {
      set({ isAdmin, ready: true });
    });
    set({ unsub });
  },

  unwatch: () => {
    get().unsub?.();
    set({ isAdmin: false, ready: true, unsub: undefined });
  },
}));
