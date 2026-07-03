import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FraudBlockedStore {
  isDeviceBlocked: boolean;
  blockReason: 'no_data' | 'low_ratio' | null;
  blockedAt: string | null;
  markBlocked: (reason: 'no_data' | 'low_ratio') => void;
  clearBlock: () => void;
}

export const useFraudBlockedStore = create<FraudBlockedStore>()(
  persist(
    (set) => ({
      isDeviceBlocked: false,
      blockReason: null,
      blockedAt: null,
      markBlocked: (reason) => set({ isDeviceBlocked: true, blockReason: reason, blockedAt: new Date().toISOString() }),
      clearBlock: () => set({ isDeviceBlocked: false, blockReason: null, blockedAt: null }),
    }),
    { name: 'fraud-blocked-device' }
  )
);
