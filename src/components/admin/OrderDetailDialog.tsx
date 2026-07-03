import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Save, X, Phone, Plus, Trash2, StickyNote, AlertCircle, Search, Truck, ExternalLink, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useProductStore } from '@/stores/useProductStore';
import { useSteadfastStore } from '@/stores/useSteadfastStore';
import type { Product } from '@/data/store-data';
import { buildSteadfastTrackingUrl } from '@/lib/courier-links';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  originalPrice: number;
  image: string;
  discountNote?: string;
  stockProductName?: string;
  variations?: Record<string, string>;
  freeDelivery?: boolean;
  /** Snapshot of product.buyPrice (cost) at the moment the order was placed. */
  buyPrice?: number;
  /** Snapshot of product.resellerPrice at order time. */
  resellerPriceSnapshot?: number;
  /** Optional product id to help future lookups. */
  productId?: string;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  address: string;
  items: OrderItem[];
  deliveryCharge: number;
  originalDeliveryCharge: number;
  deliveryDiscountNote?: string;
  total: number;
  status: string;
  date: string;
  isoDate?: string;
  confirmedBy: string;
  assignedTo?: string;
  assignedToName?: string;
  note?: string;
  customerIp?: string;
  customerFingerprint?: string;
  manualTrackingUrl?: string;
  paidReturnAmount?: number | null;
  smsSent?: Record<string, string>;
  source?: string;
}

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-100 text-yellow-800',
  'হোল্ড': 'bg-amber-100 text-amber-800',
  'ফলোয়াপ': 'bg-cyan-100 text-cyan-800',
  'কনফার্মড': 'bg-blue-100 text-blue-800',
  'প্যাকেজিং': 'bg-indigo-100 text-indigo-800',
  'শিপমেন্ট': 'bg-purple-100 text-purple-800',
  'ডেলিভারড': 'bg-green-100 text-green-800',
  'রিটার্ন': 'bg-orange-100 text-orange-800',
  'পেইড রিটার্ন': 'bg-pink-100 text-pink-800',
  'ক্যান্সেল': 'bg-red-100 text-red-800',
};

// Only these statuses can be changed from order detail view (same as Orders page)
const editableStatusOptions = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ', 'কনফার্মড', 'ক্যান্সেল'];
const statusOptions = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ', 'কনফার্মড', 'ক্যান্সেল'];

interface OrderDetailDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Order) => void;
  courierSent?: boolean;
  onStatusChange?: (orderId: string, newStatus: string) => void;
  onNoteChange?: (orderId: string, note: string) => void;
}

const steadfastStatusMap: Record<string, { label: string; color: string }> = {
  'in_review': { label: 'প্যাকেজিং', color: 'bg-indigo-100 text-indigo-800' },
  'pending': { label: 'শিপমেন্ট', color: 'bg-purple-100 text-purple-800' },
  'delivered': { label: 'ডেলিভারড', color: 'bg-green-100 text-green-800' },
  'partial_delivered': { label: 'আংশিক ডেলিভারড', color: 'bg-emerald-100 text-emerald-800' },
  'cancelled': { label: 'ক্যান্সেলড', color: 'bg-red-100 text-red-800' },
  'hold': { label: 'হোল্ড', color: 'bg-amber-100 text-amber-800' },
  'delivered_approval_pending': { label: 'ডেলিভারড (অপেক্ষমান)', color: 'bg-lime-100 text-lime-800' },
  'cancelled_approval_pending': { label: 'ক্যান্সেল (অপেক্ষমান)', color: 'bg-orange-100 text-orange-800' },
};

