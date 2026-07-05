import { useState, useEffect } from 'react';
import { useCourierRatioStore } from '@/stores/useCourierRatioStore';
import { useResellerStore, type ResellerOrder } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Loader2, Phone, Copy, MessageCircle, ExternalLink, Eye, ChevronDown, Search, Pencil, Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { normalizePhone } from '@/lib/order-validation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { useSteadfastStore } from '@/stores/useSteadfastStore';
import { useCarrybeeStore } from '@/stores/useCarrybeeStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { buildSteadfastTrackingUrl } from '@/lib/courier-links';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const STATUS_TABS = [
  { label: 'সব', value: 'all', color: 'bg-blue-50 border-blue-200 text-blue-700', activeColor: 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' },
  { label: 'পেন্ডিং', value: 'পেন্ডিং', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', activeColor: 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-300' },
  { label: 'হোল্ড', value: 'হোল্ড', color: 'bg-gray-50 border-gray-200 text-gray-700', activeColor: 'bg-gray-100 border-gray-400 ring-2 ring-gray-300' },
  { label: 'কনফার্মড', value: 'কনফার্মড', color: 'bg-blue-50 border-blue-200 text-blue-700', activeColor: 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' },
  { label: 'প্যাকেজিং', value: 'প্যাকেজিং', color: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeColor: 'bg-indigo-100 border-indigo-400 ring-2 ring-indigo-300' },
  { label: 'শিপমেন্ট', value: 'শিপমেন্ট', color: 'bg-purple-50 border-purple-200 text-purple-700', activeColor: 'bg-purple-100 border-purple-400 ring-2 ring-purple-300' },
  { label: 'এসাইন', value: 'এসাইন', color: 'bg-teal-50 border-teal-200 text-teal-700', activeColor: 'bg-teal-100 border-teal-400 ring-2 ring-teal-300' },
  { label: 'ফলোয়াপ', value: 'ফলোয়াপ', color: 'bg-cyan-50 border-cyan-200 text-cyan-700', activeColor: 'bg-cyan-100 border-cyan-400 ring-2 ring-cyan-300' },
  { label: 'ডেলিভারড', value: 'ডেলিভারড', color: 'bg-green-50 border-green-200 text-green-700', activeColor: 'bg-green-100 border-green-400 ring-2 ring-green-300' },
  { label: 'ক্যান্সেল', value: 'ক্যান্সেল', color: 'bg-red-50 border-red-200 text-red-700', activeColor: 'bg-red-100 border-red-400 ring-2 ring-red-300' },
  { label: 'রিটার্নিং', value: 'রিটার্নিং', color: 'bg-rose-50 border-rose-200 text-rose-700', activeColor: 'bg-rose-100 border-rose-400 ring-2 ring-rose-300' },
  { label: 'রিটার্ন', value: 'রিটার্ন', color: 'bg-orange-50 border-orange-200 text-orange-700', activeColor: 'bg-orange-100 border-orange-400 ring-2 ring-orange-300' },
  { label: 'পেইড রিটার্নিং', value: 'পেইড রিটার্নিং', color: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700', activeColor: 'bg-fuchsia-100 border-fuchsia-400 ring-2 ring-fuchsia-300' },
  { label: 'পেইড রিটার্ন', value: 'পেইড রিটার্ন', color: 'bg-pink-50 border-pink-200 text-pink-700', activeColor: 'bg-pink-100 border-pink-400 ring-2 ring-pink-300' },
];

const getResellerId = () => {
  const auth = localStorage.getItem('reseller-auth');
  return auth ? JSON.parse(auth).id : '';
};

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'হোল্ড': 'bg-gray-100 text-gray-800 border-gray-300',
  'কনফার্মড': 'bg-blue-100 text-blue-800 border-blue-300',
  'প্যাকেজিং': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'শিপমেন্ট': 'bg-purple-100 text-purple-800 border-purple-300',
  'এসাইন': 'bg-teal-100 text-teal-800 border-teal-300',
  'ফলোয়াপ': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'ডেলিভারির পথে': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'ডেলিভারড': 'bg-green-100 text-green-800 border-green-300',
  'ক্যান্সেল': 'bg-red-100 text-red-800 border-red-300',
  'রিটার্নিং': 'bg-rose-100 text-rose-800 border-rose-300',
  'রিটার্ন': 'bg-orange-100 text-orange-800 border-orange-300',
  'পেইড রিটার্নিং': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  'পেইড রিটার্ন': 'bg-pink-100 text-pink-800 border-pink-300',
};

const LOCKED_STATUSES = ['প্যাকেজিং', 'শিপমেন্ট', 'ডেলিভারির পথে', 'ডেলিভারড', 'রিটার্ন', 'পেইড রিটার্ন', 'হোল্ড'];

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
  } catch {}
  return dateStr;
};

