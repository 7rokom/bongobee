import { create } from 'zustand';

export interface ResellerCodeOverride {
  headerCode: string;
  bodyCode: string;
  footerCode: string;
}

interface State {
  override: ResellerCodeOverride | null;
  setOverride: (o: ResellerCodeOverride | null) => void;
}

/**
 * When set (on a reseller's single product page whose reseller has their own
 * tracking codes), SiteSettingsInitializer will SUPPRESS the admin's main
 * pixels and inject the reseller's codes instead. Cleared on unmount.
 */
export const useResellerCodeOverrideStore = create<State>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));
