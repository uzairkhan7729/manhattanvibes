'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession(userId: string, accessToken: string, refreshToken: string): void;
  clear(): void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      accessToken: null,
      refreshToken: null,
      setSession: (userId, accessToken, refreshToken) => set({ userId, accessToken, refreshToken }),
      clear: () => set({ userId: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'mv-web-auth' },
  ),
);
