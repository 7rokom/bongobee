import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrderStore } from '@/stores/useOrderStore';
import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useBlogStore } from '@/stores/useBlogStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useDepositStore } from '@/stores/useDepositStore';
import { useStockStore } from '@/stores/useStockStore';
import { useIncompleteOrderStore } from '@/stores/useIncompleteOrderStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { useNavigate } from 'react-router-dom';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import {
  Package, ShoppingCart, FileText, TrendingUp, TrendingDown, Users, Wallet,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, Truck,
  XCircle, RotateCcw, AlertTriangle, Eye, DollarSign,
  PackageCheck, ShoppingBag, BarChart3, PieChart, Activity, Sparkles,
  CreditCard, Boxes, UserCheck, Layers,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'কনফার্মড': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'প্রসেসিং': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'প্যাকেজিং': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'শিপমেন্ট': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'ডেলিভারড': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'রিটার্ন': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'পেইড রিটার্ন': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  'ক্যান্সেল': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'হোল্ড': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'ফলোয়াপ': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

const statusIcons: Record<string, React.ElementType> = {
  'পেন্ডিং': Clock,
  'কনফার্মড': CheckCircle2,
  'প্রসেসিং': PackageCheck,
  'প্যাকেজিং': Package,
  'শিপমেন্ট': Truck,
  'ডেলিভারড': CheckCircle2,
  'রিটার্ন': RotateCcw,
  'পেইড রিটার্ন': RotateCcw,
  'ক্যান্সেল': XCircle,
};

const formatBDT = (n: number) => '৳' + n.toLocaleString('en-IN');

type RangeKey = 'today' | 'yesterday' | 'month' | 'lastMonth' | 'custom';

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'আজকে' },
  { key: 'yesterday', label: 'গতকাল' },
  { key: 'month', label: 'এই মাস' },
  { key: 'lastMonth', label: 'গতমাস' },
  { key: 'custom', label: 'কাস্টম' },
];

