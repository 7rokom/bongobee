import { create } from 'zustand';
import { api } from '@/lib/api';

export interface FraudSettings {
  enabled: boolean; minDeliveryPercent: number; blockOnNoData: boolean;
  apiProvider: string; customApiUrl: string; customApiKey: string; bdcourierApiKey: string;
  // Cooldown settings
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownMessage: string;
  // Fraud popup settings
  fraudPopupEnabled: boolean;
  noDataMessage: string;
  lowRatioMessage: string;
  // Post-order popup settings
  postOrderPopupEnabled: boolean;
  postOrderChooseTitle: string;
  postOrderChooseMessage: string;
  postOrderDirectBtnText: string;
  postOrderCallBtnText: string;
  postOrderDirectSuccessTitle: string;
  postOrderDirectSuccessMessage: string;
  postOrderCallSuccessTitle: string;
  postOrderCallSuccessMessage: string;
}

const DEFAULT_COOLDOWN_MESSAGE = "প্রিয় গ্রাহক! আপনি ইতিমধ্যে ১বার অর্ডার করেছেন। আমাদের ওয়েবসাইটে প্রতি ২ ঘন্টায় ১ বারের বেশি অর্ডার করা যায় না। ধন্যবাদ!";
const DEFAULT_NO_DATA_MESSAGE = "প্রিয় গ্রাহক! আপনি আগে কখনো অনলাইন থেকে অর্ডার করেন নি। তাই সরাসরি আপনার অর্ডার গ্রহণ করা সম্ভব হচ্ছে না। ২৪ ঘন্টার মধ্যে আপনার অর্ডার গ্রহণ করার জন্য আমাদের প্রতিনিধি আপনাকে কল করবে। ধন্যবাদ!";
const DEFAULT_LOW_RATIO_MESSAGE = "প্রিয় গ্রাহক! আপনার প্রোডাক্ট রিভিস রেশিও পর্যাপ্ত না। তাই সরাসরি আপনার অর্ডার গ্রহণ করা সম্ভব হচ্ছে না। ২৪ ঘন্টার মধ্যে আপনার অর্ডার গ্রহণ করার জন্য আমাদের প্রতিনিধি আপনাকে কল করবে। ধন্যবাদ!";

const DEFAULT_POST_ORDER_CHOOSE_TITLE = "প্রিয় গ্রাহক!";
const DEFAULT_POST_ORDER_CHOOSE_MESSAGE = "আমরা কি আপনার অর্ডারকৃত প্রোডাকটি সরাসরি পাঠিয়ে দেবো?\nনাকি পাঠানোর আগে আপনাকে কল করবো?";
const DEFAULT_POST_ORDER_DIRECT_BTN = "জি, সরাসরি পাঠিয়ে দিন।";
const DEFAULT_POST_ORDER_CALL_BTN = "না, পাঠানোর আগে কল দিবেন।";
const DEFAULT_POST_ORDER_DIRECT_SUCCESS_TITLE = "প্রিয় গ্রাহক! ইনশাআল্লাহ";
const DEFAULT_POST_ORDER_DIRECT_SUCCESS_MESSAGE = "আমরা আপনার নোট দেখে প্রোডাক্ট পাঠিয়ে দেবো।\n\nঢাকার মধ্যে হলে ১-২ দিন এবং ঢাকার বাহিরে হলে ২-৪ দিনের মধ্যে প্রোডাক্ট হাতে পেয়ে যাবেন। ধন্যবাদ!";
const DEFAULT_POST_ORDER_CALL_SUCCESS_TITLE = "প্রিয় গ্রাহক!";
const DEFAULT_POST_ORDER_CALL_SUCCESS_MESSAGE = "আমরা আপনার অর্ডারটি গ্রহণ করেছি। ২৪ ঘন্টার মধ্যে আমাদের কল সেন্টার থেকে আপনাকে কল করা হবে। দয়া করে সময় দিয়ে সহযোগিতা করবেন প্লিজ!";

interface FraudSettingsStore extends FraudSettings {
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<FraudSettings>) => Promise<void>;
  flushSettings: () => Promise<void>;
}

// ----- Debounced + serialized API writer (merges server-side) -----
let pendingUpdates: Partial<FraudSettings> = {};
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflightWrite: Promise<void> | null = null;
const DEBOUNCE_MS = 600;

const flushPending = async (): Promise<void> => {
  if (Object.keys(pendingUpdates).length === 0) return;
  if (inflightWrite) { try { await inflightWrite; } catch { /* ignore */ } }

  const updatesToWrite = pendingUpdates;
  pendingUpdates = {};

  inflightWrite = (async () => {
    try {
      // Never overwrite an existing bdcourierApiKey with an empty string.
      const safeUpdates: Partial<FraudSettings> = { ...updatesToWrite };
      if ('bdcourierApiKey' in safeUpdates && (!safeUpdates.bdcourierApiKey || safeUpdates.bdcourierApiKey.trim() === '')) {
        delete safeUpdates.bdcourierApiKey;
      }
      // Backend merges this patch into the stored fraud_settings blob.
      await api.put('/admin/fraud-settings', safeUpdates);
    } finally {
      inflightWrite = null;
    }
  })();

  await inflightWrite;
  if (Object.keys(pendingUpdates).length > 0) await flushPending();
};

const scheduleFlush = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushPending().catch(() => { /* next write retries */ });
  }, DEBOUNCE_MS);
};

export const useFraudSettingsStore = create<FraudSettingsStore>()((set) => ({
  enabled: false, minDeliveryPercent: 50, blockOnNoData: true,
  apiProvider: 'bdcourier', customApiUrl: '', customApiKey: '', bdcourierApiKey: '',
  cooldownEnabled: true, cooldownMinutes: 120,
  cooldownMessage: DEFAULT_COOLDOWN_MESSAGE,
  fraudPopupEnabled: true,
  noDataMessage: DEFAULT_NO_DATA_MESSAGE,
  lowRatioMessage: DEFAULT_LOW_RATIO_MESSAGE,
  postOrderPopupEnabled: true,
  postOrderChooseTitle: DEFAULT_POST_ORDER_CHOOSE_TITLE,
  postOrderChooseMessage: DEFAULT_POST_ORDER_CHOOSE_MESSAGE,
  postOrderDirectBtnText: DEFAULT_POST_ORDER_DIRECT_BTN,
  postOrderCallBtnText: DEFAULT_POST_ORDER_CALL_BTN,
  postOrderDirectSuccessTitle: DEFAULT_POST_ORDER_DIRECT_SUCCESS_TITLE,
  postOrderDirectSuccessMessage: DEFAULT_POST_ORDER_DIRECT_SUCCESS_MESSAGE,
  postOrderCallSuccessTitle: DEFAULT_POST_ORDER_CALL_SUCCESS_TITLE,
  postOrderCallSuccessMessage: DEFAULT_POST_ORDER_CALL_SUCCESS_MESSAGE,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      // Public read — the storefront needs the popup/cooldown messages & flags.
      const data = await api.get('/public/fraud-settings');
      if (data && typeof data === 'object') set({ ...data });
    } catch { /* keep defaults */ }
    set({ loading: false });
  },

  updateSettings: async (updates) => {
    set((s) => ({ ...s, ...updates }));            // optimistic
    pendingUpdates = { ...pendingUpdates, ...updates };
    scheduleFlush();
  },

  flushSettings: async () => {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    await flushPending();
  },
}));
