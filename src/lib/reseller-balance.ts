import type { ResellerOrder, PaymentRequest } from '@/stores/useResellerStore';

export const RESELLER_RETURN_STATUSES = ['রিটার্ন', 'রিটার্নিং'];
export const RESELLER_PAID_RETURN_STATUSES = ['পেইড রিটার্ন', 'পেইড রিটার্নিং'];

export const getResellerReturnCharges = (order: ResellerOrder) =>
  (order.deliveryCharge || 0) + (order.packagingCharge || 0);

export const getResellerPaidReturnAmount = (order: ResellerOrder) => {
  const paid = (order as any).paidReturnAmount;
  return typeof paid === 'number' && !Number.isNaN(paid) && paid > 0
    ? paid
    : getResellerReturnCharges(order);
};

export const getResellerOrderBalanceImpact = (order: ResellerOrder) => {
  if (order.status === 'ডেলিভারড') return order.totalProfit || 0;
  if (RESELLER_RETURN_STATUSES.includes(order.status)) return -getResellerReturnCharges(order);
  if (RESELLER_PAID_RETURN_STATUSES.includes(order.status)) {
    return getResellerPaidReturnAmount(order) - getResellerReturnCharges(order);
  }
  return 0;
};

/**
 * Single source of truth for reseller balance math.
 * Used by ResellerDashboard, ResellerBalance, and ResellerPayments
 * so all three pages show the same number.
 */
export function computeResellerBalance(
  orders: ResellerOrder[],
  paymentRequests: PaymentRequest[],
) {
  const deliveredOrders = orders.filter((o) => o.status === 'ডেলিভারড');
  const returnOrders = orders.filter((o) => RESELLER_RETURN_STATUSES.includes(o.status));
  const paidReturnOrders = orders.filter((o) => RESELLER_PAID_RETURN_STATUSES.includes(o.status));

  const deliveredProfit = deliveredOrders.reduce((s, o) => s + o.totalProfit, 0);
  const returnLoss = returnOrders.reduce((s, o) => s + getResellerReturnCharges(o), 0);
  const paidReturnNet = paidReturnOrders.reduce((s, o) => {
    const charges = getResellerReturnCharges(o);
    const paid = getResellerPaidReturnAmount(o);
    return s + (charges - paid);
  }, 0);

  const approvedPayments = paymentRequests
    .filter((p) => p.status === 'অনুমোদিত')
    .reduce((s, p) => s + p.amount, 0);
  const pendingPayments = paymentRequests
    .filter((p) => p.status === 'পেন্ডিং')
    .reduce((s, p) => s + p.amount, 0);

  const withdrawable =
    deliveredProfit - returnLoss - paidReturnNet - approvedPayments - pendingPayments;

  return {
    deliveredProfit,
    returnLoss,
    paidReturnNet,
    approvedPayments,
    pendingPayments,
    withdrawable,
  };
}
