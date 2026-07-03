import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Pencil, Trash2, CalendarIcon, Package, TrendingUp, Archive, AlertTriangle, Truck } from 'lucide-react';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { useStockStore, StockEntry } from '@/stores/useStockStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useProductStore } from '@/stores/useProductStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import {
  buildStockProductMap,
  DELIVERED_STATUS,
  isInShipmentStockStatus,
  isSelfFulfilledOrder,
  resolveStockName,
  RETURN_STATUSES,
} from '@/lib/stock-calculation';
import { format } from 'date-fns';
import { toast } from 'sonner';

const StockManagement = () => {
  const { stockEntries, addStockEntry, updateStockEntry, deleteStockEntry } = useStockStore();
  const orders = useOrderStore((s) => s.orders);
  const resellerOrders = useResellerStore((s) => s.orders);
  const stockTypes = useFollowUpStore((s) => s.stockTypes);
  const courierNames = useFollowUpStore((s) => s.courierNames);
  const products = useProductStore((s) => s.products);
  const stockProductMap = useMemo(() => buildStockProductMap(products), [products]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockEntry | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    productName: '', quantity: '', buyPrice: '', sellPrice: '', supplier: '', note: '', date: new Date()
  });

  // Stock calculation from orders: only self-stock orders that are delivered or actually sent to courier reduce stock.
  const stockCalc = useMemo(() => {
    const result: Record<string, {
      delivered: number;
      inShipment: number;
      returned: number;
      selfDeliveredRevenue: number;
      selfDeliveredQty: number;
      resellerDeliveredRevenue: number;
      resellerDeliveredQty: number;
    }> = {};

    const init = (name: string) => {
      if (!result[name]) result[name] = { delivered: 0, inShipment: 0, returned: 0, selfDeliveredRevenue: 0, selfDeliveredQty: 0, resellerDeliveredRevenue: 0, resellerDeliveredQty: 0 };
    };

    orders.forEach(o => {
      const status = o.status;
      if (!isSelfFulfilledOrder(o.id, stockTypes, courierNames, o.source)) return;
      (o.items as any[]).forEach((item: any) => {
        const stockName = resolveStockName(item, stockProductMap);
        if (!stockName) return;
        init(stockName);
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
        if (status === DELIVERED_STATUS) {
          result[stockName].delivered += qty;
          result[stockName].selfDeliveredRevenue += (item.price || 0) * qty;
          result[stockName].selfDeliveredQty += qty;
        }
        if (isInShipmentStockStatus(status, o.id, courierNames)) result[stockName].inShipment += qty;
        if (RETURN_STATUSES.includes(status)) result[stockName].returned += qty;
      });
    });

    resellerOrders.forEach(o => {
      const status = o.status;
      // Reseller orders use prefixed key in followUp store
      const orderKey = `reseller-${o.id}`;
      if (!isSelfFulfilledOrder(orderKey, stockTypes, courierNames, o.source)) return;
      (o.items as any[]).forEach((item: any) => {
        const stockName = resolveStockName(item, stockProductMap);
        if (!stockName) return;
        init(stockName);
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
        if (status === DELIVERED_STATUS) {
          result[stockName].delivered += qty;
          result[stockName].resellerDeliveredRevenue += (item.resellerPrice || item.sellingPrice || 0) * qty;
          result[stockName].resellerDeliveredQty += qty;
        }
        if (isInShipmentStockStatus(status, orderKey, courierNames)) result[stockName].inShipment += qty;
        if (RETURN_STATUSES.includes(status)) result[stockName].returned += qty;
      });
    });

    return result;
  }, [orders, resellerOrders, stockProductMap, stockTypes, courierNames]);

  const stockSummary = useMemo(() => {
    const productMap: Record<string, { totalBought: number; totalBuyValue: number; entries: StockEntry[]; totalDamage: number }> = {};
    stockEntries.forEach(entry => {
      if (!productMap[entry.productName]) {
        productMap[entry.productName] = { totalBought: 0, totalBuyValue: 0, entries: [], totalDamage: 0 };
      }
      productMap[entry.productName].totalBought += entry.quantity;
      productMap[entry.productName].totalBuyValue += entry.quantity * entry.buyPrice;
      productMap[entry.productName].totalDamage += (entry.damage || 0);
      productMap[entry.productName].entries.push(entry);
    });

    return Object.entries(productMap).map(([name, data]) => {
      const calc = stockCalc[name] || { delivered: 0, inShipment: 0, returned: 0, selfDeliveredRevenue: 0, selfDeliveredQty: 0, resellerDeliveredRevenue: 0, resellerDeliveredQty: 0 };
      
      // Stock = কেনা - ডেলিভারড - শিপমেন্টে - ড্যামেজ
      const inStock = Math.max(0, data.totalBought - calc.delivered - calc.inShipment - data.totalDamage);
      const avgBuyPrice = data.totalBuyValue / data.totalBought;

      const totalDeliveredQty = calc.selfDeliveredQty + calc.resellerDeliveredQty;
      const totalDeliveredRevenue = calc.selfDeliveredRevenue + calc.resellerDeliveredRevenue;
      const avgSellPrice = totalDeliveredQty > 0 ? totalDeliveredRevenue / totalDeliveredQty : 0;

      // লাভ/পিস: self (sell - buy) + reseller (reseller price - buy) / total delivered
      const selfProfit = calc.selfDeliveredQty > 0 ? calc.selfDeliveredRevenue - (calc.selfDeliveredQty * avgBuyPrice) : 0;
      const resellerProfit = calc.resellerDeliveredQty > 0 ? calc.resellerDeliveredRevenue - (calc.resellerDeliveredQty * avgBuyPrice) : 0;
      const profitPerUnit = totalDeliveredQty > 0 ? (selfProfit + resellerProfit) / totalDeliveredQty : 0;

      return {
        name,
        totalBought: data.totalBought,
        delivered: calc.delivered,
        inShipment: calc.inShipment,
        returned: calc.returned,
        damage: data.totalDamage,
        inStock,
        avgBuyPrice,
        avgSellPrice,
        profitPerUnit,
        stockValue: inStock * avgBuyPrice,
        shipmentValue: calc.inShipment * avgBuyPrice,
      };
    });
  }, [stockEntries, stockCalc]);

  const totals = useMemo(() => ({
    totalBought: stockSummary.reduce((s, p) => s + p.totalBought, 0),
    totalDelivered: stockSummary.reduce((s, p) => s + p.delivered, 0),
    totalInShipment: stockSummary.reduce((s, p) => s + p.inShipment, 0),
    totalInStock: stockSummary.reduce((s, p) => s + p.inStock, 0),
    totalDamage: stockSummary.reduce((s, p) => s + p.damage, 0),
    totalBuyValue: stockSummary.reduce((s, p) => s + p.totalBought * p.avgBuyPrice, 0),
    totalStockValue: stockSummary.reduce((s, p) => s + p.stockValue, 0),
    totalShipmentValue: stockSummary.reduce((s, p) => s + p.shipmentValue, 0),
    totalDeliveredValue: stockSummary.reduce((s, p) => s + p.delivered * p.avgBuyPrice, 0),
    totalDamageLoss: stockSummary.reduce((s, p) => s + p.damage * p.avgBuyPrice, 0),
  }), [stockSummary]);

  const filteredEntries = useMemo(() => {
    if (!search) return stockEntries;
    const q = search.toLowerCase();
    return stockEntries.filter(e => e.productName.toLowerCase().includes(q) || e.supplier.toLowerCase().includes(q));
  }, [stockEntries, search]);

  // Unique product names for autocomplete
  const existingProductNames = useMemo(() => {
    return [...new Set(stockEntries.map(e => e.productName))] as string[];
  }, [stockEntries]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredSuggestions = useMemo(() => {
    if (!form.productName) return existingProductNames;
    const q = form.productName.toLowerCase();
    return existingProductNames.filter(n => n.toLowerCase().includes(q));
  }, [form.productName, existingProductNames]);

  const openAdd = () => {
    setEditing(null);
    setForm({ productName: '', quantity: '', buyPrice: '', sellPrice: '', supplier: '', note: '', date: new Date() });
    setDialogOpen(true);
  };

  const openRestock = (productName: string) => {
    const lastEntry = stockEntries.find(e => e.productName === productName);
    setEditing(null);
    setForm({
      productName,
      quantity: '',
      buyPrice: lastEntry ? String(lastEntry.buyPrice) : '',
      sellPrice: lastEntry ? String(lastEntry.sellPrice) : '',
      supplier: lastEntry ? lastEntry.supplier : '',
      note: '',
      date: new Date()
    });
    setDialogOpen(true);
  };

  const openEdit = (e: StockEntry) => {
    setEditing(e);
    setForm({
      productName: e.productName, quantity: String(e.quantity), buyPrice: String(e.buyPrice),
      sellPrice: String(e.sellPrice), supplier: e.supplier, note: e.note, date: new Date(e.date)
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.productName || !form.quantity || !form.buyPrice || !form.sellPrice) return;
    const data = {
      productName: form.productName, quantity: Number(form.quantity), buyPrice: Number(form.buyPrice),
      sellPrice: Number(form.sellPrice), supplier: form.supplier, note: form.note, date: form.date.toISOString()
    };
    if (editing) {
      updateStockEntry(editing.id, data);
    } else {
      addStockEntry({ id: 'st' + Date.now(), ...data, damage: 0 });
    }
    setDialogOpen(false);
  };

  const handleDamageChange = (productName: string, newDamage: number) => {
    // Distribute damage across entries for this product (set on first entry, rest 0)
    const entries = stockEntries.filter(e => e.productName === productName);
    if (entries.length === 0) return;
    // Set all damage to first entry for simplicity
    entries.forEach((e, i) => {
      updateStockEntry(e.id, { damage: i === 0 ? newDamage : 0 });
    });
    toast.success(`${productName} এর ড্যামেজ আপডেট হয়েছে`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">স্টক ম্যানেজ</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={stockEntries}
            filename="stock-entries"
            label="স্টক"
            onImport={(items: StockEntry[]) => {
              items.forEach(e => {
                if (!stockEntries.find(se => se.id === e.id)) addStockEntry(e);
              });
            }}
          />
          <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> প্রোডাক্ট কেনা যোগ করুন</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">মোট কেনা</p>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.totalBought}টি</p>
            <p className="text-xs text-muted-foreground">৳{Math.round(totals.totalBuyValue).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">ডেলিভারড</p>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.totalDelivered}টি</p>
            <p className="text-xs text-muted-foreground">৳{Math.round(totals.totalDeliveredValue).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Archive className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">এখন স্টকে আছে</p>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.totalInStock}টি</p>
            <p className="text-xs text-muted-foreground">৳{Math.round(totals.totalStockValue).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">শিপমেন্টে আছে</p>
            </div>
            <p className="text-lg font-bold text-foreground">{totals.totalInShipment}টি</p>
            <p className="text-xs text-muted-foreground">৳{Math.round(totals.totalShipmentValue).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="text-xs text-muted-foreground">ড্যামেজ</p>
            </div>
            <p className="text-lg font-bold text-destructive">{totals.totalDamage}টি</p>
            <p className="text-xs text-muted-foreground">লস: ৳{Math.round(totals.totalDamageLoss).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Product-wise Stock Summary */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">প্রোডাক্ট অনুযায়ী স্টক</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">প্রোডাক্ট নাম</TableHead>
                  <TableHead className="text-xs text-center">কেনা</TableHead>
                  <TableHead className="text-xs text-center">ডেলিভারড</TableHead>
                  <TableHead className="text-xs text-center">শিপমেন্টে আছে</TableHead>
                  <TableHead className="text-xs text-center">রিটার্ন হয়েছে</TableHead>
                  <TableHead className="text-xs text-center">ড্যামেজ হয়েছে</TableHead>
                  <TableHead className="text-xs text-center">এখন স্টকে</TableHead>
                  <TableHead className="text-xs text-right">কেনা দাম/পিস</TableHead>
                  <TableHead className="text-xs text-right">গড় বিক্রি/পিস</TableHead>
                  <TableHead className="text-xs text-right">লাভ/পিস</TableHead>
                  <TableHead className="text-xs text-right">স্টক ভ্যালু</TableHead>
                  <TableHead className="text-xs text-center">রিস্টক</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockSummary.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">কোনো স্টক এন্ট্রি নেই</TableCell></TableRow>
                ) : stockSummary.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="text-xs font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-center">{p.totalBought}</TableCell>
                    <TableCell className="text-xs text-center font-semibold">{p.delivered}</TableCell>
                    <TableCell className="text-xs text-center font-semibold">{p.inShipment}</TableCell>
                    <TableCell className="text-xs text-center">{p.returned}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Input
                        type="number"
                        value={p.damage || 0}
                        onChange={(e) => handleDamageChange(p.name, Math.max(0, Number(e.target.value)))}
                        className="h-7 w-16 text-xs text-center mx-auto"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-center font-bold">{p.inStock}</TableCell>
                    <TableCell className="text-xs text-right">৳{Math.round(p.avgBuyPrice).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">
                      {p.delivered > 0 ? `৳${Math.round(p.avgSellPrice).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className={`text-xs text-right font-semibold ${p.delivered > 0 ? (p.profitPerUnit >= 0 ? 'text-green-600' : 'text-destructive') : ''}`}>
                      {p.delivered > 0 ? `৳${Math.round(p.profitPerUnit).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold">৳{Math.round(p.stockValue).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openRestock(p.name)}>
                        <Plus className="w-3 h-3 mr-1" />রিস্টক
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {stockSummary.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell className="text-xs">মোট</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalBought}</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalDelivered}</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalInShipment}</TableCell>
                    <TableCell className="text-xs text-center">-</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalDamage}</TableCell>
                    <TableCell className="text-xs text-center">{totals.totalInStock}</TableCell>
                    <TableCell className="text-xs text-right">-</TableCell>
                    <TableCell className="text-xs text-right">-</TableCell>
                    <TableCell className="text-xs text-right">-</TableCell>
                    <TableCell className="text-xs text-right">৳{Math.round(totals.totalStockValue).toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Entries */}
      <div className="flex items-center gap-2">
        <Input placeholder="প্রোডাক্ট বা সাপ্লায়ার সার্চ করুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-xs" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">ক্রয় তালিকা</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">তারিখ</TableHead>
                <TableHead className="text-xs">প্রোডাক্ট</TableHead>
                <TableHead className="text-xs text-center">লট</TableHead>
                <TableHead className="text-xs text-center">পরিমাণ</TableHead>
                <TableHead className="text-xs text-right">কেনা দাম</TableHead>
                <TableHead className="text-xs text-right">বিক্রয় দাম</TableHead>
                <TableHead className="text-xs text-right">মোট খরচ</TableHead>
                <TableHead className="text-xs">সাপ্লায়ার</TableHead>
                <TableHead className="text-xs">নোট</TableHead>
                <TableHead className="text-xs text-center">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">কোনো ক্রয় এন্ট্রি নেই</TableCell></TableRow>
              ) : filteredEntries.map((e, idx) => {
                // Calculate lot number: count how many entries with same productName exist before this one (by date order)
                const sameProductEntries = stockEntries.filter(se => se.productName === e.productName).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const lotNumber = sameProductEntries.findIndex(se => se.id === e.id) + 1;
                return (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs font-medium">{e.productName}</TableCell>
                  <TableCell className="text-xs text-center">
                    <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">#{lotNumber}</span>
                  </TableCell>
                  <TableCell className="text-xs text-center">{e.quantity}টি</TableCell>
                  <TableCell className="text-xs text-right">৳{e.buyPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-right">৳{e.sellPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">৳{(e.quantity * e.buyPrice).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.supplier || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.note || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteStockEntry(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'ক্রয় এডিট করুন' : 'নতুন প্রোডাক্ট ক্রয় যোগ করুন'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="প্রোডাক্টের নাম"
                value={form.productName}
                onChange={(e) => { setForm({ ...form, productName: e.target.value }); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && filteredSuggestions.length > 0 && !editing && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {filteredSuggestions.map(name => (
                    <button
                      key={name}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const lastEntry = stockEntries.find(en => en.productName === name);
                        setForm({
                          ...form,
                          productName: name,
                          buyPrice: lastEntry ? String(lastEntry.buyPrice) : form.buyPrice,
                          sellPrice: lastEntry ? String(lastEntry.sellPrice) : form.sellPrice,
                          supplier: lastEntry ? lastEntry.supplier : form.supplier,
                        });
                        setShowSuggestions(false);
                      }}
                    >
                      {name}
                      <span className="text-xs text-muted-foreground ml-2">(আগের দাম: ৳{stockEntries.find(en => en.productName === name)?.buyPrice.toLocaleString()})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="পরিমাণ" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <Input type="number" placeholder="কেনা দাম (পিস)" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} />
            </div>
            <Input type="number" placeholder="বিক্রয় দাম (পিস)" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
            <Input placeholder="সাপ্লায়ার (ঐচ্ছিক)" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <Input
              type="date"
              value={format(form.date, 'yyyy-MM-dd')}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setForm({ ...form, date: d });
              }}
            />
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

export default StockManagement;
