import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, TrendingUp, TrendingDown, Truck, BarChart3, ArrowUpRight, ArrowDownRight, Wallet, Banknote, Landmark, Package, Users, MapPin, ShoppingCart } from 'lucide-react';
import { useOrderStore } from '@/stores/useOrderStore';
import { useStockStore } from '@/stores/useStockStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import { useDepositStore } from '@/stores/useDepositStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { computeResellerBalance } from '@/lib/reseller-balance';
import { format, isToday, isYesterday, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const COD_CHARGE_PERCENT = 1;
const calcCodCharge = (amount: number) => Math.ceil((amount * COD_CHARGE_PERCENT) / 100);
const RETURN_LOSS_CATEGORY = 'ডেলিভারি রিটার্ন লস';
const FINAL_RETURN_STATUSES = ['রিটার্ন', 'পেইড রিটার্ন'];

const isFinalReturnStatus = (status: string) => FINAL_RETURN_STATUSES.includes(status);

type DateFilter = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'lastMonth' | 'year' | 'custom';

const filterLabels: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'সব সময়' },
  { value: 'today', label: 'আজ' },
  { value: 'yesterday', label: 'গতকাল' },
  { value: '7days', label: '৭ দিন' },
  { value: 'month', label: 'এই মাস' },
  { value: 'lastMonth', label: 'গত মাস' },
  { value: 'year', label: 'এই বছর' },
  { value: 'custom', label: 'কাস্টম তারিখ' },
];

