import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  estimatedUnitPrice: number;
  sizeCode?: 'S' | 'M' | 'L' | 'XL';
  crustCode?: string;
  toppingIds?: string[];
  sauceIds?: string[];
}

interface CartState {
  branchId: string | null;
  lines: CartLine[];
  setBranch(id: string | null): void;
  add(line: Omit<CartLine, 'id'>): void;
  setQty(id: string, qty: number): void;
  remove(id: string): void;
  clear(): void;
}

let counter = 0;
const newId = (): string => `${Date.now().toString(36)}-${++counter}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      branchId: null,
      lines: [],
      setBranch: (id) => set({ branchId: id }),
      add: (line) => set((s) => ({ lines: [...s.lines, { ...line, id: newId() }] })),
      setQty: (id, qty) => set((s) => ({ lines: s.lines.map((l) => l.id === id ? { ...l, qty: Math.max(1, qty) } : l) })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'mv-mobile-cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