const getRangeBounds = (key: RangeKey, customFrom?: Date, customTo?: Date): { start: Date; end: Date } => {
  const now = new Date();
  switch (key) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case 'month': return { start: startOfMonth(now), end: endOfDay(now) };
    case 'lastMonth': { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case 'custom': return { start: startOfDay(customFrom || now), end: endOfDay(customTo || customFrom || now) };
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { orders } = useOrderStore();
  const { products } = useProductStore();
  const { categories } = useCategoryStore();
  const { posts } = useBlogStore();
  const { expenses } = useExpenseStore();
  const { deposits } = useDepositStore();
  const { stockEntries } = useStockStore();
  const { orders: allIncompleteOrders } = useIncompleteOrderStore();
  const incompleteOrders = allIncompleteOrders.filter(o => o.status !== 'cancelled');
  const { resellers, orders: resellerOrders } = useResellerStore();
  const { stockTypes, vendorBuyPrices } = useFollowUpStore();

  useLazyFetch([
    useProductStore.getState().fetchProducts,
    useCategoryStore.getState().fetchCategories,
    useBlogStore.getState().fetchPosts,
    useExpenseStore.getState().fetchExpenses,
    useDepositStore.getState().fetchDeposits,
    useStockStore.getState().fetchStockEntries,
    useResellerStore.getState().fetchResellerOrders,
    useFollowUpStore.getState().fetchAll,
  ]);

  const [range, setRange] = useState<RangeKey>('month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const stats = useMemo(() => {
    const { start: rangeStart, end: rangeEnd } = getRangeBounds(range, customFrom, customTo);
    const inSelectedRange = (dateStr?: string) => {
      if (!dateStr) return false;
      try {
        const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
      } catch {
        return false;
      }
    };
    const rangeOrders = orders.filter(o => inSelectedRange((o as any).isoDate || (o as any).iso_date || o.date));
    const rangeResellerOrders = resellerOrders.filter(o => inSelectedRange(o.date));
    const rangeExpenses = expenses.filter(e => inSelectedRange(e.date));
    const rangeDeposits = deposits.filter(d => inSelectedRange(d.date));
    const allOrderStatuses = [...rangeOrders.map(o => o.status), ...rangeResellerOrders.map(o => o.status)];
    const countStatus = (status: string) => allOrderStatuses.filter(s => s === status).length;

    const pending = countStatus('পেন্ডিং');
    const confirmed = countStatus('কনফার্মড');
    const processing = countStatus('প্রসেসিং');
    const packaging = countStatus('প্যাকেজিং');
    const shipped = countStatus('শিপমেন্ট');
    const delivered = countStatus('ডেলিভারড');
    const returned = countStatus('রিটার্ন');
    const paidReturn = countStatus('পেইড রিটার্ন');
    const cancelled = countStatus('ক্যান্সেল');
    const hold = countStatus('হোল্ড');
    const followup = countStatus('ফলোয়াপ');

    const mainDeliveredOrders = rangeOrders.filter(o => o.status === 'ডেলিভারড');
    const resellerDeliveredOrders = rangeResellerOrders.filter(o => o.status === 'ডেলিভারড');
    // ডেলিভারড রেভিনিউ = প্রোডাক্ট সেল প্রাইস (ডেলিভারি চার্জ বাদে) — প্রফিট খাতার "মোট প্রোডাক্ট সেল"-এর সাথে মেলে।
    const totalRevenue = mainDeliveredOrders.reduce((s, o) => s + (o.total - (o.deliveryCharge || 0)), 0)
      + resellerDeliveredOrders.reduce((s, o) => s + ((o.totalSellingPrice || 0) - (o.deliveryCharge || 0)), 0);
    const totalSales = totalRevenue;
    const totalExpenses = rangeExpenses.filter(e => e.category !== 'ডিজিটাল প্রডাক্ট অ্যাড').reduce((s, e) => s + e.amount, 0);
    const totalDeposits = rangeDeposits.reduce((s, d) => s + d.amount, 0);

    const titleToStock: Record<string, string> = {};
    const productById: Record<string, typeof products[number]> = {};
    const productByTitle: Record<string, typeof products[number]> = {};
    products.forEach((p) => {
      productById[p.id] = p;
      productByTitle[p.title] = p;
      if (p.stockType === 'self' && p.stockProductName) titleToStock[p.title] = p.stockProductName;
    });

    const stockMap: Record<string, { bought: number; buyValue: number; sellValue: number; damage: number }> = {};
    stockEntries.forEach((entry) => {
      if (!stockMap[entry.productName]) stockMap[entry.productName] = { bought: 0, buyValue: 0, sellValue: 0, damage: 0 };
      stockMap[entry.productName].bought += entry.quantity;
      stockMap[entry.productName].buyValue += entry.quantity * entry.buyPrice;
      stockMap[entry.productName].sellValue += entry.quantity * entry.sellPrice;
      stockMap[entry.productName].damage += entry.damage || 0;
    });

    const avgBuyPrice = (stockName?: string) => {
      if (!stockName) return 0;
      const stock = stockMap[stockName];
      return stock?.bought ? stock.buyValue / stock.bought : 0;
    };
    const mainItemBuyPrice = (item: any) => {
      if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) return item.buyPrice;
      const product = productByTitle[item.name];
      const stockName = item.stockProductName || product?.stockProductName || titleToStock[item.name];
      return avgBuyPrice(stockName) || product?.buyPrice || 0;
    };
    const resellerItemBuyPrice = (item: any) => {
      if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) return item.buyPrice;
      const product = productById[item.productId] || productByTitle[item.productTitle];
      const stockName = item.stockProductName || product?.stockProductName || titleToStock[item.productTitle];
      return avgBuyPrice(stockName) || product?.buyPrice || 0;
    };

    const shipmentStatuses = ['কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ', 'ডেলিভারির পথে'];
    const stockCalc: Record<string, { delivered: number; inShipment: number }> = {};
    const initStockCalc = (name: string) => {
      if (!stockCalc[name]) stockCalc[name] = { delivered: 0, inShipment: 0 };
    };

    orders.forEach((o) => {
      if ((stockTypes[o.id] || 'self') === 'vendor') return;
      o.items.forEach((item: any) => {
        const stockName = item.stockProductName || titleToStock[item.name];
        if (!stockName) return;
        initStockCalc(stockName);
        const qty = item.qty || 1;
        if (o.status === 'ডেলিভারড') stockCalc[stockName].delivered += qty;
        if (shipmentStatuses.includes(o.status)) stockCalc[stockName].inShipment += qty;
      });
    });
    resellerOrders.forEach((o) => {
      if ((stockTypes[`reseller-${o.id}`] || 'self') === 'vendor') return;
      o.items.forEach((item: any) => {
        const stockName = item.stockProductName || titleToStock[item.productTitle];
        if (!stockName) return;
        initStockCalc(stockName);
        const qty = item.qty || 1;
        if (o.status === 'ডেলিভারড') stockCalc[stockName].delivered += qty;
        if (shipmentStatuses.includes(o.status)) stockCalc[stockName].inShipment += qty;
      });
    });

    let totalStockValue = 0;
    let totalStockSellValue = 0;
    Object.entries(stockMap).forEach(([name, stock]) => {
      const calc = stockCalc[name] || { delivered: 0, inShipment: 0 };
      const inStock = Math.max(0, stock.bought - calc.delivered - calc.inShipment - stock.damage);
      const avgBuy = stock.bought ? stock.buyValue / stock.bought : 0;
      const avgSell = stock.bought ? stock.sellValue / stock.bought : 0;
      totalStockValue += inStock * avgBuy;
      totalStockSellValue += inStock * avgSell;
    });

    const mainProfit = mainDeliveredOrders.reduce((sum, o) => {
      const stockType = stockTypes[o.id] || 'self';
      const productCost = vendorBuyPrices[o.id] !== undefined
        ? vendorBuyPrices[o.id]
        : o.items.reduce((s, item: any) => s + mainItemBuyPrice(item) * (item.qty || 1), 0);
      const codCharge = Math.ceil((o.total * 1) / 100);
      const packagingCharge = stockType === 'vendor' ? 10 : 0;
      return sum + o.total - (o.deliveryCharge || 0) - productCost - codCharge - packagingCharge;
    }, 0);
    const resellerProfit = resellerDeliveredOrders.reduce((sum, o) => {
      const key = `reseller-${o.id}`;
      const productCost = vendorBuyPrices[key] !== undefined
        ? vendorBuyPrices[key]
        : o.items.reduce((s, item: any) => s + resellerItemBuyPrice(item) * (item.qty || 1), 0);
      return sum + (o.totalResellerCost || 0) - productCost;
    }, 0);

    const uniqueCustomers = new Set([...rangeOrders.map(o => o.phone), ...rangeResellerOrders.map(o => o.customerPhone)]).size;
    const totalOrders = rangeOrders.length + rangeResellerOrders.length;
    const deliveryRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(1) : '0';
    // Cancel/Return rate now includes cancelled + returned + paid-return
    const cancelReturnCount = cancelled + returned + paidReturn;
    const cancelRate = totalOrders > 0 ? ((cancelReturnCount / totalOrders) * 100).toFixed(1) : '0';
    const netProfit = mainProfit + resellerProfit - totalExpenses;

    return {
      pending, confirmed, processing, packaging, shipped, delivered, returned, paidReturn, cancelled, hold, followup,
      totalRevenue, totalSales, totalExpenses, totalDeposits, totalStockValue, totalStockSellValue,
      uniqueCustomers, deliveryRate, cancelRate, cancelReturnCount, netProfit,
      totalOrders,
    };
  }, [orders, resellerOrders, expenses, deposits, stockEntries, products, stockTypes, vendorBuyPrices, range, customFrom, customTo]);


  // Build trend chart data from orders.iso_date / date
  const trendData = useMemo(() => {
    const { start: rStart, end: rEnd } = getRangeBounds(range, customFrom, customTo);
    const days = Math.max(1, differenceInCalendarDays(rEnd, rStart) + 1);
    const result: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(rStart.getTime() + i * 86400000);
      const start = startOfDay(day);
      const end = endOfDay(day);
      let revenue = 0;
      let count = 0;
      const chartOrders = [
        ...orders.map((o) => ({ isoDate: (o as any).isoDate || (o as any).iso_date, status: o.status, total: o.total })),
        ...resellerOrders.map((o) => ({ isoDate: o.date, status: o.status, total: o.totalSellingPrice || 0 })),
      ];
      chartOrders.forEach(o => {
        const iso = (o as any).isoDate || (o as any).iso_date;
        if (!iso) return;
        try {
          const d = typeof iso === 'string' ? parseISO(iso) : new Date(iso);
          if (isNaN(d.getTime())) return;
          if (isWithinInterval(d, { start, end })) {
            count++;
            if (o.status === 'ডেলিভারড') revenue += o.total;
          }
        } catch {}
      });
      result.push({ date: format(day, 'dd/MM'), revenue, orders: count });
    }
    return result;
  }, [orders, resellerOrders, range, customFrom, customTo]);

  const orderStatusBreakdown = useMemo(() => {
    return [
      { label: 'পেন্ডিং', count: stats.pending, color: 'bg-yellow-500' },
      { label: 'কনফার্মড', count: stats.confirmed, color: 'bg-blue-500' },
      { label: 'প্রসেসিং', count: stats.processing, color: 'bg-cyan-500' },
      { label: 'প্যাকেজিং', count: stats.packaging, color: 'bg-indigo-500' },
      { label: 'শিপমেন্ট', count: stats.shipped, color: 'bg-purple-500' },
      { label: 'ডেলিভারড', count: stats.delivered, color: 'bg-green-500' },
      { label: 'রিটার্ন', count: stats.returned, color: 'bg-orange-500' },
      { label: 'পেইড রিটার্ন', count: stats.paidReturn, color: 'bg-pink-500' },
      { label: 'ক্যান্সেল', count: stats.cancelled, color: 'bg-red-500' },
      { label: 'হোল্ড', count: stats.hold, color: 'bg-gray-500' },
      { label: 'ফলোয়াপ', count: stats.followup, color: 'bg-teal-500' },
    ].filter(i => i.count > 0);
  }, [stats]);

  const chartConfig = {
    revenue: { label: 'রেভিনিউ', color: 'hsl(var(--primary))' },
    orders: { label: 'অর্ডার', color: 'hsl(var(--secondary))' },
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary p-5 md:p-6 text-white shadow-lg">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium opacity-90">অ্যাডমিন প্যানেল</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">ড্যাশবোর্ড</h1>
            <p className="text-xs md:text-sm opacity-90 mt-1">আপনার বিজনেসের রিয়েল-টাইম পারফরমেন্স</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {rangeOptions.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${
                  range === r.key
                    ? 'bg-white text-primary shadow-md'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {r.label}
              </button>
            ))}
            {range === 'custom' && (
              <div className="flex items-center gap-1.5 ml-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[11px] px-2.5 py-1.5 rounded-full font-medium bg-white/15 text-white hover:bg-white/25 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {customFrom ? format(customFrom, 'dd/MM/yy') : 'শুরু'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-white/70 text-[11px]">—</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-[11px] px-2.5 py-1.5 rounded-full font-medium bg-white/15 text-white hover:bg-white/25 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {customTo ? format(customTo, 'dd/MM/yy') : 'শেষ'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          className="border-0 shadow-md bg-gradient-to-br from-primary/15 via-primary/5 to-transparent cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          onClick={() => navigate('/admin/orders')}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-primary/20 backdrop-blur">
                <ShoppingCart className="w-4 h-4 text-primary" />
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {stats.pending + stats.confirmed} নতুন
              </Badge>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-0.5">মোট অর্ডার</p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-md bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          onClick={() => navigate('/admin/account-report')}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-green-500/20 backdrop-blur">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                <ArrowUpRight className="w-3 h-3" /> {stats.deliveryRate}%
              </span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground truncate">{formatBDT(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ডেলিভারড রেভিনিউ</p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-md bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          onClick={() => navigate('/admin/orders')}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 backdrop-blur">
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-0.5 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                <ArrowDownRight className="w-3 h-3" /> {stats.cancelRate}%
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.cancelReturnCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ক্যান্সেল + রিটার্ন + পেইড রিটার্ন</p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-md bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden"
          onClick={() => navigate('/admin/customers')}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 backdrop-blur">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <UserCheck className="w-3.5 h-3.5 text-blue-500/60" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.uniqueCustomers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ইউনিক কাস্টমার</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart + Net Profit summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> রেভিনিউ ট্রেন্ড
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">
                {rangeOptions.find(r => r.key === range)?.label}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-2">
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <AreaChart data={trendData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis className="text-[10px]" tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={45} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Financial summary — সঠিক হিসাব প্রফিট খাতায় */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-transparent">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> ফাইন্যান্স ওভারভিউ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2.5">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
              <p className="text-[11px] text-muted-foreground mb-1">ডেলিভারড রেভিনিউ</p>
              <p className="text-lg font-bold text-foreground">{formatBDT(stats.totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ডেলিভারি চার্জ বাদে প্রোডাক্ট সেল</p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => navigate('/admin/expenses')}>
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-xs text-muted-foreground">মোট খরচ</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatBDT(stats.totalExpenses)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => navigate('/admin/deposits')}>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs text-muted-foreground">মোট ডিপোজিট</span>
              </div>
              <span className="text-sm font-bold text-foreground">{formatBDT(stats.totalDeposits)}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8 mt-1"
              onClick={() => navigate('/admin/account-report')}
            >
              বিস্তারিত নেট লাভ/লস দেখুন <Eye className="w-3 h-3 ml-1" />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              নেট লাভ, কুরিয়ার পেমেন্ট ও সম্পূর্ণ হিসাবের জন্য প্রফিট খাতা দেখুন
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Order Status Breakdown */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> অর্ডার স্ট্যাটাস ব্রেকডাউন
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate('/admin/orders')}>
              সব দেখুন <Eye className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {stats.totalOrders > 0 && (
            <div className="w-full h-3 rounded-full overflow-hidden flex mb-4 bg-muted shadow-inner">
              {orderStatusBreakdown.map((item) => (
                <div
                  key={item.label}
                  className={`${item.color} h-full transition-all hover:opacity-80`}
                  style={{ width: `${(item.count / stats.totalOrders) * 100}%` }}
                  title={`${item.label}: ${item.count}`}
                />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {orderStatusBreakdown.map((item) => {
              const Icon = statusIcons[item.label] || Clock;
              const pct = stats.totalOrders > 0 ? ((item.count / stats.totalOrders) * 100).toFixed(0) : '0';
              return (
                <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/40">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0 ring-2 ring-background`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-bold text-foreground">{item.count}</p>
                      <span className="text-[9px] text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Inventory + Catalog stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/products')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/15"><Boxes className="w-4 h-4 text-violet-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">প্রোডাক্ট</p>
              <p className="text-base font-bold text-foreground">{products.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/categories')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/15"><Layers className="w-4 h-4 text-cyan-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">ক্যাটাগরি</p>
              <p className="text-base font-bold text-foreground">{categories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/blog')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/15"><FileText className="w-4 h-4 text-indigo-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">ব্লগ পোস্ট</p>
              <p className="text-base font-bold text-foreground">{posts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/all-resellers')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/15"><Users className="w-4 h-4 text-pink-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">রিসেলার</p>
              <p className="text-base font-bold text-foreground">{resellers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/stock')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/15"><Package className="w-4 h-4 text-emerald-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">স্টক ভ্যালু</p>
              <p className="text-sm font-bold text-foreground truncate">{formatBDT(stats.totalStockValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/stock')}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15"><ShoppingBag className="w-4 h-4 text-amber-600" /></div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">স্টক বিক্রয়</p>
              <p className="text-sm font-bold text-foreground truncate">{formatBDT(stats.totalStockSellValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Attention Required */}
      {(stats.pending > 0 || incompleteOrders.length > 0 || stats.hold > 0 || stats.followup > 0) && (
        <Card className="border-0 shadow-md border-l-4 border-l-yellow-500 overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-yellow-500/10 to-transparent">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="w-4 h-4" /> মনোযোগ দরকার
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stats.pending > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  onClick={() => navigate('/admin/orders')}>
                  <Clock className="w-4 h-4 text-yellow-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400">{stats.pending}</p>
                    <p className="text-[10px] text-yellow-600">পেন্ডিং অর্ডার</p>
                  </div>
                </div>
              )}
              {stats.followup > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                  onClick={() => navigate('/admin/orders')}>
                  <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-teal-800 dark:text-teal-400">{stats.followup}</p>
                    <p className="text-[10px] text-teal-600">ফলোয়াপ</p>
                  </div>
                </div>
              )}
              {stats.hold > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
                  onClick={() => navigate('/admin/orders')}>
                  <AlertTriangle className="w-4 h-4 text-gray-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-400">{stats.hold}</p>
                    <p className="text-[10px] text-gray-600">হোল্ড</p>
                  </div>
                </div>
              )}
              {incompleteOrders.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                  onClick={() => navigate('/admin/incomplete-orders')}>
                  <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-400">{incompleteOrders.length}</p>
                    <p className="text-[10px] text-orange-600">অসম্পূর্ণ</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
