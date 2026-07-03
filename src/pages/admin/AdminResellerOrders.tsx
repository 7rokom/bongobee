import { useState, useMemo, useEffect, useRef } from 'react';
import { useCourierRatioStore } from '@/stores/useCourierRatioStore';
import { useResellerStore, type ResellerOrder } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Eye, CalendarIcon, Send, RefreshCw, Loader2, Phone, Copy, MessageCircle, Truck, Package, ExternalLink, ShieldAlert, CheckSquare, Edit, Plus, Trash2, StickyNote, ShieldBan, CheckCircle2, UserCheck, UserPlus } from 'lucide-react';
import { findCustomerHistory, hasCustomerHistory, collectCustomerIdentifiers } from '@/lib/customer-history';
import { CustomerHistoryDialog } from '@/components/CustomerHistoryDialog';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import CourierDeliveryChargePopup, { type FreeDeliveryOrderInfo } from '@/components/admin/CourierDeliveryChargePopup';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useSteadfastStore } from '@/stores/useSteadfastStore';
import { useCarrybeeStore } from '@/stores/useCarrybeeStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { useFollowUpStore, type OrderStockType } from '@/stores/useFollowUpStore';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { useBlockStore } from '@/stores/useBlockStore';
import { useAdminStore } from '@/stores/useAdminStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useIncompleteOrderStore } from '@/stores/useIncompleteOrderStore';
import { normalizePhone } from '@/lib/order-validation';
import { api } from '@/lib/api';
import { buildSteadfastTrackingUrl, buildCarrybeeTrackingUrl } from '@/lib/courier-links';
import ManualSmsDialog from '@/components/admin/ManualSmsDialog';
import { buildResellerOrderVars } from '@/lib/bulksms';
import { checkSelfStockForItems, formatStockProblems } from '@/lib/check-self-stock';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

type DateFilter = 'all' | 'custom';

const STATUS_OPTIONS = [
  'পেন্ডিং', 'হোল্ড', 'কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ',
  'ডেলিভারড', 'ক্যান্সেল', 'রিটার্নিং', 'রিটার্ন', 'পেইড রিটার্নিং', 'পেইড রিটার্ন',
];

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-400 text-yellow-950',
  'হোল্ড': 'bg-amber-400 text-amber-950',
  'কনফার্মড': 'bg-blue-500 text-white',
  'প্যাকেজিং': 'bg-indigo-500 text-white',
  'শিপমেন্ট': 'bg-purple-500 text-white',
  'এসাইন': 'bg-teal-500 text-white',
  'ফলোয়াপ': 'bg-cyan-400 text-cyan-950',
  'ডেলিভারির পথে': 'bg-cyan-500 text-white',
  'ডেলিভারড': 'bg-green-500 text-white',
  'রিটার্নিং': 'bg-rose-400 text-rose-950',
  'রিটার্ন': 'bg-orange-500 text-white',
  'পেইড রিটার্নিং': 'bg-fuchsia-400 text-fuchsia-950',
  'পেইড রিটার্ন': 'bg-pink-500 text-white',
  'ক্যান্সেল': 'bg-red-500 text-white',
  'ড্রাফট': 'bg-slate-400 text-white',
};

