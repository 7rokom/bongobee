import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Pencil, Trash2, CalendarIcon, TrendingUp, Wallet, Layers, Truck, Package } from 'lucide-react';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import PaymentDetailTables from '@/components/admin/PaymentDetailTables';
import { useDepositStore, depositSources, Deposit, RESELLING_PROFIT_SOURCE } from '@/stores/useDepositStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { useOrderStore } from '@/stores/useOrderStore';
import { useStockStore } from '@/stores/useStockStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import { format, isToday, isYesterday, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

const COD_CHARGE_PERCENT = 1;
const calcCodCharge = (amount: number) => Math.ceil((amount * COD_CHARGE_PERCENT) / 100);
const VENDOR_PACKAGING_CHARGE = 10;

const Deposits = () => {
  const { deposits, addDeposit, updateDeposit, deleteDeposit } = useDepositStore();
  const { orders } = useOrderStore();
  const { stockEntries } = useStockStore();
  const { orders: resellerOrders } = useResellerStore();
  const allProducts = useProductStore((s) => s.products);
  const stockTypes = useFollowUpStore((s) => s.stockTypes);
  const vendorBuyPrices = useFollowUpStore((s) => s.vendorBuyPrices);
  useLazyFetch([
    useDepositStore.getState().fetchDeposits,
    useExpenseStore.getState().fetchExpenses,
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deposit | null>(null);
  const [form, setForm] = useState({ title: '', source: depositSources[0], amount: '', note: '', date: new Date() });
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [filterSource, setFilterSource] = useState('all');

  const inDateRange = (dateStr: string) => {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return false;
    const now = new Date();
    switch (dateFilter) {
      case 'today': return isToday(dt);
      case 'yesterday': return isYesterday(dt);
      case '7days': return dt >= subDays(now, 7);
      case 'month': return dt >= startOfMonth(now) && dt <= endOfMonth(now);
      case 'lastMonth': { const lm = subMonths(now, 1); return dt >= startOfMonth(lm) && dt <= endOfMonth(lm); }
      case 'year': return dt >= startOfYear(now);
      case 'custom': return (!customStart || dt >= customStart) && (!customEnd || dt <= new Date(customEnd.getTime() + 86400000));
      default: return true;
    }
  };

  const filtered = useMemo(() => {
    let list = [...deposits];
    if (filterSource !== 'all') list = list.filter((d) => d.source === filterSource);
    list = list.filter((d) => inDateRange(d.date));
    return list;
  }, [deposits, dateFilter, filterSource, customStart, customEnd]);

  const depositsTotal = filtered.filter(d => d.source !== RESELLING_PROFIT_SOURCE).reduce((s, d) => s + d.amount, 0);

  const mainInvestTotal = useMemo(() => {
    return deposits
      .filter(d => (d.source === 'মূল ইনভেস্ট' || d.source === 'সার্কেল ইনভেস্ট') && inDateRange(d.date))
      .reduce((s, d) => s + d.amount, 0);
  }, [deposits, dateFilter, customStart, customEnd]);

  const totalSectors = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(d => set.add(d.source));
    return set.size;
  }, [filtered]);

  const buyPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    stockEntries.forEach(e => {
      if (!map[e.productName]) map[e.productName] = e.buyPrice;
    });
    return map;
  }, [stockEntries]);

  const getMainOrderStockType = (orderId: string) => stockTypes[orderId] || 'self';
  const getResellerOrderStockType = (orderId: string, items?: any[]) => {
    const explicit = stockTypes[`reseller-${orderId}`] || stockTypes[orderId];
    if (explicit) return explicit;
    if (items && items.length > 0) {
      const firstItem = items[0];
      const prod = allProducts.find((p: any) => p.id === firstItem.productId || p.title === firstItem.productTitle);
      if (prod?.stockType) return prod.stockType;
    }
    return 'self';
  };

  const getMainItemBuyPrice = (item: { name: string; qty: number; stockProductName?: string }) => {
    const matchedProduct = allProducts.find(
      (product) => product.title === item.name || (!!item.stockProductName && product.stockProductName === item.stockProductName)
    );
    const stockName = item.stockProductName || matchedProduct?.stockProductName || item.name;
    return matchedProduct?.buyPrice ?? buyPriceMap[stockName] ?? 0;
  };

  // Split courier payment (self stock) vs vendor payment (vendor stock)
  const { courierPayment, vendorPayment } = useMemo(() => {
    let selfProfit = 0;
    let vendorProfit = 0;

    // Main orders
    const deliveredOrders = orders.filter(o => o.status === 'ডেলিভারড' && inDateRange(o.isoDate || o.date));
    deliveredOrders.forEach(o => {
      const sellPrice = o.total;
      const deliveryCharge = o.deliveryCharge || 0;
      const codCharge = calcCodCharge(sellPrice);
      const orderStockType = getMainOrderStockType(o.id);

      if (orderStockType === 'vendor') {
        // Vendor: sellPrice - COD - buyPrice - deliveryCharge - packagingCharge
        const packagingCharge = VENDOR_PACKAGING_CHARGE;
        const customBuyPrice = vendorBuyPrices[o.id];
        let productCost: number;
        if (customBuyPrice !== undefined) {
          productCost = customBuyPrice;
        } else {
          productCost = 0;
          o.items.forEach(item => {
            productCost += getMainItemBuyPrice(item as any) * item.qty;
          });
        }
        vendorProfit += sellPrice - codCharge - productCost - deliveryCharge - packagingCharge;
      } else {
        // Self stock: sellPrice - COD - deliveryCharge
        selfProfit += sellPrice - deliveryCharge - codCharge;
      }
    });

    // Vendor-stock returns & paid-returns adjust vendor payment
    const vendorReturnedMain = orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      inDateRange(o.isoDate || o.date) &&
      getMainOrderStockType(o.id) === 'vendor'
    );
    vendorReturnedMain.forEach(o => {
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = VENDOR_PACKAGING_CHARGE;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        vendorProfit += paidAmount - deliveryCharge - packagingCharge;
      } else {
        vendorProfit -= deliveryCharge + packagingCharge;
      }
    });

    // Self-stock returns & paid-returns adjust courier payment (selfProfit).
    const selfReturnedMain = orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      inDateRange(o.isoDate || o.date) &&
      getMainOrderStockType(o.id) !== 'vendor'
    );
    selfReturnedMain.forEach(o => {
      const deliveryCharge = o.deliveryCharge || 0;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        selfProfit += paidAmount - deliveryCharge;
      } else {
        selfProfit -= deliveryCharge;
      }
    });

    // Reseller orders
    const deliveredResellerOrders = resellerOrders.filter(o => o.status === 'ডেলিভারড' && inDateRange(o.date));
    deliveredResellerOrders.forEach(o => {
      const sellingPrice = o.totalSellingPrice || 0;
      const codCharge = calcCodCharge(sellingPrice);
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = o.packagingCharge || 0;
      const orderStockType = getResellerOrderStockType(o.id, o.items);

      if (orderStockType === 'vendor') {
        // Vendor: sellPrice - COD - buyPrice - deliveryCharge - packagingCharge
        const key = `reseller-${o.id}`;
        const customBuyPrice = vendorBuyPrices[key];
        let productCost: number;
        if (customBuyPrice !== undefined) {
          productCost = customBuyPrice;
        } else {
          productCost = 0;
          o.items.forEach(item => {
            const matchedProduct = allProducts.find((p: any) => p.id === item.productId || p.title === item.productTitle);
            const stockName = matchedProduct?.stockProductName || item.productTitle;
            const bPrice = matchedProduct?.buyPrice ?? buyPriceMap[stockName] ?? 0;
            productCost += bPrice * item.qty;
          });
        }
        vendorProfit += sellingPrice - codCharge - productCost - deliveryCharge - packagingCharge;
      } else {
        // Self stock: sellPrice - COD - deliveryCharge
        selfProfit += sellingPrice - codCharge - deliveryCharge;
      }
    });

    // NOTE: Reseller order returns/paid-returns are borne entirely by the
    // reseller (deducted from their balance). They do NOT adjust courier or
    // vendor payment here.

    return { courierPayment: selfProfit, vendorPayment: vendorProfit };
  }, [orders, resellerOrders, buyPriceMap, stockTypes, vendorBuyPrices, dateFilter, customStart, customEnd, allProducts]);

  const totalAmount = depositsTotal + courierPayment + vendorPayment;

  const sourceTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((d) => { map[d.source] = (map[d.source] || 0) + d.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', source: depositSources[0], amount: '', note: '', date: new Date() });
    setDialogOpen(true);
  };

  const openEdit = (d: Deposit) => {
    setEditing(d);
    setForm({ title: d.title, source: d.source, amount: String(d.amount), note: d.note, date: new Date(d.date) });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.amount) return;
    if (editing) {
      updateDeposit(editing.id, { title: form.title, source: form.source, amount: Number(form.amount), note: form.note, date: form.date.toISOString() });
    } else {
      addDeposit({ id: 'd' + Date.now(), title: form.title, source: form.source, amount: Number(form.amount), note: form.note, date: form.date.toISOString() });
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">জমা / বিনিয়োগ</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={deposits}
            filename="deposits"
            label="জমা"
            onImport={(items: Deposit[]) => {
              items.forEach(d => {
                if (!deposits.find(dd => dd.id === d.id)) addDeposit(d);
              });
            }}
          />
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> জমা যোগ করুন</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm bg-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">মোট জমা</p>
            </div>
            <p className="text-xl font-bold text-primary">৳{totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-muted-foreground">মূল ইনভেস্ট</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">৳{mainInvestTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">মোট খাত</p>
            </div>
            <p className="text-xl font-bold text-foreground">{totalSectors}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-muted-foreground">কুরিয়ার পেমেন্ট</p>
            </div>
            <p className="text-xl font-bold text-blue-600">৳{courierPayment.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-muted-foreground">ভেন্ডর পেমেন্ট</p>
            </div>
            <p className="text-xl font-bold text-amber-600">৳{vendorPayment.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date & Source Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <ToggleGroup type="single" value={dateFilter} onValueChange={(v) => v && setDateFilter(v)} className="flex-wrap">
          {[['all','সব'],['today','আজ'],['yesterday','গতকাল'],['7days','৭ দিন'],['month','এই মাস'],['lastMonth','গত মাস'],['year','এই বছর'],['custom','কাস্টম']].map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} size="sm" className="text-xs px-3 h-8">{l}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব উৎস</SelectItem>
            {depositSources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {/* Source Totals */}
      {sourceTotals.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">উৎস অনুযায়ী জমা</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {sourceTotals.map(([src, amt]) => (
                <div key={src} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground">{src}</span>
                  </div>
                  <span className="font-semibold text-foreground">৳{amt.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Detail Tables */}
      <PaymentDetailTables
        orders={orders}
        resellerOrders={resellerOrders}
        buyPriceMap={buyPriceMap}
        stockTypes={stockTypes}
        vendorBuyPrices={vendorBuyPrices}
        allProducts={allProducts}
        inDateRange={inDateRange}
        getMainOrderStockType={getMainOrderStockType}
        getResellerOrderStockType={getResellerOrderStockType}
        getMainItemBuyPrice={getMainItemBuyPrice}
      />

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">তারিখ</TableHead>
                <TableHead className="text-xs">শিরোনাম</TableHead>
                <TableHead className="text-xs">উৎস</TableHead>
                <TableHead className="text-xs text-right">টাকা</TableHead>
                <TableHead className="text-xs">নোট</TableHead>
                <TableHead className="text-xs text-center">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">কোনো জমা পাওয়া যায়নি</TableCell></TableRow>
              ) : filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(d.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs font-medium">{d.title}</TableCell>
                  <TableCell className="text-xs">{d.source}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">৳{d.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{d.note || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDeposit(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'জমা এডিট করুন' : 'নতুন জমা যোগ করুন'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="শিরোনাম" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="উৎস নির্বাচন" /></SelectTrigger>
              <SelectContent>{depositSources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="টাকার পরিমাণ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="w-4 h-4 mr-2" />{format(form.date, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.date} onSelect={(d) => d && setForm({ ...form, date: d })} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Textarea placeholder="নোট (ঐচ্ছিক)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave}>{editing ? 'আপডেট' : 'সেভ করুন'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Deposits;