import { create } from 'zustand';
import { User, UserRole, UserStatus } from '@/types';
import * as authLib from '@/lib/auth/firebaseAuth';

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string,
    role?: UserRole,
  ) => Promise<void>;
  signInGoogle: (role?: UserRole, idToken?: string) => Promise<void>;
  signInApple: (role?: UserRole, idToken?: string, rawNonce?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setMyStatus: (status: UserStatus) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  hydrated: false,

  hydrate: async () => {
    const user = await authLib.getCurrentUser();
    set({ user, hydrated: true });
  },

  refreshUser: async () => {
    const user = await authLib.getCurrentUser();
    set({ user });
  },

  signInEmail: async (email, password) => {
    set({ loading: true });
    try {
      const user = await authLib.signInWithEmail(email, password);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signUpEmail: async (email, password, displayName, role = 'visitor') => {
    set({ loading: true });
    try {
      const user = await authLib.signUpWithEmail(email, password, displayName, role);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signInGoogle: async (role = 'visitor', idToken) => {
    set({ loading: true });
    try {
      const user = await authLib.signInWithGoogle(role, idToken);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signInApple: async (role = 'visitor', idToken, rawNonce) => {
    set({ loading: true });
    try {
      const user = await authLib.signInWithApple(role, idToken, rawNonce);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await authLib.signOut();
    set({ user: null });
  },

  resetPassword: async (email) => {
    await authLib.requestPasswordReset(email);
  },

  setMyStatus: async (status) => {
    const current = get().user;
    if (!current) throw new Error('로그인된 사용자가 없습니다.');
    await authLib.setUserStatus(current.email, status);
    set({ user: { ...current, status } });
  },
}));
