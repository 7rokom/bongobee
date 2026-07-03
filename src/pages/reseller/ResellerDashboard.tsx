import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useResellerStore } from '@/stores/useResellerStore';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Package, TrendingUp, Clock, Wallet, XCircle, RotateCcw,
  CalendarIcon, ArrowUpRight, ArrowDownRight, Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfYear, subYears, isWithinInterval } from 'date-fns';
import { computeResellerBalance, RESELLER_RETURN_STATUSES } from '@/lib/reseller-balance';

type DateFilter = 'today' | 'yesterday' | '7days' | 'month' | 'year' | 'lastYear' | 'custom';

const dateFilters: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'আজকে' },
  { key: 'yesterday', label: 'গতকাল' },
  { key: '7days', label: '৭ দিন' },
  { key: 'month', label: 'এই মাসে' },
  { key: 'year', label: 'এই বছর' },
  { key: 'lastYear', label: 'আগের বছর' },
  { key: 'custom', label: 'কাস্টম' },
];

const getResellerId = () => {
  const auth = localStorage.getItem('reseller-auth');
  return auth ? JSON.parse(auth).id : '';
};

const getDateRange = (filter: DateFilter, customFrom?: Date, customTo?: Date) => {
  const now = new Date();
  switch (filter) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case '7days': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'year': return { from: startOfYear(now), to: endOfDay(now) };
    case 'lastYear': {
      const ly = subYears(now, 1);
      return { from: startOfYear(ly), to: endOfDay(new Date(ly.getFullYear(), 11, 31)) };
    }
    case 'custom':
      return { from: customFrom || startOfDay(now), to: customTo ? endOfDay(customTo) : endOfDay(now) };
  }
};

