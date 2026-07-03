import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Search, Download, Phone, Copy, MessageCircle, Eye,
  ShoppingCart, XCircle, RotateCcw, CheckCircle, ChevronDown, ChevronUp, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrderStore } from '@/stores/useOrderStore';
import { useBlockStore } from '@/stores/useBlockStore';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-100 text-yellow-800',
  'কনফার্মড': 'bg-blue-100 text-blue-800',
  'প্যাকেজিং': 'bg-indigo-100 text-indigo-800',
  'শিপমেন্ট': 'bg-purple-100 text-purple-800',
  'ডেলিভারড': 'bg-green-100 text-green-800',
  'ক্যান্সেল': 'bg-red-100 text-red-800',
  'রিটার্ন': 'bg-orange-100 text-orange-800',
};

interface CustomerData {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  delivered: number;
  cancelled: number;
  returned: number;
  pending: number;
  totalSpent: number;
  orders: {
    id: string;
    items: { name: string; qty: number; price: number; image: string }[];
    total: number;
    status: string;
    date: string;
  }[];
}

const CustomerList = () => {
  const { orders } = useOrderStore();
  const { isPhoneBlocked } = useBlockStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'সব' | 'ডেলিভারড' | 'ক্যান্সেল' | 'রিটার্ন'>('সব');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; phone: string; name: string }>({
    open: false, phone: '', name: '',
  });
  const [messageText, setMessageText] = useState('');

  // Aggregate customers from orders
  const customers = useMemo(() => {
    const map = new Map<string, CustomerData>();
    orders.forEach((order) => {
      const key = order.phone;
      const existing = map.get(key);
      const orderEntry = {
        id: order.id,
        items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, image: i.image })),
        total: order.total,
        status: order.status,
        date: order.date,
      };
      if (existing) {
        existing.totalOrders++;
        existing.orders.push(orderEntry);
        if (order.status === 'ডেলিভারড') existing.delivered++;
        else if (order.status === 'ক্যান্সেল') existing.cancelled++;
        else if (order.status === 'রিটার্ন') existing.returned++;
        else if (order.status === 'পেন্ডিং') existing.pending++;
        existing.totalSpent += order.total;
        // Use latest name/address
        existing.name = order.customer;
        existing.address = order.address;
      } else {
        map.set(key, {
          name: order.customer,
          phone: order.phone,
          address: order.address,
          totalOrders: 1,
          delivered: order.status === 'ডেলিভারড' ? 1 : 0,
          cancelled: order.status === 'ক্যান্সেল' ? 1 : 0,
          returned: order.status === 'রিটার্ন' ? 1 : 0,
          pending: order.status === 'পেন্ডিং' ? 1 : 0,
          totalSpent: order.total,
          orders: [orderEntry],
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const filtered = useMemo(() => {
    let list = customers;
    // Filter by type
    if (filter === 'ডেলিভারড') list = list.filter((c) => c.delivered > 0);
    else if (filter === 'ক্যান্সেল') list = list.filter((c) => c.cancelled > 0);
    else if (filter === 'রিটার্ন') list = list.filter((c) => c.returned > 0);
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.address.toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, search, filter]);

  const exportToExcel = () => {
    const data = customers.map((c) => ({
      'নাম': c.name,
      'ফোন': c.phone,
      'ঠিকানা': c.address,
      'মোট অর্ডার': c.totalOrders,
      'ডেলিভারড': c.delivered,
      'ক্যান্সেল': c.cancelled,
      'রিটার্ন': c.returned,
      'পেন্ডিং': c.pending,
      'মোট খরচ (৳)': c.totalSpent,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customer-list.xlsx');
    toast.success('এক্সেল ফাইল ডাউনলোড হচ্ছে');
  };

  const handleSendMessage = (phone: string) => {
    const encoded = encodeURIComponent(messageText);
    window.open(`https://wa.me/88${phone}?text=${encoded}`, '_blank');
    setMessageDialog({ open: false, phone: '', name: '' });
    setMessageText('');
    toast.success('WhatsApp ওপেন হচ্ছে');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">
          কাস্টমার লিস্ট <span className="text-sm font-normal text-muted-foreground">({customers.length} জন)</span>
        </h1>
        <Button onClick={exportToExcel} size="sm" className="gap-1.5">
          <Download className="w-4 h-4" /> এক্সেল এক্সপোর্ট
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['সব', 'ডেলিভারড', 'ক্যান্সেল', 'রিটার্ন'] as const).map((f) => {
          const count = f === 'সব' ? customers.length
            : f === 'ডেলিভারড' ? customers.filter((c) => c.delivered > 0).length
            : f === 'ক্যান্সেল' ? customers.filter((c) => c.cancelled > 0).length
            : customers.filter((c) => c.returned > 0).length;
          return (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="text-xs gap-1.5"
              onClick={() => setFilter(f)}
            >
              {f} <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="নাম, ফোন বা ঠিকানা দিয়ে সার্চ করুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table - Desktop */}
      <Card className="border-0 shadow-sm hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>কাস্টমার</TableHead>
                <TableHead className="text-center">অর্ডার</TableHead>
                <TableHead className="text-center">ডেলিভারড</TableHead>
                <TableHead className="text-center">ক্যান্সেল</TableHead>
                <TableHead className="text-center">রিটার্ন</TableHead>
                <TableHead className="text-right">মোট খরচ</TableHead>
                <TableHead className="text-center">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    কোনো কাস্টমার পাওয়া যায়নি
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c, idx) => (
                  <>
                    <TableRow
                      key={c.phone}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedCustomer(expandedCustomer === c.phone ? null : c.phone)}
                    >
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-sm text-foreground flex items-center gap-1.5">
                              {c.name}
                              {isPhoneBlocked(c.phone) && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0">ব্লকড</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.phone}</p>
                            <p className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">{c.address}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{c.totalOrders}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-green-600 font-medium">{c.delivered}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-red-600 font-medium">{c.cancelled}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-orange-600 font-medium">{c.returned}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">৳{c.totalSpent}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => window.open(`tel:${c.phone}`)}
                          >
                            <Phone className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              navigator.clipboard.writeText(c.phone);
                              toast.success('নম্বর কপি হয়েছে');
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setMessageDialog({ open: true, phone: c.phone, name: c.name });
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setExpandedCustomer(expandedCustomer === c.phone ? null : c.phone)}
                          >
                            {expandedCustomer === c.phone ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded order history */}
                    {expandedCustomer === c.phone && (
                      <TableRow key={`${c.phone}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/20 p-3">
                          <p className="text-xs font-semibold text-foreground mb-2">অর্ডার হিস্ট্রি</p>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {c.orders.map((o) => (
                              <div key={o.id} className="flex items-center gap-3 bg-background rounded-lg p-2.5 border">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {o.items[0]?.image && (
                                    <img src={o.items[0].image} alt="" className="w-9 h-9 rounded object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{o.id} • {o.date}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs font-semibold">৳{o.total}</p>
                                  <Badge className={`text-[9px] px-1.5 py-0 ${statusColors[o.status] || 'bg-muted'}`}>
                                    {o.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              কোনো কাস্টমার পাওয়া যায়নি
            </CardContent>
          </Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.phone} className="border-0 shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground flex items-center gap-1.5">
                      {c.name}
                      {isPhoneBlocked(c.phone) && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">ব্লকড</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                    <p className="text-[11px] text-muted-foreground/70">{c.address}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{c.totalOrders} অর্ডার</Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-green-50 rounded p-1.5">
                    <CheckCircle className="w-3.5 h-3.5 mx-auto text-green-600" />
                    <p className="text-[10px] text-green-700 mt-0.5">{c.delivered}</p>
                  </div>
                  <div className="bg-red-50 rounded p-1.5">
                    <XCircle className="w-3.5 h-3.5 mx-auto text-red-600" />
                    <p className="text-[10px] text-red-700 mt-0.5">{c.cancelled}</p>
                  </div>
                  <div className="bg-orange-50 rounded p-1.5">
                    <RotateCcw className="w-3.5 h-3.5 mx-auto text-orange-600" />
                    <p className="text-[10px] text-orange-700 mt-0.5">{c.returned}</p>
                  </div>
                  <div className="bg-blue-50 rounded p-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 mx-auto text-blue-600" />
                    <p className="text-[10px] text-blue-700 mt-0.5">৳{c.totalSpent}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => window.open(`tel:${c.phone}`)}>
                    <Phone className="w-3 h-3" /> কল
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => {
                    setMessageDialog({ open: true, phone: c.phone, name: c.name });
                  }}>
                    <MessageCircle className="w-3 h-3" /> মেসেজ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 flex-1"
                    onClick={() => setExpandedCustomer(expandedCustomer === c.phone ? null : c.phone)}
                  >
                    <Eye className="w-3 h-3" /> হিস্ট্রি
                  </Button>
                </div>

                {/* Expanded */}
                {expandedCustomer === c.phone && (
                  <div className="space-y-1.5 pt-1 border-t">
                    {c.orders.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                        {o.items[0]?.image && (
                          <img src={o.items[0].image} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">
                            {o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{o.id} • {o.date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-semibold">৳{o.total}</p>
                          <Badge className={`text-[8px] px-1 py-0 ${statusColors[o.status] || 'bg-muted'}`}>
                            {o.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Message Dialog */}
      <Dialog open={messageDialog.open} onOpenChange={(open) => {
        if (!open) setMessageDialog({ open: false, phone: '', name: '' });
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              মেসেজ পাঠান - {messageDialog.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">ফোন: {messageDialog.phone}</p>
            <Textarea
              placeholder="আপনার অফার বা মেসেজ লিখুন..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                disabled={!messageText.trim()}
                onClick={() => handleSendMessage(messageDialog.phone)}
              >
                <Send className="w-4 h-4" /> WhatsApp এ পাঠান
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerList;
