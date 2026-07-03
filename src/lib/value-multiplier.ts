/**
 * Courier-ratio based Purchase value multiplier (Aggressive tier).
 *
 * Sent to Facebook/TikTok/Google Ads via the Purchase event so the
 * ad-platform optimization algorithms learn to find higher-quality buyers
 * (those who actually accept deliveries) and de-prioritize risky audiences.
 *
 *  Delivery%  | Multiplier | Meaning
 *  -----------|------------|----------------------------------
 *   < 50%     |   0.1x     | Very risky — almost suppress
 *   50–69%    |   0.4x     | Below threshold — low weight
 *   70–89%    |   0.7x     | Normal customer
 *   ≥ 90%     |   1.0x     | Premium — full weight
 *
 * No-data customers never reach this function because `blockOnNoData` is on
 * in fraud settings — those orders are sent to the fake-thank-you flow which
 * does not fire `trackPurchase` at all.
 */
export interface CourierRatioInput {
  all?: number;
  delivered?: number;
  deliveryPercent?: number;
}

export function getValueMultiplier(ratio?: CourierRatioInput | null): number {
  if (!ratio) return 1; // no data passed in — keep baseline

  let percent = ratio.deliveryPercent;
  if (typeof percent !== 'number' && ratio.all && ratio.all > 0) {
    percent = Math.round(((ratio.delivered || 0) / ratio.all) * 100);
  }

  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 1;

  if (percent < 50) return 0.1;
  if (percent < 70) return 0.4;
  if (percent < 90) return 0.7;
  return 1.0;
}

/** Apply multiplier and round to whole currency units (BDT). */
export function getAdjustedPurchaseValue(
  originalValue: number,
  ratio?: CourierRatioInput | null,
): number {
  const mult = getValueMultiplier(ratio);
  return Math.round(originalValue * mult);
}