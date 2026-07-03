import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useResellerStore } from '@/stores/useResellerStore';
import { Wallet, TrendingUp, Clock, CheckCircle, ChevronDown, ChevronUp, TrendingDown, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  computeResellerBalance,
  getResellerOrderBalanceImpact,
  getResellerPaidReturnAmount,
  getResellerReturnCharges,
  RESELLER_PAID_RETURN_STATUSES,
  RESELLER_RETURN_STATUSES,
} from '@/lib/reseller-balance';

const getResellerId = () => {
  const auth = localStorage.getItem('reseller-auth');
  return auth ? JSON.parse(auth).id : '';
};

const ResellerBalance = () => {
  const resellerId = getResellerId();
  const store = useResellerStore();
  const orders = store.orders.filter((o) => o.resellerId === resellerId);
  const paymentRequests = store.paymentRequests.filter((p) => p.resellerId === resellerId);

  const deliveredOrders = orders.filter((o) => o.status === 'ডেলিভারড');
  const {
    deliveredProfit,
    returnLoss,
    paidReturnNet,
    approvedPayments: totalWithdrawn,
    pendingPayments,
    withdrawable,
  } = computeResellerBalance(orders, paymentRequests);
  const pendingProfit = orders
    .filter((o) => !['ডেলিভারড', 'ক্যান্সেল', ...RESELLER_RETURN_STATUSES, ...RESELLER_PAID_RETURN_STATUSES].includes(o.status))
    .reduce((sum, o) => sum + o.totalProfit, 0);

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const stats = [
    { title: 'ডেলিভারড লাভ', value: `৳${deliveredProfit}`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { title: 'রিটার্ন লস', value: `৳${returnLoss + paidReturnNet}`, icon: TrendingDown, color: returnLoss + paidReturnNet > 0 ? 'text-red-600' : 'text-emerald-600', bg: 'bg-red-500/10' },
    { title: 'পেন্ডিং লাভ', value: `৳${pendingProfit}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { title: 'উত্তোলিত', value: `৳${totalWithdrawn}`, icon: Wallet, color: 'text-violet-600', bg: 'bg-violet-500/10' },
  ];

  // Combine delivered (profit) and return (loss) orders for the breakdown
  const profitLossOrders = orders.filter((o) =>
    ['ডেলিভারড', ...RESELLER_RETURN_STATUSES, ...RESELLER_PAID_RETURN_STATUSES].includes(o.status)
  );

  return (
    <div className="space-y-5 pb-8">
      <h1 className="text-xl font-bold text-foreground">ব্যালেন্স</h1>

      {/* Withdrawable Balance */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5 text-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">উত্তোলনযোগ্য ব্যালেন্স</p>
          <p className="text-3xl font-bold text-primary mt-1">৳{withdrawable}</p>
          <p className="text-[11px] text-muted-foreground mt-1.5">ডেলিভারড লাভ - রিটার্ন লস - উত্তোলিত</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.title} className="border-0 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.title}</p>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order-wise Profit & Loss */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">অর্ডার ভিত্তিক লাভ ও লস</CardTitle>
            <span className="text-[11px] text-muted-foreground">{profitLossOrders.length} টি অর্ডার</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {profitLossOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">কোনো ডেলিভারড বা রিটার্ন অর্ডার নেই</p>
          ) : (
            <div className="space-y-2">
              {profitLossOrders.map((o) => {
                const isDelivered = o.status === 'ডেলিভারড';
                const isPaidReturn = RESELLER_PAID_RETURN_STATUSES.includes(o.status);
                const isExpanded = expandedOrder === o.id;

                const subtotalSelling = o.items.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
                const subtotalDP = o.items.reduce((s, i) => s + i.resellerPrice * i.qty, 0);
                const delivery = o.deliveryCharge || 0;
                const packaging = o.packagingCharge || 0;
                const cod = o.codCharge || 0;
                const profit = o.totalProfit;
                const returnLossAmount = getResellerReturnCharges(o);
                const paidReturnAmount = getResellerPaidReturnAmount(o);
                const balanceImpact = getResellerOrderBalanceImpact(o);

                return (
                  <div key={o.id} className="rounded-xl border bg-card overflow-hidden">
                    {/* Summary Row */}
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDelivered ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        }`}>
                          {isDelivered ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-primary">{o.id}</span>
                            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${
                              isDelivered ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {o.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{o.customerName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold ${isDelivered ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isDelivered || balanceImpact >= 0 ? `+৳${Math.abs(balanceImpact)}` : `-৳${Math.abs(balanceImpact)}`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Breakdown */}
                    {isExpanded && (
                      <div className="border-t px-3 pb-3 pt-2 bg-muted/20">
                        {/* Products */}
                        <div className="mb-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">প্রোডাক্ট</p>
                          <div className="space-y-1.5">
                            {o.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <img src={item.image || '/placeholder.svg'} alt="" className="w-8 h-8 rounded object-cover border shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{item.productTitle}</p>
                                  <p className="text-[10px] text-muted-foreground">×{item.qty}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Price Breakdown */}
                        <div className="rounded-lg bg-card border p-3 space-y-1.5 text-xs">
                          {isDelivered ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">সেল প্রাইজ:</span>
                                <span className="font-medium">৳{subtotalSelling}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- DP প্রাইজ:</span>
                                <span className="text-red-500">-৳{subtotalDP}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- ডেলিভারি চার্জ:</span>
                                <span className="text-red-500">-৳{delivery}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- প্যাকেজিং চার্জ:</span>
                                <span className="text-red-500">-৳{packaging}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- COD চার্জ:</span>
                                <span className="text-red-500">-৳{cod}</span>
                              </div>
                              <div className="flex justify-between font-bold border-t pt-1.5 text-emerald-600">
                                <span>প্রফিট:</span>
                                <span>+৳{profit}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] text-muted-foreground mb-1">{isPaidReturn ? 'পেইড রিটার্নে পেমেন্ট বাদ দিয়ে নেট হিসাব হয়েছে' : 'রিটার্নে শুধুমাত্র ডেলিভারি ও প্যাকেজিং চার্জ কাটা হয়েছে'}</p>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- ডেলিভারি চার্জ:</span>
                                <span className="text-red-500">-৳{delivery}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">- প্যাকেজিং চার্জ:</span>
                                <span className="text-red-500">-৳{packaging}</span>
                              </div>
                              {isPaidReturn && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">+ পেইড রিটার্ন পেমেন্ট:</span>
                                  <span className="text-emerald-600">+৳{paidReturnAmount}</span>
                                </div>
                              )}
                              <div className={`flex justify-between font-bold border-t pt-1.5 ${balanceImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                <span>{balanceImpact >= 0 ? 'নেট যোগ:' : 'নেট লস:'}</span>
                                <span>{balanceImpact >= 0 ? `+৳${balanceImpact}` : `-৳${Math.abs(balanceImpact)}`}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerBalance;