const ResellerDashboard = () => {
  const resellerId = getResellerId();
  const store = useResellerStore();
  const allOrders = store.orders.filter((o) => o.resellerId === resellerId);
  const allPayments = store.paymentRequests.filter((p) => p.resellerId === resellerId);

  const [activeFilter, setActiveFilter] = useState<DateFilter>('month');
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();

  const filteredOrders = useMemo(() => {
    const range = getDateRange(activeFilter, customFrom, customTo);
    return allOrders.filter((o) => {
      const d = new Date(o.date);
      if (isNaN(d.getTime())) return true; // include orders with unparseable dates
      return isWithinInterval(d, { start: range.from, end: range.to });
    });
  }, [allOrders, activeFilter, customFrom, customTo]);

  const totalOrders = filteredOrders.length;
  const totalOrderAmount = filteredOrders.reduce((s, o) => s + o.totalSellingPrice, 0);
  const pendingOrders = filteredOrders.filter((o) => o.status === 'পেন্ডিং');
  const pendingAmount = pendingOrders.reduce((s, o) => s + o.totalSellingPrice, 0);
  const deliveredOrders = filteredOrders.filter((o) => o.status === 'ডেলিভারড');
  const deliveredProfit = deliveredOrders.reduce((s, o) => s + o.totalProfit, 0);
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'ক্যান্সেল');
  const cancelledAmount = cancelledOrders.reduce((s, o) => s + o.totalSellingPrice, 0);
  const returnOrders = filteredOrders.filter((o) => RESELLER_RETURN_STATUSES.includes(o.status));
  const returnAmount = returnOrders.reduce((s, o) => s + o.totalSellingPrice, 0);

  const totalWithdrawn = allPayments
    .filter((p) => p.status === 'অনুমোদিত')
    .reduce((s, p) => s + p.amount, 0);

  const { withdrawable } = computeResellerBalance(allOrders, allPayments);

  // Chart data - last 7 days profit
  const chartData = useMemo(() => {
    const days: { date: string; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, 'dd/MM');
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayProfit = allOrders
        .filter((o) => o.status === 'ডেলিভারড' && isWithinInterval(new Date(o.date), { start: dayStart, end: dayEnd }))
        .reduce((s, o) => s + o.totalProfit, 0);
      days.push({ date: dayStr, profit: dayProfit });
    }
    return days;
  }, [allOrders]);

  const chartConfig = {
    profit: { label: 'লাভ', color: 'hsl(var(--primary))' },
  };

  const stats = [
    {
      title: 'মোট অর্ডার', value: totalOrders, sub: `৳${totalOrderAmount.toLocaleString('bn-BD')}`,
      icon: Package, gradient: 'from-blue-500/10 to-blue-600/5', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-600',
    },
    {
      title: 'ডেলিভারড লাভ', value: `৳${deliveredProfit.toLocaleString('bn-BD')}`, sub: `${deliveredOrders.length} অর্ডার`,
      icon: TrendingUp, gradient: 'from-emerald-500/10 to-emerald-600/5', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-600',
    },
    {
      title: 'পেন্ডিং অর্ডার', value: pendingOrders.length, sub: `৳${pendingAmount.toLocaleString('bn-BD')}`,
      icon: Clock, gradient: 'from-amber-500/10 to-amber-600/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-600',
    },
    {
      title: 'উত্তোলনযোগ্য', value: `৳${withdrawable.toLocaleString('bn-BD')}`, sub: 'ডেলিভারড থেকে',
      icon: Wallet, gradient: 'from-violet-500/10 to-violet-600/5', iconBg: 'bg-violet-500/15', iconColor: 'text-violet-600',
    },
    {
      title: 'ক্যান্সেল অর্ডার', value: cancelledOrders.length, sub: `৳${cancelledAmount.toLocaleString('bn-BD')}`,
      icon: XCircle, gradient: 'from-rose-500/10 to-rose-600/5', iconBg: 'bg-rose-500/15', iconColor: 'text-rose-600',
    },
    {
      title: 'রিটার্ন অর্ডার', value: returnOrders.length, sub: `৳${returnAmount.toLocaleString('bn-BD')}`,
      icon: RotateCcw, gradient: 'from-orange-500/10 to-orange-600/5', iconBg: 'bg-orange-500/15', iconColor: 'text-orange-600',
    },
    {
      title: 'মোট উত্তোলিত', value: `৳${totalWithdrawn.toLocaleString('bn-BD')}`, sub: 'সর্বমোট',
      icon: Banknote, gradient: 'from-teal-500/10 to-teal-600/5', iconBg: 'bg-teal-500/15', iconColor: 'text-teal-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">ড্যাশবোর্ড</h1>
          <p className="text-sm text-muted-foreground mt-0.5">আপনার ব্যবসার সারসংক্ষেপ</p>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {dateFilters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={activeFilter === f.key ? 'default' : 'outline'}
            className={cn(
              'text-xs h-8 rounded-full transition-all',
              activeFilter === f.key && 'shadow-md'
            )}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        {activeFilter === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'শুরু'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {customTo ? format(customTo, 'dd/MM/yyyy') : 'শেষ'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.title} className={`border-0 shadow-sm bg-gradient-to-br ${s.gradient} overflow-hidden relative group hover:shadow-md transition-shadow`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.title}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                </div>
                <div className={cn('p-2 rounded-xl', s.iconBg)}>
                  <s.icon className={cn('h-4 w-4', s.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profit Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">লাভের গ্রাফ (গত ৭ দিন)</CardTitle>
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <ArrowUpRight className="h-3 w-3" />
              <span>ডেলিভারড</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-[10px]" tickLine={false} axisLine={false} />
              <YAxis className="text-[10px]" tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" fill="url(#profitGrad)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">সাম্প্রতিক অর্ডার</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredOrders.length} টি অর্ডার</span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-10">
              <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">এই সময়সীমায় কোনো অর্ডার নেই</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.slice(0, 10).map((o) => {
                const statusColors: Record<string, string> = {
                  'পেন্ডিং': 'bg-amber-100 text-amber-700',
                  'প্রসেসিং': 'bg-blue-100 text-blue-700',
                  'ডেলিভারড': 'bg-emerald-100 text-emerald-700',
                  'ক্যান্সেল': 'bg-rose-100 text-rose-700',
                  'রিটার্ন': 'bg-orange-100 text-orange-700',
                };
                return (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{o.customerName}</p>
                      <p className="text-[11px] text-muted-foreground">{o.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusColors[o.status] || 'bg-muted text-muted-foreground')}>
                        {o.status}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">৳{o.totalSellingPrice}</p>
                        {o.status === 'ডেলিভারড' && (
                          <p className="text-[10px] text-emerald-600 font-medium">লাভ: ৳{o.totalProfit}</p>
                        )}
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
  );
};

export default ResellerDashboard;
