import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
    {
      name: 'mv-mobile-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
