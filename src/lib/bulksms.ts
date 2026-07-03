// bulksmsbd.net integration helper.
// Sends through the deployed function when available, with a browser-safe direct API fallback.

import { api } from '@/lib/api';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useSteadfastStore } from '@/stores/useSteadfastStore';
import { useCarrybeeStore } from '@/stores/useCarrybeeStore';
import { buildSteadfastTrackingUrl, buildCarrybeeTrackingUrl } from '@/lib/courier-links';

export type SmsTemplateVars = Record<string, string | number | undefined>;

type SmsSendResult = { phone: string; ok: boolean; response: string };

function normalizeBdPhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('880') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

function parseCode(text: string): number | null {
  try {
    const j = JSON.parse(text);
    if (typeof j?.response_code === 'number') return j.response_code;
    if (typeof j?.response_code === 'string') {
      const n = parseInt(j.response_code, 10);
      if (!isNaN(n)) return n;
    }
  } catch (_) { /* not JSON */ }
  const m = text.match(/"?response_code"?\s*[:=]\s*"?(\d{3,4})"?/);
  if (m) return parseInt(m[1], 10);
  const m2 = text.match(/\b(202|10\d{2})\b/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function isSmsAccepted(responseText: string): boolean {
  // Only response_code 202 = actually accepted. Everything else (1007 etc.) = failure.
  return parseCode(responseText) === 202;
}

export async function checkBulkSmsBalance(): Promise<{ success: boolean; balance?: string | number | null; error?: string }> {
  try {
    const data = await api.get('/admin/mk/sms-balance');
    return { success: true, balance: data?.balance ?? null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Balance check failed' };
  }
}

async function sendDirectBulkSms(messages: Array<{ phone: string; message: string }>) {
  const { bulkSmsApiKey, bulkSmsSenderId } = useSiteSettingsStore.getState();
  if (!bulkSmsApiKey) return { success: false, error: 'API key সেট করা নেই' };

  const results: SmsSendResult[] = [];
  for (const item of messages) {
    const phone = normalizeBdPhone(item.phone);
    if (!phone) {
      results.push({ phone: item.phone, ok: false, response: 'Invalid phone number' });
      continue;
    }

    const url = new URL('https://bulksmsbd.net/api/smsapi');
    url.searchParams.set('api_key', bulkSmsApiKey);
    url.searchParams.set('type', 'text');
    url.searchParams.set('number', phone);
    url.searchParams.set('senderid', bulkSmsSenderId || '');
    url.searchParams.set('message', item.message);

    const response = await fetch(url.toString());
    const text = await response.text();
    results.push({ phone, ok: response.ok && isSmsAccepted(text), response: text });
  }

  const sentCount = results.filter((result) => result.ok).length;
  if (sentCount === 0) {
    return { success: false, results, error: results[0]?.response || 'SMS পাঠানো ব্যর্থ হয়েছে' };
  }
  return { success: true, results };
}

export function renderTemplate(template: string, vars: SmsTemplateVars): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export async function sendBulkSmsApi(
  messages: Array<{ phone: string; message: string }>
): Promise<{ success: boolean; results?: Array<{ phone: string; ok: boolean; response: string }>; error?: string }> {
  if (!messages.length) return { success: false, error: 'No messages' };
  try {
    const data = await api.post('/public/send-sms', { messages });
    const results = (data?.results || []) as SmsSendResult[];
    const sentCount = results.filter((result) => result.ok).length;
    if (sentCount === 0) return { success: false, results, error: results[0]?.response || data?.error || 'SMS পাঠানো ব্যর্থ হয়েছে' };
    return { success: true, results };
  } catch (err) {
    console.warn('[Bulk SMS] Function unavailable, using direct API fallback:', err);
    try {
      return await sendDirectBulkSms(messages);
    } catch (fallbackErr) {
      return { success: false, error: fallbackErr instanceof Error ? fallbackErr.message : 'Network error' };
    }
  }
}

// Build a courier tracking link directly from the order's dispatched courier data.
// Each courier has its own tracking URL format — no manual base URL needed.
function lookupTrackingLink(orderId: string): string {
  const sfMap = useSteadfastStore.getState().orderData;
  const sf = sfMap[orderId] || sfMap[`reseller-${orderId}`];
  if (sf?.tracking_code) return buildSteadfastTrackingUrl(sf.tracking_code);
  if (sf?.consignment_id) return buildSteadfastTrackingUrl(sf.consignment_id);
  const cbMap = useCarrybeeStore.getState().orderData || {};
  const cb = cbMap[orderId] || cbMap[`reseller-${orderId}`];
  if (cb?.consignment_id) return buildCarrybeeTrackingUrl(cb.consignment_id);
  return '';
}

function getWhatsappNumber(): string {
  const s = useSiteSettingsStore.getState();
  return s.whatsappNumber || s.phone || '';
}

// Build template vars from a main order
export function buildMainOrderVars(order: {
  id: string; customer: string; phone: string; address?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number; deliveryCharge?: number; status?: string;
}): SmsTemplateVars {
  const productNames = order.items.map((i) => i.name).join(', ');
  const quantities = order.items.map((i) => i.qty).join(', ');
  const prices = order.items.map((i) => i.price).join(', ');
  const productsDetailed = order.items
    .map((i) => `${i.name} x${i.qty} = ${i.price * i.qty}৳`)
    .join(', ');
  return {
    customer_name: order.customer,
    phone: order.phone,
    order_id: order.id,
    address: order.address || '',
    total: order.total,
    delivery_charge: order.deliveryCharge ?? 0,
    products: productsDetailed,
    product_names: productNames,
    product_name: productNames,
    quantity: quantities,
    price: prices,
    courier_link: lookupTrackingLink(order.id),
    tracking_link: lookupTrackingLink(order.id),
    whatsapp: getWhatsappNumber(),
    status: order.status || '',
  };
}

// Build template vars from a reseller order
export function buildResellerOrderVars(order: {
  id: string; customerName: string; customerPhone: string; customerAddress?: string;
  items: Array<{ productTitle: string; qty: number; sellingPrice: number }>;
  totalSellingPrice: number; deliveryCharge?: number; status?: string;
}): SmsTemplateVars {
  const productNames = order.items.map((i) => i.productTitle).join(', ');
  const quantities = order.items.map((i) => i.qty).join(', ');
  const prices = order.items.map((i) => i.sellingPrice).join(', ');
  const productsDetailed = order.items
    .map((i) => `${i.productTitle} x${i.qty} = ${i.sellingPrice * i.qty}৳`)
    .join(', ');
  return {
    customer_name: order.customerName,
    phone: order.customerPhone,
    order_id: order.id,
    address: order.customerAddress || '',
    total: order.totalSellingPrice,
    delivery_charge: order.deliveryCharge ?? 0,
    products: productsDetailed,
    product_names: productNames,
    product_name: productNames,
    quantity: quantities,
    price: prices,
    courier_link: lookupTrackingLink(order.id),
    tracking_link: lookupTrackingLink(order.id),
    whatsapp: getWhatsappNumber(),
    status: order.status || '',
  };
}

// Pick template + enabled flag for a status. Returns null if disabled / no template.
export function getTemplateForStatus(status: string): string | null {
  const s = useSiteSettingsStore.getState();
  if (status === 'পেন্ডিং' && s.smsPendingEnabled) return s.smsPendingTemplate || null;
  if (status === 'কনফার্মড' && s.smsConfirmedEnabled) return s.smsConfirmedTemplate || null;
  if (status === 'শিপমেন্ট' && s.smsShipmentEnabled) return s.smsShipmentTemplate || null;
  if (status === 'ফলোয়াপ' && s.smsFollowupEnabled) return s.smsFollowupTemplate || null;
  // হোল্ড is sent manually via ManualSmsDialog — no auto-send.
  return null;
}

export function getResellerTemplateForStatus(status: string, resellerId?: string): string | null {
  if (!resellerId) return getTemplateForStatus(status);
  const reseller = useResellerStore.getState().resellers.find((r) => r.id === resellerId);
  const custom = (() => {
    if (status === 'পেন্ডিং') return reseller?.smsPendingTemplate;
    if (status === 'কনফার্মড') return reseller?.smsConfirmedTemplate;
    if (status === 'শিপমেন্ট') return reseller?.smsShipmentTemplate;
    if (status === 'ফলোয়াপ') return reseller?.smsFollowupTemplate;
    return '';
  })();
  return custom?.trim() ? custom : getTemplateForStatus(status);
}

// Mark the sms_sent jsonb on the order row. Gracefully no-ops if the column
// doesn't exist yet (e.g. before the migration is applied).
async function markSmsSent(
  orderType: 'main' | 'reseller',
  orderId: string,
  status: string,
  prev: Record<string, string> = {},
): Promise<Record<string, string> | null> {
  const next = { ...prev, [status]: new Date().toISOString() };
  let error: any = null;
  try { await api.post('/public/mark-sms-sent', { code: orderId, sms_sent: next }); } catch (e) { error = e; }
  if (error) {
    const msg = (error as any).message || '';
    const code = (error as any).code || '';
    if (code === '42703' || code === 'PGRST204' || /column .* does not exist/i.test(msg) || /sms_sent/i.test(msg)) {
      console.warn('[markSmsSent] sms_sent column missing — run scripts/add-sms-sent-tracking.sql');
      return null;
    }
    console.warn('[markSmsSent] failed:', error);
    return null;
  }
  return next;
}

// Auto-fire SMS when an order moves to a tracked status.
// If `meta` is passed, dedup using order.sms_sent and mark on success.
export async function maybeSendStatusSms(
  status: string,
  phone: string,
  vars: SmsTemplateVars,
  meta?: {
    orderId: string;
    orderType: 'main' | 'reseller';
    resellerId?: string;
    smsSent?: Record<string, string>;
    onMarked?: (next: Record<string, string>) => void;
  },
): Promise<{ skipped?: 'disabled' | 'already-sent' | 'no-phone'; ok?: boolean; error?: string }> {
  const template = meta?.orderType === 'reseller'
    ? getResellerTemplateForStatus(status, meta.resellerId)
    : getTemplateForStatus(status);
  if (!template) return { skipped: 'disabled' };
  if (meta?.orderType === 'reseller' && useSiteSettingsStore.getState().smsResellerEnabled === false) {
    return { skipped: 'disabled' };
  }
  if (!phone) return { skipped: 'no-phone' };
  if (meta?.smsSent && meta.smsSent[status]) return { skipped: 'already-sent' };

  const message = renderTemplate(template, vars);
  if (!message.trim()) return { skipped: 'disabled' };

  const r = await sendBulkSmsApi([{ phone, message }]);
  if (!r.success) {
    console.warn('[auto SMS] failed:', r.error);
    return { ok: false, error: r.error };
  }
  if (meta) {
    const next = await markSmsSent(meta.orderType, meta.orderId, status, meta.smsSent || {});
    if (next && meta.onMarked) meta.onMarked(next);
  }
  return { ok: true };
}

export const TEMPLATE_VARS_HELP: Array<{ key: string; desc: string }> = [
  { key: '{customer_name}', desc: 'কাস্টমারের নাম' },
  { key: '{phone}', desc: 'কাস্টমারের ফোন নম্বর' },
  { key: '{order_id}', desc: 'অর্ডার আইডি' },
  { key: '{address}', desc: 'কাস্টমারের ঠিকানা' },
  { key: '{total}', desc: 'মোট মূল্য (৳)' },
  { key: '{delivery_charge}', desc: 'ডেলিভারি চার্জ' },
  { key: '{products}', desc: 'বিস্তারিত প্রোডাক্ট লিস্ট (নাম x পরিমাণ = মূল্য)' },
  { key: '{product_names}', desc: 'প্রোডাক্টের নাম (কমা সেপারেটেড)' },
  { key: '{quantity}', desc: 'পরিমাণ (কমা সেপারেটেড)' },
  { key: '{price}', desc: 'প্রতি পিসের মূল্য (কমা সেপারেটেড)' },
  { key: '{courier_link}', desc: 'কুরিয়ার ট্র্যাকিং লিংক (অর্ডারের কুরিয়ার থেকে অটো)' },
  { key: '{tracking_link}', desc: '{courier_link} এর বিকল্প নাম' },
  { key: '{whatsapp}', desc: 'হোয়াটসঅ্যাপ নম্বর (শপ সেটিংস থেকে)' },
  { key: '{status}', desc: 'বর্তমান স্ট্যাটাস' },
];