const AdminResellerOrders = () => {
  const { orders, resellers, updateResellerOrderStatus, addResellerOrder, updateResellerOrder, assignResellerOrder, unassignResellerOrder, deleteResellerOrder } = useResellerStore();
  const employees = useEmployeeStore((s) => s.employees);
  const { products } = useProductStore();
  const userRole = useAdminStore((s) => s.userRole);
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const isAdmin = userRole === 'admin';
  const currentEmployee = useMemo(() => employees.find(e => e.email === adminEmail), [employees, adminEmail]);
  const { blockCustomerFull, isPhoneBlocked, blockedList, unblockCustomer, fetchBlocked } = useBlockStore();
  const mainOrders = useOrderStore((s) => s.orders);
  const incompleteOrders = useIncompleteOrderStore((s) => s.orders);
  const [historyForOrderId, setHistoryForOrderId] = useState<string | null>(null);

  const isReturningResellerCustomer = (o: ResellerOrder) =>
    hasCustomerHistory(o.id, { phone: o.customerPhone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.customerAddress }, mainOrders, orders);
  const getResellerHistory = (o: ResellerOrder) =>
    findCustomerHistory(o.id, { phone: o.customerPhone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.customerAddress }, mainOrders, orders);

  // Look up IP + fingerprint for a customer by matching phone in main orders / incomplete orders
  // Look up IP + fingerprint for a customer by matching phone across reseller orders,
  // main orders and incomplete orders.
  const getCustomerIdentifiersByPhone = (phone: string) => {
    const normalized = normalizePhone(phone) || phone;
    // 1. Reseller orders themselves (now store customerIp / customerFingerprint)
    const resellerMatch = orders.find(
      (o) =>
        (normalizePhone(o.customerPhone) || o.customerPhone) === normalized &&
        (o.customerIp || o.customerFingerprint)
    );
    if (resellerMatch?.customerIp || resellerMatch?.customerFingerprint) {
      return { ip: resellerMatch.customerIp, fingerprint: resellerMatch.customerFingerprint };
    }
    // 2. Main orders
    const main = mainOrders.find(
      (o) => (normalizePhone(o.phone) || o.phone) === normalized && (o.customerIp || o.customerFingerprint)
    );
    if (main?.customerIp || main?.customerFingerprint) {
      return { ip: main.customerIp, fingerprint: main.customerFingerprint };
    }
    // 3. Incomplete orders
    const inc = incompleteOrders.find(
      (o) => (normalizePhone(o.phone) || o.phone) === normalized && (o.customerIp || o.customerFingerprint)
    );
    return { ip: inc?.customerIp, fingerprint: inc?.customerFingerprint };
  };

  // DB fallback: query the Laravel API when in-memory stores don't have the identifiers
  // (e.g. pagination, not yet loaded, or order created on another device).
  const fetchIdentifiersFromDb = async (phone: string): Promise<{ ip?: string; fingerprint?: string }> => {
    const normalized = normalizePhone(phone) || phone;
    try {
      const res = await api.get(`/admin/customer-devices?phone=${encodeURIComponent(normalized)}`);
      if (res && (res.ip || res.fingerprint)) {
        return { ip: res.ip || undefined, fingerprint: res.fingerprint || undefined };
      }
    } catch (e) {
      console.warn('[fetchIdentifiersFromDb] error:', e);
    }
    return {};
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resellerFilter, setResellerFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [viewOrder, setViewOrder] = useState<ResellerOrder | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Paid return popup state
  const [paidReturnOrder, setPaidReturnOrder] = useState<ResellerOrder | null>(null);
  const [paidReturnAmount, setPaidReturnAmount] = useState<number>(0);

  // Note dialog state (unified admin+reseller note like main orders)
  const [noteOrder, setNoteOrder] = useState<ResellerOrder | null>(null);
  const [noteText, setNoteText] = useState('');

  // Edit order state
  const [editOrder, setEditOrder] = useState<ResellerOrder | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editDeliveryCharge, setEditDeliveryCharge] = useState(0);
  const [editPackagingCharge, setEditPackagingCharge] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<ResellerOrder['items']>([]);
  const [showAddProductSearch, setShowAddProductSearch] = useState(false);
  const [addProductSearch, setAddProductSearch] = useState('');
  const [pendingVariationProduct, setPendingVariationProduct] = useState<any>(null);
  const [pendingVariations, setPendingVariations] = useState<Record<string, string>>({});
  const [editVariantIndex, setEditVariantIndex] = useState<number | null>(null);

  const computeVariationPrice = (p: any, vars: Record<string, string>) => {
    let price = Number(p.price);
    if (p.variationPrices && p.variationPrices.length > 0) {
      for (const vp of p.variationPrices) {
        const key = vp.variationType === 'color' ? 'কালার' : vp.variationType === 'size' ? 'সাইজ' : 'কেজি/ওজন';
        if (vars[key] === vp.variationName && vp.price) { price = Number(vp.price); break; }
      }
    }
    return price;
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
      setEditItems(prev => prev.map((it: any, i) => i === editVariantIndex ? {
        ...it, selectedColor, selectedSize, selectedWeight,
        selectedVariations: pendingVariations,
        sellingPrice, resellerPrice, profit: sellingPrice - resellerPrice,
      } : it));
      toast.success('ভেরিয়েন্ট আপডেট হয়েছে');
    } else {
      setEditItems(prev => [...prev, {
        productId: p.id, productTitle: p.title,
        image: p.featuredImage || p.images?.[0] || '/placeholder.svg',
        qty: 1, resellerPrice, sellingPrice, profit: sellingPrice - resellerPrice,
        selectedColor, selectedSize, selectedWeight, selectedVariations: pendingVariations,
        buyPrice: typeof p.buyPrice === 'number' ? p.buyPrice : undefined,
      } as any]);
    }
    setPendingVariationProduct(null);
    setPendingVariations({});
    setEditVariantIndex(null);
  };

  const startEditItemVariant = (index: number) => {
    const item: any = editItems[index];
    if (!item?.productId) { toast.error('প্রোডাক্ট আইডি পাওয়া যায়নি'); return; }
    const product: any = products.find((p: any) => p.id === item.productId);
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

  // Courier ratio check (shared store)
  const courierData = useCourierRatioStore((s) => s.data);
  const loadCourierCache = useCourierRatioStore((s) => s.loadCache);
  const checkCourierRatioAction = useCourierRatioStore((s) => s.checkRatio);
  useEffect(() => { loadCourierCache(); }, [loadCourierCache]);
  useEffect(() => { fetchBlocked(); }, []);
  const fraudSettings = useFraudSettingsStore();

  // Auto-assign new pending reseller orders to active team members in round-robin.
  // Respects per-employee assigned/hidden reseller lists:
  //  - An employee is only auto-assigned an order if assignedResellerIds includes the order's resellerId
  //  - hiddenResellerIds are excluded entirely
  //  - If no employee has the order's reseller assigned, the order is left unassigned
  const autoAssignedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activeEmployees = employees.filter(e => e.isActive && e.permissions?.includes('resellers'));
    if (activeEmployees.length === 0) return;
    const unassignedPending = orders.filter(o =>
      o.status === 'পেন্ডিং' && !o.assignedTo && !autoAssignedRef.current.has(o.id)
    );
    if (unassignedPending.length === 0) return;

    let index = parseInt(localStorage.getItem('reseller-auto-assign-index') || '0');
    (async () => {
      try {
        const { api } = await import('@/lib/api');
        const counterRow = await api.get('/admin/counter/reseller_auto_assign_index');
        if (counterRow && typeof counterRow.value === 'number') index = counterRow.value;
      } catch { /* ignore */ }
    })();

    let didAssign = false;
    unassignedPending.forEach(order => {
      // Eligible: not hidden AND explicitly assigned this reseller
      const eligible = activeEmployees.filter(e => {
        const hidden = e.hiddenResellerIds || [];
        const assigned = e.assignedResellerIds || [];
        if (hidden.includes(order.resellerId)) return false;
        if (assigned.length === 0) return false; // no assignments => never auto-assign
        return assigned.includes(order.resellerId);
      });
      if (eligible.length === 0) {
        // Mark as processed so we don't re-check every render
        autoAssignedRef.current.add(order.id);
        return;
      }
      const emp = eligible[index % eligible.length];
      assignResellerOrder(order.id, emp.id, emp.name);
      autoAssignedRef.current.add(order.id);
      index++;
      didAssign = true;
    });

    if (!didAssign) return;
    const newIndex = index;
    localStorage.setItem('reseller-auto-assign-index', String(newIndex));
    (async () => {
      try {
        const { api } = await import('@/lib/api');
        await api.put('/admin/counter/reseller_auto_assign_index', { value: newIndex });
      } catch { /* ignore */ }
    })();
  }, [orders, employees, assignResellerOrder]);

  // Bulk actions
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showBulkCourierPicker, setShowBulkCourierPicker] = useState(false);

  // Delete confirmation (double confirm) — admin only, পেন্ডিং only
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<ResellerOrder | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const handleDeleteOrder = (order: ResellerOrder) => {
    if (!isAdmin) { toast.error('শুধু অ্যাডমিন ডিলিট করতে পারবে'); return; }
    if (order.status !== 'পেন্ডিং') { toast.error('শুধু পেন্ডিং অর্ডার ডিলিট করা যাবে'); return; }
    setDeleteConfirmOrder(order);
    setDeleteConfirmStep(1);
  };
  const confirmDeleteStep = async () => {
    if (deleteConfirmStep === 1) { setDeleteConfirmStep(2); return; }
    if (deleteConfirmStep === 2 && deleteConfirmOrder) {
      try {
        await deleteResellerOrder(deleteConfirmOrder.id);
        toast.success(`অর্ডার ${deleteConfirmOrder.id} ডিলিট হয়েছে`);
      } catch (e: any) {
        toast.error('ডিলিট ব্যর্থ: ' + (e?.message || ''));
      }
      setDeleteConfirmOrder(null);
      setDeleteConfirmStep(0);
    }
  };

  // Courier stores
  const { settings: sfSettings, orderData: sfOrderData, setOrderData: setSfOrderData } = useSteadfastStore();
  const { settings: cbSettings, orderData: cbOrderData, setOrderData: setCbOrderData } = useCarrybeeStore();
  useLazyFetch([
    useSteadfastStore.getState().fetchSettings,
    useSteadfastStore.getState().fetchDispatchData,
    useCarrybeeStore.getState().fetchSettings,
    useCarrybeeStore.getState().fetchDispatchData,
  ]);
  const [sendingToSf, setSendingToSf] = useState<Set<string>>(new Set());
  const [sendingToCb, setSendingToCb] = useState<Set<string>>(new Set());
  const [manualSmsOrder, setManualSmsOrder] = useState<ResellerOrder | null>(null);
  const smsHoldTemplates = useSiteSettingsStore((s) => s.smsHoldTemplates) || [];
  const smsFollowupTemplates = useSiteSettingsStore((s) => s.smsFollowupTemplates) || [];
  const getResellerManualSmsTemplates = (order: ResellerOrder) => {
    const reseller = resellers.find((r) => r.id === order.resellerId);
    const customFollowup = reseller?.smsFollowupTemplate?.trim();
    if (order.status === 'ফলোয়াপ' && customFollowup) return [{ name: 'রিসেলার সেটিং', body: customFollowup }];
    return order.status === 'হোল্ড' ? smsHoldTemplates : smsFollowupTemplates;
  };
  const [courierPickerOrder, setCourierPickerOrder] = useState<ResellerOrder | null>(null);
  const [manualCourierOrder, setManualCourierOrder] = useState<string | null>(null);
  const [manualCourierName, setManualCourierName] = useState('');
  const [manualTrackingLink, setManualTrackingLink] = useState('');
  const [manualCourierStockType, setManualCourierStockType] = useState<OrderStockType>('self');
  const [manualVendorBuyPrice, setManualVendorBuyPrice] = useState('');
  const [directDeliveredOrder, setDirectDeliveredOrder] = useState<string | null>(null);
  const [editTrackingOrder, setEditTrackingOrder] = useState<string | null>(null);
  const [editTrackingUrl, setEditTrackingUrl] = useState('');
  const [editCourierName, setEditCourierName] = useState('');
  const [editTrackingStockType, setEditTrackingStockType] = useState<OrderStockType>('self');
  const [editTrackingVendorPrice, setEditTrackingVendorPrice] = useState('');

  // API courier stock-type prompt (asked before sending to Steadfast/CarryBee)
  const [apiCourierPromptOrder, setApiCourierPromptOrder] = useState<{ order: ResellerOrder; provider: 'steadfast' | 'carrybee' } | null>(null);
  const [apiCourierStockType, setApiCourierStockType] = useState<OrderStockType>('self');
  const [apiCourierVendorPrice, setApiCourierVendorPrice] = useState('');

  // Vendor badge buy-price prompt (when toggling stock type to vendor inline)
  const [vendorPricePromptOrder, setVendorPricePromptOrder] = useState<ResellerOrder | null>(null);
  const [vendorPromptPrice, setVendorPromptPrice] = useState('');
  const setStockType = useFollowUpStore((s) => s.setStockType);
  const setVendorBuyPrice = useFollowUpStore((s) => s.setVendorBuyPrice);
  const stockTypes = useFollowUpStore((s) => s.stockTypes);
  const setCourierDeliveryCharge = useFollowUpStore((s) => s.setCourierDeliveryCharge);
  const courierDeliveryCharges = useFollowUpStore((s) => s.courierDeliveryCharges);
  // Subscribe so component re-renders when manual/api courier info changes
  const courierNames = useFollowUpStore((s) => s.courierNames);
  const trackingUrls = useFollowUpStore((s) => s.trackingUrls);
  const allProducts = useProductStore((s) => s.products);
  const defaultCourier: string = 'none';

  // Free-delivery courier charge popup state
  const [pendingDeliveryChargeOrders, setPendingDeliveryChargeOrders] = useState<FreeDeliveryOrderInfo[]>([]);
  const [pendingDeliveryChargeAction, setPendingDeliveryChargeAction] = useState<(() => void) | null>(null);

  const resellerOrderKeyHelper = (id: string) => `reseller-${id}`;
  const needsDeliveryCharge = (order: ResellerOrder) => {
    const key = resellerOrderKeyHelper(order.id);
    return (order.deliveryCharge ?? 0) <= 0 && !(courierDeliveryCharges[key] > 0);
  };
  const requireDeliveryCharge = (orderList: ResellerOrder[], action: () => void) => {
    const missing = orderList.filter(needsDeliveryCharge);
    if (missing.length === 0) { action(); return; }
    setPendingDeliveryChargeOrders(missing.map((o) => ({
      orderId: o.id,
      storeKey: resellerOrderKeyHelper(o.id),
      customerName: o.customerName,
    })));
    setPendingDeliveryChargeAction(() => action);
  };
  const handleDeliveryChargeSubmit = (charges: Record<string, number>) => {
    Object.entries(charges).forEach(([k, c]) => setCourierDeliveryCharge(k, c));
    const action = pendingDeliveryChargeAction;
    setPendingDeliveryChargeOrders([]);
    setPendingDeliveryChargeAction(null);
    if (action) setTimeout(action, 0);
  };
  const handleDeliveryChargeCancel = () => {
    setPendingDeliveryChargeOrders([]);
    setPendingDeliveryChargeAction(null);
  };

  // ভেন্ডর সেট করলে অটো buy price সেভ
  const setStockTypeWithBuyPrice = (key: string, type: OrderStockType, order: ResellerOrder) => {
    setStockType(key, type);
    if (type === 'vendor') {
      let totalBuyPrice = 0;
      order.items.forEach((item: any) => {
        const matchedProduct = allProducts.find(p => p.id === item.productId || p.title === item.productTitle);
        totalBuyPrice += (matchedProduct?.buyPrice || 0) * (item.qty || 1);
      });
      setVendorBuyPrice(key, totalBuyPrice);
    }
  };

  // Compute auto vendor buy price for a reseller order based on product buyPrice × qty
  const computeAutoVendorPrice = (order: ResellerOrder) => {
    let total = 0;
    order.items.forEach((item: any) => {
      const mp = allProducts.find(p => p.id === item.productId || p.title === item.productTitle);
      total += (mp?.buyPrice || 0) * (item.qty || 1);
    });
    return total;
  };

  // Open the API courier stock-type prompt
  const openApiCourierPrompt = (order: ResellerOrder, provider: 'steadfast' | 'carrybee') => {
    setApiCourierStockType('self');
    setApiCourierVendorPrice(String(computeAutoVendorPrice(order)));
    setApiCourierPromptOrder({ order, provider });
  };

  const checkCourierRatio = (phone: string) => {
    checkCourierRatioAction(phone, fraudSettings.bdcourierApiKey || undefined, true);
  };

  // Courier ratio bar component (same as main orders)
  const CourierFraudInline = ({ phone }: { phone: string }) => {
    const data = courierData[normalizePhone(phone) || phone];
    if (!data || data.loading) return null;
    if (!data.all && !data.delivered && !data.returned) return (
      <span className="text-[10px] text-muted-foreground ml-1">ডাটা নেই</span>
    );
    const pct = data.all > 0 ? Math.round((data.delivered / data.all) * 100) : 0;
    return (
      <div className="w-full mt-1">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px]">
          <span className="text-foreground font-semibold">all: {data.all}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-green-600 font-semibold">delivered: {data.delivered}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-red-600 font-semibold">return: {data.returned}</span>
        </div>
      </div>
    );
  };

  const parseOrderDate = (d: string) => {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const getDateRangeForFilter = (filter: DateFilter) => {
    const now = new Date();
    switch (filter) {
      case 'all': return null;
      case 'custom': return { start: customStart ? startOfDay(customStart) : startOfDay(now), end: customEnd ? endOfDay(customEnd) : endOfDay(now) };
    }
  };

  const dateRange = useMemo(() => getDateRangeForFilter(dateFilter), [dateFilter, customStart, customEnd]);



  const filtered = useMemo(() => {
    // Hidden resellers for the currently logged-in non-admin team member
    const hiddenResellerSet = !isAdmin && currentEmployee?.hiddenResellerIds?.length
      ? new Set(currentEmployee.hiddenResellerIds)
      : null;
    return orders.filter((o) => {
      if (hiddenResellerSet && hiddenResellerSet.has(o.resellerId)) return false;
      // Non-admin: hide পেন্ডিং / হোল্ড orders assigned to another team member
      if (!isAdmin && currentEmployee) {
        const isPendingOrHold = o.status === 'পেন্ডিং' || o.status === 'হোল্ড';
        if (isPendingOrHold && o.assignedTo && o.assignedTo !== currentEmployee.id) return false;
      }
      const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase()) ||
        o.customerPhone.includes(search) ||
        o.resellerName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchReseller = resellerFilter === 'all' || o.resellerId === resellerFilter;
      let matchDate = true;
      if (dateRange) {
        const d = parseOrderDate(o.date);
        matchDate = d ? d >= dateRange.start && d <= dateRange.end : false;
      }
      return matchSearch && matchStatus && matchReseller && matchDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, search, statusFilter, resellerFilter, dateRange, isAdmin, currentEmployee]);

  // Pagination — 20 per page
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    // Reset to page 1 whenever filters change or the result set shrinks below current page
    if (currentPage > totalPages) setCurrentPage(1);
  }, [filtered.length, totalPages, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, resellerFilter, dateRange]);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const stats = useMemo(() => {
    const hiddenResellerSet = !isAdmin && currentEmployee?.hiddenResellerIds?.length
      ? new Set(currentEmployee.hiddenResellerIds)
      : null;
    let base = hiddenResellerSet ? orders.filter(o => !hiddenResellerSet.has(o.resellerId)) : orders;
    if (!isAdmin && currentEmployee) {
      base = base.filter(o => {
        const isPendingOrHold = o.status === 'পেন্ডিং' || o.status === 'হোল্ড';
        return !(isPendingOrHold && o.assignedTo && o.assignedTo !== currentEmployee.id);
      });
    }
    const total = base.length;
    const pending = base.filter(o => o.status === 'পেন্ডিং').length;
    const hold = base.filter(o => o.status === 'হোল্ড').length;
    const confirmed = base.filter(o => o.status === 'কনফার্মড').length;
    const packaging = base.filter(o => o.status === 'প্যাকেজিং').length;
    const shipment = base.filter(o => o.status === 'শিপমেন্ট').length;
    const assigned = base.filter(o => o.status === 'এসাইন').length;
    const followup = base.filter(o => o.status === 'ফলোয়াপ').length;
    const delivered = base.filter(o => o.status === 'ডেলিভারড').length;
    const cancelled = base.filter(o => o.status === 'ক্যান্সেল').length;
    const returning = base.filter(o => o.status === 'রিটার্নিং').length;
    const returned = base.filter(o => o.status === 'রিটার্ন').length;
    const paidReturning = base.filter(o => o.status === 'পেইড রিটার্নিং').length;
    const paidReturn = base.filter(o => o.status === 'পেইড রিটার্ন').length;
    const totalAmount = base.reduce((s, o) => s + o.totalSellingPrice, 0);
    const totalProfit = base.filter(o => o.status === 'ডেলিভারড').reduce((s, o) => s + o.totalProfit, 0);
    return { total, pending, hold, confirmed, packaging, shipment, assigned, followup, delivered, cancelled, returning, returned, paidReturning, paidReturn, totalAmount, totalProfit };
  }, [orders, isAdmin, currentEmployee]);

  const handleStatusChange = (orderId: string, newStatus: string) => {
    const stockKey = resellerOrderKey(orderId);
    if (newStatus === 'ডেলিভারড' && !isSentToCourier(orderId) && !stockTypes[stockKey]) {
      setDirectDeliveredOrder(orderId);
      return;
    }
    // Paid return popup
    if (newStatus === 'পেইড রিটার্ন') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setPaidReturnOrder(order);
        setPaidReturnAmount(0);
      }
      return;
    }
    // When reverting to কনফার্মড, clear stock type so user can re-select.
    // NOTE: courier data (consignment + tracking link + courier name) is intentionally
    // preserved so the tracking link stays visible across status changes.
    if (newStatus === 'কনফার্মড') {
      const key = resellerOrderKey(orderId);
      useFollowUpStore.getState().removeStockType(key);
    }
    const confirmerName = currentEmployee?.name || 'অ্যাডমিন';
    updateResellerOrderStatus(orderId, newStatus, confirmerName);
    // Auto-rebalance: ফাস্ট মেম্বারের কাছে স্লো মেম্বারের পেন্ডিং অর্ডার ট্রান্সফার
    if (newStatus === 'কনফার্মড' && currentEmployee?.id) {
      setTimeout(() => {
        import('@/lib/auto-reassign').then(({ autoReassignToFastWorker }) => autoReassignToFastWorker(currentEmployee.id));
      }, 800);
    }
    toast.success(`অর্ডার স্ট্যাটাস "${newStatus}" এ পরিবর্তন হয়েছে`);
  };

  const handlePaidReturnConfirm = async () => {
    if (!paidReturnOrder) return;
    const order = paidReturnOrder;
    const deliveryCharge = order.deliveryCharge || 0;
    const packagingCharge = order.packagingCharge || 0;
    const totalCharges = deliveryCharge + packagingCharge;

    // Update status
    await updateResellerOrderStatus(order.id, 'পেইড রিটার্ন');

    // Persist paid_return_amount on the order so reports can compute the
    // reseller balance adjustment from it. The diff between paid amount and
    // total charges credits/debits the reseller's own balance — courier and
    // vendor payments are NOT touched for reseller order returns.
    await api.post('/rs/reseller-orders/update', { code: order.id, paid_return_amount: paidReturnAmount });
    useResellerStore.setState((s) => ({
      orders: s.orders.map(o => o.id === order.id ? { ...o, paidReturnAmount: paidReturnAmount } : o),
    }));

    const target = 'রিসেলার ব্যালেন্স';
    const diff = paidReturnAmount - totalCharges;
    if (diff > 0) {
      toast.success(`পেইড রিটার্ন সম্পন্ন। ৳${diff} ${target}-এ যোগ হবে`);
    } else if (diff < 0) {
      toast.success(`পেইড রিটার্ন সম্পন্ন। ৳${Math.abs(diff)} ${target} থেকে কাটা হবে`);
    } else {
      toast.success(`পেইড রিটার্ন সম্পন্ন। কোনো পরিবর্তন নেই`);
    }

    setPaidReturnOrder(null);
    setPaidReturnAmount(0);
  };

  // Bulk status change
  const handleBulkStatusChange = (status: string) => {
    if (selectedOrders.size === 0) { toast.error('কোনো অর্ডার সিলেক্ট করা হয়নি'); return; }
    selectedOrders.forEach(id => {
      if (status === 'ডেলিভারড') {
        const stockKey = resellerOrderKey(id);
        if (!isSentToCourier(id) && !stockTypes[stockKey]) {
          setStockType(stockKey, 'self');
        }
      }
      updateResellerOrderStatus(id, status, currentEmployee?.name || 'অ্যাডমিন');
    });
    toast.success(`${selectedOrders.size}টি অর্ডার "${status}" এ পরিবর্তন হয়েছে`);
    setSelectedOrders(new Set());
    setBulkAction('');
  };

  // Bulk send to courier
  const handleBulkSendToCourier = (courierType: 'steadfast' | 'carrybee') => {
    if (selectedOrders.size === 0) { toast.error('কোনো অর্ডার সিলেক্ট করা হয়নি'); return; }
    const ordersToSend = orders.filter(o => selectedOrders.has(o.id) && !isSentToCourier(o.id));
    if (ordersToSend.length === 0) { toast.error('সিলেক্ট করা অর্ডারগুলো ইতিমধ্যে কুরিয়ারে পাঠানো হয়েছে'); return; }
    requireDeliveryCharge(ordersToSend, () => {
      ordersToSend.forEach(order => {
        if (courierType === 'steadfast') sendToSteadfast(order, { stockType: 'self' });
        else sendToCarrybee(order, { stockType: 'self' });
      });
      setShowBulkCourierPicker(false);
      setSelectedOrders(new Set());
    });
  };

  // Customer block helpers (admin only)
  // Collect every IP / fingerprint we've ever seen for a customer by matching
  // phone OR address across main orders, reseller orders and incomplete orders.
  const gatherAllIdentifiers = (phone: string, address?: string, orderObj?: ResellerOrder) => {
    const ref = {
      phone,
      address: address || orderObj?.customerAddress,
      ip: orderObj?.customerIp,
      fingerprint: orderObj?.customerFingerprint,
    };
    return collectCustomerIdentifiers(ref, mainOrders as any, orders as any, incompleteOrders as any);
  };

  const handleBlockResellerCustomer = async (phone: string, customerName: string, orderObj?: ResellerOrder) => {
    if (!isAdmin) { toast.error('শুধুমাত্র অ্যাডমিন ব্লক করতে পারবেন'); return; }
    const normalized = normalizePhone(phone) || phone;
    const { ips, fingerprints } = gatherAllIdentifiers(normalized, orderObj?.customerAddress, orderObj);
    if (ips.length === 0 && fingerprints.length === 0) {
      const dbFound = await fetchIdentifiersFromDb(normalized);
      if (dbFound.ip) ips.push(dbFound.ip);
      if (dbFound.fingerprint) fingerprints.push(dbFound.fingerprint);
    }
    try {
      await blockCustomerFull({ phone: normalized, ips, fingerprints, customerName, reason: 'রিসেলার অর্ডার থেকে ব্লক' });
      const parts = ['ফোন'];
      if (ips.length) parts.push(`${ips.length} IP`);
      if (fingerprints.length) parts.push(`${fingerprints.length} ডিভাইস`);
      toast.success(`${customerName}-কে ব্লক করা হয়েছে (${parts.join(' + ')})`);
    } catch {
      toast.error(`${customerName}-কে ব্লক করা যায়নি। পরে আবার চেষ্টা করুন।`);
    }
  };

  const handleUnblockResellerCustomer = async (phone: string, customerName: string, orderObj?: ResellerOrder) => {
    if (!isAdmin) { toast.error('শুধুমাত্র অ্যাডমিন আনব্লক করতে পারবেন'); return; }
    const normalized = normalizePhone(phone) || phone;
    const { ips, fingerprints } = gatherAllIdentifiers(normalized, orderObj?.customerAddress, orderObj);
    const matchingEntries = blockedList.filter(b =>
      (b.type === 'phone' && (b.value === normalized || b.value === phone)) ||
      (b.type === 'ip' && ips.includes(b.value)) ||
      (b.type === 'fingerprint' && fingerprints.includes(b.value))
    );
    const handledGroups = new Set<string>();
    for (const entry of matchingEntries) {
      if (entry.linked_group) {
        if (handledGroups.has(entry.linked_group)) continue;
        handledGroups.add(entry.linked_group);
        await useBlockStore.getState().unblockGroup(entry.linked_group);
      } else {
        await unblockCustomer(entry.id);
      }
    }
    toast.success(`${customerName}-কে আনব্লক করা হয়েছে`);
  };

  const handleBulkBlockResellerCustomers = async () => {
    if (!isAdmin) { toast.error('শুধুমাত্র অ্যাডমিন বাল্ক ব্লক করতে পারবেন'); return; }
    if (selectedOrders.size === 0) { toast.error('কোনো অর্ডার সিলেক্ট করা হয়নি'); return; }
    let count = 0;
    for (const id of Array.from(selectedOrders)) {
      const order = orders.find(o => o.id === id);
      if (!order) continue;
      const normalized = normalizePhone(order.customerPhone) || order.customerPhone;
      if (isPhoneBlocked(normalized)) continue;
      const { ips, fingerprints } = gatherAllIdentifiers(normalized, order.customerAddress, order);
      if (ips.length === 0 && fingerprints.length === 0) {
        const dbFound = await fetchIdentifiersFromDb(normalized);
        if (dbFound.ip) ips.push(dbFound.ip);
        if (dbFound.fingerprint) fingerprints.push(dbFound.fingerprint);
      }
      try {
        await blockCustomerFull({ phone: normalized, ips, fingerprints, customerName: order.customerName, reason: 'বাল্ক ব্লক (রিসেলার অর্ডার)' });
        count++;
      } catch { /* skip failed entry; continue blocking others */ }
    }
    if (count > 0) toast.success(`${count}টি কাস্টমার ব্লক করা হয়েছে`);
    else toast.info('সিলেক্ট করা সকল কাস্টমার ইতিমধ্যে ব্লক করা আছে');
    setSelectedOrders(new Set());
  };


  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('bn-BD'); } catch { return d; }
  };

  const isNewOrder = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return (Date.now() - d.getTime()) / (1000 * 60 * 60) <= 24;
    } catch { return false; }
  };

  // Edit order functions
  const openEditOrder = (order: ResellerOrder) => {
    setEditOrder(order);
    setEditCustomerName(order.customerName);
    setEditCustomerPhone(order.customerPhone);
    setEditCustomerAddress(order.customerAddress);
    setEditDeliveryCharge(order.deliveryCharge);
    setEditPackagingCharge(order.packagingCharge || 0);
    setEditNotes((order.notes || []).join('\n'));
    setEditItems(order.items.map(item => ({ ...item })));
    setShowAddProductSearch(false);
    setAddProductSearch('');
    setPendingVariationProduct(null);
    setPendingVariations({});
    setEditVariantIndex(null);
  };

  const saveEditOrder = async () => {
    if (!editOrder) return;
    if (editItems.length === 0) { toast.error('অন্তত একটি প্রোডাক্ট থাকতে হবে'); return; }
    const updatedOrder: ResellerOrder = {
      ...editOrder,
      customerName: editCustomerName,
      customerPhone: editCustomerPhone,
      customerAddress: editCustomerAddress,
      deliveryCharge: editDeliveryCharge,
      packagingCharge: editPackagingCharge,
      items: editItems,
      notes: editNotes.trim() ? editNotes.trim().split('\n') : [],
    };
    // Recalculate totals
    const subtotalSelling = updatedOrder.items.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
    const subtotalDP = updatedOrder.items.reduce((s, i) => s + i.resellerPrice * i.qty, 0);
    const codCharge = Math.ceil((subtotalSelling * 1) / 100);
    updatedOrder.totalSellingPrice = subtotalSelling;
    updatedOrder.totalResellerCost = subtotalDP;
    updatedOrder.codCharge = codCharge;
    updatedOrder.totalProfit = subtotalSelling - subtotalDP - editDeliveryCharge - editPackagingCharge - codCharge;

    // Update via API
    let error: any = null;
    try {
      await api.post('/rs/reseller-orders/update', {
        code: editOrder.id,
        customer_name: updatedOrder.customerName,
        customer_phone: updatedOrder.customerPhone,
        customer_address: updatedOrder.customerAddress,
        delivery_charge: updatedOrder.deliveryCharge,
        packaging_charge: updatedOrder.packagingCharge,
        cod_charge: updatedOrder.codCharge,
        total_selling_price: updatedOrder.totalSellingPrice,
        total_reseller_cost: updatedOrder.totalResellerCost,
        total_profit: updatedOrder.totalProfit,
        notes: updatedOrder.notes,
        items: updatedOrder.items,
      });
    } catch (e) { error = e; }

    if (!error) {
      // Update local state
      useResellerStore.setState((s) => ({
        orders: s.orders.map(o => o.id === editOrder.id ? updatedOrder : o),
      }));
      toast.success('অর্ডার আপডেট হয়েছে');
      setEditOrder(null);
      // Also update viewOrder if it's the same
      if (viewOrder?.id === editOrder.id) setViewOrder(updatedOrder);
    } else {
      toast.error('আপডেট ব্যর্থ হয়েছে');
    }
  };

  // Courier functions (Laravel proxy → Steadfast / CarryBee APIs)
  const callSteadfast = async (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { ...payload };
    if (sfSettings.apiKey) body.apiKey = sfSettings.apiKey;
    if (sfSettings.secretKey) body.secretKey = sfSettings.secretKey;
    return await api.post('/admin/courier/steadfast', body);
  };

  const callCarrybee = async (payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { ...payload };
    if (cbSettings.clientId) body.clientId = cbSettings.clientId;
    if (cbSettings.clientSecret) body.clientSecret = cbSettings.clientSecret;
    if (cbSettings.clientContext) body.clientContext = cbSettings.clientContext;
    return await api.post('/admin/courier/carrybee', body);
  };

  const resellerOrderKey = (id: string) => `reseller-${id}`;

  const sendToSteadfast = async (order: ResellerOrder, opts?: { stockType?: OrderStockType; vendorBuyPrice?: number }) => {
    const key = resellerOrderKey(order.id);
    if (sfOrderData[key]?.consignment_id) { toast.error('ইতিমধ্যে পাঠানো হয়েছে'); return; }
    if ((opts?.stockType || 'self') === 'self') {
      const check = checkSelfStockForItems(order.items as any[], key);
      if (!check.ok) {
        toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
        return;
      }
    }
    setSendingToSf(prev => new Set(prev).add(order.id));
    try {
      const itemDesc = order.items.map(i => `${i.productTitle} x${i.qty}`).join(', ');
      const data = await callSteadfast({
        action: 'create_order', invoice: order.id.replace('#', ''),
        recipient_name: order.customerName, recipient_phone: order.customerPhone,
        recipient_address: order.customerAddress, cod_amount: order.totalSellingPrice,
        note: `রিসেলার: ${order.resellerName}`, item_description: itemDesc,
      });
      if (data.status === 200 && data.consignment) {
        const chosenStock: OrderStockType = opts?.stockType || 'self';
        setStockType(key, chosenStock);
        if (chosenStock === 'vendor' && opts?.vendorBuyPrice && opts.vendorBuyPrice > 0) {
          setVendorBuyPrice(key, opts.vendorBuyPrice);
        }
        setSfOrderData(key, {
          consignment_id: data.consignment.consignment_id, tracking_code: data.consignment.tracking_code,
          steadfast_status: data.consignment.status || 'in_review', sent_at: new Date().toISOString(),
        });
        // Always persist courier name so the badge survives refresh, even if Steadfast
        // hasn't generated a tracking_code yet (it often arrives later via status sync).
        useFollowUpStore.getState().setCourierName(key, 'Steadfast');
        if (data.consignment.tracking_code) {
          useFollowUpStore.getState().setTrackingUrl(key, buildSteadfastTrackingUrl(data.consignment.tracking_code));
        }
        // No fallback to consignment_id — Steadfast's public tracking page only accepts tracking_code.
        updateResellerOrderStatus(order.id, 'প্যাকেজিং');
        toast.success(`অর্ডার ${order.id} Steadfast-এ পাঠানো হয়েছে ✅`);
      } else {
        toast.error(`ব্যর্থ: ${data.message || JSON.stringify(data)}`);
      }
    } catch { toast.error('Steadfast-এ পাঠাতে সমস্যা'); }
    finally { setSendingToSf(prev => { const n = new Set(prev); n.delete(order.id); return n; }); }
  };

  const sendToCarrybee = async (order: ResellerOrder, opts?: { stockType?: OrderStockType; vendorBuyPrice?: number }) => {
    const key = resellerOrderKey(order.id);
    if (cbOrderData[key]?.consignment_id) { toast.error('ইতিমধ্যে পাঠানো হয়েছে'); return; }
    if (!cbSettings.clientId) { toast.error('CarryBee API কনফিগার করা হয়নি'); return; }
    if ((opts?.stockType || 'self') === 'self') {
      const check = checkSelfStockForItems(order.items as any[], key);
      if (!check.ok) {
        toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
        return;
      }
    }
    setSendingToCb(prev => new Set(prev).add(order.id));
    try {
      let storeId = cbSettings.defaultStoreId;
      if (!storeId) {
        const storesData = await callCarrybee({ action: 'get_stores' });
        if (!storesData.error && storesData.data?.stores?.length > 0) {
          const activeStore = storesData.data.stores.find((s: any) => s.is_active && s.is_approved) || storesData.data.stores[0];
          storeId = activeStore.id;
          useCarrybeeStore.getState().updateSettings({ defaultStoreId: String(storeId) });
        } else {
          toast.error('CarryBee স্টোর পাওয়া যায়নি — Setup-এ স্টোর তৈরি করুন');
          return;
        }
      }
      let cityId = cbSettings.defaultCityId || 0;
      let zoneId = cbSettings.defaultZoneId || 0;
      if (order.customerAddress && order.customerAddress.length >= 10) {
        try {
          const addrData = await callCarrybee({ action: 'address_details', query: order.customerAddress });
          if (!addrData.error && addrData.data?.city_id && addrData.data?.zone_id) {
            cityId = addrData.data.city_id;
            zoneId = addrData.data.zone_id;
          }
        } catch { /* fallback */ }
      }
      if (!cityId || !zoneId) { cityId = cityId || 14; zoneId = zoneId || 5; }
      const itemDesc = order.items.map(i => `${i.productTitle} x${i.qty}`).join(', ').slice(0, 250);
      const totalQty = order.items.reduce((s, i) => s + i.qty, 0) || 1;
      const phone = normalizePhone(order.customerPhone) || order.customerPhone;
      const codAmount = Math.max(0, Math.min(100000, Math.round(order.totalSellingPrice || 0)));
      const data = await callCarrybee({
        action: 'create_order',
        store_id: storeId,
        merchant_order_id: order.id.replace('#', '').slice(0, 49),
        delivery_type: 1,
        product_type: 1,
        recipient_name: order.customerName.slice(0, 99),
        recipient_phone: phone,
        recipient_address: order.customerAddress.slice(0, 200),
        city_id: cityId,
        zone_id: zoneId,
        collectable_amount: codAmount,
        product_description: itemDesc,
        item_quantity: Math.min(200, totalQty),
        item_weight: 500,
      });
      if (!data.error && data.data?.order?.consignment_id) {
        const chosenStock: OrderStockType = opts?.stockType || 'self';
        setStockType(key, chosenStock);
        if (chosenStock === 'vendor' && opts?.vendorBuyPrice && opts.vendorBuyPrice > 0) {
          setVendorBuyPrice(key, opts.vendorBuyPrice);
        }
        setCbOrderData(key, {
          consignment_id: data.data.order.consignment_id, transfer_status: 'Order Created', sent_at: new Date().toISOString(),
          store_id: storeId,
        });
        useFollowUpStore.getState().setTrackingUrl(key, buildCarrybeeTrackingUrl(data.data.order.consignment_id));
        useFollowUpStore.getState().setCourierName(key, 'CarryBee');
        updateResellerOrderStatus(order.id, 'প্যাকেজিং');
        toast.success(`অর্ডার ${order.id} CarryBee-তে পাঠানো হয়েছে ✅`);
      } else {
        let detail = data.message || data.error || '';
        if (data.causes && typeof data.causes === 'object') {
          const causeMsgs = Object.entries(data.causes).map(([field, errs]: any) => {
            const types = Array.isArray(errs) ? errs.map((e: any) => e?.type).filter(Boolean).join(',') : '';
            return `${field}(${types})`;
          });
          if (causeMsgs.length) detail = `${detail} — ${causeMsgs.join('; ')}`;
        }
        if (!detail) detail = JSON.stringify(data).slice(0, 200);
        console.error('CarryBee create_order failed:', data);
        toast.error(`ব্যর্থ: ${detail}`, { duration: 8000 });
      }
    } catch { toast.error('CarryBee-তে পাঠাতে সমস্যা'); }
    finally { setSendingToCb(prev => { const n = new Set(prev); n.delete(order.id); return n; }); }
  };

  const handleSendToCourier = (order: ResellerOrder) => {
    requireDeliveryCharge([order], () => {
      if (defaultCourier === 'steadfast') sendToSteadfast(order);
      else if (defaultCourier === 'carrybee') sendToCarrybee(order);
      else setCourierPickerOrder(order);
    });
  };

  const isSentToCourier = (orderId: string) => {
    const key = resellerOrderKey(orderId);
    return !!sfOrderData[key]?.consignment_id
      || !!cbOrderData[key]?.consignment_id
      || !!sfOrderData[orderId]?.consignment_id
      || !!cbOrderData[orderId]?.consignment_id
      || !!courierNames[key]
      || !!trackingUrls[key];
  };

  const getCourierInfo = (orderId: string) => {
    const key = resellerOrderKey(orderId);
    // Backward-compat: older rows may have been stored with the raw order id
    // (no "reseller-" prefix). Fall back to that if the prefixed key is empty.
    const sf = sfOrderData[key] || sfOrderData[orderId];
    const cb = cbOrderData[key] || cbOrderData[orderId];
    const followUp = useFollowUpStore.getState();
    const customTracking = followUp.trackingUrls[key] || followUp.trackingUrls[orderId];
    const customCourierName = followUp.courierNames[key] || followUp.courierNames[orderId];
    if (sf?.consignment_id) {
      if (sf.steadfast_status === 'manual') {
        return { type: customCourierName || 'ম্যানুয়াল কুরিয়ার', cid: '', tracking: customTracking || '', status: 'manual' };
      }
      const auto = buildSteadfastTrackingUrl(sf.tracking_code);
      return { type: customCourierName || 'steadfast', cid: sf.consignment_id, tracking: customTracking || auto, status: sf.steadfast_status };
    }
    if (cb?.consignment_id) {
      return { type: customCourierName || 'carrybee', cid: cb.consignment_id, tracking: customTracking || buildCarrybeeTrackingUrl(cb.consignment_id), status: cb.transfer_status };
    }
    if (customTracking || customCourierName) {
      const cidFromTracking = customTracking?.match(/order-track\/([^/?#]+)/)?.[1] || customTracking?.split('/').filter(Boolean).pop() || '';
      return { type: customCourierName || 'Courier', cid: cidFromTracking || 'N/A', tracking: customTracking || '', status: undefined };
    }
    return null;
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const getPriceBreakdown = (order: ResellerOrder) => {
    const subtotalSelling = order.items.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
    const subtotalDP = order.items.reduce((s, i) => s + i.resellerPrice * i.qty, 0);
    const deliveryCharge = order.deliveryCharge || 0;
    const packagingCharge = order.packagingCharge || 0;
    const codCharge = order.codCharge || Math.ceil((subtotalSelling * 1) / 100);
    const profit = subtotalSelling - subtotalDP - deliveryCharge - packagingCharge - codCharge;
    return { subtotalSelling, subtotalDP, deliveryCharge, packagingCharge, codCharge, profit };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">রিসেলার অর্ডার</h1>
        <ImportExportButtons
          data={orders} filename="reseller-orders" label="রিসেলার অর্ডার"
          onImport={(items: any[]) => { const store = useResellerStore.getState(); items.forEach(o => { if (!orders.find(eo => eo.id === o.id)) store.addResellerOrder(o); }); }}
        />
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {[
          { key: 'all', label: 'মোট অর্ডার', count: stats.total, active: 'bg-blue-500 text-white', inactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
          { key: 'পেন্ডিং', label: 'পেন্ডিং', count: stats.pending, active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
          { key: 'হোল্ড', label: 'হোল্ড', count: stats.hold, active: 'bg-gray-500 text-white', inactive: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' },
          { key: 'কনফার্মড', label: 'কনফার্মড', count: stats.confirmed, active: 'bg-blue-500 text-white', inactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
          { key: 'প্যাকেজিং', label: 'প্যাকেজিং', count: stats.packaging, active: 'bg-indigo-500 text-white', inactive: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
          { key: 'শিপমেন্ট', label: 'শিপমেন্ট', count: stats.shipment, active: 'bg-purple-500 text-white', inactive: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
          { key: 'এসাইন', label: 'এসাইন', count: stats.assigned, active: 'bg-teal-500 text-white', inactive: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
          { key: 'ফলোয়াপ', label: 'ফলোয়াপ', count: stats.followup, active: 'bg-cyan-500 text-white', inactive: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100' },
          { key: 'ডেলিভারড', label: 'ডেলিভারড', count: stats.delivered, active: 'bg-green-500 text-white', inactive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
          { key: 'ক্যান্সেল', label: 'ক্যান্সেল', count: stats.cancelled, active: 'bg-red-500 text-white', inactive: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
          { key: 'রিটার্নিং', label: 'রিটার্নিং', count: stats.returning, active: 'bg-rose-500 text-white', inactive: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
          { key: 'রিটার্ন', label: 'রিটার্ন', count: stats.returned, active: 'bg-orange-500 text-white', inactive: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
          { key: 'পেইড রিটার্নিং', label: 'পেইড রিটার্নিং', count: stats.paidReturning, active: 'bg-fuchsia-500 text-white', inactive: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100' },
          { key: 'পেইড রিটার্ন', label: 'পেইড রিটার্ন', count: stats.paidReturn, active: 'bg-pink-500 text-white', inactive: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
        ].map((s) => {
          const isActive = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(isActive && s.key !== 'all' ? 'all' : s.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all whitespace-nowrap',
                isActive
                  ? `${s.active} border-transparent shadow-md`
                  : s.inactive
              )}
            >
              <span className="font-bold">{s.count}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="অর্ডার, কাস্টমার বা রিসেলার খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={resellerFilter} onValueChange={setResellerFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="রিসেলার ফিল্টার" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব রিসেলার</SelectItem>
            {resellers.filter(r => isAdmin || !currentEmployee?.hiddenResellerIds?.includes(r.id)).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn('gap-2', !customStart && 'text-muted-foreground')}><CalendarIcon className="w-4 h-4" />{customStart ? format(customStart, 'dd/MM/yyyy') : 'শুরু তারিখ'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customStart} onSelect={(d) => { setCustomStart(d); setDateFilter('custom'); }} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
        <span className="text-muted-foreground">—</span>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className={cn('gap-2', !customEnd && 'text-muted-foreground')}><CalendarIcon className="w-4 h-4" />{customEnd ? format(customEnd, 'dd/MM/yyyy') : 'শেষ তারিখ'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customEnd} onSelect={(d) => { setCustomEnd(d); setDateFilter('custom'); }} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
        {dateFilter === 'custom' && <Button variant="ghost" size="sm" onClick={() => { setDateFilter('all'); setCustomStart(undefined); setCustomEnd(undefined); }}>রিসেট</Button>}
      </div>

      {/* Bulk Actions Bar */}
      {selectedOrders.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedOrders.size}টি সিলেক্ট করা হয়েছে</span>
          </div>
          <Select value={bulkAction} onValueChange={(v) => {
            if (v === 'courier') { setShowBulkCourierPicker(true); return; }
            handleBulkStatusChange(v);
          }}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="বাল্ক একশন" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>স্ট্যাটাস: {s}</SelectItem>)}
              <SelectItem value="courier">🚚 কুরিয়ারে পাঠান</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleBulkBlockResellerCustomers}>
              <ShieldBan className="w-3.5 h-3.5" /> বাল্ক ব্লক
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedOrders(new Set())}>সিলেকশন বাতিল</Button>
        </div>
      )}

      {/* Desktop Table */}
      <Card className="border-0 shadow-sm hidden lg:block rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] table-fixed">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground w-[32px]">
                    <Checkbox checked={pageItems.length > 0 && pageItems.every(o => selectedOrders.has(o.id))} onCheckedChange={() => { const allSelected = pageItems.length > 0 && pageItems.every(o => selectedOrders.has(o.id)); setSelectedOrders(prev => { const n = new Set(prev); if (allSelected) pageItems.forEach(o => n.delete(o.id)); else pageItems.forEach(o => n.add(o.id)); return n; }); }} className="h-3.5 w-3.5" />
                  </th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[100px]">অর্ডার</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[130px]">রিসেলার</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[200px]">কাস্টমার</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[170px]">প্রোডাক্ট</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[180px]">মূল্য</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[150px]">স্ট্যাটাস</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[130px]">একশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">কোনো রিসেলার অর্ডার পাওয়া যায়নি</td></tr>
                ) : pageItems.map((order) => {
                  const courier = getCourierInfo(order.id);
                  const pb = getPriceBreakdown(order);
                  return (
                    <tr key={order.id} className={`border-b last:border-0 hover:bg-muted/30 align-top ${selectedOrders.has(order.id) ? 'bg-primary/5' : ''}`}>
                      <td className="py-3 px-2 text-center"><Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="h-3.5 w-3.5" /></td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-primary text-sm">{order.id}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(order.date)}</p>
                        {isReturningResellerCustomer(order) ? (
                          <button onClick={() => setHistoryForOrderId(order.id)} className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors mt-0.5">
                            <UserCheck className="w-2.5 h-2.5" /> পুরাতন
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 mt-0.5">
                            <UserPlus className="w-2.5 h-2.5" /> নতুন
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          const r = resellers.find(res => res.id === order.resellerId);
                          return (
                            <div>
                              <button
                                type="button"
                                onClick={() => window.open(`/reseller?as=${order.resellerId}`, '_blank')}
                                className="font-semibold text-primary text-sm hover:underline text-left"
                                title="রিসেলার ড্যাশবোর্ড দেখুন"
                              >
                                {order.resellerName}
                              </button>
                              {r?.phone && <p className="text-[10px] text-muted-foreground">{r.phone}</p>}
                              {r?.phone && (
                                <div className="flex gap-1 mt-1">
                                  <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`tel:${r.phone}`)}><Phone className="w-2.5 h-2.5 text-foreground" /></Button>
                                  <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`https://wa.me/88${r.phone.replace(/^0/, '')}`, '_blank')}><MessageCircle className="w-2.5 h-2.5 text-foreground" /></Button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-foreground text-sm">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerAddress}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <p
                            className="text-foreground text-xs cursor-pointer hover:underline inline-flex items-center gap-0.5"
                            onClick={() => checkCourierRatio(order.customerPhone)}
                          >
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />{order.customerPhone}
                          </p>
                          {courierData[normalizePhone(order.customerPhone) || order.customerPhone]?.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </div>
                        <CourierFraudInline phone={order.customerPhone} />
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`tel:${order.customerPhone}`)}><Phone className="w-3 h-3 text-foreground" /></Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(order.customerPhone); toast.success('কপি হয়েছে'); }}><Copy className="w-3 h-3 text-foreground" /></Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(`https://wa.me/88${order.customerPhone}`, '_blank')}><MessageCircle className="w-3 h-3 text-foreground" /></Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="দেখুন" onClick={() => setViewOrder(order)}><Eye className="w-3 h-3 text-foreground" /></Button>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" title="এডিট" onClick={() => openEditOrder(order)}><Edit className="w-3 h-3 text-foreground" /></Button>
                          {isAdmin && order.status === 'পেন্ডিং' && (
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-destructive/40 hover:bg-destructive/10" title="ডিলিট" onClick={() => handleDeleteOrder(order)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                          )}
                        </div>
                        {/* Courier tracking UI moved to action column */}
                        {/* Note preview moved to action column */}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1.5">
                          {order.items.map((item: any, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <img src={item.image} alt="" className="w-9 h-9 rounded object-cover border" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{item.productTitle}</p>
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
                      {/* Price breakdown */}
                      <td className="py-3 px-3">
                        <div className="text-[12px] space-y-0">
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">সেলিং প্রাইজ:</span><span>৳{pb.subtotalSelling}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">- DP প্রাইজ:</span><span>৳{pb.subtotalDP}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">- ডেলিভারি চার্জ:</span><span>৳{pb.deliveryCharge}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">- প্যাকেজিং চার্জ:</span><span>৳{pb.packagingCharge}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">- COD চার্জ (১%):</span><span>৳{pb.codCharge}</span></div>
                          <div className="flex justify-between gap-2 border-t mt-1 pt-1 font-bold text-green-600"><span>প্রফিট:</span><span>৳{pb.profit}</span></div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {['ডেলিভারড', 'পেইড রিটার্ন'].includes(order.status) ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status] || ''}`}>{order.status} 🔒</span>
                        ) : (
                        <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}><span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[s] || ''}`}>{s}</span></SelectItem>))}</SelectContent>
                        </Select>
                        )}
                        {/* Assign employee */}
                        <div className="mt-1">
                          <Select value={order.assignedTo || ''} disabled={order.status !== 'পেন্ডিং'} onValueChange={(val) => {
                            if (order.status !== 'পেন্ডিং') { toast.error('শুধু পেন্ডিং অর্ডার এসাইন করা যাবে'); return; }
                            if (val === '__unassign__') { unassignResellerOrder(order.id); return; }
                            const emp = employees.find(e => e.id === val);
                            if (emp) assignResellerOrder(order.id, emp.id, emp.name);
                          }}>
                            <SelectTrigger className="h-6 text-[10px] w-[120px]"><SelectValue placeholder="এসাইন..." /></SelectTrigger>
                            <SelectContent>
                              {order.assignedTo && <SelectItem value="__unassign__">অ্যাসাইন সরান</SelectItem>}
                              {employees.filter(e => e.isActive !== false).map(e => (
                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {order.source && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              সোর্স: <span className="font-semibold text-foreground">{order.source}</span>
                            </p>
                          )}
                          {(() => {
                            const isAssignable = order.status === 'পেন্ডিং' || order.status === 'হোল্ড';
                            if (isAssignable && order.assignedToName) {
                              return <p className="text-[10px] text-muted-foreground mt-0.5">অ্যাসাইন: <span className="font-semibold text-foreground">{order.assignedToName}</span></p>;
                            }
                            if (!isAssignable) {
                              const actor = order.confirmedBy || order.assignedToName;
                              if (actor) return <p className="text-[10px] text-muted-foreground mt-0.5">{order.status}: <span className="font-semibold text-foreground">{actor}</span></p>;
                            }
                            return null;
                          })()}
                          {order.smsSent && Object.keys(order.smsSent).length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 mt-1" title={Object.keys(order.smsSent).join(', ')}>
                              <CheckCircle2 className="w-2.5 h-2.5" /> SMS: Done
                            </span>
                          )}
                        </div>
                        {/* Stock Type Badge */}
                        {(isSentToCourier(order.id) || ['ডেলিভারড','রিটার্ন','পেইড রিটার্ন'].includes(order.status)) && (() => {
                          const key = resellerOrderKey(order.id);
                          const current = stockTypes[key] || 'self';
                          return (
                            <div className="mt-1 flex gap-1" title="স্টক টাইপ — সেলফ হলে স্টক থেকে কাটবে, রিটার্নে আবার যোগ হবে">
                              <button
                                className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition ${current === 'self' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                onClick={() => { setStockType(key, 'self'); toast.success('সেলফ স্টক সেট'); }}
                              >সেলফ</button>
                              <button
                                className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition ${current === 'vendor' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                onClick={() => {
                                  const existing = useFollowUpStore.getState().vendorBuyPrices[key];
                                  setVendorPromptPrice(String(existing && existing > 0 ? existing : computeAutoVendorPrice(order)));
                                  setVendorPricePromptOrder(order);
                                }}
                              >ভেন্ডর</button>
                            </div>
                          );
                        })()}
                        {/* Courier tracking UI moved to customer column for parity with main orders */}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isSentToCourier(order.id) ? (
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="কুরিয়ারে পাঠান"
                              onClick={() => setCourierPickerOrder(order)} disabled={sendingToSf.has(order.id) || sendingToCb.has(order.id)}>
                              {(sendingToSf.has(order.id) || sendingToCb.has(order.id)) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4 text-orange-500" />}
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="সিঙ্ক" disabled><RefreshCw className="w-4 h-4 text-green-500" /></Button>
                          )}
                          <Button
                            variant="outline" size="sm" className="h-7 w-7 p-0 border-amber-300 hover:bg-amber-50"
                            title="নোট"
                            onClick={() => { setNoteOrder(order); setNoteText((order.notes || []).join('\n')); }}
                          >
                            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                          {isAdmin && (
                            isPhoneBlocked(normalizePhone(order.customerPhone) || order.customerPhone) ? (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-destructive/30 bg-destructive/10" title="আনব্লক করুন"
                                onClick={() => handleUnblockResellerCustomer(order.customerPhone, order.customerName, order)}>
                                <ShieldBan className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="কাস্টমার ব্লক"
                                onClick={() => handleBlockResellerCustomer(order.customerPhone, order.customerName, order)}>
                                <ShieldBan className="w-3.5 h-3.5 text-foreground" />
                              </Button>
                            )
                          )}
                          {(order.status === 'হোল্ড' || order.status === 'ফলোয়াপ') && (
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-emerald-300 hover:bg-emerald-50"
                              title="SMS পাঠান" onClick={() => setManualSmsOrder(order)}>
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                        {courier && (
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] text-muted-foreground font-medium">
                                {courier.type === 'carrybee' || courier.type === 'CarryBee' ? 'CarryBee' : (courier.type === 'steadfast' ? 'Steadfast' : courier.type)}{courier.cid ? ` • CID: ${courier.cid}` : ''}
                              </p>
                              <button
                                className="text-blue-500 hover:text-blue-700"
                                title="ট্র্যাকিং এডিট"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const key = resellerOrderKey(order.id);
                                  const followUp = useFollowUpStore.getState();
                                  setEditTrackingOrder(order.id);
                                  setEditTrackingUrl(followUp.trackingUrls[key] || courier.tracking || '');
                                  setEditCourierName(followUp.courierNames[key] || (courier.type === 'steadfast' ? 'Steadfast' : 'CarryBee'));
                                  const curStock = (followUp.stockTypes[key] || 'self') as OrderStockType;
                                  setEditTrackingStockType(curStock);
                                  const curPrice = followUp.vendorBuyPrices[key];
                                  setEditTrackingVendorPrice(curPrice && curPrice > 0 ? String(curPrice) : '');
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            </div>
                            {courier.tracking && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 gap-1 text-[10px] px-2 border-orange-300 hover:bg-orange-50 text-orange-600"
                                onClick={(e) => { e.stopPropagation(); window.open(courier.tracking, '_blank'); }}
                              >
                                <Truck className="w-3 h-3" /> কুরিয়ার ট্র্যাক
                              </Button>
                            )}
                          </div>
                        )}
                        {(order.notes && order.notes.length > 0) && (
                          <p className="text-[9px] text-amber-600 mt-1 truncate max-w-[160px]" title={order.notes[order.notes.length - 1]}>
                            📝 {order.notes[order.notes.length - 1]}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {pageItems.map((order) => {
          const courier = getCourierInfo(order.id);
          const r = resellers.find(res => res.id === order.resellerId);
          const pb = getPriceBreakdown(order);
          return (
            <Card key={order.id} className="shadow-sm rounded-xl border">
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="h-3.5 w-3.5 mt-1" />
                    <div>
                      <span className="font-bold text-primary text-sm">{order.id}</span>
                      <p className="text-[10px] text-muted-foreground">{formatDate(order.date)}</p>
                      {isReturningResellerCustomer(order) ? (
                        <button onClick={() => setHistoryForOrderId(order.id)} className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 mt-0.5">
                          <UserCheck className="w-2.5 h-2.5" /> পুরাতন
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 mt-0.5">
                          <UserPlus className="w-2.5 h-2.5" /> নতুন
                        </span>
                      )}
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => window.open(`/reseller?as=${order.resellerId}`, '_blank')}
                          className="text-xs font-medium text-primary hover:underline"
                          title="রিসেলার ড্যাশবোর্ড দেখুন"
                        >
                          {order.resellerName}
                        </button>
                        {r?.phone && (
                          <div className="flex gap-1 mt-0.5">
                            <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`tel:${r.phone}`)}><Phone className="w-2.5 h-2.5" /></Button>
                            <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`https://wa.me/88${r.phone.replace(/^0/, '')}`, '_blank')}><MessageCircle className="w-2.5 h-2.5" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{order.customerName}</p>
                    <button className="text-[10px] text-muted-foreground hover:text-primary hover:underline" onClick={() => checkCourierRatio(order.customerPhone)}>
                      <Phone className="w-2.5 h-2.5 inline mr-0.5" />{order.customerPhone}
                    </button>
                    {courierData[normalizePhone(order.customerPhone) || order.customerPhone]?.loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground inline ml-1" />}
                    {courierData[normalizePhone(order.customerPhone) || order.customerPhone] && !courierData[normalizePhone(order.customerPhone) || order.customerPhone].loading && (() => {
                      const d = courierData[normalizePhone(order.customerPhone) || order.customerPhone];
                      const pct = d.all > 0 ? Math.round((d.delivered / d.all) * 100) : 0;
                      return d.all || d.delivered || d.returned ? (
                        <div className="mt-0.5">
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center gap-1 text-[9px] justify-end mt-0.5">
                            <span>all: {d.all}</span>
                            <span className="text-green-600">✓{d.delivered}</span>
                            <span className="text-red-600">✗{d.returned}</span>
                          </div>
                        </div>
                      ) : <span className="text-[9px] text-muted-foreground block">ডাটা নেই</span>;
                    })()}
                    <div className="flex gap-1 mt-1 justify-end">
                      <Button variant="outline" size="sm" className="h-5 w-5 p-0" title="কপি" onClick={() => { navigator.clipboard.writeText(order.customerPhone); toast.success('কপি হয়েছে'); }}><Copy className="w-2.5 h-2.5" /></Button>
                      <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`tel:${order.customerPhone}`)}><Phone className="w-2.5 h-2.5" /></Button>
                      <Button variant="outline" size="sm" className="h-5 w-5 p-0" onClick={() => window.open(`https://wa.me/88${order.customerPhone}`, '_blank')}><MessageCircle className="w-2.5 h-2.5" /></Button>
                      <Button variant="outline" size="sm" className="h-5 w-5 p-0" title="দেখুন" onClick={() => setViewOrder(order)}><Eye className="w-2.5 h-2.5" /></Button>
                      <Button variant="outline" size="sm" className="h-5 w-5 p-0" title="এডিট" onClick={() => openEditOrder(order)}><Edit className="w-2.5 h-2.5" /></Button>
                      {isAdmin && order.status === 'পেন্ডিং' && (
                        <Button variant="outline" size="sm" className="h-5 w-5 p-0 border-destructive/40 hover:bg-destructive/10" title="ডিলিট" onClick={() => handleDeleteOrder(order)}>
                          <Trash2 className="w-2.5 h-2.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t pt-2 space-y-1.5">
                  {order.items.map((item: any, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={item.image} alt="" className="w-8 h-8 rounded object-cover border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.productTitle}</p>
                        <p className="text-[10px] text-muted-foreground">×{item.qty}</p>
                        {(() => {
                          const knownKeys = ['কালার', 'color', 'সাইজ', 'size', 'ওজন', 'weight'];
                          const extraVars = item.selectedVariations ? Object.entries(item.selectedVariations).filter(([k]) => !knownKeys.includes(k)) : [];
                          const hasAny = item.selectedColor || item.selectedSize || item.selectedWeight || extraVars.length > 0;
                          return hasAny ? (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.selectedColor && <span className="text-[9px] px-1 py-0.5 bg-pink-50 text-pink-700 rounded">{item.selectedColor}</span>}
                              {item.selectedSize && <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-700 rounded">{item.selectedSize}</span>}
                              {item.selectedWeight && <span className="text-[9px] px-1 py-0.5 bg-green-50 text-green-700 rounded">{item.selectedWeight}</span>}
                              {extraVars.map(([k, v]) => <span key={k} className="text-[9px] px-1 py-0.5 bg-purple-50 text-purple-700 rounded">{String(v)}</span>)}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  ))}
                  {/* Price breakdown mobile */}
                  <div className="text-[11px] space-y-0 border-t pt-1.5 mt-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">সেলিং প্রাইজ:</span><span>৳{pb.subtotalSelling}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- DP প্রাইজ:</span><span>৳{pb.subtotalDP}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- ডেলিভারি:</span><span>৳{pb.deliveryCharge}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- প্যাকেজিং:</span><span>৳{pb.packagingCharge}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- COD (১%):</span><span>৳{pb.codCharge}</span></div>
                    <div className="flex justify-between font-bold text-green-600 border-t mt-1 pt-1"><span>প্রফিট:</span><span>৳{pb.profit}</span></div>
                  </div>
                </div>
                <div className="border-t pt-2 flex items-center gap-2 flex-wrap">
                  {['ডেলিভারড', 'পেইড রিটার্ন'].includes(order.status) ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status] || ''}`}>{order.status} 🔒</span>
                  ) : (
                  <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-[120px]"><span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[order.status] || ''}`}>{order.status}</span></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                  )}
                  <Select value={order.assignedTo || ''} disabled={order.status !== 'পেন্ডিং'} onValueChange={(val) => {
                    if (order.status !== 'পেন্ডিং') { toast.error('শুধু পেন্ডিং অর্ডার এসাইন করা যাবে'); return; }
                    if (val === '__unassign__') { unassignResellerOrder(order.id); return; }
                    const emp = employees.find(e => e.id === val);
                    if (emp) assignResellerOrder(order.id, emp.id, emp.name);
                  }}>
                    <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue placeholder="এসাইন..." /></SelectTrigger>
                    <SelectContent>
                      {order.assignedTo && <SelectItem value="__unassign__">অ্যাসাইন সরান</SelectItem>}
                      {employees.filter(e => e.isActive !== false).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {order.source && (
                    <span className="text-[10px] text-muted-foreground">সোর্স: <span className="font-semibold">{order.source}</span></span>
                  )}
                  {(() => {
                    const isAssignable = order.status === 'পেন্ডিং' || order.status === 'হোল্ড';
                    if (isAssignable && order.assignedToName) {
                      return <span className="text-[10px] text-muted-foreground">অ্যাসাইন: <span className="font-semibold">{order.assignedToName}</span></span>;
                    }
                    if (!isAssignable) {
                      const actor = order.confirmedBy || order.assignedToName;
                      if (actor) return <span className="text-[10px] text-muted-foreground">{order.status}: <span className="font-semibold">{actor}</span></span>;
                    }
                    return null;
                  })()}
                  {order.smsSent && Object.keys(order.smsSent).length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800" title={Object.keys(order.smsSent).join(', ')}>
                      <CheckCircle2 className="w-2.5 h-2.5" /> SMS: Done
                    </span>
                  )}
                  {/* Stock Type Badge Mobile */}
                  {(isSentToCourier(order.id) || ['ডেলিভারড','রিটার্ন','পেইড রিটার্ন'].includes(order.status)) && (() => {
                    const key = resellerOrderKey(order.id);
                    const current = stockTypes[key] || 'self';
                    return (
                      <div className="flex gap-1" title="স্টক টাইপ — সেলফ হলে স্টক থেকে কাটবে, রিটার্নে আবার যোগ হবে">
                        <button
                          className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition ${current === 'self' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}
                          onClick={() => { setStockType(key, 'self'); toast.success('সেলফ স্টক সেট'); }}
                        >সেলফ</button>
                        <button
                          className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer transition ${current === 'vendor' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700'}`}
                          onClick={() => {
                            const existing = useFollowUpStore.getState().vendorBuyPrices[key];
                            setVendorPromptPrice(String(existing && existing > 0 ? existing : computeAutoVendorPrice(order)));
                            setVendorPricePromptOrder(order);
                          }}
                        >ভেন্ডর</button>
                      </div>
                    );
                  })()}
                  {!isSentToCourier(order.id) ? (
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px]" onClick={() => setCourierPickerOrder(order)}
                      disabled={sendingToSf.has(order.id) || sendingToCb.has(order.id)}>
                      <Truck className="w-3 h-3 text-orange-500" /> কুরিয়ার
                    </Button>
                  ) : courier && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {courier.type === 'carrybee' || courier.type === 'CarryBee' ? 'CarryBee' : (courier.type === 'steadfast' ? 'Steadfast' : courier.type)}{courier.cid ? ` • CID: ${courier.cid}` : ''}
                      </span>
                      {courier.tracking && (
                        <a href={courier.tracking} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" /> ট্র্যাক</a>
                      )}
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" title="ট্র্যাকিং এডিট" onClick={() => {
                        const key = resellerOrderKey(order.id);
                        const followUp = useFollowUpStore.getState();
                        setEditTrackingOrder(order.id);
                        setEditTrackingUrl(followUp.trackingUrls[key] || courier.tracking || '');
                        setEditCourierName(followUp.courierNames[key] || (courier.type === 'steadfast' ? 'Steadfast' : 'CarryBee'));
                        const curStock = (followUp.stockTypes[key] || 'self') as OrderStockType;
                        setEditTrackingStockType(curStock);
                        const curPrice = followUp.vendorBuyPrices[key];
                        setEditTrackingVendorPrice(curPrice && curPrice > 0 ? String(curPrice) : '');
                      }}>
                        <Edit className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0 border-amber-300 hover:bg-amber-50"
                    title="নোট"
                    onClick={() => { setNoteOrder(order); setNoteText((order.notes || []).join('\n')); }}
                  >
                    <StickyNote className="w-3 h-3 text-amber-500" />
                  </Button>
                  {isAdmin && (
                    isPhoneBlocked(normalizePhone(order.customerPhone) || order.customerPhone) ? (
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-destructive/30 bg-destructive/10" title="আনব্লক"
                        onClick={() => handleUnblockResellerCustomer(order.customerPhone, order.customerName, order)}>
                        <ShieldBan className="w-3 h-3 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="কাস্টমার ব্লক"
                        onClick={() => handleBlockResellerCustomer(order.customerPhone, order.customerName, order)}>
                        <ShieldBan className="w-3 h-3 text-foreground" />
                      </Button>
                    )
                  )}
                  {(order.status === 'হোল্ড' || order.status === 'ফলোয়াপ') && (
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-emerald-300 hover:bg-emerald-50"
                      title="SMS পাঠান" onClick={() => setManualSmsOrder(order)}>
                      <Send className="w-3 h-3 text-emerald-600" />
                    </Button>
                  )}
                </div>
                {order.adminNote && (
                  <div className="border-t pt-2">
                    <p className="text-[10px] text-amber-600 truncate">{order.adminNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 border-t bg-muted/20 rounded-md">
          <p className="text-xs text-muted-foreground">
            পেজ <span className="font-semibold text-foreground">{currentPage}</span> / {totalPages} — দেখাচ্ছে {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} মোট {filtered.length}টি
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</Button>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹ পূর্ববর্তী</Button>
            {(() => {
              const pages: number[] = [];
              const start = Math.max(1, currentPage - 2);
              const end = Math.min(totalPages, start + 4);
              for (let i = start; i <= end; i++) pages.push(i);
              return pages.map(p => (
                <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p)}>{p}</Button>
              ));
            })()}
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>পরবর্তী ›</Button>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
          </div>
        </div>
      )}

      {/* Courier Picker Dialog */}
      {courierPickerOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setCourierPickerOrder(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-lg">কোন কুরিয়ারে পাঠাবেন?</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Button className="w-full gap-2 justify-start h-12" variant="outline" onClick={() => { const o = courierPickerOrder; setCourierPickerOrder(null); requireDeliveryCharge([o], () => openApiCourierPrompt(o, 'steadfast')); }}>
                <Truck className="w-5 h-5 text-orange-500" /><div className="text-left"><p className="font-semibold">Steadfast</p></div>
              </Button>
              <Button className="w-full gap-2 justify-start h-12" variant="outline" onClick={() => { const o = courierPickerOrder; setCourierPickerOrder(null); requireDeliveryCharge([o], () => openApiCourierPrompt(o, 'carrybee')); }}>
                <Package className="w-5 h-5 text-blue-500" /><div className="text-left"><p className="font-semibold">CarryBee</p></div>
              </Button>
              <Button className="w-full gap-2 justify-start h-12" variant="outline" onClick={() => { const o = courierPickerOrder; setCourierPickerOrder(null); requireDeliveryCharge([o], () => setManualCourierOrder(o.id)); }}>
                <Send className="w-5 h-5 text-foreground" /><div className="text-left"><p className="font-semibold">ম্যানুয়াল কুরিয়ার</p></div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Courier Picker Dialog */}
      {showBulkCourierPicker && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setShowBulkCourierPicker(false); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-lg">{selectedOrders.size}টি অর্ডার কোন কুরিয়ারে পাঠাবেন?</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Button className="w-full gap-2 justify-start h-12" variant="outline" onClick={() => handleBulkSendToCourier('steadfast')}>
                <Truck className="w-5 h-5 text-orange-500" /><div className="text-left"><p className="font-semibold">Steadfast</p></div>
              </Button>
              <Button className="w-full gap-2 justify-start h-12" variant="outline" onClick={() => handleBulkSendToCourier('carrybee')}>
                <Package className="w-5 h-5 text-blue-500" /><div className="text-left"><p className="font-semibold">CarryBee</p></div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Courier Dialog */}
      {manualCourierOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setManualCourierOrder(null); setManualCourierName(''); setManualTrackingLink(''); setManualCourierStockType('self'); setManualVendorBuyPrice(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-lg">ম্যানুয়াল কুরিয়ার</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">স্টক টাইপ</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={manualCourierStockType === 'self' ? 'default' : 'outline'} onClick={() => { setManualCourierStockType('self'); setManualVendorBuyPrice(''); }}>সেলফ স্টক</Button>
                  <Button type="button" variant={manualCourierStockType === 'vendor' ? 'default' : 'outline'} onClick={() => {
                    setManualCourierStockType('vendor');
                    const o = orders.find(or => or.id === manualCourierOrder);
                    if (o && !manualVendorBuyPrice) setManualVendorBuyPrice(String(computeAutoVendorPrice(o)));
                  }}>ভেন্ডর স্টক</Button>
                </div>
              </div>
              {manualCourierStockType === 'vendor' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</label>
                  <Input type="number" min="0" value={manualVendorBuyPrice} onChange={(e) => setManualVendorBuyPrice(e.target.value)} placeholder="কেনা দাম লিখুন" />
                  <p className="text-[10px] text-muted-foreground">এই দাম থেকেই প্রফিট হিসাব হবে।</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">কুরিয়ার নাম</label>
                <Input value={manualCourierName} onChange={(e) => setManualCourierName(e.target.value)} placeholder="যেমন: সুন্দরবন, এস.এ পরিবহন" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">ট্র্যাকিং লিঙ্ক (ঐচ্ছিক)</label>
                <Input value={manualTrackingLink} onChange={(e) => setManualTrackingLink(e.target.value)} placeholder="https://..." />
              </div>
              <Button className="w-full" onClick={() => {
                if (!manualCourierName.trim()) { toast.error('কুরিয়ার নাম দিন'); return; }
                if (manualCourierStockType === 'vendor') {
                  const p = parseFloat(manualVendorBuyPrice);
                  if (isNaN(p) || p <= 0) { toast.error('ভেন্ডর কেনা দাম দিন'); return; }
                }
                const key = resellerOrderKey(manualCourierOrder);
                if (manualCourierStockType === 'self') {
                  const ord = orders.find(o => o.id === manualCourierOrder);
                  if (ord) {
                    const check = checkSelfStockForItems(ord.items as any[], key);
                    if (!check.ok) {
                      toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
                      return;
                    }
                  }
                }
                // Synthetic dispatch row — makes isSentToCourier() work after refresh
                setSfOrderData(key, { consignment_id: Date.now(), tracking_code: '', steadfast_status: 'manual', sent_at: new Date().toISOString() });
                const cName = manualCourierName.trim();
                const tLink = manualTrackingLink.trim();
                let vPrice: number | undefined;
                if (manualCourierStockType === 'vendor') {
                  const p = parseFloat(manualVendorBuyPrice);
                  if (!isNaN(p) && p > 0) vPrice = p;
                }
                // ONE batch save — updates in-memory atomically and fires a single API call (no concurrent race)
                useFollowUpStore.getState().batchSave(key, {
                  courier_name: cName,
                  stock_type: manualCourierStockType,
                  ...(tLink ? { tracking_url: tLink } : {}),
                  ...(vPrice !== undefined ? { vendor_buy_price: vPrice } : {}),
                });
                updateResellerOrderStatus(manualCourierOrder, 'প্যাকেজিং');
                toast.success(`${manualCourierName} কুরিয়ারে পাঠানো হয়েছে`);
                setManualCourierOrder(null); setManualCourierName(''); setManualTrackingLink(''); setManualCourierStockType('self'); setManualVendorBuyPrice('');
              }}>
                <Send className="w-4 h-4 mr-2" /> কুরিয়ারে পাঠান
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Tracking Link Dialog */}
      {editTrackingOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setEditTrackingOrder(null); setEditTrackingUrl(''); setEditCourierName(''); setEditTrackingStockType('self'); setEditTrackingVendorPrice(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-lg">ট্র্যাকিং লিঙ্ক এডিট</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">স্টক টাইপ</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={editTrackingStockType === 'self' ? 'default' : 'outline'} onClick={() => { setEditTrackingStockType('self'); setEditTrackingVendorPrice(''); }}>সেলফ স্টক</Button>
                  <Button type="button" variant={editTrackingStockType === 'vendor' ? 'default' : 'outline'} onClick={() => {
                    setEditTrackingStockType('vendor');
                    const o = orders.find(or => or.id === editTrackingOrder);
                    if (o && !editTrackingVendorPrice) {
                      const key = resellerOrderKey(o.id);
                      const existing = useFollowUpStore.getState().vendorBuyPrices[key];
                      setEditTrackingVendorPrice(String(existing && existing > 0 ? existing : computeAutoVendorPrice(o)));
                    }
                  }}>ভেন্ডর স্টক</Button>
                </div>
              </div>
              {editTrackingStockType === 'vendor' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</label>
                  <Input type="number" min="0" value={editTrackingVendorPrice} onChange={(e) => setEditTrackingVendorPrice(e.target.value)} placeholder="কেনা দাম লিখুন" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium">কুরিয়ার নাম</label>
                <Input value={editCourierName} onChange={(e) => setEditCourierName(e.target.value)} placeholder="কুরিয়ার নাম" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">ট্র্যাকিং লিঙ্ক</label>
                <Input value={editTrackingUrl} onChange={(e) => setEditTrackingUrl(e.target.value)} placeholder="https://..." />
              </div>
              <Button
                variant="outline"
                className="w-full gap-1.5 border-red-300 hover:bg-red-50 text-red-600"
                onClick={() => {
                  const id = editTrackingOrder;
                  if (!id) return;
                  const key = resellerOrderKey(id);
                  // Wipe all courier traces (both keys for backward-compat)
                  useSteadfastStore.getState().removeOrderData(key);
                  useSteadfastStore.getState().removeOrderData(id);
                  useCarrybeeStore.getState().removeOrderData(key);
                  useCarrybeeStore.getState().removeOrderData(id);
                  const fu = useFollowUpStore.getState();
                  fu.removeCourierName(key);
                  fu.removeTrackingUrl(key);
                  fu.removeStockType(key);
                  setEditTrackingOrder(null); setEditTrackingUrl(''); setEditCourierName(''); setEditTrackingStockType('self'); setEditTrackingVendorPrice('');
                  const ord = orders.find(o => o.id === id);
                  if (ord) setCourierPickerOrder(ord);
                  toast.success('কুরিয়ার তথ্য মুছে দেওয়া হয়েছে — অন্য কুরিয়ার বেছে নিন');
                }}
              >
                <Truck className="w-4 h-4" /> অন্য কুরিয়ারে পাঠান (রিসেট)
              </Button>
              <Button className="w-full" onClick={() => {
                const key = resellerOrderKey(editTrackingOrder);
                const followUp = useFollowUpStore.getState();
                if (editTrackingUrl.trim()) {
                  followUp.setTrackingUrl(key, editTrackingUrl.trim());
                } else {
                  followUp.removeTrackingUrl(key);
                }
                if (editCourierName.trim()) {
                  followUp.setCourierName(key, editCourierName.trim());
                } else {
                  followUp.removeCourierName(key);
                }
                setStockType(key, editTrackingStockType);
                if (editTrackingStockType === 'vendor') {
                  const p = parseFloat(editTrackingVendorPrice);
                  if (!isNaN(p) && p > 0) setVendorBuyPrice(key, p);
                }
                toast.success('ট্র্যাকিং লিঙ্ক আপডেট হয়েছে');
                setEditTrackingOrder(null); setEditTrackingUrl(''); setEditCourierName(''); setEditTrackingStockType('self'); setEditTrackingVendorPrice('');
              }}>
                সেভ করুন
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* API Courier Stock Type Prompt (before send to Steadfast/CarryBee) */}
      {apiCourierPromptOrder && (() => {
        const { order: apiOrder, provider } = apiCourierPromptOrder;
        const sending = provider === 'steadfast' ? sendingToSf.has(apiOrder.id) : sendingToCb.has(apiOrder.id);
        const close = () => { setApiCourierPromptOrder(null); setApiCourierStockType('self'); setApiCourierVendorPrice(''); };
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  {provider === 'steadfast' ? <Truck className="w-5 h-5 text-orange-500" /> : <Package className="w-5 h-5 text-blue-500" />}
                  স্টক টাইপ — {apiOrder.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  {provider === 'steadfast' ? 'Steadfast' : 'CarryBee'}-এ পাঠানোর আগে স্টক টাইপ সিলেক্ট করুন।
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">স্টক টাইপ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={apiCourierStockType === 'self' ? 'default' : 'outline'} onClick={() => { setApiCourierStockType('self'); }}>সেলফ স্টক</Button>
                    <Button type="button" variant={apiCourierStockType === 'vendor' ? 'default' : 'outline'} onClick={() => {
                      setApiCourierStockType('vendor');
                      if (!apiCourierVendorPrice) setApiCourierVendorPrice(String(computeAutoVendorPrice(apiOrder)));
                    }}>ভেন্ডর স্টক</Button>
                  </div>
                </div>
                {apiCourierStockType === 'vendor' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</label>
                    <Input type="number" min="0" value={apiCourierVendorPrice} onChange={(e) => setApiCourierVendorPrice(e.target.value)} placeholder="কেনা দাম লিখুন" />
                    <p className="text-[10px] text-muted-foreground">এই দাম থেকেই প্রফিট হিসাব হবে।</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={close}>বাতিল</Button>
                  <Button
                    className="gap-1.5"
                    disabled={sending || (apiCourierStockType === 'vendor' && (!apiCourierVendorPrice || parseFloat(apiCourierVendorPrice) <= 0))}
                    onClick={() => {
                      const price = apiCourierStockType === 'vendor' ? parseFloat(apiCourierVendorPrice) : undefined;
                      const o = apiOrder;
                      const p = provider;
                      const stock = apiCourierStockType;
                      close();
                      if (p === 'steadfast') sendToSteadfast(o, { stockType: stock, vendorBuyPrice: price });
                      else sendToCarrybee(o, { stockType: stock, vendorBuyPrice: price });
                    }}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} কুরিয়ারে পাঠান
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Vendor Buy Price Prompt (when toggling stock type to vendor inline) */}
      {vendorPricePromptOrder && (() => {
        const o = vendorPricePromptOrder;
        const close = () => { setVendorPricePromptOrder(null); setVendorPromptPrice(''); };
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" /> ভেন্ডর কেনা দাম — {o.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">এই অর্ডারটি ভেন্ডর স্টক হিসেবে সেট হবে। কেনা দাম দিন (এই দাম থেকেই প্রফিট হিসাব হবে):</p>
                <div className="space-y-1">
                  <label className="text-sm font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</label>
                  <Input type="number" min="0" value={vendorPromptPrice} onChange={(e) => setVendorPromptPrice(e.target.value)} placeholder="কেনা দাম লিখুন" autoFocus />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={close}>বাতিল</Button>
                  <Button
                    disabled={!vendorPromptPrice || parseFloat(vendorPromptPrice) <= 0}
                    onClick={() => {
                      const p = parseFloat(vendorPromptPrice);
                      if (isNaN(p) || p <= 0) { toast.error('সঠিক কেনা দাম দিন'); return; }
                      const key = resellerOrderKey(o.id);
                      setStockType(key, 'vendor');
                      setVendorBuyPrice(key, p);
                      toast.success('ভেন্ডর স্টক সেট');
                      close();
                    }}
                  >
                    সেভ করুন
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {directDeliveredOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setDirectDeliveredOrder(null); }}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader><DialogTitle className="text-lg">ডেলিভারড স্টক টাইপ</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">এই রিসেলার অর্ডারটি কোন স্টক থেকে ডেলিভারি হয়েছে?</p>
            <div className="grid grid-cols-1 gap-3 pt-2">
              <Button variant="outline" className="justify-start h-12" onClick={() => {
                const key = resellerOrderKey(directDeliveredOrder);
                setStockType(key, 'self');
                updateResellerOrderStatus(directDeliveredOrder, 'ডেলিভারড');
                toast.success('সেলফ স্টক হিসেবে ডেলিভারড');
                setDirectDeliveredOrder(null);
              }}>
                সেলফ স্টক
              </Button>
              <Button variant="outline" className="justify-start h-12" onClick={() => {
                const key = resellerOrderKey(directDeliveredOrder);
                setStockType(key, 'vendor');
                updateResellerOrderStatus(directDeliveredOrder, 'ডেলিভারড');
                toast.success('ভেন্ডর স্টক হিসেবে ডেলিভারড');
                setDirectDeliveredOrder(null);
              }}>
                ভেন্ডর স্টক
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Order Detail Dialog with Edit */}
      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>অর্ডার বিবরণ — {viewOrder?.id}</DialogTitle>
              {viewOrder && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { openEditOrder(viewOrder); setViewOrder(null); }}>
                  <Edit className="w-3.5 h-3.5" /> এডিট
                </Button>
              )}
            </div>
          </DialogHeader>
          {viewOrder && (() => {
            const pb = getPriceBreakdown(viewOrder);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">রিসেলার</p><p className="font-medium">{viewOrder.resellerName}</p></div>
                  <div><p className="text-muted-foreground text-xs">তারিখ</p><p className="font-medium">{formatDate(viewOrder.date)}</p></div>
                  <div><p className="text-muted-foreground text-xs">কাস্টমার</p><p className="font-medium">{viewOrder.customerName}</p></div>
                  <div><p className="text-muted-foreground text-xs">ফোন</p><p className="font-medium">{viewOrder.customerPhone}</p></div>
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">ঠিকানা</p><p className="font-medium">{viewOrder.customerAddress}</p></div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-semibold mb-2">প্রোডাক্ট সমূহ</p>
                  {viewOrder.items.map((item: any, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <img src={item.image} alt="" className="w-12 h-12 rounded object-cover" />
                      <div className="flex-1">
                        <p className="text-sm">{item.productTitle}</p>
                        <p className="text-xs text-muted-foreground">পরিমাণ: {item.qty}</p>
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
                        <p>SP: ৳{item.sellingPrice}</p><p className="text-muted-foreground">RP: ৳{item.resellerPrice}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">সেলিং প্রাইজ:</span><span>৳{pb.subtotalSelling}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">- DP প্রাইজ:</span><span>৳{pb.subtotalDP}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">- ডেলিভারি চার্জ:</span><span>৳{pb.deliveryCharge}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">- প্যাকেজিং চার্জ:</span><span>৳{pb.packagingCharge}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">- COD চার্জ (১%):</span><span>৳{pb.codCharge}</span></div>
                  <div className="flex justify-between text-green-600 font-bold border-t pt-2 mt-2"><span>প্রফিট:</span><span>৳{pb.profit}</span></div>
                </div>
                {/* Notes Section */}
                {viewOrder.notes && viewOrder.notes.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">📝 নোট</p>
                    <div className="bg-amber-50/50 rounded-lg p-3 space-y-1">
                      {viewOrder.notes.map((n: string, i: number) => (
                        <p key={i} className="text-sm text-foreground">• {n}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      {editOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditOrder(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>অর্ডার এডিট — {editOrder.id}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">কাস্টমার নাম</Label>
                  <Input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ফোন</Label>
                  <Input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ঠিকানা</Label>
                <Textarea value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} rows={2} />
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">প্রোডাক্ট সমূহ</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAddProductSearch(!showAddProductSearch)}>
                    <Plus className="w-3 h-3" /> প্রোডাক্ট যোগ
                  </Button>
                </div>

                {/* Add product search */}
                {showAddProductSearch && (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-2 mb-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="প্রোডাক্ট সার্চ করুন..."
                        value={addProductSearch}
                        onChange={(e) => setAddProductSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {products
                        .filter(p => p.title.toLowerCase().includes(addProductSearch.toLowerCase()))
                        .slice(0, 20)
                        .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            const hasVariations = (p.colors && p.colors.length > 0) || (p.sizes && p.sizes.length > 0) || (p.weights && p.weights.length > 0);
                            if (hasVariations) {
                              setEditVariantIndex(null);
                              setPendingVariationProduct(p);
                              setPendingVariations({});
                              setShowAddProductSearch(false);
                              setAddProductSearch('');
                              return;
                            }
                            const newItem = {
                              productId: p.id,
                              productTitle: p.title,
                              image: p.featuredImage || p.images[0] || '/placeholder.svg',
                              qty: 1,
                              resellerPrice: p.resellerPrice || p.price,
                              sellingPrice: p.price,
                              profit: p.price - (p.resellerPrice || p.price),
                              buyPrice: typeof p.buyPrice === 'number' ? p.buyPrice : undefined,
                            };
                            setEditItems(prev => [...prev, newItem]);
                            setShowAddProductSearch(false);
                            setAddProductSearch('');
                            toast.success(`${p.title} যোগ করা হয়েছে`);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left transition-colors"
                        >
                          <img src={p.featuredImage || p.images[0] || '/placeholder.svg'} alt={p.title} className="w-8 h-8 rounded object-cover border" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.title}</p>
                            <p className="text-xs text-muted-foreground">RP: ৳{p.resellerPrice || p.price} | SP: ৳{p.price}</p>
                          </div>
                          <Plus className="w-4 h-4 text-primary shrink-0" />
                        </button>
                      ))}
                      {products.filter(p => p.title.toLowerCase().includes(addProductSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
                      )}
                    </div>
                  </div>
                )}

                {editItems.map((item: any, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <img src={item.image} alt="" className="w-10 h-10 rounded object-cover mt-1" />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm font-medium">{item.productTitle}</p>
                      {(item.selectedColor || item.selectedSize || item.selectedWeight) && (
                        <div className="flex gap-1 flex-wrap">
                          {item.selectedColor && <span className="text-[9px] px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded">কালার: {item.selectedColor}</span>}
                          {item.selectedSize && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">সাইজ: {item.selectedSize}</span>}
                          {item.selectedWeight && <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">{item.selectedWeight}</span>}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap items-center">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground">পরিমাণ</span>
                          <Input type="number" min={1} value={item.qty}
                            onChange={(e) => {
                              const qty = Math.max(1, parseInt(e.target.value) || 1);
                              setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty } : it));
                            }}
                            className="h-7 w-14 text-xs" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground">SP (সেলিং)</span>
                          <Input type="number" min={0} value={item.sellingPrice}
                            onChange={(e) => {
                              const sp = Math.max(0, parseInt(e.target.value) || 0);
                              setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, sellingPrice: sp, profit: sp - it.resellerPrice } : it));
                            }}
                            className="h-7 w-20 text-xs" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground">RP (রিসেলার)</span>
                          <Input type="number" min={0} value={item.resellerPrice}
                            onChange={(e) => {
                              const rp = Math.max(0, parseInt(e.target.value) || 0);
                              setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, resellerPrice: rp, profit: it.sellingPrice - rp } : it));
                            }}
                            className="h-7 w-20 text-xs" />
                        </div>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1 mt-3" onClick={() => startEditItemVariant(i)}>
                          <Edit className="w-3 h-3" /> ভেরিয়েন্ট
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive mt-3"
                          onClick={() => {
                            if (editItems.length <= 1) { toast.error('অন্তত একটি প্রোডাক্ট থাকতে হবে'); return; }
                            setEditItems(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Variation picker */}
                {pendingVariationProduct && (
                  <div className="border rounded-lg p-3 space-y-3 bg-primary/5 mt-2">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">ডেলিভারি চার্জ</Label>
                  <Input type="number" value={editDeliveryCharge} onChange={(e) => setEditDeliveryCharge(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">প্যাকেজিং চার্জ</Label>
                  <Input type="number" value={editPackagingCharge} onChange={(e) => setEditPackagingCharge(Number(e.target.value))} />
                </div>
              </div>

              {/* Live profit preview */}
              {(() => {
                const subtotalSP = editItems.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
                const subtotalRP = editItems.reduce((s, i) => s + i.resellerPrice * i.qty, 0);
                const cod = Math.ceil((subtotalSP * 1) / 100);
                const profit = subtotalSP - subtotalRP - editDeliveryCharge - editPackagingCharge - cod;
                return (
                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">সেলিং প্রাইজ:</span><span>৳{subtotalSP}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- DP প্রাইজ:</span><span>৳{subtotalRP}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- ডেলিভারি:</span><span>৳{editDeliveryCharge}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- প্যাকেজিং:</span><span>৳{editPackagingCharge}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">- COD (১%):</span><span>৳{cod}</span></div>
                    <div className={`flex justify-between font-bold border-t pt-1 mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>প্রফিট:</span><span>৳{profit}</span></div>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <Label className="text-xs">নোট</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="অর্ডার সম্পর্কে নোট..." />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={saveEditOrder}>সেভ করুন</Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditOrder(null)}>বাতিল</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Paid Return Popup */}
      {paidReturnOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setPaidReturnOrder(null); setPaidReturnAmount(0); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-lg">পেইড রিটার্ন — {paidReturnOrder.id}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ:</span><span className="font-medium">৳{paidReturnOrder.deliveryCharge || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">প্যাকেজিং চার্জ:</span><span className="font-medium">৳{paidReturnOrder.packagingCharge || 0}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold"><span>মোট চার্জ:</span><span>৳{(paidReturnOrder.deliveryCharge || 0) + (paidReturnOrder.packagingCharge || 0)}</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">কত টাকা পেইড রিটার্ন হয়েছে?</Label>
                <Input
                  type="number"
                  value={paidReturnAmount || ''}
                  onChange={(e) => setPaidReturnAmount(Number(e.target.value))}
                  placeholder="টাকার পরিমাণ লিখুন"
                  className="text-lg font-bold"
                  min={0}
                />
              </div>
              {paidReturnAmount > 0 && (() => {
                const totalCharges = (paidReturnOrder.deliveryCharge || 0) + (paidReturnOrder.packagingCharge || 0);
                const diff = paidReturnAmount - totalCharges;
                const target = 'রিসেলার ব্যালেন্স';
                return (
                  <div className={`rounded-lg p-3 text-sm ${diff > 0 ? 'bg-green-50 border border-green-200 text-green-700' : diff < 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                    {diff > 0 ? (
                      <p>৳{diff} {target}-এ যোগ হবে</p>
                    ) : diff < 0 ? (
                      <p>৳{Math.abs(diff)} {target} থেকে কাটা হবে</p>
                    ) : (
                      <p>কোনো পরিবর্তন হবে না</p>
                    )}
                  </div>
                );
              })()}
              <Button className="w-full" onClick={handlePaidReturnConfirm} disabled={paidReturnAmount <= 0}>
                পেইড রিটার্ন কনফার্ম করুন
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
              {/* Show existing notes (read-only) */}
              {noteOrder.notes && noteOrder.notes.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">বিদ্যমান নোট:</p>
                  {noteOrder.notes.map((n: string, i: number) => (
                    <p key={i} className="text-sm text-foreground">• {n}</p>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">নতুন নোট যোগ করুন:</p>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="যেমন: কাস্টমার ফোন ধরছে না, পরে কল করতে হবে..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setNoteOrder(null); setNoteText(''); }}>বাতিল</Button>
                <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={async () => {
                  if (!noteOrder) return;
                  const newNote = noteText.trim();
                  const existingNotes = noteOrder.notes || [];
                  const updatedNotes = newNote ? [...existingNotes.filter((n: string) => n !== newNote), newNote] : existingNotes;
                  await api.post('/rs/reseller-orders/update', { code: noteOrder.id, admin_note: newNote, notes: updatedNotes });
                  useResellerStore.setState((s) => ({
                    orders: s.orders.map(o => o.id === noteOrder.id ? { ...o, adminNote: newNote, notes: updatedNotes } : o),
                  }));
                  toast.success(newNote ? `অর্ডার ${noteOrder.id}-এ নোট সেভ হয়েছে` : 'নোট আপডেট হয়েছে');
                  setNoteOrder(null);
                  setNoteText('');
                }}>
                  <StickyNote className="w-4 h-4" /> সেভ করুন
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteConfirmOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setDeleteConfirmOrder(null); setDeleteConfirmStep(0); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" /> রিসেলার অর্ডার ডিলিট — {deleteConfirmOrder.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {deleteConfirmStep === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    আপনি কি <span className="font-bold text-foreground">{deleteConfirmOrder.id}</span> ({deleteConfirmOrder.customerName}) অর্ডারটি ডিলিট করতে চান?
                  </p>
                  <p className="text-xs text-destructive font-medium">⚠️ এই অ্যাকশন পূর্বাবস্থায় ফেরানো যাবে না।</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setDeleteConfirmOrder(null); setDeleteConfirmStep(0); }}>বাতিল</Button>
                    <Button variant="destructive" onClick={confirmDeleteStep}>হ্যাঁ, ডিলিট করুন</Button>
                  </div>
                </>
              )}
              {deleteConfirmStep === 2 && (
                <>
                  <p className="text-sm font-bold text-destructive">
                    ⚠️ শেষ সতর্কতা! সত্যিই কি অর্ডার {deleteConfirmOrder.id} চিরতরে ডিলিট করতে চান?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setDeleteConfirmOrder(null); setDeleteConfirmStep(0); }}>বাতিল</Button>
                    <Button variant="destructive" onClick={confirmDeleteStep}>নিশ্চিত ডিলিট</Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CourierDeliveryChargePopup
        open={pendingDeliveryChargeOrders.length > 0}
        orders={pendingDeliveryChargeOrders}
        onCancel={handleDeliveryChargeCancel}
        onSubmit={handleDeliveryChargeSubmit}
      />

      {manualSmsOrder && (
        <ManualSmsDialog
          open={!!manualSmsOrder}
          onOpenChange={(open) => { if (!open) setManualSmsOrder(null); }}
          phone={manualSmsOrder.customerPhone}
          vars={buildResellerOrderVars(manualSmsOrder)}
          templates={getResellerManualSmsTemplates(manualSmsOrder)}
          title={`${manualSmsOrder.status} SMS — ${manualSmsOrder.id}`}
        />
      )}

      {historyForOrderId && (() => {
        const o = orders.find(x => x.id === historyForOrderId);
        if (!o) return null;
        return (
          <CustomerHistoryDialog
            open={true}
            onOpenChange={(open) => { if (!open) setHistoryForOrderId(null); }}
            title={`পূর্ববর্তী অর্ডার — ${o.customerPhone}`}
            orders={getResellerHistory(o)}
            statusColors={statusColors}
          />
        );
      })()}
    </div>
  );
};

export default AdminResellerOrders;
