import { normalizePhone } from '@/lib/order-validation';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { api } from '@/lib/api';

export interface FraudCheckResult {
  passed: boolean;
  reason?: 'no_data' | 'low_ratio';
  all?: number;
  delivered?: number;
  returned?: number;
  deliveryPercent?: number;
}

interface CourierCheckResponse {
  all?: number;
  delivered?: number;
  returned?: number;
  error?: string;
}

/**
 * Fetches courier ratio from BDCourier and caches it in the store + DB,
 * regardless of whether fraud blocking is enabled. Safe to call from any
 * checkout flow (main, landing, reseller).
 */
export const fetchAndCacheCourierRatio = async (
  phone: string,
  apiKeyOverride?: string,
): Promise<{ all: number; delivered: number; returned: number } | null> => {
  const normalized = normalizePhone(phone);
  if (normalized.length < 11) return null;
  try {
    const settings = useFraudSettingsStore.getState();
    const apiKey = apiKeyOverride || settings.bdcourierApiKey || '';
    const doCheck = async () => {
      return (await api.post('/public/courier-check', { phone: normalized, ...(apiKey ? { apiKey } : {}) })) as CourierCheckResponse;
    };
    let data: CourierCheckResponse;
    try { data = await doCheck(); }
    catch { await new Promise(r => setTimeout(r, 800)); data = await doCheck(); }
    if (data.error) {
      console.warn('[fraud-check] courier ratio API error:', data.error);
      return null;
    }
    const all = data.all || 0;
    const delivered = data.delivered || 0;
    const returned = data.returned || 0;
    try {
      const { useCourierRatioStore } = await import('@/stores/useCourierRatioStore');
      await useCourierRatioStore.getState().saveRatio(normalized, { all, delivered, returned });
    } catch (cacheError) {
      console.warn('[fraud-check] courier ratio cache skipped:', cacheError);
    }
    return { all, delivered, returned };
  } catch (err) {
    console.warn('[fraud-check] fetchAndCacheCourierRatio failed:', err);
    return null;
  }
};

export const checkFraud = async (phone: string): Promise<FraudCheckResult> => {
  const settings = useFraudSettingsStore.getState();
  const normalized = normalizePhone(phone);
  if (normalized.length < 11) return { passed: true };

  // Always try to cache the courier ratio so it shows up in orders pages,
  // even if fraud blocking is disabled.
  if (!settings.enabled) {
    await fetchAndCacheCourierRatio(normalized);
    return { passed: true };
  }


  try {
    const doCheck = async (): Promise<{all: number; delivered: number; returned: number}> => {
      return await api.post('/public/courier-check', {
        phone: normalized,
        ...(settings.bdcourierApiKey ? { apiKey: settings.bdcourierApiKey } : {}),
      });
    };

    let data: CourierCheckResponse;
    try {
      data = await doCheck();
    } catch {
      // Retry once on network failure
      await new Promise(r => setTimeout(r, 1000));
      data = await doCheck();
    }

    if (data.error) {
      console.warn('[fraud-check] courier check API error:', data.error);
      return { passed: !settings.blockOnNoData, reason: 'no_data' };
    }

    const all = data.all || 0;
    const delivered = data.delivered || 0;
    const returned = data.returned || 0;

    try {
      const { useCourierRatioStore } = await import('@/stores/useCourierRatioStore');
      await useCourierRatioStore.getState().saveRatio(normalized, { all, delivered, returned });
    } catch (cacheError) {
      console.warn('[fraud-check] courier ratio cache skipped:', cacheError);
    }

    if (all === 0) {
      return {
        passed: !settings.blockOnNoData,
        reason: 'no_data',
        all, delivered, returned, deliveryPercent: 0,
      };
    }

    const deliveryPercent = Math.round((delivered / all) * 100);
    const passed = deliveryPercent >= settings.minDeliveryPercent;

    return {
      passed,
      reason: passed ? undefined : 'low_ratio',
      all, delivered, returned, deliveryPercent,
    };
  } catch {
    // Both attempts failed — don't auto-pass, treat as no data
    return { passed: !settings.blockOnNoData, reason: 'no_data' };
  }
};

export interface DeviceBlockResult {
  blocked: boolean;
  status?: string;
}

/**
 * Check if a customer has ANY previous order (any status, including ডেলিভারড).
 * Returns true for repeat buyers — used to redirect to fake thank-you page.
 */
export const checkHasPreviousOrder = async (
  fingerprint?: string,
  phone?: string,
  ip?: string,
): Promise<boolean> => {
  try {
    if (!fingerprint && !phone && !ip) return false;
    const { normalizePhone } = await import('@/lib/order-validation');
    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const res = await api.post('/public/has-previous-order', {
      fingerprint: fingerprint || null,
      phone: normalizedPhone || null,
      ip: ip || null,
    });
    return !!res?.has_previous;
  } catch {
    return false;
  }
};

/**
 * Check if a customer has any order in blocking statuses by fingerprint, phone, or IP.
 * All statuses except ডেলিভারড are blocking.
 */
export const checkDeviceBlocked = async (
  fingerprint?: string,
  phone?: string,
  ip?: string,
): Promise<DeviceBlockResult> => {
  try {
    if (!fingerprint && !phone && !ip) return { blocked: false };
    const { normalizePhone } = await import('@/lib/order-validation');
    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const res = await api.post('/public/device-check', {
      fingerprint: fingerprint || null,
      phone: normalizedPhone || null,
      ip: ip || null,
    });
    return res?.blocked ? { blocked: true, status: res.status } : { blocked: false };
  } catch {
    return { blocked: false };
  }
};