const AccountReport = () => {
  const orders = useOrderStore((s) => s.orders);
  const stockEntries = useStockStore((s) => s.stockEntries);
  const expenses = useExpenseStore((s) => s.expenses);
  const resellerOrders = useResellerStore((s) => s.orders);
  const paymentRequests = useResellerStore((s) => s.paymentRequests);
  const allProducts = useProductStore((s) => s.products);
  useLazyFetch([
    useExpenseStore.getState().fetchExpenses,
    useDepositStore.getState().fetchDeposits,
  ]);
  const deposits = useDepositStore((s) => s.deposits);
  const stockTypes = useFollowUpStore((s) => s.stockTypes);
  const vendorBuyPrices = useFollowUpStore((s) => s.vendorBuyPrices);
  const courierDeliveryCharges = useFollowUpStore((s) => s.courierDeliveryCharges);

  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();

  const inRange = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    switch (dateFilter) {
      case 'today': return isToday(d);
      case 'yesterday': return isYesterday(d);
      case '7days': return d >= subDays(now, 7);
      case 'month': return d >= startOfMonth(now) && d <= endOfMonth(now);
      case 'lastMonth': { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
      case 'year': return d >= startOfYear(now);
      case 'custom': return (!customStart || d >= customStart) && (!customEnd || d <= new Date(customEnd.getTime() + 86400000));
      default: return true;
    }
  };

  const buyPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    stockEntries.forEach(entry => { map[entry.productName] = entry.buyPrice; });
    return map;
  }, [stockEntries]);

  // Average buy price per stock product — mirrors StockManagement.tsx
  // Used so "মোট প্রোডাক্ট সেল" matches Stock Management's "ডেলিভারড" value exactly.
  const avgBuyPriceMap = useMemo(() => {
    const acc: Record<string, { qty: number; value: number }> = {};
    stockEntries.forEach(entry => {
      if (!acc[entry.productName]) acc[entry.productName] = { qty: 0, value: 0 };
      acc[entry.productName].qty += entry.quantity;
      acc[entry.productName].value += entry.quantity * entry.buyPrice;
    });
    const map: Record<string, number> = {};
    Object.entries(acc).forEach(([name, { qty, value }]) => {
      map[name] = qty > 0 ? value / qty : 0;
    });
    return map;
  }, [stockEntries]);

  const getMainOrderStockType = (orderId: string) => stockTypes[orderId] || 'self';
  const getResellerOrderStockType = (orderId: string, items?: any[]) => {
    const explicit = stockTypes[`reseller-${orderId}`] || stockTypes[orderId];
    if (explicit) return explicit;
    // Fall back to product's default stock type
    if (items && items.length > 0) {
      const firstItem = items[0];
      const prod = allProducts.find(p => p.id === firstItem.productId || p.title === firstItem.productTitle);
      if (prod?.stockType) return prod.stockType;
    }
    return 'self';
  };

  const getMainItemBuyPrice = (item: { name: string; qty: number; stockProductName?: string }) => {
    // Prefer the snapshot saved on the order line at order creation time.
    // Falls back to live product / stock entry lookup for legacy orders.
    const snap = (item as any).buyPrice;
    if (typeof snap === 'number' && !isNaN(snap)) return snap;
    const matchedProduct = allProducts.find(
      (product) => product.title === item.name || (!!item.stockProductName && product.stockProductName === item.stockProductName)
    );
    const stockName = item.stockProductName || matchedProduct?.stockProductName || item.name;
    return matchedProduct?.buyPrice ?? buyPriceMap[stockName] ?? 0;
  };

  const getResellerItemBuyPrice = (item: { productId: string; productTitle: string }) => {
    // Prefer the snapshot saved on the reseller order line at order creation time.
    const snap = (item as any).buyPrice;
    if (typeof snap === 'number' && !isNaN(snap)) return snap;
    const matchedProduct = allProducts.find(
      (product) => product.id === item.productId || product.title === item.productTitle
    );
    const stockName = matchedProduct?.stockProductName || item.productTitle;
    return matchedProduct?.buyPrice ?? buyPriceMap[stockName] ?? 0;
  };

  // For SELF-stock delivered orders, use the average buy price from stock
  // entries (auto-set price) instead of the snapshot/current product price.
  // This way profit accounting always reflects the actual weighted-average
  // cost of inventory, even if the admin forgot to update buyPrice on the
  // product before posting. Vendor orders are unaffected — they are still
  // entered manually before courier dispatch.
  const getMainItemEffectiveBuyPrice = (item: { name: string; qty: number; stockProductName?: string }) => {
    const matchedProduct = allProducts.find(
      (p) => p.title === item.name || (!!item.stockProductName && p.stockProductName === item.stockProductName)
    );
    const stockName = item.stockProductName || matchedProduct?.stockProductName || item.name;
    const avg = avgBuyPriceMap[stockName];
    if (typeof avg === 'number' && avg > 0) return avg;
    return getMainItemBuyPrice(item);
  };

  const getResellerItemEffectiveBuyPrice = (item: { productId: string; productTitle: string }) => {
    const matchedProduct = allProducts.find(
      (p) => p.id === item.productId || p.title === item.productTitle
    );
    const stockName = matchedProduct?.stockProductName || item.productTitle;
    const avg = avgBuyPriceMap[stockName];
    if (typeof avg === 'number' && avg > 0) return avg;
    return getResellerItemBuyPrice(item);
  };

  const report = useMemo(() => {
    // === MAIN ORDERS ===
    const filteredOrders = orders.filter((o) => inRange(o.isoDate || o.date));
    const deliveredOrders = filteredOrders.filter((o) => o.status === 'ডেলিভারড' && getMainOrderStockType(o.id) === 'self');
    const vendorDeliveredOrders = filteredOrders.filter((o) => o.status === 'ডেলিভারড' && getMainOrderStockType(o.id) === 'vendor');
    const returnedOrders = filteredOrders.filter((o) => o.status === 'রিটার্ন');
    const paidReturnOrders = filteredOrders.filter((o) => o.status === 'পেইড রিটার্ন');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'ক্যান্সেল');

    let totalSellPrice = 0;
    let totalDeliveryCharge = 0;
    let totalProductCost = 0;
    let totalCodCharge = 0;
    let totalDeliveredProfit = 0;

    const deliveredDetails: { orderId: string; customer: string; sellPrice: number; deliveryCharge: number; productCost: number; codCharge: number; profit: number }[] = [];

    deliveredOrders.forEach((o) => {
      const sellPrice = o.total;
      const customerDeliveryCharge = o.deliveryCharge || 0;
      // For free-delivery orders, deduct the actual courier cost paid by the seller
      const actualCourierCost = customerDeliveryCharge === 0 ? (courierDeliveryCharges[o.id] || 0) : 0;
      const deliveryCharge = customerDeliveryCharge + actualCourierCost;
      let orderProductCost = 0;
      o.items.forEach((item) => {
        orderProductCost += getMainItemEffectiveBuyPrice(item as any) * item.qty;
      });
      const codCharge = calcCodCharge(sellPrice);
      const profit = sellPrice - deliveryCharge - orderProductCost - codCharge;

      totalSellPrice += sellPrice;
      totalDeliveryCharge += deliveryCharge;
      totalProductCost += orderProductCost;
      totalCodCharge += codCharge;
      totalDeliveredProfit += profit;

      deliveredDetails.push({ orderId: o.id, customer: o.customer, sellPrice, deliveryCharge, productCost: orderProductCost, codCharge, profit });
    });

    let mainVendorProfit = 0;
    vendorDeliveredOrders.forEach((o) => {
      const sellPrice = o.total;
      const customerDeliveryCharge = o.deliveryCharge || 0;
      const actualCourierCost = customerDeliveryCharge === 0 ? (courierDeliveryCharges[o.id] || 0) : 0;
      const deliveryCharge = customerDeliveryCharge + actualCourierCost;
      const codCharge = calcCodCharge(sellPrice);
      const customBuyPrice = vendorBuyPrices[o.id];
      let orderProductCost: number;
      if (customBuyPrice !== undefined) {
        orderProductCost = customBuyPrice;
      } else {
        orderProductCost = 0;
        o.items.forEach((item) => {
          orderProductCost += getMainItemBuyPrice(item as any) * item.qty;
        });
      }
      const packagingCharge = 10;
      mainVendorProfit += sellPrice - codCharge - orderProductCost - deliveryCharge - packagingCharge;
    });

    // Return loss — pulled directly from the expense ledger category
    // "ডেলিভারি রিটার্ন লস" (auto-added by return-ledger.ts). Since this is
    // already part of totalExpenses, it MUST NOT be added to totalLoss again.

    // Paid Return — only for SELF-stock orders here.
    let totalPaidReturnProfit = 0;
    let totalPaidReturnLoss = 0;
    paidReturnOrders.forEach((o) => {
      if (getMainOrderStockType(o.id) === 'vendor') return;
      const paidAmount = (o as any).paidReturnAmount ?? 0;
      const deliveryCharge = o.originalDeliveryCharge || o.deliveryCharge || 0;
      if (paidAmount >= deliveryCharge) {
        totalPaidReturnProfit += (paidAmount - deliveryCharge);
      } else {
        totalPaidReturnLoss += (deliveryCharge - paidAmount);
      }
    });

    // === RESELLER ORDERS ===
    const filteredResellerOrders = resellerOrders.filter((o) => inRange(o.date));
    const resellerDelivered = filteredResellerOrders.filter(o => o.status === 'ডেলিভারড' && getResellerOrderStockType(o.id, o.items) === 'self');
    const resellerVendorDelivered = filteredResellerOrders.filter(o => o.status === 'ডেলিভারড' && getResellerOrderStockType(o.id, o.items) === 'vendor');
    const resellerReturned = filteredResellerOrders.filter(o => o.status === 'রিটার্ন');
    const resellerPaidReturn = filteredResellerOrders.filter(o => o.status === 'পেইড রিটার্ন');

    let resellerMyProfit = 0;
    const resellerDetails: {
      orderId: string;
      resellerName: string;
      stockType: 'self' | 'vendor';
      resellerPrice: number;
      buyPriceLabel: string;
      buyPrice: number;
      profit: number;
    }[] = [];

    resellerDelivered.forEach((o) => {
      let orderResellerCost = 0;
      let orderMyBuyPrice = 0;
      o.items.forEach((item) => {
        orderResellerCost += item.resellerPrice * item.qty;
        orderMyBuyPrice += getResellerItemEffectiveBuyPrice(item as any) * item.qty;
      });
      // আমার লাভ = রিসেলার প্রাইজ - আমার কেনা দাম
      const profit = orderResellerCost - orderMyBuyPrice;
      resellerMyProfit += profit;
      resellerDetails.push({
        orderId: o.id,
        resellerName: o.resellerName,
        stockType: 'self',
        resellerPrice: orderResellerCost,
        buyPriceLabel: 'আমার কেনা দাম',
        buyPrice: orderMyBuyPrice,
        profit,
      });
    });

    let resellerVendorProfit = 0;
    resellerVendorDelivered.forEach((o) => {
      let orderResellerCost = 0;
      o.items.forEach((item) => {
        orderResellerCost += item.resellerPrice * item.qty;
      });
      let orderBuyPrice = 0;
      const key = `reseller-${o.id}`;
      const customBuyPrice = vendorBuyPrices[key];
      if (customBuyPrice !== undefined) {
        orderBuyPrice = customBuyPrice;
      } else {
        o.items.forEach((item) => {
          orderBuyPrice += getResellerItemBuyPrice(item as any) * item.qty;
        });
      }
      // আমার লাভ = রিসেলার প্রাইজ - ভেন্ডর কেনা দাম
      const profit = orderResellerCost - orderBuyPrice;
      resellerVendorProfit += profit;
      resellerDetails.push({
        orderId: o.id,
        resellerName: o.resellerName,
        stockType: 'vendor',
        resellerPrice: orderResellerCost,
        buyPriceLabel: 'ভেন্ডর কেনা দাম',
        buyPrice: orderBuyPrice,
        profit,
      });
    });

    // === EXPENSES === (exclude ডিজিটাল প্রডাক্ট অ্যাড — that's tracked in Digital Report)
    // Return loss is recalculated from actual order statuses below, so old/missing
    // ledger rows in this category cannot make the report count wrong.
    const filteredExpenses = expenses.filter((e) => inRange(e.date) && e.category !== 'ডিজিটাল প্রডাক্ট অ্যাড');
    const nonReturnExpenses = filteredExpenses.filter((e) => e.category !== RETURN_LOSS_CATEGORY);
    const totalExpensesWithoutReturn = nonReturnExpenses.reduce((s, e) => s + e.amount, 0);
    const expenseByCategory: Record<string, number> = {};
    nonReturnExpenses.forEach((e) => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    });

    // === DEPOSITS ===
    const filteredDeposits = deposits.filter((d) => inRange(d.date));
    const resellingProfit = filteredDeposits.filter(d => d.source === 'রিসেলিং করে লাভ').reduce((s, d) => s + d.amount, 0);
    const totalDeposits = filteredDeposits.filter(d => d.source !== 'রিসেলিং করে লাভ').reduce((s, d) => s + d.amount, 0);

    // === TOTAL CAPITAL (all-time deposits, not date-filtered) ===
    const totalCapital = deposits.filter(d => d.source !== 'রিসেলিং করে লাভ').reduce((s, d) => s + d.amount, 0);

    // === COURIER PAYMENT (self-stock) === সেল প্রাইজ - COD(1%) - ডেলিভারি চার্জ
    let courierPayment = 0;
    deliveredOrders.forEach((o) => {
      const sellPrice = o.total;
      const deliveryCharge = o.deliveryCharge || 0;
      const codCharge = calcCodCharge(sellPrice);
      courierPayment += sellPrice - codCharge - deliveryCharge;
    });
    resellerDelivered.forEach((o) => {
      const sellingPrice = o.totalSellingPrice || 0;
      const codCharge = calcCodCharge(sellingPrice);
      const deliveryCharge = o.deliveryCharge || 0;
      courierPayment += sellingPrice - codCharge - deliveryCharge;
    });

    // NOTE: Returns / paid-returns no longer adjust courier or vendor payment cards
    // (per user request). Reseller order returns remain deducted from reseller balance.

    // === VENDOR PAYMENT (vendor-stock) === সেল প্রাইজ − ১% COD − ডেলিভারি − ১০ প্যাকেজিং
    // (no return deductions — shown separately below)
    const VENDOR_PACKAGING_CHARGE = 10;
    let vendorPayment = 0;
    vendorDeliveredOrders.forEach((o) => {
      const sellPrice = o.total;
      vendorPayment += sellPrice - calcCodCharge(sellPrice) - (o.deliveryCharge || 0) - VENDOR_PACKAGING_CHARGE;
    });
    resellerVendorDelivered.forEach((o) => {
      const sp = o.totalSellingPrice || 0;
      vendorPayment += sp - calcCodCharge(sp) - (o.deliveryCharge || 0) - VENDOR_PACKAGING_CHARGE;
    });

    // vendorReturnLossTotal is computed below from the expense ledger
    // (ডেলিভারি রিটার্ন লস category, ভেন্ডর-tagged entries) so the card
    // value always reconciles with the expense breakdown.

    // "রিসেলার থেকে মোট লাভ" = self-stock reseller profit + vendor-stock reseller profit
    // (already calculated above with full formula incl. COD, delivery, packaging)
    //   self:   sellingPrice − 1% COD − resellerPrice − delivery − packaging
    //   vendor: sellingPrice − 1% COD − vendorBuyPrice − delivery − packaging
    const totalResellerAdminProfit = resellerMyProfit + resellerVendorProfit;

    // === RESELLER PAYMENTS ===
    // "রিসেলারদের দিতে হবে" must match every reseller's current balance,
    // including the reserved ৳200 that stays in their account and will be paid later.
    const resellerBalanceSummary = computeResellerBalance(resellerOrders, paymentRequests);
    const approvedPayments = resellerBalanceSummary.approvedPayments;
    const resellerPayable = resellerBalanceSummary.withdrawable + resellerBalanceSummary.pendingPayments;

    // === STOCK VALUE ===
    // Calculate remaining stock value
    const stockValue = useMemo_stockValue(stockEntries, orders, resellerOrders, allProducts, stockTypes);
    // === SHIPMENT VALUE === (products currently in shipment, valued at buy price)
    const shipmentValue = useMemo_shipmentValue(stockEntries, orders, resellerOrders, allProducts, stockTypes);

    // === BANK BALANCE ===
    // All-time: totalCapital + courierPayment + vendorPayment - totalExpenses - approvedPayments
    const allTimeExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    
    // All-time courier payment (all delivered self-stock) = সেল প্রাইজ - COD(1%) - ডেলিভারি চার্জ
    let allTimeCourierPayment = 0;
    orders.filter(o => o.status === 'ডেলিভারড' && getMainOrderStockType(o.id) === 'self').forEach((o) => {
      allTimeCourierPayment += o.total - calcCodCharge(o.total) - (o.deliveryCharge || 0);
    });
    resellerOrders.filter(o => o.status === 'ডেলিভারড' && getResellerOrderStockType(o.id, o.items) === 'self').forEach((o) => {
      const sp = o.totalSellingPrice || 0;
      allTimeCourierPayment += sp - calcCodCharge(sp) - (o.deliveryCharge || 0);
    });
    // Self-stock returns & paid-returns adjust all-time courier payment.
    orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      getMainOrderStockType(o.id) !== 'vendor'
    ).forEach((o) => {
      const deliveryCharge = o.deliveryCharge || 0;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        allTimeCourierPayment += paidAmount - deliveryCharge;
      } else {
        allTimeCourierPayment -= deliveryCharge;
      }
    });
    resellerOrders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      getResellerOrderStockType(o.id, o.items) !== 'vendor'
    ).forEach((o) => {
      const deliveryCharge = o.deliveryCharge || 0;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        allTimeCourierPayment += paidAmount - deliveryCharge;
      } else {
        allTimeCourierPayment -= deliveryCharge;
      }
    });

    // All-time vendor payment — সেল প্রাইজ - COD - কেনা দাম - ডেলিভারি - প্যাকেজিং
    let allTimeVendorPayment = 0;
    orders.filter(o => o.status === 'ডেলিভারড' && getMainOrderStockType(o.id) === 'vendor').forEach((o) => {
      const sellPrice = o.total;
      const codCharge = calcCodCharge(sellPrice);
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = 10;
      const cbp = vendorBuyPrices[o.id];
      let buyPrice: number;
      if (cbp !== undefined) { buyPrice = cbp; } else {
        buyPrice = 0;
        o.items.forEach((item) => { buyPrice += getMainItemBuyPrice(item as any) * item.qty; });
      }
      allTimeVendorPayment += sellPrice - codCharge - buyPrice - deliveryCharge - packagingCharge;
    });
    resellerOrders.filter(o => o.status === 'ডেলিভারড' && getResellerOrderStockType(o.id, o.items) === 'vendor').forEach((o) => {
      const sp = o.totalSellingPrice || 0;
      const codCharge = calcCodCharge(sp);
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = o.packagingCharge || 0;
      const key = `reseller-${o.id}`;
      const cbp = vendorBuyPrices[key];
      let buyPrice: number;
      if (cbp !== undefined) { buyPrice = cbp; } else {
        buyPrice = 0;
        o.items.forEach((item) => { buyPrice += getResellerItemBuyPrice(item as any) * item.qty; });
      }
      allTimeVendorPayment += sp - codCharge - buyPrice - deliveryCharge - packagingCharge;
    });
    // Vendor-stock returns & paid-returns adjust all-time vendor payment.
    orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      getMainOrderStockType(o.id) === 'vendor'
    ).forEach((o) => {
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = 10;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        allTimeVendorPayment += paidAmount - deliveryCharge - packagingCharge;
      } else {
        allTimeVendorPayment -= deliveryCharge + packagingCharge;
      }
    });
    resellerOrders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      getResellerOrderStockType(o.id, o.items) === 'vendor'
    ).forEach((o) => {
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = o.packagingCharge || 10;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        allTimeVendorPayment += paidAmount - deliveryCharge - packagingCharge;
      } else {
        allTimeVendorPayment -= deliveryCharge + packagingCharge;
      }
    });

    const bankBalance = totalCapital + allTimeCourierPayment + allTimeVendorPayment - allTimeExpenses - approvedPayments;

    // === TOTAL PRODUCT SALE (কেনা দাম of delivered self-stock products) ===
    // Mirrors Stock Management page's "ডেলিভারড" value =
    // Σ (delivered units × average buy price of that stock product)
    // — uses self-stock orders only, since vendor stock is not in our inventory.
    const avgBuyForMainItem = (item: any): number => {
      const matchedProduct = allProducts.find(
        (p) => p.title === item.name || (!!item.stockProductName && p.stockProductName === item.stockProductName)
      );
      const stockName = item.stockProductName || matchedProduct?.stockProductName || item.name;
      const avg = avgBuyPriceMap[stockName];
      if (typeof avg === 'number' && avg > 0) return avg;
      // Fallback for legacy items without stock entries
      return getMainItemBuyPrice(item);
    };
    const avgBuyForResellerItem = (item: any): number => {
      const matchedProduct = allProducts.find(
        (p) => p.id === item.productId || p.title === item.productTitle
      );
      const stockName = matchedProduct?.stockProductName || item.productTitle;
      const avg = avgBuyPriceMap[stockName];
      if (typeof avg === 'number' && avg > 0) return avg;
      return getResellerItemBuyPrice(item);
    };

    let mainSelfSale = 0;
    deliveredOrders.forEach((o) => {
      o.items.forEach((item) => { mainSelfSale += avgBuyForMainItem(item as any) * item.qty; });
    });
    let mainVendorSale = 0;
    vendorDeliveredOrders.forEach((o) => {
      const customBuyPrice = vendorBuyPrices[o.id];
      if (customBuyPrice !== undefined) {
        mainVendorSale += customBuyPrice;
      } else {
        o.items.forEach((item) => { mainVendorSale += getMainItemBuyPrice(item as any) * item.qty; });
      }
    });
    let resellerSelfSale = 0;
    resellerDelivered.forEach((o) => {
      o.items.forEach((item) => { resellerSelfSale += avgBuyForResellerItem(item as any) * item.qty; });
    });
    let resellerVendorSale = 0;
    resellerVendorDelivered.forEach((o) => {
      const key = `reseller-${o.id}`;
      const cbp = vendorBuyPrices[key];
      if (cbp !== undefined) {
        resellerVendorSale += cbp;
      } else {
        o.items.forEach((item) => { resellerVendorSale += getResellerItemBuyPrice(item as any) * item.qty; });
      }
    });
    // === SELL AMOUNTS (main self/vendor own sell, reseller sell) ===
    let mainSelfSellTotal = 0;
    deliveredOrders.forEach((o) => { mainSelfSellTotal += o.total - (o.deliveryCharge || 0); });
    let mainVendorSellTotal = 0;
    vendorDeliveredOrders.forEach((o) => { mainVendorSellTotal += o.total - (o.deliveryCharge || 0); });
    let resellerSelfSellTotal = 0;
    resellerDelivered.forEach((o) => { resellerSelfSellTotal += (o.totalSellingPrice || 0) - (o.deliveryCharge || 0); });
    let resellerVendorSellTotal = 0;
    resellerVendorDelivered.forEach((o) => { resellerVendorSellTotal += (o.totalSellingPrice || 0) - (o.deliveryCharge || 0); });

    // সেলফ প্রডাক্ট সেল = ডেলিভার্ড সেলফ প্রডাক্টের কেনা দাম (নিজে + রিসেলার)
    const selfProductSale = mainSelfSale + resellerSelfSale;
    // ভেন্ডর প্রডাক্ট সেল = ডেলিভার্ড ভেন্ডর প্রডাক্টের কেনা দাম (নিজে + রিসেলার)
    const vendorProductSale = mainVendorSale + resellerVendorSale;

    // === রিটার্ন লস — শুধুমাত্র মেইন অর্ডার (সেলফ + ভেন্ডর) ===
    // রিসেলার অর্ডারের রিটার্ন এখানে আসবে না — কারণ সেগুলো রিসেলারের
    // ব্যালেন্স থেকে কাটা হয় (user spec #4)।
    //
    // অ্যামাউন্ট ও ব্রেকডাউন এর সোর্স: "খরচের খাতা" (expense ledger,
    // category = ডেলিভারি রিটার্ন লস)। কেউ ম্যানুয়ালি কোনো এন্ট্রি অ্যাড/
    // এডিট/ডিলিট করলেও এই কার্ডে সেটাই প্রতিফলিত হবে — return-ledger
    // backfill ব্যবস্থা থাকায় ভুল করে ডিলিট হলেও পরের রিফ্রেশে আবার
    // অটো অ্যাড হয়ে যাবে (user spec #5)।
    let selfReturnOrderCount = 0;
    let selfPaidReturnOrderCount = 0;
    let vendorReturnOrderCount = 0;
    let vendorPaidReturnOrderCount = 0;
    filteredOrders.filter((o) => isFinalReturnStatus(o.status)).forEach((o) => {
      const isVendor = getMainOrderStockType(o.id) === 'vendor';
      if (isVendor) {
        if (o.status === 'পেইড রিটার্ন') vendorPaidReturnOrderCount += 1;
        else vendorReturnOrderCount += 1;
      } else if (o.status === 'পেইড রিটার্ন') selfPaidReturnOrderCount += 1;
      else selfReturnOrderCount += 1;
    });

    // Expense ledger rows in RETURN_LOSS_CATEGORY → split by note prefix
    // (return-ledger writes "ভেন্ডর ..." or "সেলফ ..." in note). Manual
    // entries default to self.
    const returnLossLedger = filteredExpenses.filter(e => e.category === RETURN_LOSS_CATEGORY);
    const selfReturnLossEntries: { id: string; title: string; amount: number; note: string; date: string }[] = [];
    const vendorReturnLossEntries: { id: string; title: string; amount: number; note: string; date: string }[] = [];
    let selfReturnLossTotal = 0;
    let vendorReturnLossFromOrders = 0;
    returnLossLedger.forEach(e => {
      const row = { id: e.id, title: e.title, amount: e.amount, note: e.note || '', date: e.date };
      if ((e.note || '').trim().startsWith('ভেন্ডর')) {
        vendorReturnLossEntries.push(row);
        vendorReturnLossFromOrders += e.amount;
      } else {
        selfReturnLossEntries.push(row);
        selfReturnLossTotal += e.amount;
      }
    });
    const returnLossTotal = selfReturnLossTotal + vendorReturnLossFromOrders;
    if (returnLossTotal > 0) expenseByCategory[RETURN_LOSS_CATEGORY] = returnLossTotal;
    const totalExpenses = totalExpensesWithoutReturn + returnLossTotal;

    // === PROFIT BREAKDOWN ===
    // সেলফ স্টক লাভ = main self sell − main self avg buy
    const selfStockProfit = mainSelfSellTotal - mainSelfSale;
    // ভেন্ডর স্টক লাভ = main vendor sell − main vendor buy
    const vendorStockProfit = mainVendorSellTotal - mainVendorSale;
    // রিসেলার থেকে লাভ = already computed (reseller price − buy price both stock types)
    const resellerProfit = totalResellerAdminProfit;
    // পেইড রিটার্ন লাভ — from deposit ledger source
    const paidReturnProfitFromDeposits = filteredDeposits
      .filter(d => d.source === 'পেইড রিটার্ন লাভ')
      .reduce((s, d) => s + d.amount, 0);

    // === DAMAGE LOSS (kept for reference) ===
    const totalDamageLoss = stockEntries.reduce((sum, entry) => sum + ((entry.damage || 0) * entry.buyPrice), 0);

    // === NET PROFIT/LOSS ===
    const totalIncome = selfStockProfit + vendorStockProfit + resellerProfit + resellingProfit + paidReturnProfitFromDeposits;
    // মোট লস/খরচ = খরচ খাতার সকল খাতের যোগফল
    const totalLoss = totalExpenses;
    const netProfit = totalIncome - totalLoss;

    // === COURIER PAYMENT pure (no return adjustment in display) ===
    // recompute without return deduction for the displayed card
    let courierPaymentPure = 0;
    deliveredOrders.forEach((o) => {
      courierPaymentPure += o.total - calcCodCharge(o.total) - (o.deliveryCharge || 0);
    });
    resellerDelivered.forEach((o) => {
      const sp = o.totalSellingPrice || 0;
      courierPaymentPure += sp - calcCodCharge(sp) - (o.deliveryCharge || 0);
    });
    // === মোট জমা (same as Deposits page's মোট জমা) ===
    const totalJoma = totalDeposits + courierPayment + vendorPayment;

    return {
      totalOrders: filteredOrders.length,
      deliveredCount: deliveredOrders.length,
      cancelledCount: cancelledOrders.length,
      returnedCount: returnedOrders.length,
      paidReturnCount: paidReturnOrders.length,
      resellerDeliveredCount: resellerDelivered.length,
      resellerReturnedCount: resellerReturned.length,
      totalSellPrice, totalDeliveryCharge, totalProductCost, totalCodCharge,
      totalDeliveredProfit, deliveredDetails,
      totalPaidReturnProfit, totalPaidReturnLoss,
      totalResellerAdminProfit, resellerDetails, mainVendorProfit,
      totalExpenses, expenseByCategory: Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]),
      totalDeposits, courierPayment, vendorPayment, resellingProfit,
      totalIncome, totalLoss, netProfit, totalDamageLoss,
      // New fields
      totalCapital,
      bankBalance,
      resellerPayable: Math.max(0, resellerPayable),
      approvedPayments,
      stockValue,
      shipmentValue,
      selfProductSale,
      vendorProductSale,
      selfStockProfit,
      vendorStockProfit,
      resellerProfit,
      paidReturnProfitFromDeposits,
      courierPaymentPure,
      selfReturnLossTotal,
      vendorReturnLossTotal: vendorReturnLossFromOrders,
      selfReturnOrderCount,
      selfPaidReturnOrderCount,
      vendorReturnOrderCount,
      vendorPaidReturnOrderCount,
      selfReturnLossEntries,
      vendorReturnLossEntries,
      mainSelfSellTotal,
      mainVendorSellTotal,
      resellerSelfSellTotal,
      resellerVendorSellTotal,
      mainSelfSale,
      mainVendorSale,
      resellerSelfSale,
      resellerVendorSale,
      totalJoma,
    };
  }, [orders, resellerOrders, allProducts, stockEntries, expenses, deposits, dateFilter, customStart, customEnd, buyPriceMap, stockTypes, vendorBuyPrices, paymentRequests]);

  const isProfit = report.netProfit >= 0;

  // Auto monthly loss feature removed

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">প্রফিট খাতা</h1>

      {/* Date Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {filterLabels.map((f) => (
          <Button
            key={f.value}
            variant={dateFilter === f.value ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-8 rounded-[5px]"
            onClick={() => setDateFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {dateFilter === 'custom' && (
        <div className="flex gap-2 items-center flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                {customStart ? format(customStart, 'dd/MM/yyyy') : 'শুরু'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">থেকে</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'শেষ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ===== SECTION 1: Hero Cards — আমার ব্যবসার অবস্থা ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Net Profit/Loss */}
        <Card className={cn("border-0 shadow-sm", isProfit ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20')}>
          <CardContent className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isProfit ? <TrendingUp className="w-6 h-6 text-green-600" /> : <TrendingDown className="w-6 h-6 text-destructive" />}
            </div>
            <p className="text-xs text-muted-foreground mb-1">{isProfit ? 'নেট লাভ' : 'নেট লস'}</p>
            <p className={cn("text-3xl font-bold", isProfit ? 'text-green-600' : 'text-destructive')}>
              {isProfit ? '+' : ''}৳{report.netProfit.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              মোট আয় ৳{report.totalIncome.toLocaleString()} − মোট লস ৳{report.totalLoss.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* মোট পুঁজি (ইনভেস্ট) = Deposits page's মোট জমা */}
        <Card className="border-0 shadow-sm bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">মোট জমাকৃত পুঁজি</p>
            <p className="text-3xl font-bold text-blue-600">৳{report.totalJoma.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              জমা ৳{report.totalDeposits.toLocaleString()} + কুরিয়ার ৳{report.courierPayment.toLocaleString()} + ভেন্ডর ৳{report.vendorPayment.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* সেলফ প্রডাক্ট সেল */}
        <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShoppingCart className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">সেলফ প্রডাক্ট সেল</p>
            <p className="text-3xl font-bold text-emerald-600">৳{report.selfProductSale.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-2">নিজে ৳{report.mainSelfSale.toLocaleString()} + রিসেলার ৳{report.resellerSelfSale.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* ভেন্ডর প্রডাক্ট সেল */}
        <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShoppingCart className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">ভেন্ডর প্রডাক্ট সেল</p>
            <p className="text-3xl font-bold text-amber-600">৳{report.vendorProductSale.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-2">নিজে ৳{report.mainVendorSale.toLocaleString()} + রিসেলার ৳{report.resellerVendorSale.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Truck className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">কুরিয়ার পেমেন্ট পাবো</p>
              </div>
              <p className="text-lg font-bold text-foreground">৳{report.courierPaymentPure.toLocaleString()}</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] text-destructive underline-offset-2 hover:underline text-left w-full">
                    সেলফ রিটার্ন/পেইড রিটার্ন লস: ৳{report.selfReturnLossTotal.toLocaleString()} <span className="text-muted-foreground">({report.selfReturnLossEntries.length}টি)</span>
                    <span className="block text-muted-foreground">রিটার্ন {report.selfReturnOrderCount}টি + পেইড রিটার্ন {report.selfPaidReturnOrderCount}টি</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-2" align="start">
                  <p className="text-xs font-semibold mb-1.5 px-1">সেলফ রিটার্ন লস ভাঙা</p>
                  {report.selfReturnLossEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">কোনো এন্ট্রি নেই</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {report.selfReturnLossEntries.map((e) => (
                        <div key={e.id} className="text-[11px] border rounded p-1.5">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium truncate">{e.title}</span>
                            <span className="text-destructive whitespace-nowrap">৳{e.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground">{e.date} · {e.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="w-4 h-4 text-teal-600" />
                <p className="text-xs text-muted-foreground">ভেন্ডর থেকে পাবো</p>
              </div>
              <p className="text-lg font-bold text-foreground">৳{report.vendorPayment.toLocaleString()}</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[10px] text-destructive underline-offset-2 hover:underline text-left w-full">
                    ভেন্ডর রিটার্ন/পেইড রিটার্ন লস: ৳{report.vendorReturnLossTotal.toLocaleString()} <span className="text-muted-foreground">({report.vendorReturnLossEntries.length}টি)</span>
                    <span className="block text-muted-foreground">রিটার্ন {report.vendorReturnOrderCount}টি + পেইড রিটার্ন {report.vendorPaidReturnOrderCount}টি</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-2" align="start">
                  <p className="text-xs font-semibold mb-1.5 px-1">ভেন্ডর রিটার্ন লস ভাঙা</p>
                  {report.vendorReturnLossEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">কোনো এন্ট্রি নেই</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {report.vendorReturnLossEntries.map((e) => (
                        <div key={e.id} className="text-[11px] border rounded p-1.5">
                          <div className="flex justify-between gap-2">
                            <span className="font-medium truncate">{e.title}</span>
                            <span className="text-destructive whitespace-nowrap">৳{e.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground">{e.date} · {e.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">রিসেলারদের দিতে হবে</p>
              </div>
              <p className="text-lg font-bold text-foreground">৳{report.resellerPayable.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">দেওয়া হয়েছে: ৳{report.approvedPayments.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-4 h-4 text-cyan-600" />
                <p className="text-xs text-muted-foreground">স্টকে প্রোডাক্ট আছে</p>
              </div>
              <p className="text-lg font-bold text-foreground">৳{report.stockValue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">স্টকের মোট মূল্য</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== SECTION 3: আয়ের সোর্স ===== */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">প্রতিষ্ঠানের লাভ হয়েছে</p>
            </div>
            <p className="text-2xl font-bold text-green-600">৳{report.totalIncome.toLocaleString()}</p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">সেলফ স্টক লাভ</span><span className={cn("font-medium", report.selfStockProfit >= 0 ? 'text-green-600' : 'text-destructive')}>৳{report.selfStockProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ভেন্ডর স্টক লাভ</span><span className={cn("font-medium", report.vendorStockProfit >= 0 ? 'text-green-600' : 'text-destructive')}>৳{report.vendorStockProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">রিসেলার থেকে লাভ</span><span className={cn("font-medium", report.resellerProfit >= 0 ? 'text-green-600' : 'text-destructive')}>৳{report.resellerProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">রিসেলিং করে লাভ</span><span className="text-green-600 font-medium">৳{report.resellingProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">পেইড রিটার্ন লাভ</span><span className="text-green-600 font-medium">৳{report.paidReturnProfitFromDeposits.toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-5 h-5 text-destructive" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">মোট লস/খরচ</p>
            </div>
            <p className="text-2xl font-bold text-destructive">৳{report.totalLoss.toLocaleString()}</p>
            <div className="mt-2 space-y-1 text-xs">
              {report.expenseByCategory.length === 0 && (
                <div className="text-muted-foreground">কোন খরচ নেই</div>
              )}
              {report.expenseByCategory.map(([cat, amt]) => (
                <div key={cat} className="flex justify-between">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="text-destructive font-medium">৳{(amt as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Helper to calculate stock value
function useMemo_stockValue(
  stockEntries: any[],
  orders: any[],
  resellerOrders: any[],
  allProducts: any[],
  stockTypes: Record<string, string>
): number {
  // MIRRORS StockManagement.tsx "এখন স্টকে আছে" calculation exactly.
  // inStock = max(0, totalBought - delivered - inShipment - damage)
  // stockValue = inStock × avgBuyPrice

  const shipmentStatuses = ['কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ', 'ডেলিভারির পথে'];
  const deliveredStatus = 'ডেলিভারড';

  // Build title → stockProductName map (only self-stock products contribute)
  const titleToStock: Record<string, string> = {};
  allProducts.forEach((p: any) => {
    if (p.stockType === 'self' && p.stockProductName) {
      titleToStock[p.title] = p.stockProductName;
    }
  });

  // Aggregate purchases per stock product
  const productMap: Record<string, { totalBought: number; totalBuyValue: number; totalDamage: number }> = {};
  stockEntries.forEach((entry: any) => {
    if (!productMap[entry.productName]) {
      productMap[entry.productName] = { totalBought: 0, totalBuyValue: 0, totalDamage: 0 };
    }
    productMap[entry.productName].totalBought += entry.quantity;
    productMap[entry.productName].totalBuyValue += entry.quantity * entry.buyPrice;
    productMap[entry.productName].totalDamage += entry.damage || 0;
  });

  // Aggregate delivered + inShipment per stock product (self-stock only)
  const calc: Record<string, { delivered: number; inShipment: number }> = {};
  const init = (name: string) => {
    if (!calc[name]) calc[name] = { delivered: 0, inShipment: 0 };
  };

  orders.forEach((o: any) => {
    const orderStockType = stockTypes[o.id] || 'self';
    if (orderStockType === 'vendor') return;
    (o.items || []).forEach((item: any) => {
      const stockName = item.stockProductName || titleToStock[item.name];
      if (!stockName) return;
      init(stockName);
      const qty = item.qty || 1;
      if (o.status === deliveredStatus) calc[stockName].delivered += qty;
      if (shipmentStatuses.includes(o.status)) calc[stockName].inShipment += qty;
    });
  });

  resellerOrders.forEach((o: any) => {
    const orderStockType = stockTypes[`reseller-${o.id}`] || 'self';
    if (orderStockType === 'vendor') return;
    (o.items || []).forEach((item: any) => {
      const stockName = item.stockProductName || titleToStock[item.productTitle];
      if (!stockName) return;
      init(stockName);
      const qty = item.qty || 1;
      if (o.status === deliveredStatus) calc[stockName].delivered += qty;
      if (shipmentStatuses.includes(o.status)) calc[stockName].inShipment += qty;
    });
  });

  let totalValue = 0;
  Object.entries(productMap).forEach(([name, data]) => {
    const c = calc[name] || { delivered: 0, inShipment: 0 };
    const inStock = Math.max(0, data.totalBought - c.delivered - c.inShipment - data.totalDamage);
    const avgBuyPrice = data.totalBought > 0 ? data.totalBuyValue / data.totalBought : 0;
    totalValue += inStock * avgBuyPrice;
  });

  return totalValue;
}

export default AccountReport;

// Helper: calculate value of products currently in shipment (avg buy price × qty)
// Mirrors StockManagement.tsx logic for "শিপমেন্টে আছে"
function useMemo_shipmentValue(
  stockEntries: any[],
  orders: any[],
  resellerOrders: any[],
  allProducts: any[],
  stockTypes: Record<string, string>
): number {
  const shipmentStatuses = ['কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ', 'ডেলিভারির পথে'];

  // Build avg buy price per stock product (same as StockManagement.tsx)
  const stockBuyMap: Record<string, { totalBought: number; totalBuyValue: number }> = {};
  stockEntries.forEach(entry => {
    if (!stockBuyMap[entry.productName]) {
      stockBuyMap[entry.productName] = { totalBought: 0, totalBuyValue: 0 };
    }
    stockBuyMap[entry.productName].totalBought += entry.quantity;
    stockBuyMap[entry.productName].totalBuyValue += entry.quantity * entry.buyPrice;
  });

  // Aggregate inShipment qty per stock product (self-stock only)
  const inShipmentQty: Record<string, number> = {};

  orders.forEach(o => {
    const st = stockTypes[o.id] || 'self';
    if (st !== 'self') return;
    if (!shipmentStatuses.includes(o.status)) return;
    o.items.forEach((item: any) => {
      const product = allProducts.find((p: any) => p.title === item.name || (item.stockProductName && p.stockProductName === item.stockProductName));
      const stockName = item.stockProductName || product?.stockProductName || item.name;
      inShipmentQty[stockName] = (inShipmentQty[stockName] || 0) + (item.qty || 1);
    });
  });

  resellerOrders.forEach(o => {
    let st = stockTypes[`reseller-${o.id}`] || stockTypes[o.id];
    if (!st && o.items && o.items.length > 0) {
      const firstItem = o.items[0];
      const prod = allProducts.find((p: any) => p.id === firstItem.productId || p.title === firstItem.productTitle);
      st = prod?.stockType || 'self';
    }
    if (!st) st = 'self';
    if (st !== 'self') return;
    if (!shipmentStatuses.includes(o.status)) return;
    o.items.forEach((item: any) => {
      const product = allProducts.find((p: any) => p.id === item.productId || p.title === item.productTitle);
      const stockName = product?.stockProductName || item.productTitle;
      inShipmentQty[stockName] = (inShipmentQty[stockName] || 0) + (item.qty || 1);
    });
  });

  let totalValue = 0;
  Object.entries(inShipmentQty).forEach(([stockName, qty]) => {
    const data = stockBuyMap[stockName];
    if (!data || data.totalBought === 0) return;
    const avgBuyPrice = data.totalBuyValue / data.totalBought;
    totalValue += qty * avgBuyPrice;
  });

  return totalValue;
}
