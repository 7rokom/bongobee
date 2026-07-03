// Single source of truth for courier tracking URLs.
// Used by main Orders, reseller orders, and SMS templates.

// Steadfast public tracking URL: https://steadfast.com.bd/t/{tracking_code}
// The tracking_code is returned by the create_order API in consignment.tracking_code.
export function buildSteadfastTrackingUrl(trackingCode?: string | number | null): string {
  if (!trackingCode) return '';
  return `https://steadfast.com.bd/t/${trackingCode}`;
}

export function buildCarrybeeTrackingUrl(consignmentId: string | number | undefined | null): string {
  if (!consignmentId) return '';
  return `https://merchant.carrybee.com/order-track/${consignmentId}`;
}
