import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useResellerStore } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import {
  Users, TrendingUp, ShoppingCart, Wallet, Search,
  PackageCheck, PackageX, Clock, Crown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { isToday, isYesterday, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { computeResellerBalance, RESELLER_PAID_RETURN_STATUSES, RESELLER_RETURN_STATUSES } from '@/lib/reseller-balance';

const ResellerReport = () => {
  const { resellers, orders, paymentRequests } = useResellerStore();
  const products = useProductStore((s) => s.products);
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'profit' | 'orders' | 'delivered' | 'balance'>('profit');

  const filteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    const now = new Date();
    return orders.filter((o) => {
      const d = new Date(o.date);
      if (isNaN(d.getTime())) return true;
      switch (dateFilter) {
        case 'today': return isToday(d);
        case 'yesterday': return isYesterday(d);
        case '7days': return d >= subDays(now, 7);
        case 'month': return d >= startOfMonth(now) && d <= endOfMonth(now);
        case 'lastMonth': { const lm = subMonths(now, 1); return d >= startOfMonth(lm) && d <= endOfMonth(lm); }
        case 'year': return d >= startOfYear(now);
        default: return true;
      }
    });
  }, [orders, dateFilter]);

  const resellerStats = useMemo(() => {
    return resellers.map((r) => {
      const rOrders = filteredOrders.filter((o) => o.resellerId === r.id);
      const totalOrders = rOrders.length;
      const deliveredOrders = rOrders.filter((o) => o.status === 'ডেলিভারড');
      // "Lost" orders for delivery-rate / C counter — cancel + return + paid return
      const cancelledOrders = rOrders.filter((o) =>
        ['ক্যান্সেল', ...RESELLER_RETURN_STATUSES, ...RESELLER_PAID_RETURN_STATUSES].includes(o.status),
      );
      const pendingOrders = rOrders.filter(
        (o) => !['ডেলিভারড', 'ক্যান্সেল', ...RESELLER_RETURN_STATUSES, ...RESELLER_PAID_RETURN_STATUSES].includes(o.status),
      );

      // Sales: delivered selling price only (what was actually sold)
      const deliveredSelling = deliveredOrders.reduce((s, o) => s + (o.totalSellingPrice || 0), 0);
      const deliveredProfit = deliveredOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
      // Units sold (sum of qty across delivered order items)
      const deliveredQty = deliveredOrders.reduce(
        (s, o) => s + (o.items || []).reduce((q, it) => q + (it.qty || 0), 0),
        0,
      );

      let myProfit = 0;
      deliveredOrders.forEach((o) => {
        o.items.forEach((item) => {
          const snap = (item as any).buyPrice;
          let buyPrice: number;
          if (typeof snap === 'number' && !isNaN(snap)) buyPrice = snap;
          else {
            const prod = products.find((p) => p.id === item.productId);
            buyPrice = prod?.buyPrice || 0;
          }
          myProfit += (item.resellerPrice - buyPrice) * item.qty;
        });
      });

      const rPayments = paymentRequests.filter((p) => p.resellerId === r.id);
      const { approvedPayments, pendingPayments, withdrawable: balance } = computeResellerBalance(rOrders, rPayments);

      const deliveryRate = totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;

      return {
        id: r.id, name: r.name, phone: r.phone, isActive: r.isActive,
        totalOrders, deliveredCount: deliveredOrders.length,
        cancelledCount: cancelledOrders.length, pendingCount: pendingOrders.length,
        deliveredQty,
        deliveredSelling, deliveredProfit, myProfit,
        approvedPayments, pendingPayments, deliveryRate,
        balance,
      };
    });
  }, [resellers, filteredOrders, paymentRequests, products]);

  const filteredStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? resellerStats.filter(r => r.name.toLowerCase().includes(q) || r.phone.includes(q))
      : resellerStats;
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'orders': return b.totalOrders - a.totalOrders;
        case 'delivered': return b.deliveredCount - a.deliveredCount;
        case 'balance': return b.balance - a.balance;
        default: return b.myProfit - a.myProfit;
      }
    });
    return list;
  }, [resellerStats, search, sortBy]);

  const totals = useMemo(() => ({
    totalOrders: resellerStats.reduce((s, r) => s + r.totalOrders, 0),
    deliveredCount: resellerStats.reduce((s, r) => s + r.deliveredCount, 0),
    cancelledCount: resellerStats.reduce((s, r) => s + r.cancelledCount, 0),
    pendingCount: resellerStats.reduce((s, r) => s + r.pendingCount, 0),
    deliveredSelling: resellerStats.reduce((s, r) => s + r.deliveredSelling, 0),
    deliveredQty: resellerStats.reduce((s, r) => s + r.deliveredQty, 0),
    totalBalance: resellerStats.reduce((s, r) => s + r.balance, 0),
    deliveredProfit: resellerStats.reduce((s, r) => s + r.deliveredProfit, 0),
    myProfit: resellerStats.reduce((s, r) => s + r.myProfit, 0),
    totalPaid: resellerStats.reduce((s, r) => s + r.approvedPayments, 0),
    totalPending: resellerStats.reduce((s, r) => s + r.pendingPayments, 0),
    activeResellers: resellers.filter(r => r.isActive).length,
  }), [resellerStats, resellers]);

  const topPerformers = useMemo(
    () => [...resellerStats].sort((a, b) => b.myProfit - a.myProfit).slice(0, 5).filter(r => r.myProfit > 0),
    [resellerStats],
  );

  const deliveryRate = totals.totalOrders > 0
    ? Math.round((totals.deliveredCount / totals.totalOrders) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-5">
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 w-44 h-44 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" /> রিসেলার রিপোর্ট
            </h1>
            <p className="text-xs text-muted-foreground mt-1">পারফরম্যান্স, লাভ, পেমেন্ট ও ব্যালেন্স একনজরে</p>
          </div>
          <ToggleGroup type="single" value={dateFilter} onValueChange={(v) => v && setDateFilter(v)} className="flex-wrap">
            {[['all','সব'],['today','আজ'],['yesterday','গতকাল'],['7days','৭ দিন'],['month','এই মাস'],['lastMonth','গত মাস'],['year','এই বছর']].map(([v, l]) => (
              <ToggleGroupItem key={v} value={v} size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{l}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">মোট রিসেলার</p>
                <p className="text-2xl font-bold text-foreground mt-1">{resellers.length}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">সক্রিয়: {totals.activeResellers}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">মোট অর্ডার</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totals.totalOrders}</p>
                <div className="flex items-center gap-1 text-[10px] mt-0.5">
                  <PackageCheck className="w-3 h-3 text-green-600" /><span className="text-green-600">{totals.deliveredCount}</span>
                  <PackageX className="w-3 h-3 text-red-500 ml-1" /><span className="text-red-500">{totals.cancelledCount}</span>
                  <Clock className="w-3 h-3 text-amber-500 ml-1" /><span className="text-amber-600">{totals.pendingCount}</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-500/10 to-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">আমার লাভ</p>
                <p className="text-2xl font-bold text-green-600 mt-1">৳{totals.myProfit.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">রিসেলার লাভ: ৳{totals.deliveredProfit.toLocaleString()}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500/10 to-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">পেমেন্ট দেওয়া</p>
                <p className="text-2xl font-bold text-foreground mt-1">৳{totals.totalPaid.toLocaleString()}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">পেন্ডিং: ৳{totals.totalPending.toLocaleString()}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery rate + Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">ডেলিভারি রেট</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-foreground">{deliveryRate}%</p>
              <span className={`text-xs font-medium mb-1 inline-flex items-center gap-0.5 ${deliveryRate >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                {deliveryRate >= 60 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {deliveryRate >= 60 ? 'ভালো' : 'লো'}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${deliveryRate >= 70 ? 'bg-green-500' : deliveryRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${deliveryRate}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">ডেলিভারড</p>
                <p className="text-sm font-bold text-green-600">{totals.deliveredCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">ক্যান্সেল</p>
                <p className="text-sm font-bold text-red-500">{totals.cancelledCount}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">পেন্ডিং</p>
                <p className="text-sm font-bold text-amber-600">{totals.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" /> টপ ৫ রিসেলার (লাভে)
              </p>
            </div>
            {topPerformers.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-6">কোনো ডেটা নেই</p>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((r, i) => {
                  const max = topPerformers[0].myProfit || 1;
                  const pct = Math.round((r.myProfit / max) * 100);
                  const medal = ['🥇', '🥈', '🥉', '4', '5'][i];
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < 3 ? '' : 'bg-muted text-muted-foreground'}`}>{medal}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium truncate">{r.name}</p>
                          <p className="text-xs font-bold text-green-600">৳{r.myProfit.toLocaleString()}</p>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-green-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="রিসেলার খুঁজুন (নাম বা ফোন)"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <ToggleGroup type="single" value={sortBy} onValueChange={(v: any) => v && setSortBy(v)} className="flex-wrap">
          <ToggleGroupItem value="profit" size="sm" className="text-xs h-9">আমার লাভ</ToggleGroupItem>
          <ToggleGroupItem value="balance" size="sm" className="text-xs h-9">ব্যালেন্স</ToggleGroupItem>
          <ToggleGroupItem value="delivered" size="sm" className="text-xs h-9">ডেলিভারড</ToggleGroupItem>
          <ToggleGroupItem value="orders" size="sm" className="text-xs h-9">অর্ডার</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Reseller table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">রিসেলার</TableHead>
                  <TableHead className="text-xs text-center">অর্ডার</TableHead>
                  <TableHead className="text-xs text-center">ডেলিভারি রেট</TableHead>
                  <TableHead className="text-xs text-right">বিক্রি</TableHead>
                  <TableHead className="text-xs text-right">রিসেলার লাভ</TableHead>
                  <TableHead className="text-xs text-right">আমার লাভ</TableHead>
                  <TableHead className="text-xs text-right">পেমেন্ট</TableHead>
                  <TableHead className="text-xs text-right">ব্যালেন্স</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">কোনো রিসেলার নেই</TableCell></TableRow>
                ) : filteredStats.map((r) => {
                  const initials = r.name?.slice(0, 1).toUpperCase() || 'R';
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold flex items-center justify-center text-xs shrink-0">{initials}</div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{r.name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.phone}</p>
                            <Badge variant={r.isActive ? "default" : "secondary"} className="text-[9px] mt-0.5 h-4 px-1.5">
                              {r.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <p className="font-bold">{r.totalOrders}</p>
                        <p className="text-[9px] text-muted-foreground">D:{r.deliveredCount} · C:{r.cancelledCount} · P:{r.pendingCount}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          <span className={`text-xs font-bold ${r.deliveryRate >= 70 ? 'text-green-600' : r.deliveryRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {Math.round(r.deliveryRate)}%
                          </span>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${r.deliveryRate >= 70 ? 'bg-green-500' : r.deliveryRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${r.deliveryRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <p>৳{r.deliveredSelling.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground">{r.deliveredQty} পিস</p>
                      </TableCell>
                      <TableCell className="text-xs text-right text-blue-600 font-semibold">৳{r.deliveredProfit.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right text-green-600 font-bold">৳{r.myProfit.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right">
                        <p>৳{r.approvedPayments.toLocaleString()}</p>
                        {r.pendingPayments > 0 && <p className="text-[9px] text-amber-600">পেন্ডিং: ৳{r.pendingPayments.toLocaleString()}</p>}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-bold ${r.balance > 0 ? 'text-green-600' : r.balance < 0 ? 'text-red-500' : ''}`}>
                        ৳{r.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredStats.length > 0 && (
                  <TableRow className="bg-primary/5 font-bold hover:bg-primary/5">
                    <TableCell className="text-xs">মোট ({filteredStats.length})</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalOrders}</TableCell>
                    <TableCell className="text-xs text-center text-green-600">{deliveryRate}%</TableCell>
                    <TableCell className="text-xs text-right">
                      <p>৳{totals.deliveredSelling.toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">{totals.deliveredQty} পিস</p>
                    </TableCell>
                    <TableCell className="text-xs text-right text-blue-600">৳{totals.deliveredProfit.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right text-green-600">৳{totals.myProfit.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">৳{totals.totalPaid.toLocaleString()}</TableCell>
                    <TableCell className={`text-xs text-right ${totals.totalBalance > 0 ? 'text-green-600' : totals.totalBalance < 0 ? 'text-red-500' : ''}`}>৳{totals.totalBalance.toLocaleString()}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerReport;
