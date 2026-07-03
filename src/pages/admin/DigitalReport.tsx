import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, TrendingDown, Wallet, ShoppingBag, Megaphone } from 'lucide-react';
import { useDigitalOrderStore } from '@/stores/useDigitalOrderStore';
import { useExpenseStore, DIGITAL_AD_EXPENSE_CATEGORY } from '@/stores/useExpenseStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { format, isToday, isYesterday, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const DigitalReport = () => {
  const { orders } = useDigitalOrderStore();
  const { expenses } = useExpenseStore();
  useLazyFetch([
    useDigitalOrderStore.getState().fetchAll,
    useExpenseStore.getState().fetchExpenses,
  ]);

  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();

  const inRange = (dateStr: string) => {
    if (!dateStr) return dateFilter === 'all';
    const d = new Date(dateStr);
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

  const stats = useMemo(() => {
    const confirmed = orders.filter(o => o.status === 'কনফার্মড' && inRange(o.createdAt));
    const pending = orders.filter(o => o.status === 'পেন্ডিং' && inRange(o.createdAt));
    const cancelled = orders.filter(o => o.status === 'বাতিল' && inRange(o.createdAt));
    const totalSales = confirmed.reduce((s, o) => s + (o.price || 0), 0);
    const adsExpenses = expenses.filter(e => e.category === DIGITAL_AD_EXPENSE_CATEGORY && inRange(e.date));
    const totalAds = adsExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalSales - totalAds;

    // Product-wise breakdown
    const productMap: Record<string, { title: string; qty: number; sales: number }> = {};
    confirmed.forEach(o => {
      if (o.items && o.items.length) {
        o.items.forEach(it => {
          const key = it.title || 'অজানা';
          if (!productMap[key]) productMap[key] = { title: key, qty: 0, sales: 0 };
          productMap[key].qty += it.qty || 1;
          productMap[key].sales += (it.price || 0) * (it.qty || 1);
        });
      } else {
        const key = o.productTitle || 'অজানা';
        if (!productMap[key]) productMap[key] = { title: key, qty: 0, sales: 0 };
        productMap[key].qty += 1;
        productMap[key].sales += o.price || 0;
      }
    });
    const productBreakdown = Object.values(productMap).sort((a, b) => b.sales - a.sales);

    return {
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      totalSales,
      totalAds,
      netProfit,
      adsExpenses,
      productBreakdown,
    };
  }, [orders, expenses, dateFilter, customStart, customEnd]);

  const fmt = (n: number) => `৳${n.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">ডিজিটাল প্রডাক্ট রিপোর্ট</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <ToggleGroup type="single" value={dateFilter} onValueChange={(v) => v && setDateFilter(v)} className="flex-wrap">
          {[['all','সব'],['today','আজ'],['yesterday','গতকাল'],['7days','৭ দিন'],['month','এই মাস'],['lastMonth','গত মাস'],['year','এই বছর'],['custom','কাস্টম']].map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} size="sm" className="text-xs px-3 h-8">{l}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {dateFilter === 'custom' && (
        <div className="flex gap-2 items-center flex-wrap">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm" className="text-xs h-8"><CalendarIcon className="w-3.5 h-3.5 mr-1" />{customStart ? format(customStart, 'dd/MM/yyyy') : 'শুরু'}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} /></PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">থেকে</span>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm" className="text-xs h-8"><CalendarIcon className="w-3.5 h-3.5 mr-1" />{customEnd ? format(customEnd, 'dd/MM/yyyy') : 'শেষ'}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} /></PopoverContent>
          </Popover>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-500/10 to-emerald-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-green-500/20"><Wallet className="w-4 h-4 text-green-600" /></div>
              <p className="text-xs text-muted-foreground">মোট সেল</p>
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(stats.totalSales)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stats.confirmedCount}টি কনফার্ম অর্ডার</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-500/10 to-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-red-500/20"><Megaphone className="w-4 h-4 text-red-600" /></div>
              <p className="text-xs text-muted-foreground">অ্যাড খরচ</p>
            </div>
            <p className="text-xl font-bold text-red-600">{fmt(stats.totalAds)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stats.adsExpenses.length}টি এন্ট্রি</p>
          </CardContent>
        </Card>
        <Card className={cn(
          'border-0 shadow-sm bg-gradient-to-br',
          stats.netProfit >= 0 ? 'from-blue-500/10 to-indigo-500/10' : 'from-rose-500/10 to-red-500/10'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn('p-1.5 rounded-lg', stats.netProfit >= 0 ? 'bg-blue-500/20' : 'bg-rose-500/20')}>
                {stats.netProfit >= 0 ? <TrendingUp className="w-4 h-4 text-blue-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
              </div>
              <p className="text-xs text-muted-foreground">{stats.netProfit >= 0 ? 'নেট লাভ' : 'নেট লস'}</p>
            </div>
            <p className={cn('text-xl font-bold', stats.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600')}>{fmt(Math.abs(stats.netProfit))}</p>
            <p className="text-[10px] text-muted-foreground mt-1">সেল − অ্যাড</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-amber-500/20"><ShoppingBag className="w-4 h-4 text-amber-600" /></div>
              <p className="text-xs text-muted-foreground">অর্ডার স্ট্যাটাস</p>
            </div>
            <p className="text-xs text-foreground">কনফার্ম: <span className="font-bold text-green-600">{stats.confirmedCount}</span></p>
            <p className="text-xs text-foreground">পেন্ডিং: <span className="font-bold text-yellow-600">{stats.pendingCount}</span></p>
            <p className="text-xs text-foreground">বাতিল: <span className="font-bold text-red-600">{stats.cancelledCount}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Product-wise breakdown */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">প্রডাক্ট অনুযায়ী সেল</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">প্রডাক্ট</TableHead>
                  <TableHead className="text-xs text-center">কপি</TableHead>
                  <TableHead className="text-xs text-right">সেল</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.productBreakdown.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">কোনো ডেটা নেই</TableCell></TableRow>
                ) : stats.productBreakdown.map((p) => (
                  <TableRow key={p.title}>
                    <TableCell className="text-xs font-medium">{p.title}</TableCell>
                    <TableCell className="text-xs text-center">{p.qty}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{fmt(p.sales)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ads expense list */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">ডিজিটাল প্রডাক্ট অ্যাড খরচ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">তারিখ</TableHead>
                  <TableHead className="text-xs">শিরোনাম</TableHead>
                  <TableHead className="text-xs text-right">টাকা</TableHead>
                  <TableHead className="text-xs">নোট</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.adsExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">এই খাতে কোনো খরচ নেই</TableCell></TableRow>
                ) : stats.adsExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs font-medium">{e.title}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-red-600">{fmt(e.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.note || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DigitalReport;
