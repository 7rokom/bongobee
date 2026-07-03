// dataLayer utility for GTM / Facebook Pixel / TikTok Pixel compatibility

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

// Initialize dataLayer
window.dataLayer = window.dataLayer || [];

interface EcommerceItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_category?: string;
}

function pushEvent(event: string, ecommerce?: Record<string, unknown>) {
  // Clear previous ecommerce object to prevent data leakage between events
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ...(ecommerce ? { ecommerce } : {}),
  });
}

export function trackPageView(pageTitle?: string, pagePath?: string) {
  pushEvent('page_view', {
    page_title: pageTitle || document.title,
    page_path: pagePath || window.location.pathname,
  });
}

export function trackViewContent(item: EcommerceItem, currency = 'BDT') {
  pushEvent('view_item', {
    currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackAddToCart(items: EcommerceItem[], currency = 'BDT') {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  pushEvent('add_to_cart', {
    currency,
    value,
    items,
  });
}

export function trackViewItemList(
  items: EcommerceItem[],
  listId: string,
  listName: string,
  currency = 'BDT'
) {
  pushEvent('view_item_list', {
    currency,
    item_list_id: listId,
    item_list_name: listName,
    items,
  });
}

export function trackSelectItem(
  item: EcommerceItem,
  listId: string,
  listName: string,
  currency = 'BDT'
) {
  pushEvent('select_item', {
    currency,
    item_list_id: listId,
    item_list_name: listName,
    items: [item],
  });
}

export function trackAddToWishlist(item: EcommerceItem, currency = 'BDT') {
  pushEvent('add_to_wishlist', {
    currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackInitiateCheckout(
  items: EcommerceItem[],
  value: number,
  currency = 'BDT'
) {
  pushEvent('begin_checkout', {
    currency,
    value,
    items,
  });
}

import { buildEnrichedUserData, type CustomerInfo } from './customer-enrichment';

export function trackPurchase(
  transactionId: string,
  items: EcommerceItem[],
  value: number,
  shipping: number,
  discount: number,
  currency = 'BDT',
  valueOverride?: number,
  customer?: CustomerInfo,
) {
  // valueOverride: optional adjusted value sent to ad platforms (Facebook/TikTok/Google).
  // Used for value-based bidding — e.g. weighting Purchase events by customer
  // courier-delivery reliability so ad algorithms learn to find higher-quality buyers.
  // The original `value` is still recorded as `value_actual` for accurate reporting.
  const reportedValue = typeof valueOverride === 'number' ? valueOverride : value;

  // Enriched user_data — read by server-side GTM (stape.io) and forwarded to
  // Facebook CAPI / Google Enhanced Conversions for higher Event Match Quality.
  // Derived from data we already collect at checkout (no extra customer input):
  //   country = bd, ct = district parsed from address,
  //   ge = m/f guessed from name, fn/ln = name split, ph = E.164 phone.
  // All values are plain — sGTM tags hash them before forwarding.
  const user_data = customer ? buildEnrichedUserData(customer) : { country: 'bd' };

  // Clear previous ecommerce to prevent leakage, then push the purchase
  // event with user_data attached as a sibling top-level key.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: 'purchase',
    user_data,
    ecommerce: {
      transaction_id: transactionId,
      event_id: transactionId,
      currency,
      value: reportedValue,
      value_actual: value,
      shipping,
      discount,
      items,
    },
  });
}
