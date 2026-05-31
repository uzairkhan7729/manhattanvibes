import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  fullName: { ar?: string; en: string };
  phone: string;
  email?: string;
  role: string;
  tenantId: string;
  branchIds: string[];
  preferredLanguage: 'ar' | 'en';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  setSession(user: User, accessToken: string, refreshToken: string, expiresIn: number): void;
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void;
  setUser(user: User): void;
  clear(): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      setSession: (user, accessToken, refreshToken, expiresIn) => set({
        user, accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000,
      }),
      setTokens: (accessToken, refreshToken, expiresIn) => set({
        accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000,
      }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null, expiresAt: null }),
    }),
    { name: 'mv-admin-auth' },
  ),
);
