export const normalizeStockKey = (value?: string | null) =>
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeFulfillmentKey = (value?: string | null) =>
  normalizeStockKey(value).replace(/\s+/g, '');

const vendorSignals = ['mohasagor', 'mohasagr', 'মহাসাগর'];

export const hasVendorSignal = (...values: Array<string | null | undefined>) =>
  values.some((value) => {
    const key = normalizeFulfillmentKey(value);
    return vendorSignals.some((signal) => key.includes(signal));
  });

export const DELIVERED_STATUS = 'ডেলিভারড';
export const SHIPMENT_STATUSES = ['প্যাকেজিং', 'শিপমেন্ট', 'ডেলিভারির পথে'];
export const RETURN_STATUSES = ['রিটার্ন', 'রিটার্নিং', 'পেইড রিটার্ন', 'পেইড রিটার্নিং'];
export const CLOSED_STOCK_STATUSES = [...RETURN_STATUSES, 'ক্যান্সেল', 'ক্যান্সেলড', 'বাতিল'];

export interface ProductStockRef {
  id?: string;
  title?: string;
  stockProductName?: string;
}

export interface StockProductMap {
  titleToStock: Record<string, string>;
  normalizedTitleToStock: Record<string, string>;
  productIdToStock: Record<string, string>;
}

export interface OrderItemStockRef {
  name?: string;
  productTitle?: string;
  productId?: string;
  stockProductName?: string;
}

export const buildStockProductMap = (products: ProductStockRef[]): StockProductMap => {
  const titleToStock: Record<string, string> = {};
  const normalizedTitleToStock: Record<string, string> = {};
  const productIdToStock: Record<string, string> = {};

  products.forEach((p) => {
    if (!p.stockProductName) return;
    if (p.title) {
      titleToStock[p.title] = p.stockProductName;
      normalizedTitleToStock[normalizeStockKey(p.title)] = p.stockProductName;
    }
    if (p.id) productIdToStock[p.id] = p.stockProductName;
  });

  return { titleToStock, normalizedTitleToStock, productIdToStock };
};

export const resolveStockName = (item: OrderItemStockRef, map: StockProductMap): string | undefined => {
  const title = item.name || item.productTitle || '';
  return (
    item.stockProductName ||
    (item.productId ? map.productIdToStock[item.productId] : undefined) ||
    map.titleToStock[title] ||
    map.normalizedTitleToStock[normalizeStockKey(title)]
  );
};

export const isSelfFulfilledOrder = (
  orderKey: string,
  stockTypes: Record<string, string | undefined>,
  courierNames: Record<string, string | undefined>,
  source?: string,
) => {
  // Vendor courier/source ALWAYS implies vendor stock — overrides any stored
  // stock_type. Historical bug: follow_up_data.stock_type defaulted to 'self'
  // on first row creation, masking Mohasagor orders as self stock.
  if (hasVendorSignal(courierNames[orderKey], source)) return false;
  const explicit = stockTypes[orderKey];
  if (explicit === 'vendor') return false;
  // Anything else (explicit 'self' OR no value) → self stock.
  return true;
};

export const isInShipmentStockStatus = (
  status: string,
  orderKey: string,
  courierNames: Record<string, string | undefined>,
) => {
  if (status === DELIVERED_STATUS || CLOSED_STOCK_STATUSES.includes(status)) return false;
  return SHIPMENT_STATUSES.includes(status) || !!courierNames[orderKey];
};

export const isConsumedSelfStockStatus = (
  status: string,
  orderKey: string,
  courierNames: Record<string, string | undefined>,
) => status === DELIVERED_STATUS || isInShipmentStockStatus(status, orderKey, courierNames);