const ResellerOrders = () => {
  const resellerId = getResellerId();
  const store = useResellerStore();
  const allProducts = useProductStore((s) => s.products);
  const allOrders = store.orders.filter((o) => o.resellerId === resellerId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const fraudSettings = useFraudSettingsStore();
  const courierData = useCourierRatioStore((s) => s.data);
  const loadCourierCache = useCourierRatioStore((s) => s.loadCache);
  const checkCourierRatioAction = useCourierRatioStore((s) => s.checkRatio);
  const [viewOrder, setViewOrder] = useState<ResellerOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [pendingVariationProduct, setPendingVariationProduct] = useState<any>(null);
  const [pendingVariations, setPendingVariations] = useState<Record<string, string>>({});
  const [editVariantIndex, setEditVariantIndex] = useState<number | null>(null);

  // Note dialog state
  const [noteOrder, setNoteOrder] = useState<ResellerOrder | null>(null);
  const [noteText, setNoteText] = useState('');

  const saveNote = async () => {
    if (!noteOrder) return;
    const newNote = noteText.trim();
    const existingNotes = noteOrder.notes || [];
    const updatedNotes = newNote ? [...existingNotes.filter((n: string) => n !== newNote), newNote] : existingNotes;
    let error: any = null;
    try { await api.post('/rs/reseller-orders/update', { code: noteOrder.id, notes: updatedNotes }); } catch (e) { error = e; }
    if (error) {
      toast.error('নোট সেভ করতে সমস্যা হয়েছে');
      return;
    }
    useResellerStore.setState((s) => ({
      orders: s.orders.map(o => o.id === noteOrder.id ? { ...o, notes: updatedNotes } : o),
    }));
    toast.success('নোট সেভ হয়েছে');
    setNoteOrder(null);
    setNoteText('');
  };

  const removeNote = async (idx: number) => {
    if (!noteOrder) return;
    const updatedNotes = (noteOrder.notes || []).filter((_, i) => i !== idx);
    let error: any = null;
    try { await api.post('/rs/reseller-orders/update', { code: noteOrder.id, notes: updatedNotes }); } catch (e) { error = e; }
    if (error) {
      toast.error('নোট মুছতে সমস্যা হয়েছে');
      return;
    }
    useResellerStore.setState((s) => ({
      orders: s.orders.map(o => o.id === noteOrder.id ? { ...o, notes: updatedNotes } : o),
    }));
    setNoteOrder({ ...noteOrder, notes: updatedNotes });
    toast.success('নোট মুছে ফেলা হয়েছে');
  };

  const sfOrderData = useSteadfastStore((s) => s.orderData);
  const cbOrderData = useCarrybeeStore((s) => s.orderData);
  const fuTrackingUrls = useFollowUpStore((s) => s.trackingUrls);
  useLazyFetch([
    useSteadfastStore.getState().fetchDispatchData,
    useCarrybeeStore.getState().fetchDispatchData,
    useFollowUpStore.getState().fetchAll,
  ]);

  // Filter by tab
  const tabFiltered = activeTab === 'all' ? allOrders : allOrders.filter((o) => o.status === activeTab);

  // Filter by search
  const filteredOrders = searchQuery.trim()
    ? tabFiltered.filter((o) => {
        const q = searchQuery.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.customerAddress.toLowerCase().includes(q)
        );
      })
    : tabFiltered;

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const orders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Count per status
  const statusCounts: Record<string, number> = { all: allOrders.length };
  STATUS_TABS.slice(1).forEach((t) => {
    statusCounts[t.value] = allOrders.filter((o) => o.status === t.value).length;
  });

  const resellerOrderKey = (id: string) => `reseller-${id}`;

  const carrybeeTrackUrl = (cid: string) => `https://merchant.carrybee.com/order-track/${cid}`;

  const getTrackingLink = (orderId: string) => {
    const key = resellerOrderKey(orderId);
    const sf = sfOrderData[key];
    const cb = cbOrderData[key];
    const cbCid = String(cb?.consignment_id || '').trim();
    const fu = fuTrackingUrls[key];
    if (fu) {
      // Upgrade legacy generic CarryBee URL to the per-CID order-track URL when possible.
      if (fu === 'https://carrybee.com/track' && cbCid) return carrybeeTrackUrl(cbCid);
      return fu;
    }
    if (sf?.tracking_code) return buildSteadfastTrackingUrl(sf.tracking_code);
    if (cbCid) return carrybeeTrackUrl(cbCid);
    return null;
  };

  // Returns CarryBee CID if order was sent via CarryBee — used to display the CID
  // badge with copy button next to the tracking link.
  const getCarrybeeCid = (orderId: string): string | null => {
    const key = resellerOrderKey(orderId);
    const cb = cbOrderData[key];
    const cid = String(cb?.consignment_id || '').trim();
    return cid || null;
  };

  const copyCid = (cid: string) => {
    navigator.clipboard.writeText(cid);
    toast.success(`CID কপি হয়েছে: ${cid}`);
  };

  useEffect(() => { loadCourierCache(); }, [loadCourierCache]);

  const checkCourierRatio = (phone: string) => {
    checkCourierRatioAction(phone, fraudSettings.bdcourierApiKey || undefined, true);
  };

  const canChangeStatus = (status: string) => !LOCKED_STATUSES.includes(status);

  const handleStatusChange = (orderId: string, newStatus: string) => {
    store.updateResellerOrderStatus(orderId, newStatus);
    toast.success(`স্ট্যাটাস "${newStatus}" এ পরিবর্তন হয়েছে`);
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success('ফোন নম্বর কপি হয়েছে');
  };

  const canEditOrder = (status: string) => {
    return status === 'পেন্ডিং' || status === 'কনফার্মড';
  };

  const startEditing = (order: ResellerOrder) => {
    setEditData({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      items: order.items.map((i) => ({ ...i })),
    });
    setIsEditing(true);
  };

  const updateEditItem = (idx: number, field: string, value: number) => {
    setEditData((prev: any) => {
      const items = prev.items.map((item: any, i: number) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.profit = updated.sellingPrice - updated.resellerPrice;
        return updated;
      });
      return { ...prev, items };
    });
  };

  const removeEditItem = (idx: number) => {
    if (editData.items.length <= 1) { toast.error('অন্তত একটি প্রোডাক্ট থাকতে হবে'); return; }
    setEditData((prev: any) => ({ ...prev, items: prev.items.filter((_: any, i: number) => i !== idx) }));
  };

  const computeVariationPrice = (p: any, vars: Record<string, string>) => {
    let price = Number(p.price);
    if (p.variationPrices && p.variationPrices.length > 0) {
      for (const vp of p.variationPrices) {
        const key = vp.variationType === 'color' ? 'কালার' : vp.variationType === 'size' ? 'সাইজ' : 'কেজি/ওজন';
        if (vars[key] === vp.variationName && vp.price) {
          price = Number(vp.price);
          break;
        }
      }
    }
    return price;
  };

  const addProductToEdit = (p: any) => {
    const hasVariations = (p.colors && p.colors.length > 0) || (p.sizes && p.sizes.length > 0) || (p.weights && p.weights.length > 0);
    if (hasVariations) {
      setEditVariantIndex(null);
      setPendingVariationProduct(p);
      setPendingVariations({});
      setShowProductPicker(false);
      return;
    }
    const existing = editData.items.findIndex((i: any) => i.productId === p.id);
    if (existing >= 0) {
      updateEditItem(existing, 'qty', editData.items[existing].qty + 1);
    } else {
      const resellerPrice = Number(p.resellerPrice) || Number(p.price);
      const sellingPrice = Number(p.price);
      setEditData((prev: any) => ({
        ...prev,
        items: [...prev.items, {
          productId: p.id,
          productTitle: p.title,
          image: p.featuredImage || '',
          qty: 1,
          resellerPrice,
          sellingPrice,
          profit: sellingPrice - resellerPrice,
        }],
      }));
    }
    setShowProductPicker(false);
  };

  const confirmPendingVariation = () => {
    const p = pendingVariationProduct;
    if (!p) return;
    const sellingPrice = computeVariationPrice(p, pendingVariations);
    const resellerPrice = Number(p.resellerPrice) || sellingPrice;
    const selectedColor = pendingVariations['কালার'];
    const selectedSize = pendingVariations['সাইজ'];
    const selectedWeight = pendingVariations['কেজি/ওজন'];
    if (editVariantIndex !== null) {
      setEditData((prev: any) => ({
        ...prev,
        items: prev.items.map((it: any, i: number) => i === editVariantIndex ? {
          ...it,
          selectedColor,
          selectedSize,
          selectedWeight,
          selectedVariations: pendingVariations,
          sellingPrice,
          resellerPrice,
          profit: sellingPrice - resellerPrice,
        } : it),
      }));
      toast.success('ভেরিয়েন্ট আপডেট হয়েছে');
    } else {
      setEditData((prev: any) => ({
        ...prev,
        items: [...prev.items, {
          productId: p.id,
          productTitle: p.title,
          image: p.featuredImage || '',
          qty: 1,
          resellerPrice,
          sellingPrice,
          profit: sellingPrice - resellerPrice,
          selectedColor,
          selectedSize,
          selectedWeight,
          selectedVariations: pendingVariations,
        }],
      }));
    }
    setPendingVariationProduct(null);
    setPendingVariations({});
    setEditVariantIndex(null);
  };

  const startEditItemVariant = (index: number) => {
    const item = editData.items[index];
    if (!item.productId) { toast.error('প্রোডাক্ট আইডি পাওয়া যায়নি'); return; }
    const product = allProducts.find((p: any) => p.id === item.productId);
    if (!product) { toast.error('প্রোডাক্ট স্টোরে পাওয়া যায়নি'); return; }
    const hasVar = (product.colors?.length || 0) + (product.sizes?.length || 0) + (product.weights?.length || 0) > 0;
    if (!hasVar) { toast.info('এই প্রোডাক্টের কোনো ভেরিয়েন্ট নেই'); return; }
    const initial: Record<string, string> = { ...(item.selectedVariations || {}) };
    if (item.selectedColor && !initial['কালার']) initial['কালার'] = item.selectedColor;
    if (item.selectedSize && !initial['সাইজ']) initial['সাইজ'] = item.selectedSize;
    if (item.selectedWeight && !initial['কেজি/ওজন']) initial['কেজি/ওজন'] = item.selectedWeight;
    setEditVariantIndex(index);
    setPendingVariationProduct(product);
    setPendingVariations(initial);
  };

  const saveEdit = async () => {
    if (!viewOrder || !editData) return;
    if (!editData.customerName.trim()) { toast.error('কাস্টমার নাম দিন'); return; }
    if (!editData.customerPhone.trim()) { toast.error('ফোন নম্বর দিন'); return; }
    if (!editData.customerAddress.trim()) { toast.error('ঠিকানা দিন'); return; }

    const totalSellingPrice = editData.items.reduce((s: number, i: any) => s + i.sellingPrice * i.qty, 0);
    const totalResellerCost = editData.items.reduce((s: number, i: any) => s + i.resellerPrice * i.qty, 0);
    const codCharge = Math.ceil(totalSellingPrice / 100);
    const totalProfit = totalSellingPrice - totalResellerCost - (viewOrder.deliveryCharge || 0) - (viewOrder.packagingCharge || 0) - codCharge;

    try {
      await store.updateResellerOrder(viewOrder.id, {
        customerName: editData.customerName,
        customerPhone: editData.customerPhone,
        customerAddress: editData.customerAddress,
        items: editData.items,
        totalSellingPrice,
        totalResellerCost,
        totalProfit,
        codCharge,
      });
      // Refresh viewOrder
      const updated = store.orders.find((o) => o.id === viewOrder.id);
      if (updated) setViewOrder(updated);
      setIsEditing(false);
      setEditData(null);
      toast.success('অর্ডার আপডেট হয়েছে!');
    } catch {
      toast.error('অর্ডার আপডেট করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold text-foreground">আমার অর্ডার</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="অর্ডার আইডি, কাস্টমার নাম, ফোন দিয়ে সার্চ করুন..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Tabs - Card Style */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${isActive ? tab.activeColor : tab.color} hover:shadow-sm active:scale-[0.97]`}
            >
              <p className="text-[11px] font-medium leading-tight">{tab.label}</p>
              <p className="text-lg font-bold leading-tight mt-0.5">{statusCounts[tab.value] || 0}</p>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">কোনো অর্ডার নেই</div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">অর্ডার</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">কাস্টমার</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">প্রোডাক্ট</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">প্রাইজ</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">স্ট্যাটাস</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const trackingLink = o.trackingUrl || getTrackingLink(o.id);
                  const isLocked = !canChangeStatus(o.status);
                  const subtotalSelling = o.items.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
                  const subtotalDP = o.items.reduce((s, i) => s + i.resellerPrice * i.qty, 0);
                  const profit = o.totalProfit;

                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      {/* Order ID & Date */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                            o.status === 'ডেলিভারড' ? 'bg-green-500' :
                            o.status === 'ক্যান্সেল' ? 'bg-red-500' :
                            o.status === 'রিটার্ন' ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`} />
                          <div>
                            <p className="font-bold text-primary">{o.id}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(o.date)}</p>
                            <Badge className={`text-[10px] border mt-1 ${statusColors[o.status] || 'bg-muted text-foreground'}`} variant="secondary">
                              {o.status}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3 align-top min-w-[200px]">
                        <p className="font-semibold text-foreground text-sm">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{o.customerAddress}</p>
                        <p className="text-xs text-foreground mt-0.5">{o.customerPhone}</p>
                        
                        {/* Courier ratio bar */}
                        <button
                          className="text-[11px] text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 mt-1"
                          onClick={() => checkCourierRatio(o.customerPhone)}
                        >
                          <ShieldAlert className="w-3 h-3" />
                          ফ্রড চেক
                        </button>
                        {courierData[normalizePhone(o.customerPhone) || o.customerPhone] && (
                          <div className="mt-1">
                            {courierData[normalizePhone(o.customerPhone) || o.customerPhone].loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                            ) : (() => {
                              const d = courierData[normalizePhone(o.customerPhone) || o.customerPhone];
                              const pct = d.all > 0 ? Math.round((d.delivered / d.all) * 100) : 0;
                              return (
                                <div className="w-full">
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                                    <span className="text-foreground font-semibold">all: {d.all}</span>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="text-green-600 font-semibold">delivered: {d.delivered}</span>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="text-red-600 font-semibold">return: {d.returned}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <div className="flex gap-1 mt-1.5">
                          <button className="p-1 rounded hover:bg-muted" onClick={() => window.open(`tel:${o.customerPhone}`)} title="কল">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button className="p-1 rounded hover:bg-muted" onClick={() => copyPhone(o.customerPhone)} title="কপি">
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button className="p-1 rounded hover:bg-muted" onClick={() => window.open(`https://wa.me/88${o.customerPhone}`, '_blank')} title="মেসেজ">
                            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </td>

                      {/* Products */}
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        <div className="space-y-1.5">
                          {o.items.map((item: any, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <img src={item.image || '/placeholder.svg'} alt="" className="w-9 h-9 rounded object-cover border shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[140px]">{item.productTitle}</p>
                                <p className="text-[10px] text-muted-foreground">×{item.qty}</p>
                                 {(() => {
                                   const knownKeys = ['কালার', 'color', 'সাইজ', 'size', 'ওজন', 'weight'];
                                   const extraVars = item.selectedVariations ? Object.entries(item.selectedVariations).filter(([k]) => !knownKeys.includes(k)) : [];
                                   const hasAny = item.selectedColor || item.selectedSize || item.selectedWeight || extraVars.length > 0;
                                   return hasAny ? (
                                     <div className="flex flex-wrap gap-1 mt-0.5">
                                       {item.selectedColor && <span className="text-[9px] px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded">{item.selectedColor}</span>}
                                       {item.selectedSize && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{item.selectedSize}</span>}
                                       {item.selectedWeight && <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">{item.selectedWeight}</span>}
                                       {extraVars.map(([k, v]) => <span key={k} className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{String(v)}</span>)}
                                     </div>
                                   ) : null;
                                 })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 align-top min-w-[200px]">
                        <div className="text-xs space-y-0">
                          <div className="flex justify-between gap-4 py-0.5">
                            <span className="text-muted-foreground">সেল প্রাইজ:</span>
                            <span className="font-medium">৳{subtotalSelling}</span>
                          </div>
                          <div className="flex justify-between gap-4 py-0.5">
                            <span className="text-muted-foreground">- DP প্রাইজ:</span>
                            <span className="text-red-500">-৳{subtotalDP}</span>
                          </div>
                          <div className="flex justify-between gap-4 py-0.5">
                            <span className="text-muted-foreground">- ডেলিভারি চার্জ:</span>
                            <span className="text-red-500">-৳{o.deliveryCharge || 0}</span>
                          </div>
                          <div className="flex justify-between gap-4 py-0.5">
                            <span className="text-muted-foreground">- প্যাকেজিং চার্জ:</span>
                            <span className="text-red-500">-৳{o.packagingCharge || 0}</span>
                          </div>
                          <div className="flex justify-between gap-4 py-0.5">
                            <span className="text-muted-foreground">- COD চার্জ:</span>
                            <span className="text-red-500">-৳{o.codCharge || 0}</span>
                          </div>
                          <div className="flex justify-between gap-4 py-1 border-t mt-1 font-bold text-green-600">
                            <span>প্রফিট:</span>
                            <span>+৳{profit}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 align-top">
                        {isLocked ? (
                          <Badge className={`text-[11px] border ${statusColors[o.status] || ''}`} variant="secondary">
                            {o.status}
                          </Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${statusColors[o.status] || 'bg-muted'}`}>
                                {o.status}
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[140px]">
                              {o.status === 'পেন্ডিং' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(o.id, 'কনফার্মড')}>
                                  কনফার্মড
                                </DropdownMenuItem>
                              )}
                              {(o.status === 'পেন্ডিং' || o.status === 'কনফার্মড') && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(o.id, 'ক্যান্সেল')}>
                                  ক্যান্সেল
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        
                        {trackingLink && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <a
                              href={trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> ট্র্যাক
                            </a>
                            {getCarrybeeCid(o.id) && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyCid(getCarrybeeCid(o.id)!); }}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground hover:bg-muted/70"
                                title="CID কপি করুন"
                              >
                                CID: {getCarrybeeCid(o.id)} <Copy className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 align-top text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button className="p-1.5 rounded hover:bg-muted" onClick={() => setViewOrder(o)} title="বিস্তারিত">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </button>
                      {canEditOrder(o.status) && (
                            <button className="p-1.5 rounded hover:bg-muted" onClick={() => { setViewOrder(o); startEditing(o); }} title="এডিট">
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            className="p-1.5 rounded hover:bg-amber-50"
                            title="নোট"
                            onClick={() => { setNoteOrder(o); setNoteText(''); }}
                          >
                            <StickyNote className="w-4 h-4 text-amber-500" />
                          </button>
                          {/* Notes indicator */}
                          {o.notes && o.notes.length > 0 && (
                            <span className="text-[9px] text-amber-600 px-1.5 py-0.5 bg-amber-50 rounded text-center" title={o.notes.join(', ')}>📝 {o.notes.length}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y">
            {orders.map((o) => {
              const trackingLink = o.trackingUrl || getTrackingLink(o.id);
              const isLocked = !canChangeStatus(o.status);

              return (
                <div key={o.id} className="p-3 space-y-2.5">

                  {/* Row 1: Order ID + Status + Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        o.status === 'ডেলিভারড' ? 'bg-green-500' :
                        o.status === 'ক্যান্সেল' ? 'bg-red-500' :
                        o.status === 'রিটার্ন' || o.status === 'রিটার্নিং' ? 'bg-orange-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-bold text-primary text-sm">{o.id}</span>
                      <Badge className={`text-[10px] border shrink-0 ${statusColors[o.status] || ''}`} variant="secondary">{o.status}</Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(o.date)}</span>
                  </div>

                  {/* Row 2: Products */}
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {o.items.map((item: any, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 shrink-0 bg-muted/40 rounded-lg px-2 py-1.5">
                        <img src={item.image || '/placeholder.svg'} alt="" className="w-7 h-7 rounded object-cover border shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium truncate max-w-[80px]">{item.productTitle}</p>
                          <p className="text-[10px] text-muted-foreground">×{item.qty}</p>
                          {(() => {
                            const knownKeys = ['কালার', 'color', 'সাইজ', 'size', 'ওজন', 'weight'];
                            const extraVars = item.selectedVariations ? Object.entries(item.selectedVariations).filter(([k]) => !knownKeys.includes(k)) : [];
                            const hasAny = item.selectedColor || item.selectedSize || item.selectedWeight || extraVars.length > 0;
                            return hasAny ? (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {item.selectedColor && <span className="text-[8px] px-1 py-0.5 bg-pink-50 text-pink-700 rounded">{item.selectedColor}</span>}
                                {item.selectedSize && <span className="text-[8px] px-1 py-0.5 bg-blue-50 text-blue-700 rounded">{item.selectedSize}</span>}
                                {item.selectedWeight && <span className="text-[8px] px-1 py-0.5 bg-green-50 text-green-700 rounded">{item.selectedWeight}</span>}
                                {extraVars.map(([k, v]) => <span key={k} className="text-[8px] px-1 py-0.5 bg-purple-50 text-purple-700 rounded">{String(v)}</span>)}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Row 3: Customer + Contact buttons */}
                  <div className="bg-muted/20 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{o.customerName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{o.customerAddress}</p>
                      <p className="text-[11px] text-foreground/70 font-mono">{o.customerPhone}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="p-1.5 rounded-lg hover:bg-muted" onClick={() => window.open(`tel:${o.customerPhone}`)}>
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted" onClick={() => copyPhone(o.customerPhone)}>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted" onClick={() => window.open(`https://wa.me/88${o.customerPhone}`, '_blank')}>
                        <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    </div>
                  </div>

                  {/* Row 4: Price summary + Tracking button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">মোট:</span>
                      <span className="font-semibold">৳{o.totalSellingPrice}</span>
                      <span className="w-px h-3 bg-border inline-block" />
                      <span className="text-muted-foreground text-xs">লাভ:</span>
                      <span className="font-bold text-emerald-600">+৳{o.totalProfit}</span>
                    </div>
                    {trackingLink && (
                      <a
                        href={trackingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" /> ট্র্যাক করুন
                      </a>
                    )}
                  </div>

                  {/* Row 5: Status change + Action buttons */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-muted/50">
                    <div>
                      {!isLocked ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${statusColors[o.status] || 'bg-muted'}`}>
                              {o.status} <ChevronDown className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {o.status === 'পেন্ডিং' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, 'কনফার্মড')}>কনফার্মড</DropdownMenuItem>
                            )}
                            {(o.status === 'পেন্ডিং' || o.status === 'কনফার্মড') && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(o.id, 'ক্যান্সেল')}>ক্যান্সেল</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge className={`text-[10px] border ${statusColors[o.status] || ''}`} variant="secondary">{o.status}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded-lg hover:bg-amber-50 relative"
                        onClick={() => { setNoteOrder(o); setNoteText(''); }}
                        title="নোট"
                      >
                        <StickyNote className="w-4 h-4 text-amber-500" />
                        {o.notes && o.notes.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">{o.notes.length}</span>
                        )}
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted" onClick={() => setViewOrder(o)} title="বিস্তারিত">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {canEditOrder(o.status) && (
                        <button className="p-1.5 rounded-lg hover:bg-muted" onClick={() => { setViewOrder(o); startEditing(o); }} title="এডিট">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredOrders.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 flex-wrap bg-card border rounded-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">
            পেজ {safePage} / {totalPages} • মোট {filteredOrders.length} অর্ডার
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 px-2" disabled={safePage === 1} onClick={() => setCurrentPage(1)}>«</Button>
            <Button size="sm" variant="outline" className="h-8 px-2" disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>‹</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                  <Button
                    size="sm"
                    variant={p === safePage ? 'default' : 'outline'}
                    className="h-8 min-w-8 px-2"
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </Button>
                </span>
              ))}
            <Button size="sm" variant="outline" className="h-8 px-2" disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>›</Button>
            <Button size="sm" variant="outline" className="h-8 px-2" disabled={safePage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
          </div>
        </div>
      )}


      {/* View/Edit Order Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => { if (!open) { setViewOrder(null); setIsEditing(false); setEditData(null); setShowProductPicker(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>অর্ডার বিস্তারিত — {viewOrder?.id}</span>
              {viewOrder && canEditOrder(viewOrder.status) && !isEditing && (
                <Button size="sm" variant="outline" onClick={() => startEditing(viewOrder)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> এডিট
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewOrder && !isEditing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">কাস্টমার:</span><p className="font-medium">{viewOrder.customerName}</p></div>
                <div><span className="text-muted-foreground text-xs">ফোন:</span><p className="font-medium">{viewOrder.customerPhone}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">ঠিকানা:</span><p className="font-medium">{viewOrder.customerAddress}</p></div>
                <div><span className="text-muted-foreground text-xs">স্ট্যাটাস:</span><Badge className={statusColors[viewOrder.status] || ''} variant="secondary">{viewOrder.status}</Badge></div>
                <div><span className="text-muted-foreground text-xs">তারিখ:</span><p className="font-medium">{formatDate(viewOrder.date)}</p></div>
              </div>
              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium text-sm">প্রোডাক্ট</p>
                {viewOrder.items.map((item: any, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                    <img src={item.image || '/placeholder.svg'} alt="" className="w-10 h-10 rounded object-cover" />
                    <div className="flex-1">
                      <p className="text-sm">{item.productTitle}</p>
                      <p className="text-xs text-muted-foreground">×{item.qty}</p>
                       {(() => {
                         const knownKeys = ['কালার', 'color', 'সাইজ', 'size', 'ওজন', 'weight'];
                         const extraVars = item.selectedVariations ? Object.entries(item.selectedVariations).filter(([k]) => !knownKeys.includes(k)) : [];
                         const hasAny = item.selectedColor || item.selectedSize || item.selectedWeight || extraVars.length > 0;
                         return hasAny ? (
                           <div className="flex flex-wrap gap-1 mt-0.5">
                             {item.selectedColor && <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded">{item.selectedColor}</span>}
                             {item.selectedSize && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{item.selectedSize}</span>}
                             {item.selectedWeight && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">{item.selectedWeight}</span>}
                             {extraVars.map(([k, v]) => <span key={k} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{String(v)}</span>)}
                           </div>
                         ) : null;
                       })()}
                    </div>
                    <div className="text-right text-xs">
                      <p>SP: ৳{item.sellingPrice}</p>
                      <p className="text-muted-foreground">RP: ৳{item.resellerPrice}</p>
                      <p className="text-green-600">লাভ: ৳{item.profit}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Notes Section */}
              {viewOrder.notes && viewOrder.notes.length > 0 && (
                <div className="border rounded-lg p-3 space-y-1.5 bg-amber-50/50">
                  <p className="font-medium text-sm flex items-center gap-1.5">📝 নোট</p>
                  {viewOrder.notes.map((n: string, i: number) => (
                    <p key={i} className="text-sm text-foreground">• {n}</p>
                  ))}
                </div>
              )}
              <div className="border rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>ডেলিভারি:</span><span>৳{viewOrder.deliveryCharge}</span></div>
                {viewOrder.packagingCharge && <div className="flex justify-between"><span>প্যাকেজিং:</span><span>৳{viewOrder.packagingCharge}</span></div>}
                {viewOrder.codCharge && <div className="flex justify-between"><span>COD:</span><span>৳{viewOrder.codCharge}</span></div>}
                <div className="flex justify-between font-bold border-t pt-1"><span>মোট:</span><span>৳{viewOrder.totalSellingPrice}</span></div>
                <div className="flex justify-between text-green-600"><span>লাভ:</span><span>৳{viewOrder.totalProfit}</span></div>
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {viewOrder && isEditing && editData && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="space-y-2">
                <p className="text-sm font-medium">কাস্টমার তথ্য</p>
                <Input value={editData.customerName} onChange={(e) => setEditData({ ...editData, customerName: e.target.value })} placeholder="কাস্টমার নাম" />
                <Input value={editData.customerPhone} onChange={(e) => setEditData({ ...editData, customerPhone: e.target.value })} placeholder="ফোন নম্বর" />
                <Input value={editData.customerAddress} onChange={(e) => setEditData({ ...editData, customerAddress: e.target.value })} placeholder="ঠিকানা" />
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">প্রোডাক্ট</p>
                  <Button size="sm" variant="outline" onClick={() => { setShowProductPicker(true); setProductSearch(''); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> প্রোডাক্ট যোগ
                  </Button>
                </div>
                {editData.items.map((item: any, idx: number) => {
                  const variantParts: string[] = [];
                  if (item.selectedColor) variantParts.push(`কালার: ${item.selectedColor}`);
                  if (item.selectedSize) variantParts.push(`সাইজ: ${item.selectedSize}`);
                  if (item.selectedWeight) variantParts.push(`ওজন: ${item.selectedWeight}`);
                  if (item.selectedVariations) {
                    Object.entries(item.selectedVariations).forEach(([k, v]) => {
                      if (!['কালার', 'সাইজ', 'কেজি/ওজন'].includes(k)) variantParts.push(`${k}: ${v}`);
                    });
                  }
                  return (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                    <img src={item.image || '/placeholder.svg'} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-medium truncate">{item.productTitle}</p>
                      {variantParts.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">{variantParts.join(' • ')}</p>
                      )}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground">সেল প্রাইজ</label>
                          <Input type="number" value={item.sellingPrice} onChange={(e) => updateEditItem(idx, 'sellingPrice', Number(e.target.value))} className="h-8 text-xs" />
                        </div>
                        <div className="w-16">
                          <label className="text-[10px] text-muted-foreground">পরিমাণ</label>
                          <Input type="number" value={item.qty} min={1} onChange={(e) => updateEditItem(idx, 'qty', Math.max(1, Number(e.target.value)))} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => startEditItemVariant(idx)}>
                        <Pencil className="w-3 h-3" /> ভেরিয়েন্ট পরিবর্তন
                      </Button>
                    </div>
                    <button onClick={() => removeEditItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  );
                })}

                {/* Variation picker */}
                {pendingVariationProduct && (
                  <div className="border rounded-lg p-3 space-y-3 bg-primary/5">
                    <p className="text-xs font-semibold">
                      {pendingVariationProduct.title} — ভেরিয়েন্ট {editVariantIndex !== null ? 'পরিবর্তন' : 'বাছুন'}
                    </p>
                    {pendingVariationProduct.colors && pendingVariationProduct.colors.length > 0 && (
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">কালার</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {pendingVariationProduct.colors.map((c: string) => (
                            <button key={c} onClick={() => setPendingVariations(prev => ({ ...prev, কালার: c }))} className={`px-2.5 py-1 rounded-full text-xs border transition-all ${pendingVariations['কালার'] === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {pendingVariationProduct.sizes && pendingVariationProduct.sizes.length > 0 && (
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">সাইজ</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {pendingVariationProduct.sizes.map((s: string) => (
                            <button key={s} onClick={() => setPendingVariations(prev => ({ ...prev, সাইজ: s }))} className={`px-2.5 py-1 rounded-full text-xs border transition-all ${pendingVariations['সাইজ'] === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {pendingVariationProduct.weights && pendingVariationProduct.weights.length > 0 && (
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">কেজি/ওজন</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {pendingVariationProduct.weights.map((w: string) => (
                            <button key={w} onClick={() => setPendingVariations(prev => ({ ...prev, 'কেজি/ওজন': w }))} className={`px-2.5 py-1 rounded-full text-xs border transition-all ${pendingVariations['কেজি/ওজন'] === w ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>{w}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setPendingVariationProduct(null); setPendingVariations({}); setEditVariantIndex(null); }}>বাতিল</Button>
                      <Button size="sm" onClick={confirmPendingVariation}>{editVariantIndex !== null ? 'আপডেট করুন' : 'যোগ করুন'}</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveEdit}>
                  <Save className="w-4 h-4 mr-1" /> সেভ করুন
                </Button>
                <Button variant="outline" onClick={() => { setIsEditing(false); setEditData(null); }}>
                  <X className="w-4 h-4 mr-1" /> বাতিল
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Picker Dialog */}
      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>প্রোডাক্ট যোগ করুন</DialogTitle>
          </DialogHeader>
          <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." className="mb-3" />
          <div className="space-y-2">
            {allProducts
              .filter((p) => p.status === 'published' && p.title.toLowerCase().includes(productSearch.toLowerCase()))
              .slice(0, 20)
              .map((p) => (
                <button
                  key={p.id}
                  className="flex items-center gap-3 w-full p-2 border rounded-lg hover:bg-muted/50 text-left"
                  onClick={() => addProductToEdit(p)}
                >
                  <img src={p.featuredImage || '/placeholder.svg'} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">দাম: ৳{p.price} | RP: ৳{p.resellerPrice || p.price}</p>
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      {noteOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setNoteOrder(null); setNoteText(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" /> নোট — {noteOrder.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {noteOrder.notes && noteOrder.notes.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground">বিদ্যমান নোট:</p>
                  {noteOrder.notes.map((n: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="flex-1">• {n}</span>
                      <button onClick={() => removeNote(i)} className="p-0.5 rounded hover:bg-destructive/10 text-destructive shrink-0" title="মুছুন">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">নতুন নোট যোগ করুন:</p>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="যেমন: কাস্টমার সাথে কথা বলেছি, ডেলিভারির সময় ফোন করতে বলেছি..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setNoteOrder(null); setNoteText(''); }}>বন্ধ করুন</Button>
                <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={saveNote} disabled={!noteText.trim()}>
                  <Save className="w-3.5 h-3.5" /> সেভ করুন
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ResellerOrders;