const OrderDetailDialog = ({ order, open, onOpenChange, onSave, courierSent = false, onStatusChange, onNoteChange }: OrderDetailDialogProps) => {
  const storeProducts = useProductStore((s) => s.products);
  const sfOrderData = useSteadfastStore((s) => s.orderData);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editData, setEditData] = useState(getEditData(order));
  const [discountNoteIndex, setDiscountNoteIndex] = useState<number | null>(null);
  const [showDeliveryNote, setShowDeliveryNote] = useState(false);
  const [noteText, setNoteText] = useState(order.note || '');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingVariationProduct, setPendingVariationProduct] = useState<Product | null>(null);
  const [pendingVariations, setPendingVariations] = useState<Record<string, string>>({});
  const [editVariantIndex, setEditVariantIndex] = useState<number | null>(null);

  // Compute price from a product based on selected variations
  const computeVariationPrice = (p: Product, vars: Record<string, string>) => {
    let price = p.price;
    if (p.variationPrices && p.variationPrices.length > 0) {
      for (const vp of p.variationPrices) {
        const key = vp.variationType === 'color' ? 'কালার' : vp.variationType === 'size' ? 'সাইজ' : 'কেজি/ওজন';
        if (vars[key] === vp.variationName && vp.price) {
          price = vp.price;
          break;
        }
      }
    }
    return price;
  };

  const confirmPendingVariation = () => {
    const p = pendingVariationProduct;
    if (!p) return;
    const price = computeVariationPrice(p, pendingVariations);
    if (editVariantIndex !== null) {
      // Update existing item's variations & price
      setEditData(prev => ({
        ...prev,
        items: prev.items.map((it, i) => i === editVariantIndex ? {
          ...it,
          variations: Object.keys(pendingVariations).length > 0 ? pendingVariations : undefined,
          price,
          originalPrice: it.originalPrice && price >= it.originalPrice ? price : it.originalPrice,
        } : it),
      }));
      toast.success('ভেরিয়েন্ট আপডেট হয়েছে');
    } else {
      const newItem: OrderItem = {
        name: p.title,
        qty: 1,
        price,
        originalPrice: price,
        image: p.images[0] + '&w=80&h=80&fit=crop',
        productId: p.id,
        buyPrice: typeof p.buyPrice === 'number' ? p.buyPrice : undefined,
        resellerPriceSnapshot: typeof p.resellerPrice === 'number' ? p.resellerPrice : undefined,
        stockProductName: p.stockProductName || undefined,
        variations: Object.keys(pendingVariations).length > 0 ? pendingVariations : undefined,
      };
      setEditData(prev => ({ ...prev, items: [...prev.items, newItem] }));
      toast.success(`${p.title} যোগ করা হয়েছে`);
    }
    setPendingVariationProduct(null);
    setPendingVariations({});
    setEditVariantIndex(null);
    setShowAddProduct(false);
  };

  const startEditItemVariant = (index: number) => {
    const item = editData.items[index];
    if (!item.productId) {
      toast.error('এই প্রোডাক্টের ভেরিয়েন্ট তথ্য পাওয়া যায়নি');
      return;
    }
    const product = storeProducts.find(p => p.id === item.productId);
    if (!product) {
      toast.error('প্রোডাক্ট স্টোরে পাওয়া যায়নি');
      return;
    }
    const hasVar = (product.colors?.length || 0) + (product.sizes?.length || 0) + (product.weights?.length || 0) > 0;
    if (!hasVar) {
      toast.info('এই প্রোডাক্টের কোনো ভেরিয়েন্ট নেই');
      return;
    }
    setEditVariantIndex(index);
    setPendingVariationProduct(product);
    setPendingVariations(item.variations || {});
  };

  // Allow editing if courier sent but order is cancelled
  const canEditStatus = !courierSent || order.status === 'ক্যান্সেল';

  function getEditData(o: Order) {
    return {
      customer: o.customer,
      phone: o.phone,
      address: o.address,
      status: o.status,
      deliveryCharge: o.deliveryCharge,
      originalDeliveryCharge: o.originalDeliveryCharge,
      deliveryDiscountNote: o.deliveryDiscountNote || '',
      items: o.items.map(item => ({ ...item })),
    };
  }

  const handleOpen = (val: boolean) => {
    if (!val) {
      setIsEditing(false);
      setShowAddProduct(false);
      setDiscountNoteIndex(null);
      setShowDeliveryNote(false);
      setShowNoteInput(false);
      setPendingVariationProduct(null);
      setPendingVariations({});
      setEditVariantIndex(null);
    } else {
      setNoteText(order.note || '');
    }
    onOpenChange(val);
  };

  const startEdit = () => {
    setEditData(getEditData(order));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setShowAddProduct(false);
    setDiscountNoteIndex(null);
    setShowDeliveryNote(false);
  };

  const saveEdit = () => {
    for (let i = 0; i < editData.items.length; i++) {
      const item = editData.items[i];
      if (item.price < item.originalPrice && !item.discountNote?.trim()) {
        toast.error(`"${item.name}" এর প্রাইস কমানো হয়েছে — কারণ লিখুন`);
        setDiscountNoteIndex(i);
        return;
      }
    }
    if (editData.deliveryCharge < editData.originalDeliveryCharge && !editData.deliveryDiscountNote?.trim()) {
      toast.error('ডেলিভারি চার্জ কমানো হয়েছে — কারণ লিখুন');
      setShowDeliveryNote(true);
      return;
    }

    const subtotal = editData.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const updated: Order = {
      ...order,
      customer: editData.customer.trim(),
      phone: editData.phone.trim(),
      address: editData.address.trim(),
      status: editData.status,
      deliveryCharge: editData.deliveryCharge,
      originalDeliveryCharge: editData.originalDeliveryCharge,
      deliveryDiscountNote: editData.deliveryDiscountNote,
      items: editData.items,
      total: subtotal + editData.deliveryCharge,
    };
    onSave(updated);
    setIsEditing(false);
    setShowAddProduct(false);
    setDiscountNoteIndex(null);
    setShowDeliveryNote(false);
    toast.success('অর্ডার আপডেট হয়েছে');
  };

  const updateItemPrice = (index: number, price: number) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const newItem = { ...item, price };
        if (price < item.originalPrice) setDiscountNoteIndex(index);
        return newItem;
      }),
    }));
  };

  const updateItemQty = (index: number, qty: number) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, qty } : item),
    }));
  };

  const updateItemNote = (index: number, note: string) => {
    setEditData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, discountNote: note } : item),
    }));
  };

  const removeItem = (index: number) => {
    if (editData.items.length <= 1) {
      toast.error('অন্তত একটি প্রোডাক্ট থাকতে হবে');
      return;
    }
    setEditData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const addProductFromStore = (productId: string) => {
    const product = storeProducts.find(p => p.id === productId);
    if (!product) return;
    const hasVariations = (product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0) || (product.weights && product.weights.length > 0);
    if (hasVariations) {
      setEditVariantIndex(null);
      setPendingVariationProduct(product);
      setPendingVariations({});
      return;
    }
    const newItem: OrderItem = {
      name: product.title,
      qty: 1,
      price: product.price,
      originalPrice: product.price,
      image: product.images[0] + '&w=80&h=80&fit=crop',
      productId: product.id,
      buyPrice: typeof product.buyPrice === 'number' ? product.buyPrice : undefined,
      resellerPriceSnapshot: typeof product.resellerPrice === 'number' ? product.resellerPrice : undefined,
      stockProductName: product.stockProductName || undefined,
    };
    setEditData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setShowAddProduct(false);
    toast.success(`${product.title} যোগ করা হয়েছে`);
  };

  const updateDeliveryCharge = (charge: number) => {
    if (charge < editData.originalDeliveryCharge) setShowDeliveryNote(true);
    setEditData(prev => ({ ...prev, deliveryCharge: charge }));
  };

  const getSubtotal = (items: OrderItem[]) => items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const currentItems = isEditing ? editData.items : order.items;
  const currentSubtotal = getSubtotal(currentItems);
  const currentDelivery = isEditing ? editData.deliveryCharge : order.deliveryCharge;
  const currentTotal = currentSubtotal + currentDelivery;

  const totalDiscount = (() => {
    let d = 0;
    for (const item of currentItems) {
      if (item.price < item.originalPrice) d += (item.originalPrice - item.price) * item.qty;
    }
    const origDel = isEditing ? editData.originalDeliveryCharge : order.originalDeliveryCharge;
    if (currentDelivery < origDel) d += origDel - currentDelivery;
    return d;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>অর্ডার {order.id}</DialogTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                এডিট
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1">
                  <X className="w-3.5 h-3.5" />
                  বাতিল
                </Button>
                <Button size="sm" onClick={saveEdit} className="gap-1">
                  <Save className="w-3.5 h-3.5" />
                  সেভ
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm">
          {/* Customer Info */}
          <div className="space-y-2">
            <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">কাস্টমার তথ্য</h4>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">নাম</Label>
                  <Input value={editData.customer} onChange={(e) => setEditData(p => ({ ...p, customer: e.target.value }))} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ফোন</Label>
                  <Input value={editData.phone} onChange={(e) => setEditData(p => ({ ...p, phone: e.target.value }))} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ঠিকানা</Label>
                  <Input value={editData.address} onChange={(e) => setEditData(p => ({ ...p, address: e.target.value }))} className="h-9 mt-1" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">নাম:</span> {order.customer}</div>
                <div>
                  <span className="text-muted-foreground">ফোন: </span>
                  <a href={`tel:${order.phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />{order.phone}
                  </a>
                </div>
                <div className="col-span-2"><span className="text-muted-foreground">ঠিকানা:</span> {order.address}</div>
              </div>
            )}
          </div>

          {/* Products */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">পণ্য সমূহ</h4>
              {isEditing && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAddProduct(!showAddProduct)}>
                  <Plus className="w-3 h-3" />
                  প্রোডাক্ট যোগ
                </Button>
              )}
            </div>

            {isEditing && showAddProduct && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="প্রোডাক্ট সার্চ করুন..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {storeProducts
                    .filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()) || p.slug.includes(productSearch.toLowerCase()))
                    .map(p => (
                    <button
                      key={p.id}
                      onClick={() => { addProductFromStore(p.id); setProductSearch(''); }}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left transition-colors"
                    >
                      <img src={p.images[0] + '&w=40&h=40&fit=crop'} alt={p.title} className="w-8 h-8 rounded object-cover border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">৳{p.price.toLocaleString()}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))}
                  {storeProducts.filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
                  )}
                </div>
              </div>
            )}

            {/* Variation picker (add new product OR edit existing item's variant) */}
            {isEditing && pendingVariationProduct && (
              <div className="border rounded-lg p-3 space-y-3 bg-primary/5">
                <p className="text-xs font-semibold">
                  {pendingVariationProduct.title} — ভেরিয়েন্ট {editVariantIndex !== null ? 'পরিবর্তন' : 'বাছুন'}
                </p>
                {pendingVariationProduct.colors && pendingVariationProduct.colors.length > 0 && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">কালার</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pendingVariationProduct.colors.map(c => (
                        <button key={c} onClick={() => setPendingVariations(prev => ({ ...prev, কালার: c }))} className={`px-2.5 py-1 rounded-full text-xs border transition-all ${pendingVariations['কালার'] === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}
                {pendingVariationProduct.sizes && pendingVariationProduct.sizes.length > 0 && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">সাইজ</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pendingVariationProduct.sizes.map(s => (
                        <button key={s} onClick={() => setPendingVariations(prev => ({ ...prev, সাইজ: s }))} className={`px-2.5 py-1 rounded-full text-xs border transition-all ${pendingVariations['সাইজ'] === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {pendingVariationProduct.weights && pendingVariationProduct.weights.length > 0 && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">কেজি/ওজন</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pendingVariationProduct.weights.map(w => (
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
            {currentItems.map((item, i) => (
              <div key={i} className="space-y-1">
                  <div className="flex items-center gap-3 py-1">
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover border" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    {item.variations && Object.keys(item.variations).length > 0 && (
                      <p className="text-[13px] font-medium text-foreground">{Object.entries(item.variations).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                    )}
                    {isEditing ? (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input type="number" min={1} value={item.qty} onChange={(e) => updateItemQty(i, Math.max(1, parseInt(e.target.value) || 1))} className="h-7 w-14 text-xs" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">৳</span>
                          <Input type="number" min={0} value={item.price} onChange={(e) => updateItemPrice(i, Math.max(0, parseInt(e.target.value) || 0))} className="h-7 w-20 text-xs" />
                        </div>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startEditItemVariant(i)} title="ভেরিয়েন্ট পরিবর্তন">
                          <Pencil className="w-3 h-3" /> ভেরিয়েন্ট
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">×{item.qty}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-medium">৳{(item.price * item.qty).toLocaleString()}</span>
                    {item.price < item.originalPrice && (
                      <p className="text-xs text-muted-foreground line-through">৳{(item.originalPrice * item.qty).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {item.price < item.originalPrice && (
                  <div className="ml-[60px] p-2 bg-amber-50 border border-amber-200 rounded text-xs space-y-1">
                    <div className="flex items-start gap-1.5 text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p>অরিজিনাল প্রাইস: <strong>৳{item.originalPrice.toLocaleString()}</strong> → বর্তমান: <strong>৳{item.price.toLocaleString()}</strong> (ডিসকাউন্ট: ৳{(item.originalPrice - item.price).toLocaleString()})</p>
                        {item.discountNote && <p className="mt-1"><StickyNote className="w-3 h-3 inline mr-1" />কারণ: {item.discountNote}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {isEditing && discountNoteIndex === i && item.price < item.originalPrice && (
                  <div className="ml-[60px] space-y-1">
                    <Label className="text-xs text-amber-700 flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      প্রাইস কমানোর কারণ লিখুন *
                    </Label>
                    <Textarea
                      value={item.discountNote || ''}
                      onChange={(e) => updateItemNote(i, e.target.value)}
                      placeholder="যেমন: কাস্টমারের অনুরোধে ১০% ডিসকাউন্ট দেওয়া হয়েছে"
                      className="text-xs min-h-[60px]"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Price summary */}
            <div className="space-y-1 pt-2 border-t text-xs">
              <div className="flex justify-between"><span>সাবটোটাল</span><span>৳{currentSubtotal.toLocaleString()}</span></div>
              <div className="flex justify-between items-center">
                <span>ডেলিভারি চার্জ</span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span>৳</span>
                    <Input type="number" min={0} value={editData.deliveryCharge} onChange={(e) => updateDeliveryCharge(Math.max(0, parseInt(e.target.value) || 0))} className="h-7 w-20 text-xs text-right" />
                  </div>
                ) : (
                  <div className="text-right">
                    <span>৳{currentDelivery}</span>
                    {order.deliveryCharge < order.originalDeliveryCharge && (
                      <span className="ml-2 line-through text-muted-foreground">৳{order.originalDeliveryCharge}</span>
                    )}
                  </div>
                )}
              </div>

              {!isEditing && order.deliveryCharge < order.originalDeliveryCharge && order.deliveryDiscountNote && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-start gap-1.5 text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p>ডেলিভারি অরিজিনাল: <strong>৳{order.originalDeliveryCharge}</strong> → বর্তমান: <strong>৳{order.deliveryCharge}</strong></p>
                      <p className="mt-0.5"><StickyNote className="w-3 h-3 inline mr-1" />কারণ: {order.deliveryDiscountNote}</p>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && showDeliveryNote && editData.deliveryCharge < editData.originalDeliveryCharge && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs text-amber-700 flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    ডেলিভারি চার্জ কমানোর কারণ *
                  </Label>
                  <Textarea
                    value={editData.deliveryDiscountNote}
                    onChange={(e) => setEditData(p => ({ ...p, deliveryDiscountNote: e.target.value }))}
                    placeholder="যেমন: কাস্টমারকে ফ্রি ডেলিভারি দেওয়া হয়েছে"
                    className="text-xs min-h-[60px]"
                  />
                </div>
              )}

              {totalDiscount > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>মোট ডিসকাউন্ট</span>
                  <span>-৳{totalDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between pt-1 border-t font-bold text-sm">
                <span>মোট</span>
                <span>৳{currentTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Activity & Status */}
          <div className="border-t pt-3 space-y-2">
            <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">একটিভিটি</h4>
            {courierSent ? (
              (() => {
                const sf = sfOrderData[order.id];
                const statusInfo = sf?.steadfast_status ? (steadfastStatusMap[sf.steadfast_status] || { label: sf.steadfast_status, color: 'bg-muted text-muted-foreground' }) : null;
                const trackingUrl = sf?.tracking_code ? buildSteadfastTrackingUrl(sf.tracking_code) : null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-orange-500" />
                      <span className="text-muted-foreground text-xs">কুরিয়ার স্ট্যাটাস:</span>
                      {statusInfo && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                      )}
                    </div>
                    {sf?.consignment_id && (
                      <p className="text-xs text-muted-foreground">CID: <span className="font-mono">{sf.consignment_id}</span></p>
                    )}
                    {trackingUrl && (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> ট্র্যাক করুন
                      </a>
                    )}
                    {isEditing && canEditStatus && (
                      <div className="pt-1">
                        <Label className="text-xs text-amber-700">স্ট্যাটাস পরিবর্তন (ক্যান্সেল অর্ডার)</Label>
                        <Select value={editData.status} onValueChange={(val) => setEditData(p => ({ ...p, status: val }))}>
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {editableStatusOptions.map(s => (
                              <SelectItem key={s} value={s}>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[s]}`}>{s}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2">
                {/* Inline status change (view mode) */}
                {!isEditing && onStatusChange && editableStatusOptions.includes(order.status) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">স্ট্যাটাস:</span>
                    <Select value={order.status} onValueChange={(val) => onStatusChange(order.id, val)}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editableStatusOptions.map(s => (
                          <SelectItem key={s} value={s}>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[s]}`}>{s}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : isEditing && canEditStatus ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">স্ট্যাটাস</Label>
                    <Select value={editData.status} onValueChange={(val) => setEditData(p => ({ ...p, status: val }))}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editableStatusOptions.map(s => (
                          <SelectItem key={s} value={s}>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[s]}`}>{s}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">স্ট্যাটাস:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>{order.status}</span>
                  </div>
                )}
              </div>
            )}
            <div><span className="text-muted-foreground">তারিখ:</span> {order.date}</div>
            {order.confirmedBy && <div><span className="text-muted-foreground">কনফার্ম করেছেন:</span> {order.confirmedBy}</div>}
            {order.manualTrackingUrl && !courierSent && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground text-xs">ম্যানুয়াল ট্র্যাকিং:</span>
                <a href={order.manualTrackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> ট্র্যাক করুন
                </a>
              </div>
            )}
          </div>

          {/* Note Section */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">নোট</h4>
              {!showNoteInput && onNoteChange && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setNoteText(order.note || ''); setShowNoteInput(true); }}>
                  <MessageSquarePlus className="w-3 h-3" /> {order.note ? 'এডিট নোট' : 'নোট দিন'}
                </Button>
              )}
            </div>
            {order.note && !showNoteInput && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <StickyNote className="w-3 h-3 inline mr-1" />{order.note}
              </div>
            )}
            {showNoteInput && onNoteChange && (
              <div className="space-y-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="অর্ডার সম্পর্কে নোট লিখুন..."
                  className="text-xs min-h-[60px]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowNoteInput(false)}>বাতিল</Button>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                    onNoteChange(order.id, noteText.trim());
                    setShowNoteInput(false);
                    // Force update the local note display immediately
                    order.note = noteText.trim() || undefined;
                    toast.success(noteText.trim() ? 'নোট সেভ হয়েছে' : 'নোট মুছে ফেলা হয়েছে');
                  }}>
                    <StickyNote className="w-3 h-3" /> সেভ
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailDialog;
