import { useState, useEffect, useRef, useMemo } from 'react';
import { useCourierRatioStore } from '@/stores/useCourierRatioStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
  import { Search, Phone, Truck, Copy, MessageCircle, ShieldBan, Trash2, UserCheck, UserPlus, Printer, Loader2, UserCog, Eye, ExternalLink, ShieldAlert, CheckCircle2, XCircle, Clock, Plus, Package, StickyNote, PauseCircle, Send, Edit, Lock, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OrderDetailDialog, { type Order, type OrderItem } from '@/components/admin/OrderDetailDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useBlockStore } from '@/stores/useBlockStore';
import { useIncompleteOrderStore } from '@/stores/useIncompleteOrderStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { findCustomerHistory, hasCustomerHistory, collectCustomerIdentifiers } from '@/lib/customer-history';
import { CustomerHistoryDialog } from '@/components/CustomerHistoryDialog';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useProductStore } from '@/stores/useProductStore';
import { type Product } from '@/data/store-data';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useAdminStore } from '@/stores/useAdminStore';
import { useSteadfastStore, type SteadfastOrderData } from '@/stores/useSteadfastStore';
import { buildSteadfastTrackingUrl } from '@/lib/courier-links';
import { useFollowUpStore, type OrderStockType } from '@/stores/useFollowUpStore';
import { useCarrybeeStore, type CarrybeeOrderData } from '@/stores/useCarrybeeStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { validatePhone, validateName, normalizePhone } from '@/lib/order-validation';
import ValidationPopup from '@/components/ValidationPopup';
import CourierDeliveryChargePopup, { type FreeDeliveryOrderInfo } from '@/components/admin/CourierDeliveryChargePopup';
import ManualSmsDialog from '@/components/admin/ManualSmsDialog';
import { buildMainOrderVars } from '@/lib/bulksms';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { checkSelfStockForItems, formatStockProblems } from '@/lib/check-self-stock';
import { api } from '@/lib/api';
import { printOrderInvoice } from '@/lib/invoice-print';

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-400 text-yellow-950',
  'হোল্ড': 'bg-amber-400 text-amber-950',
  'কনফার্মড': 'bg-blue-500 text-white',
  'প্যাকেজিং': 'bg-indigo-500 text-white',
  'শিপমেন্ট': 'bg-purple-500 text-white',
  'এসাইন': 'bg-teal-500 text-white',
  'ফলোয়াপ': 'bg-cyan-400 text-cyan-950',
  'ডেলিভারড': 'bg-green-500 text-white',
  'ক্যান্সেল': 'bg-red-500 text-white',
  'রিটার্নিং': 'bg-rose-400 text-rose-950',
  'রিটার্ন': 'bg-orange-500 text-white',
  'পেইড রিটার্নিং': 'bg-fuchsia-400 text-fuchsia-950',
  'পেইড রিটার্ন': 'bg-pink-500 text-white',
};

const allStatuses = ['সব', 'পেন্ডিং', 'হোল্ড', 'কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ', 'ডেলিভারড', 'ক্যান্সেল', 'রিটার্নিং', 'রিটার্ন', 'পেইড রিটার্নিং', 'পেইড রিটার্ন'];

// All status options for dropdown
const statusOptions = ['পেন্ডিং', 'হোল্ড', 'কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'এসাইন', 'ফলোয়াপ', 'ডেলিভারড', 'ক্যান্সেল', 'রিটার্নিং', 'রিটার্ন', 'পেইড রিটার্নিং', 'পেইড রিটার্ন'];

// Map in_review -> প্যাকেজিং
const steadfastStatusMap: Record<string, { label: string; color: string }> = {
  'in_review': { label: 'প্যাকেজিং', color: 'bg-indigo-100 text-indigo-800' },
  'pending': { label: 'পেন্ডিং', color: 'bg-yellow-100 text-yellow-800' },
  'delivered': { label: 'ডেলিভারড', color: 'bg-green-100 text-green-800' },
  'partial_delivered': { label: 'আংশিক ডেলিভারড', color: 'bg-emerald-100 text-emerald-800' },
  'cancelled': { label: 'ক্যান্সেলড', color: 'bg-red-100 text-red-800' },
  'hold': { label: 'হোল্ড', color: 'bg-amber-100 text-amber-800' },
  'delivered_approval_pending': { label: 'ডেলিভারড (অপেক্ষমান)', color: 'bg-lime-100 text-lime-800' },
  'cancelled_approval_pending': { label: 'ক্যান্সেল (অপেক্ষমান)', color: 'bg-orange-100 text-orange-800' },
};

// CarryBee status map
const carrybeeStatusMap: Record<string, { label: string; color: string }> = {
  'order created': { label: 'প্যাকেজিং', color: 'bg-indigo-100 text-indigo-800' },
  'pickup pending': { label: 'পিকআপ পেন্ডিং', color: 'bg-yellow-100 text-yellow-800' },
  'picked up': { label: 'পিকড আপ', color: 'bg-blue-100 text-blue-800' },
  'in transit': { label: 'ট্রানজিটে', color: 'bg-purple-100 text-purple-800' },
  'at hub': { label: 'হাবে আছে', color: 'bg-cyan-100 text-cyan-800' },
  'out for delivery': { label: 'ডেলিভারির পথে', color: 'bg-teal-100 text-teal-800' },
  'delivered': { label: 'ডেলিভারড', color: 'bg-green-100 text-green-800' },
  'partial delivery': { label: 'আংশিক ডেলিভারড', color: 'bg-emerald-100 text-emerald-800' },
  'return': { label: 'রিটার্ন', color: 'bg-orange-100 text-orange-800' },
  'cancelled': { label: 'ক্যান্সেলড', color: 'bg-red-100 text-red-800' },
  'pickup cancelled': { label: 'পিকআপ ক্যান্সেল', color: 'bg-red-100 text-red-800' },
  'hold': { label: 'হোল্ড', color: 'bg-amber-100 text-amber-800' },
};

// WhatsApp message helper
const buildWhatsAppMessage = (order: Order, storeProducts: Product[]) => {
  const productNames = order.items.map(i => i.name).join(', ');
  const productPrice = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryCharge = order.deliveryCharge;
  const deliveryText = deliveryCharge === 0 ? 'ফ্রি ডেলিভারি' : `৳${deliveryCharge}`;
  
  // Find product link from first item
  const firstProduct = storeProducts.find(p => p.title === order.items[0]?.name);
  const productLink = firstProduct ? `${window.location.origin}/product/${firstProduct.slug}` : '';

  const totalPrice = productPrice + (deliveryCharge || 0);
  let msg = `প্রিয় গ্রাহক!\n- আপনি একটি *${productNames}* অর্ডার করেছেন।\n- অর্ডার কনফার্মের জন্য আপনাকে কল করা হয়েছিলো। আপনি কোন কারণে কলটি রিসিভ করতে পারেন নি।\n- অর্ডারটি কনফার্ম করতে এখানে মেসেজ করে জানিয়ে দিন প্লিজ\n\nপ্রডাক্ট প্রাইজঃ ৳${productPrice}\nডেলিভারি চার্জঃ ${deliveryText}\nটোটাল প্রাইজঃ ৳${totalPrice}`;
  if (productLink) msg += `\nপ্রডাক্ট ডিটেইলসঃ ${productLink}`;
  return msg;
};

// Relative time helper
const getRelativeTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return 'এইমাত্র';
    if (diffMin < 60) return `${diffMin} মিনিট আগে`;
    if (diffHr < 24) return `${diffHr} ঘন্টা আগে`;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch {
    return dateStr;
  }
};

const printInvoice = (order: Order) => {
  const { siteName, address, phone, logoUrl } = useSiteSettingsStore.getState();
  printOrderInvoice(
    {
      id: order.id,
      customer: order.customer,
      phone: order.phone,
      address: order.address || '',
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      deliveryCharge: order.deliveryCharge,
      total: order.total,
      status: order.status,
      date: order.date,
    },
    { siteName, address, phone, logoUrl }
  );
};

const isConfirmedOrBeyond = (status: string) => ['কনফার্মড', 'প্যাকেজিং', 'শিপমেন্ট', 'ডেলিভারড'].includes(status);

const ORDERS_PER_PAGE = 10;
const EMPLOYEE_RESTRICTED_STATUSES = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ'];



const Orders = () => {
  const storeProducts = useProductStore((s) => s.products);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('সব');
  const [currentPage, setCurrentPage] = useState(1);
  const { orders, updateOrder: updateOrderInStore, updateStatus: updateStatusInStore, deleteOrders: deleteOrdersInStore, assignOrder, unassignOrder, addOrder, getNextInvoiceId } = useOrderStore();
  const resellerOrders = useResellerStore((s) => s.orders);
  const userRole = useAdminStore((s) => s.userRole);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [historyForOrderId, setHistoryForOrderId] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const { blockCustomerFull, isPhoneBlocked, blockedList, unblockCustomer, fetchBlocked } = useBlockStore();
  const incompleteOrders = useIncompleteOrderStore((s) => s.orders);

  const getCustomerIdentifiers = (phone: string, orderId?: string) => {
    const normalized = normalizePhone(phone) || phone;
    // First try to get from the order itself
    const order = orderId
      ? orders.find(o => o.id === orderId)
      : orders.find(o => (normalizePhone(o.phone) || o.phone) === normalized && (o.customerIp || o.customerFingerprint));
    if (order?.customerIp || order?.customerFingerprint) {
      return { ip: order.customerIp, fingerprint: order.customerFingerprint };
    }
    // Fallback to incomplete orders
    const incomplete = incompleteOrders.find(
      o => (normalizePhone(o.phone) || o.phone) === normalized && (o.customerIp || o.customerFingerprint)
    );
    return { ip: incomplete?.customerIp, fingerprint: incomplete?.customerFingerprint };
  };

  // Cross-store: collect ALL ips/fingerprints ever seen for this customer
  // matching by phone OR address across main + reseller + incomplete orders.
  const gatherAllIdentifiers = (phone: string, orderId?: string) => {
    const order = orderId ? orders.find(o => o.id === orderId) : undefined;
    const ref = {
      phone,
      address: order?.address,
      ip: order?.customerIp,
      fingerprint: order?.customerFingerprint,
    };
    return collectCustomerIdentifiers(ref, orders as any, resellerOrders as any, incompleteOrders as any);
  };

  // DB fallback: query the Laravel API when in-memory stores miss IP/fingerprint
  const fetchIdentifiersFromDb = async (phone: string): Promise<{ ip?: string; fingerprint?: string }> => {
    const normalized = normalizePhone(phone) || phone;
    try {
      const { api } = await import('@/lib/api');
      const res = await api.get(`/admin/customer-devices?phone=${encodeURIComponent(normalized)}`);
      if (res && (res.ip || res.fingerprint)) {
        return { ip: res.ip || undefined, fingerprint: res.fingerprint || undefined };
      }
    } catch (e) {
      console.warn('[Orders.fetchIdentifiersFromDb] error:', e);
    }
    return {};
  };

  const blockWithAllIdentifiers = async (phone: string, customerName: string, reason: string, orderId?: string) => {
    const { ips, fingerprints } = gatherAllIdentifiers(phone, orderId);
    if (ips.length === 0 && fingerprints.length === 0) {
      const dbFound = await fetchIdentifiersFromDb(phone);
      if (dbFound.ip) ips.push(dbFound.ip);
      if (dbFound.fingerprint) fingerprints.push(dbFound.fingerprint);
    }
    await blockCustomerFull({ phone, ips, fingerprints, customerName, reason });
  };
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderData, setNewOrderData] = useState({ customer: '', phone: '', address: '', deliveryCharge: 130 });
  const [newOrderItems, setNewOrderItems] = useState<{ productId: string; name: string; price: number; qty: number; image: string; variations?: Record<string, string>; buyPrice?: number; resellerPriceSnapshot?: number; stockProductName?: string }[]>([]);
  const [newOrderProductSearch, setNewOrderProductSearch] = useState('');
  const [pendingVariationProduct, setPendingVariationProduct] = useState<Product | null>(null);
  const [pendingVariations, setPendingVariations] = useState<Record<string, string>>({});
  const [validationMsg, setValidationMsg] = useState('');
  const courierData = useCourierRatioStore((s) => s.data);
  const loadCourierCache = useCourierRatioStore((s) => s.loadCache);
  const checkCourierRatioAction = useCourierRatioStore((s) => s.checkRatio);

  // Load courier ratio cache from the Laravel API on mount
  useEffect(() => { loadCourierCache(); }, [loadCourierCache]);
  useEffect(() => { fetchBlocked(); }, []);
  const fraudSettings = useFraudSettingsStore();
  const { logActivity, employees } = useEmployeeStore();
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const currentEmployee = employees.find(e => e.email === adminEmail);
  const isAdmin = userRole === 'admin';

  // Hold with note state
  const [holdNoteOrder, setHoldNoteOrder] = useState<Order | null>(null);
  const [holdNoteText, setHoldNoteText] = useState('');

  // Courier badge data (read-only display)
  const { settings: sfSettings, orderData: sfOrderData, setOrderData: setSfOrderData } = useSteadfastStore();
  const { settings: cbSettings, orderData: cbOrderData, setOrderData: setCbOrderData } = useCarrybeeStore();
  useLazyFetch([
    useSteadfastStore.getState().fetchSettings,
    useSteadfastStore.getState().fetchDispatchData,
    useCarrybeeStore.getState().fetchSettings,
    useCarrybeeStore.getState().fetchDispatchData,
    useFollowUpStore.getState().fetchAll,
  ]);
  const setStockType = useFollowUpStore((s) => s.setStockType);
  const setCourierName = useFollowUpStore((s) => s.setCourierName);
  const setTrackingUrl = useFollowUpStore((s) => s.setTrackingUrl);
  const setVendorBuyPrice = useFollowUpStore((s) => s.setVendorBuyPrice);
  const courierLocked = useFollowUpStore((s) => s.courierLocked);
  const setCourierLocked = useFollowUpStore((s) => s.setCourierLocked);
  const stockTypes = useFollowUpStore((s) => s.stockTypes);

  // Courier dispatch state
  const [courierPickerOrder, setCourierPickerOrder] = useState<Order | null>(null);
  const [manualCourierOrder, setManualCourierOrder] = useState<string | null>(null);
  const [manualCourierName, setManualCourierName] = useState('');
  const [manualTrackingLink, setManualTrackingLink] = useState('');
  const [manualCourierStockType, setManualCourierStockType] = useState<OrderStockType>('self');
  const [manualVendorBuyPrice, setManualVendorBuyPrice] = useState('');
  const [sendingToSf, setSendingToSf] = useState<Set<string>>(new Set());
  const [sendingToCb, setSendingToCb] = useState<Set<string>>(new Set());
  const [addLinkOrderId, setAddLinkOrderId] = useState<string | null>(null);
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [manualSmsOrder, setManualSmsOrder] = useState<Order | null>(null);
  const smsHoldTemplates = useSiteSettingsStore((s) => s.smsHoldTemplates) || [];
  const smsFollowupTemplates = useSiteSettingsStore((s) => s.smsFollowupTemplates) || [];

  // Free-delivery courier charge popup state
  const setCourierDeliveryCharge = useFollowUpStore((s) => s.setCourierDeliveryCharge);
  const courierDeliveryCharges = useFollowUpStore((s) => s.courierDeliveryCharges);
  const [pendingDeliveryChargeOrders, setPendingDeliveryChargeOrders] = useState<FreeDeliveryOrderInfo[]>([]);
  const [pendingDeliveryChargeAction, setPendingDeliveryChargeAction] = useState<(() => void) | null>(null);

  // Edit tracking state (for changing stock type after courier sent)
  const [editTrackingOrderId, setEditTrackingOrderId] = useState<string | null>(null);
  const [editTrackingStockType, setEditTrackingStockType] = useState<OrderStockType>('self');
  const [editTrackingVendorPrice, setEditTrackingVendorPrice] = useState('');
  const [editTrackingCourierName, setEditTrackingCourierName] = useState('');
  const [editTrackingUrl, setEditTrackingUrl] = useState('');

  // API courier stock-type prompt (asked before sending to Steadfast/CarryBee)
  const [apiCourierPromptOrder, setApiCourierPromptOrder] = useState<{ order: Order; provider: 'steadfast' | 'carrybee' } | null>(null);
  const [apiCourierStockType, setApiCourierStockType] = useState<OrderStockType>('self');
  const [apiCourierVendorPrice, setApiCourierVendorPrice] = useState('');

  // Delete confirmation state (double confirm)
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0); // 0=closed, 1=first confirm, 2=second confirm

  // Paid return popup state
  const [paidReturnOrder, setPaidReturnOrder] = useState<Order | null>(null);
  const [paidReturnAmount, setPaidReturnAmount] = useState('');


  // Force re-render for relative time
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Backfill return-ledger entries for existing return/paid-return orders.
  // Must run on FRESH API data (not stale Zustand-persisted data) — stale orders have
  // isoDate=null which return-ledger.ts would skip or previously mis-date as "today".
  // We detect "fresh data" by waiting for loading to cycle true→false after mount.
  const ordersLoading = useOrderStore((s) => s.loading);
  const returnBackfilledRef = useRef(false);
  const fetchStartedRef = useRef(false); // becomes true once loading flips to true
  useEffect(() => {
    if (ordersLoading) { fetchStartedRef.current = true; return; }
    if (!fetchStartedRef.current) return; // skip initial persist data (loading never went true yet)
    if (returnBackfilledRef.current || orders.length === 0) return;
    const hasReturns = orders.some(o => o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন');
    if (!hasReturns) return;
    returnBackfilledRef.current = true;
    import('@/lib/return-ledger').then(({ backfillReturnLedger }) => {
      backfillReturnLedger(orders as any[], stockTypes).catch(() => {});
    });
  }, [ordersLoading, orders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign new pending orders to active team members in round-robin
  const autoAssignedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activeEmployees = employees.filter(e => e.isActive && e.permissions?.includes('orders') && e.autoAssignMain !== false);
    if (activeEmployees.length === 0) return;

    const unassignedPending = orders.filter(o =>
      o.status === 'পেন্ডিং' && !o.assignedTo && !autoAssignedRef.current.has(o.id)
    );

    if (unassignedPending.length === 0) return;

    let index = parseInt(localStorage.getItem('auto-assign-index') || '0');
    // Load from counters table
    (async () => {
      try {
        const { api } = await import('@/lib/api');
        const counterRow = await api.get('/admin/counter/auto_assign_index');
        if (counterRow && typeof counterRow.value === 'number') index = counterRow.value;
      } catch { /* ignore */ }
    })();

    unassignedPending.forEach(order => {
      const emp = activeEmployees[index % activeEmployees.length];
      assignOrder(order.id, emp.id, emp.name);
      autoAssignedRef.current.add(order.id);
      index++;
    });

    const newIndex = index % activeEmployees.length;
    localStorage.setItem('auto-assign-index', String(newIndex));
    // Save the round-robin index
    (async () => {
      try {
        const { api } = await import('@/lib/api');
        await api.put('/admin/counter/auto_assign_index', { value: newIndex });
      } catch { /* ignore */ }
    })();
  }, [orders, employees, assignOrder]);

  const checkCourierRatio = (phone: string) => {
    checkCourierRatioAction(phone, fraudSettings.bdcourierApiKey || undefined, true);
  };

  // Courier dispatch helpers (Laravel proxy → Steadfast / CarryBee APIs)
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

  const isSentToCourier = (orderId: string) => {
    return !!sfOrderData[orderId]?.consignment_id || !!cbOrderData[orderId]?.consignment_id || !!useFollowUpStore.getState().courierNames[orderId];
  };

  // Detect free-delivery (customer paid 0) orders that still need actual courier-charge input
  const needsDeliveryCharge = (order: Order) => {
    return (order.deliveryCharge ?? 0) <= 0 && !(courierDeliveryCharges[order.id] > 0);
  };

  // Wrap a courier-send action with the delivery-charge popup if needed
  const requireDeliveryCharge = (orders: Order[], action: () => void) => {
    const missing = orders.filter(needsDeliveryCharge);
    if (missing.length === 0) { action(); return; }
    setPendingDeliveryChargeOrders(missing.map((o) => ({ orderId: o.id, storeKey: o.id, customerName: o.customer })));
    setPendingDeliveryChargeAction(() => action);
  };

  const handleDeliveryChargeSubmit = (charges: Record<string, number>) => {
    Object.entries(charges).forEach(([key, charge]) => {
      setCourierDeliveryCharge(key, charge);
    });
    const action = pendingDeliveryChargeAction;
    setPendingDeliveryChargeOrders([]);
    setPendingDeliveryChargeAction(null);
    if (action) setTimeout(action, 0);
  };

  const handleDeliveryChargeCancel = () => {
    setPendingDeliveryChargeOrders([]);
    setPendingDeliveryChargeAction(null);
  };

  const sendToSteadfast = async (order: Order, opts?: { stockType?: OrderStockType; vendorBuyPrice?: number }) => {
    if (sfOrderData[order.id]?.consignment_id) { toast.error('ইতিমধ্যে পাঠানো হয়েছে'); return; }
    if (!sfSettings.apiKey || !sfSettings.secretKey) { toast.error('Steadfast API কনফিগার করা হয়নি'); return; }

    // Self-stock guard: block dispatch if any item is out of self-stock
    if ((opts?.stockType || 'self') === 'self') {
      const check = checkSelfStockForItems(order.items as any[], order.id);
      if (!check.ok) {
        toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
        return;
      }
    }

    // Pre-flight validation per Steadfast API v1 spec
    const { normalizePhone } = await import('@/lib/order-validation');
    const name = (order.customer || '').trim();
    const address = (order.address || '').trim();
    const phone = normalizePhone(order.phone || '');
    if (name.length < 2) { toast.error('গ্রাহকের নাম দিন'); return; }
    if (address.length < 5) { toast.error('সঠিক ঠিকানা দিন'); return; }
    if (!/^01[3-9]\d{8}$/.test(phone)) { toast.error('Steadfast-এর জন্য সঠিক ১১ ডিজিটের ফোন নম্বর লাগবে'); return; }

    setSendingToSf(prev => new Set(prev).add(order.id));
    try {
      const itemDesc = order.items.map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 250);
      // Invoice: alpha-numeric + hyphens/underscores, max ~50 chars
      const invoice = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
      const codAmount = Math.max(0, Math.round(order.total || 0));

      const data = await callSteadfast({
        action: 'create_order',
        invoice,
        recipient_name: name.slice(0, 100),
        recipient_phone: phone,
        recipient_address: address.slice(0, 250),
        cod_amount: codAmount,
        note: '',
        item_description: itemDesc,
        delivery_type: 0, // home delivery
      });

      if (data.status === 200 && data.consignment) {
        const chosenStock: OrderStockType = opts?.stockType || 'self';
        setStockType(order.id, chosenStock);
        if (chosenStock === 'vendor' && opts?.vendorBuyPrice && opts.vendorBuyPrice > 0) {
          setVendorBuyPrice(order.id, opts.vendorBuyPrice);
        }
        setSfOrderData(order.id, {
          consignment_id: data.consignment.consignment_id,
          tracking_code: data.consignment.tracking_code,
          steadfast_status: data.consignment.status || 'in_review',
          sent_at: new Date().toISOString(),
        });
        // Always persist courier name so the badge survives refresh, even if Steadfast
        // hasn't generated a tracking_code yet (it often arrives later via status sync).
        setCourierName(order.id, 'Steadfast');
        if (data.consignment.tracking_code) {
          setTrackingUrl(order.id, buildSteadfastTrackingUrl(data.consignment.tracking_code));
        }
        // No fallback to consignment_id — Steadfast's public tracking page only accepts tracking_code.
        // tracking_code arrives later via status sync if not present yet.
        updateStatusInStore(order.id, 'প্যাকেজিং');
        toast.success(`অর্ডার ${order.id} Steadfast-এ পাঠানো হয়েছে ✅`);
      } else {
        // Surface validation errors from Steadfast
        let detail = data.message || 'অজানা ত্রুটি';
        if (data.errors && typeof data.errors === 'object') {
          const errMsgs = Object.entries(data.errors)
            .map(([field, msgs]: any) => `${field}: ${Array.isArray(msgs) ? msgs.join(',') : msgs}`);
          if (errMsgs.length) detail = `${detail} — ${errMsgs.join('; ')}`;
        }
        console.error('Steadfast create_order failed:', data);
        toast.error(`ব্যর্থ: ${detail}`);
      }
    } catch (e: any) {
      console.error('Steadfast dispatch error:', e);
      const msg = e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError')
        ? 'Steadfast ফাংশন পাওয়া যাচ্ছে না (deploy হয়নি)। কিছুক্ষণ পর আবার চেষ্টা করুন।'
        : `Steadfast-এ পাঠাতে সমস্যা: ${e?.message || 'অজানা ত্রুটি'}`;
      toast.error(msg);
    }
    finally { setSendingToSf(prev => { const n = new Set(prev); n.delete(order.id); return n; }); }
  };

  const sendToCarrybee = async (order: Order, opts?: { stockType?: OrderStockType; vendorBuyPrice?: number }) => {
    if (cbOrderData[order.id]?.consignment_id) { toast.error('ইতিমধ্যে পাঠানো হয়েছে'); return; }
    if (!cbSettings.clientId) { toast.error('CarryBee API কনফিগার করা হয়নি'); return; }

    if ((opts?.stockType || 'self') === 'self') {
      const check = checkSelfStockForItems(order.items as any[], order.id);
      if (!check.ok) {
        toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
        return;
      }
    }

    // Pre-flight validation per CarryBee API guide
    const { normalizePhone } = await import('@/lib/order-validation');
    const name = (order.customer || '').trim();
    const address = (order.address || '').trim();
    const phone = normalizePhone(order.phone || '');
    if (name.length < 2) { toast.error('গ্রাহকের নাম অন্তত ২ অক্ষর হতে হবে'); return; }
    if (address.length < 10) { toast.error('ঠিকানা অন্তত ১০ অক্ষর হতে হবে'); return; }
    if (!/^01[3-9]\d{8}$/.test(phone)) { toast.error('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন'); return; }

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

      // Auto-detect city_id and zone_id from address (guide: query >= 10 chars)
      let cityId = cbSettings.defaultCityId || 0;
      let zoneId = cbSettings.defaultZoneId || 0;
      try {
        const addrData = await callCarrybee({ action: 'address_details', query: address });
        if (!addrData.error && addrData.data?.city_id && addrData.data?.zone_id) {
          cityId = addrData.data.city_id;
          zoneId = addrData.data.zone_id;
        }
      } catch { /* fallback to defaults */ }
      // Fallback to Dhaka defaults if detection failed and no admin default set
      if (!cityId || !zoneId) { cityId = cityId || 14; zoneId = zoneId || 5; }

      const itemDesc = order.items.map(i => `${i.name} x${i.qty}`).join(', ').slice(0, 250);
      const totalQty = order.items.reduce((s, i) => s + i.qty, 0) || 1;
      const codAmount = Math.max(0, Math.min(100000, Math.round(order.total || 0)));

      const data = await callCarrybee({
        action: 'create_order',
        store_id: storeId,
        merchant_order_id: String(order.id).replace('#', '').slice(0, 49),
        delivery_type: 1,
        product_type: 1,
        recipient_name: name.slice(0, 99),
        recipient_phone: phone,
        recipient_address: address.slice(0, 200),
        city_id: cityId,
        zone_id: zoneId,
        collectable_amount: codAmount,
        product_description: itemDesc,
        item_quantity: Math.min(200, totalQty),
        item_weight: 500,
      });

      if (!data.error && data.data?.order?.consignment_id) {
        const chosenStock: OrderStockType = opts?.stockType || 'self';
        setStockType(order.id, chosenStock);
        if (chosenStock === 'vendor' && opts?.vendorBuyPrice && opts.vendorBuyPrice > 0) {
          setVendorBuyPrice(order.id, opts.vendorBuyPrice);
        }
        setCbOrderData(order.id, {
          consignment_id: data.data.order.consignment_id,
          transfer_status: 'Order Created',
          sent_at: new Date().toISOString(),
          store_id: storeId,
        });
        setTrackingUrl(order.id, `https://merchant.carrybee.com/order-track/${data.data.order.consignment_id}`);
        setCourierName(order.id, 'CarryBee');
        updateStatusInStore(order.id, 'প্যাকেজিং');
        toast.success(`অর্ডার ${order.id} CarryBee-তে পাঠানো হয়েছে ✅`);
      } else {
        // Surface validation causes from CarryBee
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
    } catch (e: any) {
      console.error('CarryBee dispatch error:', e);
      const msg = e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError')
        ? 'CarryBee ফাংশন পাওয়া যাচ্ছে না (deploy হয়নি)। কিছুক্ষণ পর আবার চেষ্টা করুন।'
        : `CarryBee-তে পাঠাতে সমস্যা: ${e?.message || 'অজানা ত্রুটি'}`;
      toast.error(msg);
    }
    finally { setSendingToCb(prev => { const n = new Set(prev); n.delete(order.id); return n; }); }
  };

  const handleManualCourier = (orderId: string) => {
    if (!manualCourierName.trim()) { toast.error('কুরিয়ারের নাম দিন'); return; }
    if (manualCourierStockType === 'self') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const check = checkSelfStockForItems(order.items as any[], orderId);
        if (!check.ok) {
          toast.error(`সেলফ স্টকে নেই: ${formatStockProblems(check.problems)}`, { duration: 8000 });
          return;
        }
      }
    }
    const courierName = manualCourierName.trim();
    const trackingLink = manualTrackingLink.trim();
    const stockType = manualCourierStockType;
    // Synthetic dispatch row — makes isSentToCourier() and CourierTrackingInfo work after refresh
    setSfOrderData(orderId, { consignment_id: Date.now(), tracking_code: '', steadfast_status: 'manual', sent_at: new Date().toISOString() });
    // Calculate vendor price before the single batch save
    let vendorPrice: number | undefined;
    if (stockType === 'vendor') {
      const price = parseFloat(manualVendorBuyPrice);
      if (!isNaN(price) && price > 0) {
        vendorPrice = price;
      } else {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          let totalBuyPrice = 0;
          order.items.forEach((item: any) => {
            if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
              totalBuyPrice += item.buyPrice * item.qty;
              return;
            }
            const matchedProduct = storeProducts.find(p => p.id === item.productId || p.title === item.name);
            totalBuyPrice += (matchedProduct?.buyPrice || 0) * item.qty;
          });
          vendorPrice = totalBuyPrice;
        }
      }
    }
    // ONE batch save — updates in-memory atomically and fires a single API call (no concurrent race)
    useFollowUpStore.getState().batchSave(orderId, {
      courier_name: courierName,
      stock_type: stockType,
      ...(trackingLink ? { tracking_url: trackingLink } : {}),
      ...(vendorPrice !== undefined ? { vendor_buy_price: vendorPrice } : {}),
    });
    updateStatusInStore(orderId, 'প্যাকেজিং');
    toast.success(`অর্ডার ${orderId} — ${courierName} কুরিয়ারে পাঠানো হয়েছে ✅`);
    setManualCourierOrder(null);
    setManualCourierName('');
    setManualTrackingLink('');
    setManualCourierStockType('self');
    setManualVendorBuyPrice('');
  };

  const allFiltered = orders.filter((o) => {
    const matchSearch = o.customer.includes(search) || o.id.includes(search) || o.phone.includes(search) || o.address?.includes(search);
    const matchStatus = statusFilter === 'সব' || o.status === statusFilter;
    if (!matchSearch || !matchStatus) return false;

    // Date filter
    if (selectedDate) {
      const orderDate = new Date(o.isoDate || o.date);
      if (!isNaN(orderDate.getTime())) {
        const sameDay = orderDate.getFullYear() === selectedDate.getFullYear() &&
          orderDate.getMonth() === selectedDate.getMonth() &&
          orderDate.getDate() === selectedDate.getDate();
        if (!sameDay) return false;
      }
    }

    if (!isAdmin) {
      if (!currentEmployee) return false;
      // Hide পেন্ডিং / হোল্ড orders that are assigned to OTHER team members.
      // All other orders (including unassigned, own-assigned, and any non-pending/hold status) are visible.
      const isPendingOrHold = o.status === 'পেন্ডিং' || o.status === 'হোল্ড';
      if (isPendingOrHold && o.assignedTo && o.assignedTo !== currentEmployee.id) return false;
      return true;
    }

    return true;
  }).sort((a, b) => {
    const numA = parseInt(a.id.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(b.id.replace(/[^0-9]/g, '')) || 0;
    return numB - numA;
  });

  const totalPages = Math.ceil(allFiltered.length / ORDERS_PER_PAGE);
  const filtered = search ? allFiltered : allFiltered.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, search, selectedDate]);

  // Date order count map for calendar
  const dateOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.isoDate || o.date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const updateStatus = (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    // Employee restriction
    if (!isAdmin && currentEmployee && order?.confirmedBy && order.confirmedBy !== '' && order.confirmedBy !== currentEmployee.name && order.confirmedBy !== 'অ্যাডমিন') {
      toast.error('অন্য টিম মেম্বারের কনফার্ম করা অর্ডারের স্ট্যাটাস পরিবর্তন করা যাবে না');
      return;
    }

    // Intercept পেইড রিটার্ন — show popup to ask amount
    if (newStatus === 'পেইড রিটার্ন') {
      setPaidReturnOrder(order);
      setPaidReturnAmount('');
      return;
    }

    // Intercept রিটার্ন — auto-ledger: delivery charge as expense
    if (newStatus === 'রিটার্ন') {
      const stockType = (useFollowUpStore.getState().stockTypes[orderId] || 'self') as 'self' | 'vendor';
      applyStatusChange(orderId, order, newStatus);
      import('@/lib/return-ledger').then(({ syncReturnLedger }) => {
        syncReturnLedger({ ...order, status: 'রিটার্ন' } as any, stockType);
      });
      return;
    }

    applyStatusChange(orderId, order, newStatus);
  };

  const applyStatusChange = async (orderId: string, order: Order, newStatus: string) => {
    if (newStatus === 'কনফার্মড') {
      const confirmerName = currentEmployee?.name || 'অ্যাডমিন';
      updateOrderInStore({ ...order, status: newStatus, confirmedBy: confirmerName }).catch(() => {});
    } else {
      updateStatusInStore(orderId, newStatus);
    }
    if (currentEmployee) {
      const actionMap: Record<string, string> = { 'কনফার্মড': 'order_confirmed', 'ক্যান্সেল': 'order_cancelled' };
      logActivity({ employeeId: currentEmployee.id, employeeName: currentEmployee.name, action: actionMap[newStatus] || 'status_changed', orderId, details: `অর্ডার #${orderId} (${order?.customer || ''}, ${order?.phone || ''}) এর স্ট্যাটাস "${newStatus}" করেছেন`, timestamp: new Date().toISOString() });
    }
    // Auto-rebalance: যে ফাস্ট কনফার্ম করতেছে তাকে স্লো মেম্বারের পেন্ডিং অর্ডার দিয়ে দাও
    if (newStatus === 'কনফার্মড' && currentEmployee?.id) {
      setTimeout(() => {
        import('@/lib/auto-reassign').then(({ autoReassignToFastWorker }) => autoReassignToFastWorker(currentEmployee.id));
      }, 800);
    }
    // Remove from follow-up sheet when reverting
    const revertStatuses = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ', 'ক্যান্সেল'];
    if (revertStatuses.includes(newStatus)) {
      useFollowUpStore.getState().removeStatus(orderId);
      // Clear auto-generated return-ledger entries (det. IDs: ret-exp-*, ret-dep-*)
      import('@/lib/return-ledger').then(({ syncReturnLedger }) => {
        syncReturnLedger({ ...order, status: newStatus } as any, 'self');
      });
    }

    // Auto-unblock when status changes to ডেলিভারড
    if (newStatus === 'ডেলিভারড') {
      const { useBlockStore } = await import('@/stores/useBlockStore');
      const blockStore = useBlockStore.getState();
      const phone = order.phone;
      const fp = order.customerFingerprint;
      const ip = order.customerIp;
      // Remove all blocked entries matching this customer's identifiers
      const toUnblock = blockStore.blockedList.filter(b => 
        (b.type === 'phone' && b.value === phone) ||
        (b.type === 'fingerprint' && fp && b.value === fp) ||
        (b.type === 'ip' && ip && b.value === ip)
      );
      for (const entry of toUnblock) {
        await blockStore.unblockCustomer(entry.id);
      }
    }
  };

  const handlePaidReturnConfirm = () => {
    if (!paidReturnOrder) return;
    const amount = parseFloat(paidReturnAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('সঠিক এমাউন্ট দিন');
      return;
    }
    const orderId = paidReturnOrder.id;
    const deliveryCharge = paidReturnOrder.deliveryCharge || 0;
    const today = new Date().toISOString().split('T')[0];
    const stockType = useFollowUpStore.getState().stockTypes[orderId] || 'self';
    const VENDOR_PACKAGING_CHARGE = 10;
    // No expense entry created. The net diff between paid amount and total
    // charges is reflected directly in the appropriate payment total:
    // - Vendor stock → adjusts "Vendor Payment"
    // - Self stock  → adjusts "Courier Payment"
    void today; void VENDOR_PACKAGING_CHARGE; void stockType; void deliveryCharge;

    // Save paid_return_amount to DB
    import('@/lib/api').then(({ api }) => api.post('/admin/fe-orders/update', { code: orderId, paid_return_amount: amount }));
    
    applyStatusChange(orderId, paidReturnOrder, 'পেইড রিটার্ন');
    // Update local state with paidReturnAmount
    const updatedOrders = useOrderStore.getState().orders.map(o => 
      o.id === orderId ? { ...o, paidReturnAmount: amount } : o
    );
    useOrderStore.setState({ orders: updatedOrders });

    // Auto-ledger entry: deposit (profit) or expense (loss) for paid return
    import('@/lib/return-ledger').then(({ syncReturnLedger }) => {
      const updated = { ...paidReturnOrder, status: 'পেইড রিটার্ন', paidReturnAmount: amount };
      syncReturnLedger(updated as any, stockType as 'self' | 'vendor');
    });

    toast.success(`অর্ডার ${orderId} পেইড রিটার্ন হয়েছে (পেইড: ৳${amount})`);
    setPaidReturnOrder(null);
    setPaidReturnAmount('');
  };

  const isReturningCustomer = (o: typeof orders[0]) =>
    hasCustomerHistory(o.id, { phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address }, orders, resellerOrders);
  const getHistoryForOrder = (o: typeof orders[0]) =>
    findCustomerHistory(o.id, { phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address }, orders, resellerOrders);
  const updateOrder = (updated: typeof orders[0]) => { updateOrderInStore(updated).catch(() => {}); };
  const getSubtotal = (items: OrderItem[]) => items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const toggleSelect = (id: string) => {
    setSelectedOrders((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedOrders.size === filtered.length) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(filtered.map((o) => o.id)));
  };

  const handleBulkStatusChange = (newStatus: string) => {
    let changed = 0;
    selectedOrders.forEach((id) => {
      const order = orders.find(o => o.id === id);
      if (!order) return;
      if (newStatus === 'কনফার্মড') {
        const confirmerName = currentEmployee?.name || 'অ্যাডমিন';
        updateOrderInStore({ ...order, status: newStatus, confirmedBy: confirmerName }).catch(() => {});
      } else {
        updateStatusInStore(id, newStatus);
      }
      changed++;
    });
    toast.success(`${changed}টি অর্ডারের স্ট্যাটাস "${newStatus}" করা হয়েছে`);
    setSelectedOrders(new Set());
  };

  const handleBulkAssign = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const eligible = Array.from(selectedOrders).filter(id => orders.find(o => o.id === id)?.status === 'পেন্ডিং');
    const skipped = selectedOrders.size - eligible.length;
    eligible.forEach((id) => assignOrder(id, emp.id, emp.name));
    if (eligible.length > 0) toast.success(`${eligible.length}টি অর্ডার ${emp.name}-কে অ্যাসাইন করা হয়েছে`);
    if (skipped > 0) toast.error(`${skipped}টি অর্ডার পেন্ডিং না হওয়ায় স্কিপ করা হয়েছে`);
    setSelectedOrders(new Set());
  };

  const handleBulkDelete = () => {
    if (!isAdmin) { toast.error('শুধুমাত্র অ্যাডমিন অর্ডার ডিলিট করতে পারবে'); return; }
    // Block devices of orders in blocking statuses before deleting
    const blockingStatuses = ['পেন্ডিং', 'হোল্ড', 'ক্যান্সেল', 'রিটার্ন'];
    selectedOrders.forEach((id) => {
      const order = orders.find(o => o.id === id);
      if (order && blockingStatuses.includes(order.status) && order.customerFingerprint) {
        blockWithAllIdentifiers(order.phone, order.customer, `অর্ডার ${order.id} (${order.status}) ডিলিট করায় ব্লক`, order.id);
      }
    });
    deleteOrdersInStore(selectedOrders);
    toast.success(`${selectedOrders.size}টি অর্ডার ডিলিট হয়েছে`);
    setSelectedOrders(new Set());
  };

  const handleDeleteOrder = (order: Order) => {
    setDeleteConfirmOrder(order);
    setDeleteConfirmStep(1);
  };

  const confirmDeleteStep = () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
    } else if (deleteConfirmStep === 2 && deleteConfirmOrder) {
      // Block device if order was in blocking status
      const blockingStatuses = ['পেন্ডিং', 'হোল্ড', 'ক্যান্সেল', 'রিটার্ন'];
      if (blockingStatuses.includes(deleteConfirmOrder.status) && deleteConfirmOrder.customerFingerprint) {
        blockWithAllIdentifiers(deleteConfirmOrder.phone, deleteConfirmOrder.customer, `অর্ডার ${deleteConfirmOrder.id} (${deleteConfirmOrder.status}) ডিলিট করায় ব্লক`, deleteConfirmOrder.id);
      }
      deleteOrdersInStore(new Set([deleteConfirmOrder.id]));
      toast.success(`অর্ডার ${deleteConfirmOrder.id} ডিলিট হয়েছে`);
      setDeleteConfirmOrder(null);
      setDeleteConfirmStep(0);
    }
  };

  const handleBulkBlock = async () => {
    let count = 0;
    for (const id of Array.from(selectedOrders)) {
      const order = orders.find(o => o.id === id);
      if (order && !isPhoneBlocked(order.phone)) {
        try {
          await blockWithAllIdentifiers(order.phone, order.customer, 'বাল্ক ব্লক', order.id);
          count++;
        } catch { /* skip failed entry; continue blocking others */ }
      }
    }
    toast.success(`${count}জন কাস্টমার ব্লক করা হয়েছে`);
    setSelectedOrders(new Set());
  };

  const handleBlockCustomer = async (phone: string, customerName: string, orderId?: string) => {
    if (!isAdmin) { toast.error('শুধুমাত্র অ্যাডমিন ব্লক করতে পারবেন'); return; }
    try {
      await blockWithAllIdentifiers(phone, customerName, 'সম্পূর্ণ ব্লক', orderId);
      toast.success(`${customerName}-কে ব্লক করা হয়েছে (ফোন + আইপি + ডিভাইস)`);
    } catch {
      toast.error(`${customerName}-কে ব্লক করা যায়নি। পরে আবার চেষ্টা করুন।`);
    }
  };

  const handleUnblockCustomer = async (phone: string, customerName: string, orderId?: string) => {
    const { ip, fingerprint } = getCustomerIdentifiers(phone, orderId);
    const matchingEntries = blockedList.filter(b => 
      (b.type === 'phone' && b.value === phone) ||
      (ip && b.type === 'ip' && b.value === ip) ||
      (fingerprint && b.type === 'fingerprint' && b.value === fingerprint)
    );
    for (const entry of matchingEntries) {
      await unblockCustomer(entry.id);
    }
    toast.success(`${customerName}-কে আনব্লক করা হয়েছে`);
  };

  const handleSaveNote = async () => {
    if (!holdNoteOrder) return;
    try {
      await updateOrderInStore({ ...holdNoteOrder, note: holdNoteText.trim() || undefined });
      if (holdNoteText.trim()) {
        toast.success(`অর্ডার ${holdNoteOrder.id}-এ নোট সেভ হয়েছে`);
      } else {
        toast.success(`অর্ডার ${holdNoteOrder.id}-এর নোট মুছে ফেলা হয়েছে`);
      }
      setHoldNoteOrder(null);
      setHoldNoteText('');
    } catch {
      // error toast already shown by the store
    }
  };

  const handleCreateNewOrder = async () => {
    if (!newOrderData.customer.trim() || !newOrderData.phone.trim() || !newOrderData.address.trim()) {
      toast.error('কাস্টমারের নাম, ফোন ও ঠিকানা দিন');
      return;
    }
    const nameErr = validateName(newOrderData.customer);
    if (nameErr) { setValidationMsg(nameErr); return; }
    const phoneErr = validatePhone(newOrderData.phone);
    if (phoneErr) { setValidationMsg(phoneErr); return; }
    if (newOrderItems.length === 0) {
      toast.error('অন্তত একটি প্রোডাক্ট যোগ করুন');
      return;
    }
    const confirmerName = currentEmployee?.name || 'অ্যাডমিন';
    const subtotal = newOrderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const orderId = await getNextInvoiceId();
    const newOrder: Order = {
      id: orderId,
      customer: newOrderData.customer.trim(),
      phone: newOrderData.phone.trim(),
      address: newOrderData.address.trim(),
      items: newOrderItems.map(i => ({ name: i.name, qty: i.qty, price: i.price, originalPrice: i.price, image: i.image, variations: i.variations, productId: i.productId, buyPrice: i.buyPrice, resellerPriceSnapshot: i.resellerPriceSnapshot, stockProductName: i.stockProductName })),
      deliveryCharge: newOrderData.deliveryCharge,
      originalDeliveryCharge: newOrderData.deliveryCharge,
      total: subtotal + newOrderData.deliveryCharge,
      status: 'কনফার্মড',
      date: new Date().toISOString(),
      confirmedBy: confirmerName,
    };
    addOrder(newOrder);
    setShowNewOrder(false);
    setNewOrderData({ customer: '', phone: '', address: '', deliveryCharge: 130 });
    setNewOrderItems([]);
    toast.success(`অর্ডার ${orderId} তৈরি হয়েছে — কনফার্মড by ${confirmerName}`);
  };

  // Courier info inline component
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

  // Unified courier tracking info - simplified display with edit & lock
  const CourierTrackingInfo = ({ orderId }: { orderId: string }) => {
    const sf = sfOrderData[orderId];
    const cb = cbOrderData[orderId];
    // Reactive subscriptions so the link/name appear as soon as follow_up_data loads
    // (otherwise a refresh / different browser reads the store before fetchAll completes
    // and the tracking link silently disappears).
    const fuTrackingUrl = useFollowUpStore((s) => s.trackingUrls[orderId]);
    const fuCourierName = useFollowUpStore((s) => s.courierNames[orderId]);
    const isLocked = courierLocked[orderId] || false;
    const currentStockType = stockTypes[orderId] || 'self';


    // Determine tracking ID and URL
    let trackingId = '';
    let trackingUrl = '';

    if (sf?.consignment_id && sf.steadfast_status !== 'manual') {
      const name = fuCourierName || 'Steadfast';
      trackingId = `${name} • CID: ${sf.consignment_id}`;
      trackingUrl = fuTrackingUrl || (sf.tracking_code ? buildSteadfastTrackingUrl(sf.tracking_code) : '');
    } else if (cb?.consignment_id) {
      const name = fuCourierName || 'CarryBee';
      trackingId = `${name} • CID: ${cb.consignment_id}`;
      trackingUrl = fuTrackingUrl || `https://merchant.carrybee.com/order-track/${cb.consignment_id}`;
    } else if (fuCourierName || sf?.steadfast_status === 'manual') {
      trackingId = fuCourierName || 'ম্যানুয়াল কুরিয়ার';
      trackingUrl = fuTrackingUrl || '';
    }

    if (!trackingId) return null;

    return (
      <div className="space-y-0.5 mt-1">
        <div className="flex items-center gap-1 flex-wrap">
          <p className="text-[10px] text-muted-foreground font-medium">{trackingId}</p>
          <div className="flex gap-0.5" title="স্টক টাইপ — সেলফ হলে স্টক থেকে কাটবে">
            <button
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer transition ${currentStockType !== 'vendor' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
              onClick={(e) => { e.stopPropagation(); setStockType(orderId, 'self'); toast.success('সেলফ স্টক সেট'); }}
            >সেলফ</button>
            <button
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer transition ${currentStockType === 'vendor' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditTrackingOrderId(orderId);
                setEditTrackingStockType('vendor');
                const vbp = useFollowUpStore.getState().vendorBuyPrices[orderId];
                setEditTrackingVendorPrice(vbp ? String(vbp) : '');
                const defaultName = fuCourierName || (sf?.consignment_id ? 'Steadfast' : (cb?.consignment_id ? 'CarryBee' : ''));
                setEditTrackingCourierName(defaultName);
                setEditTrackingUrl(trackingUrl);
              }}
            >ভেন্ডর</button>
          </div>
          {!isLocked && isAdmin && (
            <button
              className="text-blue-500 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                setEditTrackingOrderId(orderId);
                setEditTrackingStockType(currentStockType as OrderStockType);
                const vbp = useFollowUpStore.getState().vendorBuyPrices[orderId];
                setEditTrackingVendorPrice(vbp ? String(vbp) : '');
                // Populate courier name + tracking URL from current display values
                const defaultCourierName = fuCourierName || (sf?.consignment_id ? 'Steadfast' : (cb?.consignment_id ? 'CarryBee' : ''));
                setEditTrackingCourierName(defaultCourierName);
                setEditTrackingUrl(trackingUrl);
              }}
              title="এডিট"
            >
              <Edit className="w-3 h-3" />
            </button>
          )}
          {isLocked && (
            <Lock className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
        {trackingUrl ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[10px] px-2 border-orange-300 hover:bg-orange-50 text-orange-600"
            onClick={(e) => { e.stopPropagation(); window.open(trackingUrl, '_blank'); }}
          >
            <Truck className="w-3 h-3" /> কুরিয়ার ট্র্যাক
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[10px] px-2 border-blue-300 hover:bg-blue-50 text-blue-600"
            onClick={(e) => { e.stopPropagation(); setAddLinkOrderId(orderId); setAddLinkUrl(''); }}
          >
            <ExternalLink className="w-3 h-3" /> ট্র্যাকিং লিংক অ্যাড
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header row: title + search + date filter + new order button */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">অর্ডার সমূহ</h1>
            <p className="text-sm text-muted-foreground">মোট {orders.length}টি অর্ডার</p>
          </div>
          <div className="flex items-center gap-2">
            <ImportExportButtons
              data={orders.map(o => {
                const fu = useFollowUpStore.getState();
                return {
                  ...o,
                  _trackingUrl:    fu.trackingUrls[o.id]     || undefined,
                  _courierName:    fu.courierNames[o.id]     || undefined,
                  _stockType:      fu.stockTypes[o.id]       || undefined,
                  _vendorBuyPrice: fu.vendorBuyPrices[o.id]  || undefined,
                };
              })}
              filename="main-orders" label="অর্ডার"
              onImport={async (items: any[]) => {
                const { addOrder } = useOrderStore.getState();
                const fu = useFollowUpStore.getState();
                for (const item of items) {
                  const { id: _id, order_code: _oc, _trackingUrl, _courierName, _stockType, _vendorBuyPrice, ...rest } = item;
                  const newOrder = await addOrder({ ...rest, id: '' } as Order);
                  if (newOrder?.id) {
                    if (_trackingUrl)    fu.setTrackingUrl(newOrder.id, _trackingUrl);
                    if (_courierName)    fu.setCourierName(newOrder.id, _courierName);
                    if (_stockType)      fu.setStockType(newOrder.id, _stockType as 'self' | 'vendor');
                    if (_vendorBuyPrice) fu.setVendorBuyPrice(newOrder.id, Number(_vendorBuyPrice));
                  }
                }
              }}
            />
            <Button onClick={() => setShowNewOrder(true)} className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">নতুন অর্ডার</span><span className="sm:hidden">নতুন</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="অর্ডার, কাস্টমার বা ফোন খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 h-9 justify-start text-left font-normal", selectedDate ? "text-foreground" : "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4 shrink-0" />
                {selectedDate ? (
                  <span className="text-xs sm:text-sm">{selectedDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}</span>
                ) : (
                  <span className="text-xs sm:text-sm">তারিখ</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {selectedDate && (
            <Button variant="ghost" size="sm" className="gap-1 h-9 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setSelectedDate(undefined)}>
              <X className="w-3.5 h-3.5" /> মুছুন
            </Button>
          )}
        </div>
      </div>

      {/* Date filter info */}
      {selectedDate && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium">
            {selectedDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })} — মোট <span className="text-primary font-bold">{allFiltered.length}</span>টি অর্ডার
          </span>
        </div>
      )}

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {allStatuses.map((s) => {
          const statusOrders = s === 'সব' ? orders : orders.filter(o => o.status === s);
          const count = statusOrders.length;
          const amount = statusOrders.reduce((sum, o) => sum + o.total, 0);
          const isActive = statusFilter === s;
          const colorMap: Record<string, string> = {
            'সব': 'bg-blue-500 text-white',
            'পেন্ডিং': 'bg-yellow-500 text-white',
            'হোল্ড': 'bg-amber-500 text-white',
            'কনফার্মড': 'bg-green-500 text-white',
            'প্যাকেজিং': 'bg-indigo-500 text-white',
            'শিপমেন্ট': 'bg-purple-500 text-white',
            'এসাইন': 'bg-teal-500 text-white',
            'ফলোয়াপ': 'bg-cyan-500 text-white',
            'ডেলিভারড': 'bg-emerald-500 text-white',
            'ক্যান্সেল': 'bg-red-500 text-white',
            'রিটার্নিং': 'bg-rose-400 text-rose-950',
            'রিটার্ন': 'bg-orange-500 text-white',
            'পেইড রিটার্নিং': 'bg-fuchsia-400 text-fuchsia-950',
            'পেইড রিটার্ন': 'bg-pink-500 text-white',
          };
          const inactiveColorMap: Record<string, string> = {
            'সব': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
            'পেন্ডিং': 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
            'হোল্ড': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
            'কনফার্মড': 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
            'প্যাকেজিং': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
            'শিপমেন্ট': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
            'এসাইন': 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
            'ফলোয়াপ': 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
            'ডেলিভারড': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
            'ক্যান্সেল': 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
            'রিটার্নিং': 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
            'রিটার্ন': 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
            'পেইড রিটার্নিং': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100',
            'পেইড রিটার্ন': 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
          };
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all whitespace-nowrap',
                isActive
                  ? `${colorMap[s] || 'bg-blue-500 text-white'} border-transparent shadow-md`
                  : `${inactiveColorMap[s] || 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`
              )}
            >
              <span className="font-bold">{count}</span>
              <span>{s === 'সব' ? 'মোট অর্ডার' : s}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk Actions Bar */}
      {selectedOrders.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedOrders.size}টি সিলেক্ট করা হয়েছে</span>
          </div>
          <Select value="" onValueChange={(v) => handleBulkStatusChange(v)}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="স্ট্যাটাস পরিবর্তন" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value="" onValueChange={(v) => handleBulkAssign(v)}>
            <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="এমপ্লয়ীকে অ্যাসাইন" /></SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleBulkBlock}>
            <ShieldBan className="w-3.5 h-3.5" /> বাল্ক ব্লক
          </Button>
          {isAdmin && (
            <Button variant="destructive" size="sm" className="h-8 text-xs gap-1" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5" /> বাল্ক ডিলিট
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={() => setSelectedOrders(new Set())}>
            সিলেকশন বাতিল
          </Button>
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
                    <Checkbox checked={selectedOrders.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
                  </th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[110px]">ইনভয়েজ</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[220px]">কাস্টমার</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[170px]">প্রোডাক্ট</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[120px]">মূল্য</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[150px]">একটিভিটি</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[120px]">একশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className={`border-b last:border-0 hover:bg-muted/30 align-top ${selectedOrders.has(order.id) ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-2 text-center">
                      <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="h-3.5 w-3.5" />
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-primary text-sm">{order.id}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{getRelativeTime(order.date)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {isReturningCustomer(order) ? (
                          <button onClick={() => setHistoryForOrderId(order.id)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors">
                            <UserCheck className="w-3 h-3" /> পুরাতন
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                            <UserPlus className="w-3 h-3" /> নতুন
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-foreground text-sm">{order.customer}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[190px]">{order.address}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-foreground text-xs cursor-pointer hover:underline inline-flex items-center gap-0.5" onClick={() => checkCourierRatio(order.phone)}>
                          <Phone className="w-3 h-3 text-muted-foreground shrink-0" />{order.phone}
                        </p>
                        {courierData[normalizePhone(order.phone) || order.phone]?.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <CourierFraudInline phone={order.phone} />
                      <div className="flex gap-1 mt-1.5">
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-green-300 hover:bg-green-50" onClick={() => window.open(`tel:${order.phone}`)}><Phone className="w-3 h-3 text-green-600" /></Button>
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-blue-300 hover:bg-blue-50" onClick={() => { navigator.clipboard.writeText(order.phone); toast.success('নাম্বার কপি হয়েছে'); }}><Copy className="w-3 h-3 text-blue-600" /></Button>
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-emerald-300 hover:bg-emerald-50" onClick={() => { const msg = buildWhatsAppMessage(order, storeProducts); window.open(`https://wa.me/88${order.phone}?text=${encodeURIComponent(msg)}`, '_blank'); }}><MessageCircle className="w-3 h-3 text-emerald-600" /></Button>
                        <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-purple-300 hover:bg-purple-50" onClick={() => setDetailOrderId(order.id)}><Eye className="w-3 h-3 text-purple-600" /></Button>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1.5">
                        {order.items.map((item, i) => {
                          const matchedProduct = storeProducts.find(p => p.title === item.name);
                          return (
                            <div key={i} className="flex items-center gap-1.5 cursor-pointer" onClick={() => matchedProduct && setPreviewProduct(matchedProduct)}>
                              <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover border" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">{item.name}</p>
                                {item.variations && Object.keys(item.variations).length > 0 && (
                                  <p className="text-[13px] font-medium text-foreground">{Object.entries(item.variations).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">×{item.qty} — ৳{(item.price * item.qty).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-foreground">প্রাইজ: ৳{getSubtotal(order.items).toLocaleString()}</p>
                        <p className="text-xs text-foreground">চার্জ: ৳{order.deliveryCharge}</p>
                        <p className="text-sm font-bold text-foreground">মোট: ৳{order.total.toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1.5">
                        {/* Status dropdown - locked for delivered/return/paid return */}
                        {['ডেলিভারড', 'পেইড রিটার্ন'].includes(order.status) ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status] || ''}`}>{order.status} 🔒</span>
                        ) : (
                        <Select value={order.status} onValueChange={(val) => updateStatus(order.id, val)}>
                          <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => (
                              <SelectItem key={s} value={s}><span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[s] || ''}`}>{s}</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        )}
                        {/* Assign - locked after confirm */}
                        {isAdmin && !order.confirmedBy && order.status !== 'ক্যান্সেল' && (
                          <Select value={order.assignedTo || ''} disabled={order.status !== 'পেন্ডিং'} onValueChange={(val) => {
                            if (order.status !== 'পেন্ডিং') { toast.error('শুধু পেন্ডিং অর্ডার এসাইন করা যাবে'); return; }
                            if (val === '__unassign__') { unassignOrder(order.id); toast.info('অ্যাসাইন সরানো হয়েছে'); }
                            else { const emp = employees.find(e => e.id === val); if (emp) { assignOrder(order.id, emp.id, emp.name); toast.success(`${emp.name}-কে অ্যাসাইন করা হয়েছে`); } }
                          }}>
                            <SelectTrigger className="h-6 text-[10px] w-[120px] gap-1">
                              <UserCog className="w-3 h-3 shrink-0" />
                              <SelectValue placeholder="অ্যাসাইন" />
                            </SelectTrigger>
                            <SelectContent>
                              {order.assignedTo && <SelectItem value="__unassign__">অ্যাসাইন সরান</SelectItem>}
                              {employees.filter(e => e.isActive && e.permissions?.includes('orders')).map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {/* Courier tracking moved to action column */}
                        {order.source && (
                          <p className="text-[10px] text-muted-foreground">
                            সোর্স: <span className="font-semibold text-foreground">{order.source}</span>
                          </p>
                        )}
                        {(() => {
                          const isAssignable = order.status === 'পেন্ডিং' || order.status === 'হোল্ড';
                          if (isAssignable && order.assignedToName) {
                            return <p className="text-[10px] text-muted-foreground">অ্যাসাইন: <span className="font-semibold text-foreground">{order.assignedToName}</span></p>;
                          }
                          if (!isAssignable) {
                            const actor = order.confirmedBy || order.assignedToName;
                            if (actor) return <p className="text-[10px] text-muted-foreground">{order.status}: <span className="font-semibold text-foreground">{actor}</span></p>;
                          }
                          return null;
                        })()}
                        {order.note && (
                          <div className="flex items-start gap-1 mt-0.5">
                            <StickyNote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground italic leading-tight">{order.note}</p>
                          </div>
                        )}
                        {order.smsSent && Object.keys(order.smsSent).length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 mt-1" title={Object.keys(order.smsSent).join(', ')}>
                            <CheckCircle2 className="w-2.5 h-2.5" /> SMS: Done
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1.5">
                        <CourierTrackingInfo orderId={order.id} />
                        <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Courier send button - only for কনফার্মড */}
                        {order.status === 'কনফার্মড' && !isSentToCourier(order.id) && (
                          <Button
                            size="sm"
                            className="h-7 w-7 p-0 bg-orange-500 hover:bg-orange-600 text-white"
                            disabled={sendingToSf.has(order.id) || sendingToCb.has(order.id)}
                            onClick={() => setCourierPickerOrder(order)}
                            title="কুরিয়ারে পাঠান"
                          >
                            {(sendingToSf.has(order.id) || sendingToCb.has(order.id)) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                          </Button>
                        )}
                        {order.status === 'কনফার্মড' && isSentToCourier(order.id) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" /> পাঠানো হয়েছে
                          </span>
                        )}
                        {isConfirmedOrBeyond(order.status) && (
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="ইনভয়েজ প্রিন্ট" onClick={() => printInvoice(order)}>
                            <Printer className="w-4 h-4 text-foreground" />
                          </Button>
                        )}
                        {isPhoneBlocked(order.phone) ? (
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-destructive/30 bg-destructive/10" title="আনব্লক করুন" onClick={() => handleUnblockCustomer(order.phone, order.customer, order.id)}>
                            <ShieldBan className="w-4 h-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="ব্লক" onClick={() => handleBlockCustomer(order.phone, order.customer, order.id)}>
                            <ShieldBan className="w-4 h-4 text-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="outline" size="sm" className="h-7 w-7 p-0 border-amber-300 hover:bg-amber-50"
                          title="নোট"
                          onClick={() => { setHoldNoteOrder(order); setHoldNoteText(order.note || ''); }}
                        >
                          <StickyNote className="w-4 h-4 text-amber-500" />
                        </Button>
                        {(order.status === 'হোল্ড' || order.status === 'ফলোয়াপ') && (
                          <Button
                            variant="outline" size="sm" className="h-7 w-7 p-0 border-emerald-300 hover:bg-emerald-50"
                            title="SMS পাঠান"
                            onClick={() => setManualSmsOrder(order)}
                          >
                            <Send className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {isAdmin && order.status === 'পেন্ডিং' && (
                          <Button
                            variant="outline" size="sm" className="h-7 w-7 p-0 border-destructive/30 hover:bg-destructive/10"
                            title="ডিলিট"
                            onClick={() => handleDeleteOrder(order)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile/Tablet Card Layout */}
      <div className="lg:hidden space-y-3">
        {filtered.map((order) => {
          const isOld = isReturningCustomer(order);
          const lockedStatus = ['ডেলিভারড', 'পেইড রিটার্ন'].includes(order.status);
          return (
          <Card key={order.id} className={`shadow-sm rounded-xl overflow-hidden ${selectedOrders.has(order.id) ? 'border-primary/40 bg-primary/5' : 'border'}`}>
            <CardContent className="p-3 space-y-2.5">
              {/* Header: checkbox + invoice/time + status badge */}
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} className="h-4 w-4" />
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-primary text-sm">{order.id}</span>
                  <span className="text-[10px] text-muted-foreground">{getRelativeTime(order.date)}</span>
                  {isOld ? (
                    <button onClick={() => setHistoryForOrderId(order.id)} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      <UserCheck className="w-2.5 h-2.5" /> পুরাতন
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                      <UserPlus className="w-2.5 h-2.5" /> নতুন
                    </span>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[order.status] || 'bg-muted'}`}>
                  {order.status}
                </span>
              </div>

              {/* Customer info */}
              <div className="bg-muted/40 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{order.customer}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{order.address}</p>
                  </div>
                  <button onClick={() => checkCourierRatio(order.phone)} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline">
                    <Phone className="w-3 h-3 text-muted-foreground" />{order.phone}
                    {courierData[normalizePhone(order.phone) || order.phone]?.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </button>
                </div>
                <CourierFraudInline phone={order.phone} />
                <div className="flex gap-1.5 pt-0.5">
                  <Button variant="outline" size="sm" className="h-7 flex-1 p-0 border-green-300 hover:bg-green-50" onClick={() => window.open(`tel:${order.phone}`)}><Phone className="w-3.5 h-3.5 text-green-600" /></Button>
                  <Button variant="outline" size="sm" className="h-7 flex-1 p-0 border-blue-300 hover:bg-blue-50" onClick={() => { navigator.clipboard.writeText(order.phone); toast.success('নাম্বার কপি হয়েছে'); }}><Copy className="w-3.5 h-3.5 text-blue-600" /></Button>
                  <Button variant="outline" size="sm" className="h-7 flex-1 p-0 border-emerald-300 hover:bg-emerald-50" onClick={() => { const msg = buildWhatsAppMessage(order, storeProducts); window.open(`https://wa.me/88${order.phone}?text=${encodeURIComponent(msg)}`, '_blank'); }}><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /></Button>
                  <Button variant="outline" size="sm" className="h-7 flex-1 p-0 border-purple-300 hover:bg-purple-50" onClick={() => setDetailOrderId(order.id)}><Eye className="w-3.5 h-3.5 text-purple-600" /></Button>
                </div>
              </div>

              {/* Products */}
              <div className="space-y-2">
                {order.items.map((item, i) => {
                  const matchedProduct = storeProducts.find(p => p.title === item.name);
                  return (
                    <div key={i} className="flex items-center gap-2.5 cursor-pointer" onClick={() => matchedProduct && setPreviewProduct(matchedProduct)}>
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover border shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-snug">{item.name}</p>
                        {item.variations && Object.keys(item.variations).length > 0 && (
                          <p className="text-[11px] text-muted-foreground">{Object.entries(item.variations).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">×{item.qty}</p>
                      </div>
                      <span className="text-xs font-semibold text-foreground shrink-0">৳{(item.price * item.qty).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Price summary */}
              <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-2 text-center">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">প্রাইজ</p>
                  <p className="text-xs font-semibold">৳{getSubtotal(order.items).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase">চার্জ</p>
                  <p className="text-xs font-semibold">৳{order.deliveryCharge}</p>
                </div>
                <div className="border-l border-border">
                  <p className="text-[9px] text-muted-foreground uppercase">মোট</p>
                  <p className="text-xs font-bold text-primary">৳{order.total.toLocaleString()}</p>
                </div>
              </div>

              {/* Status + Assign */}
              <div className="flex items-center gap-2 flex-wrap">
                {lockedStatus ? (
                  <span className={`px-2.5 py-1 rounded text-[11px] font-medium ${statusColors[order.status] || ''}`}>{order.status} 🔒</span>
                ) : (
                  <Select value={order.status} onValueChange={(val) => updateStatus(order.id, val)}>
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s}><span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[s] || ''}`}>{s}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {isAdmin && !order.confirmedBy && order.status !== 'ক্যান্সেল' && (
                  <Select value={order.assignedTo || ''} disabled={order.status !== 'পেন্ডিং'} onValueChange={(val) => {
                    if (order.status !== 'পেন্ডিং') { toast.error('শুধু পেন্ডিং অর্ডার এসাইন করা যাবে'); return; }
                    if (val === '__unassign__') { unassignOrder(order.id); toast.info('অ্যাসাইন সরানো হয়েছে'); }
                    else { const emp = employees.find(e => e.id === val); if (emp) { assignOrder(order.id, emp.id, emp.name); toast.success(`${emp.name}-কে অ্যাসাইন করা হয়েছে`); } }
                  }}>
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px] gap-1">
                      <UserCog className="w-3 h-3 shrink-0" />
                      <SelectValue placeholder="অ্যাসাইন" />
                    </SelectTrigger>
                    <SelectContent>
                      {order.assignedTo && <SelectItem value="__unassign__">অ্যাসাইন সরান</SelectItem>}
                      {employees.filter(e => e.isActive && e.permissions?.includes('orders')).map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Meta info */}
              {(() => {
                const isAssignable = order.status === 'পেন্ডিং' || order.status === 'হোল্ড';
                const actor = !isAssignable ? (order.confirmedBy || order.assignedToName) : (isAssignable && order.assignedToName ? order.assignedToName : null);
                const hasMeta = actor || order.source || order.note;
                if (!hasMeta) return null;
                return (
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    {actor && (
                      <p>{isAssignable ? 'অ্যাসাইন' : order.status}: <span className="font-semibold text-foreground">{actor}</span></p>
                    )}
                    {order.source && (
                      <p>সোর্স: <span className="font-semibold text-foreground">{order.source}</span></p>
                    )}
                    {order.note && (
                      <div className="flex items-start gap-1">
                        <StickyNote className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <p className="italic leading-tight">{order.note}</p>
                      </div>
                    )}
                    {order.smsSent && Object.keys(order.smsSent).length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800" title={Object.keys(order.smsSent).join(', ')}>
                        <CheckCircle2 className="w-3 h-3" /> SMS: Done
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Courier tracking */}
              <CourierTrackingInfo orderId={order.id} />

              {/* Actions */}
              <div className="border-t pt-2 flex items-center gap-1.5 flex-wrap">
                {order.status === 'কনফার্মড' && !isSentToCourier(order.id) && (
                  <Button
                    size="sm"
                    className="h-8 w-8 p-0 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={sendingToSf.has(order.id) || sendingToCb.has(order.id)}
                    onClick={() => setCourierPickerOrder(order)}
                    title="কুরিয়ারে পাঠান"
                  >
                    {(sendingToSf.has(order.id) || sendingToCb.has(order.id)) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  </Button>
                )}
                {order.status === 'কনফার্মড' && isSentToCourier(order.id) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3" /> পাঠানো হয়েছে
                  </span>
                )}
                {isConfirmedOrBeyond(order.status) && (
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="ইনভয়েজ প্রিন্ট" onClick={() => printInvoice(order)}>
                    <Printer className="w-4 h-4 text-foreground" />
                  </Button>
                )}
                {isPhoneBlocked(order.phone) ? (
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-destructive/30 bg-destructive/10" title="আনব্লক করুন" onClick={() => handleUnblockCustomer(order.phone, order.customer, order.id)}>
                    <ShieldBan className="w-4 h-4 text-destructive" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="ব্লক" onClick={() => handleBlockCustomer(order.phone, order.customer, order.id)}>
                    <ShieldBan className="w-4 h-4 text-foreground" />
                  </Button>
                )}
                <Button
                  variant="outline" size="sm" className="h-8 w-8 p-0 border-amber-300 hover:bg-amber-50"
                  title="নোট"
                  onClick={() => { setHoldNoteOrder(order); setHoldNoteText(order.note || ''); }}
                >
                  <StickyNote className="w-4 h-4 text-amber-500" />
                </Button>
                {(order.status === 'হোল্ড' || order.status === 'ফলোয়াপ') && (
                  <Button
                    variant="outline" size="sm" className="h-8 w-8 p-0 border-emerald-300 hover:bg-emerald-50"
                    title="SMS পাঠান"
                    onClick={() => setManualSmsOrder(order)}
                  >
                    <Send className="w-4 h-4 text-emerald-600" />
                  </Button>
                )}
                {isAdmin && order.status === 'পেন্ডিং' && (
                  <Button
                    variant="outline" size="sm" className="h-8 w-8 p-0 border-destructive/30 hover:bg-destructive/10"
                    title="ডিলিট"
                    onClick={() => handleDeleteOrder(order)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {!search && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>পূর্ববর্তী</Button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>পরবর্তী</Button>
        </div>
      )}

      {/* Order Detail Dialog */}
      {detailOrderId && orders.find(o => o.id === detailOrderId) && (
        <OrderDetailDialog
          order={orders.find(o => o.id === detailOrderId)!}
          open={!!detailOrderId}
          onOpenChange={(open) => { if (!open) setDetailOrderId(null); }}
          onSave={updateOrder}
          onStatusChange={(orderId, newStatus) => {
            const order = orders.find(o => o.id === orderId);
            if (order) {
              updateOrderInStore({ ...order, status: newStatus }).catch(() => {});
              toast.success(`অর্ডার ${orderId} স্ট্যাটাস: ${newStatus}`);
            }
          }}
          onNoteChange={(orderId, note) => {
            const order = orders.find(o => o.id === orderId);
            if (order) {
              updateOrderInStore({ ...order, note: note || undefined }).catch(() => {});
            }
          }}
        />
      )}

      {/* Manual SMS dialog for হোল্ড / ফলোয়াপ */}
      {manualSmsOrder && (
        <ManualSmsDialog
          open={!!manualSmsOrder}
          onOpenChange={(open) => { if (!open) setManualSmsOrder(null); }}
          phone={manualSmsOrder.phone}
          vars={buildMainOrderVars(manualSmsOrder)}
          templates={manualSmsOrder.status === 'হোল্ড' ? smsHoldTemplates : smsFollowupTemplates}
          title={`${manualSmsOrder.status} SMS — ${manualSmsOrder.id}`}
        />
      )}

      {/* Previous Orders Dialog */}
      {historyForOrderId && (() => {
        const o = orders.find(x => x.id === historyForOrderId);
        if (!o) return null;
        const history = getHistoryForOrder(o);
        return (
          <CustomerHistoryDialog
            open={true}
            onOpenChange={(open) => { if (!open) setHistoryForOrderId(null); }}
            title={`পূর্ববর্তী অর্ডার — ${o.phone}`}
            orders={history}
            statusColors={statusColors}
          />
        );
      })()}

      {/* Product Preview Dialog */}
      {previewProduct && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setPreviewProduct(null); }}>
          <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{previewProduct.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {(previewProduct.featuredImage || previewProduct.images[0]) && (
                <img src={previewProduct.featuredImage || previewProduct.images[0]} alt={previewProduct.title} className="w-full rounded-lg border" />
              )}
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary">৳{previewProduct.price.toLocaleString()}</span>
                {previewProduct.originalPrice && <span className="text-sm text-muted-foreground line-through">৳{previewProduct.originalPrice.toLocaleString()}</span>}
              </div>
              {previewProduct.shortDescription && (
                <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: previewProduct.shortDescription }} />
              )}
              {previewProduct.longDescription && (
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">বিস্তারিত বিবরণ</p>
                  <div className="text-sm text-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewProduct.longDescription }} />
                </div>
              )}
              {previewProduct.colors && previewProduct.colors.length > 0 && (
                <div className="text-xs"><span className="text-muted-foreground">কালার:</span> {previewProduct.colors.join(', ')}</div>
              )}
              {previewProduct.sizes && previewProduct.sizes.length > 0 && (
                <div className="text-xs"><span className="text-muted-foreground">সাইজ:</span> {previewProduct.sizes.join(', ')}</div>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigate(`/product/${previewProduct.slug}`); setPreviewProduct(null); }}>
                <ExternalLink className="w-3.5 h-3.5" /> প্রোডাক্ট পেজে যান
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New Order Dialog */}
      {showNewOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setShowNewOrder(false); setNewOrderItems([]); setNewOrderData({ customer: '', phone: '', address: '', deliveryCharge: 130 }); } }}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">নতুন অর্ডার তৈরি করুন</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">কাস্টমারের নাম *</label>
                  <Input value={newOrderData.customer} onChange={(e) => setNewOrderData(p => ({ ...p, customer: e.target.value }))} placeholder="নাম লিখুন" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ফোন নাম্বার *</label>
                  <Input value={newOrderData.phone} onChange={(e) => setNewOrderData(p => ({ ...p, phone: e.target.value }))} placeholder="01XXXXXXXXX" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ঠিকানা *</label>
                  <Input value={newOrderData.address} onChange={(e) => setNewOrderData(p => ({ ...p, address: e.target.value }))} placeholder="সম্পূর্ণ ঠিকানা" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ডেলিভারি চার্জ</label>
                  <Input type="number" value={newOrderData.deliveryCharge} onChange={(e) => setNewOrderData(p => ({ ...p, deliveryCharge: Math.max(0, parseInt(e.target.value) || 0) }))} className="mt-1 w-32" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">প্রোডাক্ট যোগ করুন *</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="প্রোডাক্ট সার্চ..." value={newOrderProductSearch} onChange={(e) => setNewOrderProductSearch(e.target.value)} className="pl-8 text-sm" />
                </div>
                {newOrderProductSearch && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg">
                    {storeProducts.filter(p => p.title.toLowerCase().includes(newOrderProductSearch.toLowerCase())).map(p => (
                      <button key={p.id} onClick={() => {
                        const hasVariations = (p.colors && p.colors.length > 0) || (p.sizes && p.sizes.length > 0) || (p.weights && p.weights.length > 0);
                        if (hasVariations) {
                          setPendingVariationProduct(p);
                          setPendingVariations({});
                        } else {
                          setNewOrderItems(prev => [...prev, { productId: p.id, name: p.title, price: p.price, qty: 1, image: p.images[0] + '&w=80&h=80&fit=crop', buyPrice: typeof p.buyPrice === 'number' ? p.buyPrice : undefined, resellerPriceSnapshot: typeof p.resellerPrice === 'number' ? p.resellerPrice : undefined, stockProductName: p.stockProductName || undefined }]);
                        }
                        setNewOrderProductSearch('');
                      }} className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left text-sm">
                        <img src={p.images[0] + '&w=40&h=40&fit=crop'} alt={p.title} className="w-8 h-8 rounded object-cover border" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground">৳{p.price.toLocaleString()}</p>
                        </div>
                        <Plus className="w-4 h-4 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Variation Picker */}
                {pendingVariationProduct && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold">{pendingVariationProduct.title} — ভেরিয়েন্ট বাছুন</p>
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
                      <Button variant="outline" size="sm" onClick={() => setPendingVariationProduct(null)}>বাতিল</Button>
                      <Button size="sm" onClick={() => {
                        const p = pendingVariationProduct;
                        // Check variation price
                        let price = p.price;
                        if (p.variationPrices && p.variationPrices.length > 0) {
                          for (const vp of p.variationPrices) {
                            const key = vp.variationType === 'color' ? 'কালার' : vp.variationType === 'size' ? 'সাইজ' : 'কেজি/ওজন';
                            if (pendingVariations[key] === vp.variationName && vp.price) {
                              price = vp.price;
                              break;
                            }
                          }
                        }
                        setNewOrderItems(prev => [...prev, { productId: p.id, name: p.title, price, qty: 1, image: p.images[0] + '&w=80&h=80&fit=crop', variations: Object.keys(pendingVariations).length > 0 ? pendingVariations : undefined, buyPrice: typeof p.buyPrice === 'number' ? p.buyPrice : undefined, resellerPriceSnapshot: typeof p.resellerPrice === 'number' ? p.resellerPrice : undefined, stockProductName: p.stockProductName || undefined }]);
                        setPendingVariationProduct(null);
                        setPendingVariations({});
                      }}>যোগ করুন</Button>
                    </div>
                  </div>
                )}
              </div>

              {newOrderItems.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3">
                  {newOrderItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        {item.variations && Object.entries(item.variations).map(([k, v]) => (
                          <p key={k} className="text-[10px] text-muted-foreground">{k}: {v}</p>
                        ))}
                      </div>
                      <Input type="number" min={1} value={item.qty} onChange={(e) => {
                        const qty = Math.max(1, parseInt(e.target.value) || 1);
                        setNewOrderItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty } : it));
                      }} className="h-7 w-14 text-xs" />
                      <span className="text-xs font-medium shrink-0">৳{(item.price * item.qty).toLocaleString()}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setNewOrderItems(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="border-t pt-2 text-sm font-bold flex justify-between">
                    <span>মোট:</span>
                    <span>৳{(newOrderItems.reduce((s, i) => s + i.price * i.qty, 0) + newOrderData.deliveryCharge).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewOrder(false)}>বাতিল</Button>
                <Button onClick={handleCreateNewOrder}>অর্ডার তৈরি করুন</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <ValidationPopup open={!!validationMsg} message={validationMsg} onClose={() => setValidationMsg('')} />

      {/* Hold with Note Dialog */}
      {holdNoteOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setHoldNoteOrder(null); setHoldNoteText(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" /> নোট — {holdNoteOrder.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">অর্ডারে নোট লিখুন (মুছে সেভ দিলে নোট ডিলিট হবে):</p>
              <Textarea
                value={holdNoteText}
                onChange={(e) => setHoldNoteText(e.target.value)}
                placeholder="যেমন: কাস্টমার ফোন ধরছে না, পরে কল করতে হবে..."
                rows={3}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setHoldNoteOrder(null); setHoldNoteText(''); }}>বাতিল</Button>
                <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSaveNote}>
                  <StickyNote className="w-4 h-4" /> সেভ করুন
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Courier Picker Dialog */}
      {courierPickerOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setCourierPickerOrder(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" /> কুরিয়ার সিলেক্ট করুন
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">অর্ডার <span className="font-semibold text-foreground">{courierPickerOrder.id}</span> — {courierPickerOrder.customer}</p>
            <div className="space-y-2 pt-2">
              <Button
                className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white h-11"
                disabled={sendingToSf.has(courierPickerOrder.id)}
                onClick={() => {
                  const o = courierPickerOrder;
                  setCourierPickerOrder(null);
                  requireDeliveryCharge([o], () => {
                    const auto = o.items.reduce((sum: number, item: any) => {
                      if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
                        return sum + item.buyPrice * item.qty;
                      }
                      const mp = storeProducts.find(p => p.id === item.productId || p.title === item.name);
                      return sum + (mp?.buyPrice || 0) * item.qty;
                    }, 0);
                    setApiCourierStockType('self');
                    setApiCourierVendorPrice(String(auto));
                    setApiCourierPromptOrder({ order: o, provider: 'steadfast' });
                  });
                }}
              >
                {sendingToSf.has(courierPickerOrder.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Steadfast-এ পাঠান
              </Button>
              <Button
                className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white h-11"
                disabled={sendingToCb.has(courierPickerOrder.id)}
                onClick={() => {
                  const o = courierPickerOrder;
                  setCourierPickerOrder(null);
                  requireDeliveryCharge([o], () => {
                    const auto = o.items.reduce((sum: number, item: any) => {
                      if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
                        return sum + item.buyPrice * item.qty;
                      }
                      const mp = storeProducts.find(p => p.id === item.productId || p.title === item.name);
                      return sum + (mp?.buyPrice || 0) * item.qty;
                    }, 0);
                    setApiCourierStockType('self');
                    setApiCourierVendorPrice(String(auto));
                    setApiCourierPromptOrder({ order: o, provider: 'carrybee' });
                  });
                }}
              >
                {sendingToCb.has(courierPickerOrder.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                CarryBee-তে পাঠান
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 h-11"
                onClick={() => { const o = courierPickerOrder; setCourierPickerOrder(null); requireDeliveryCharge([o], () => setManualCourierOrder(o.id)); }}
              >
                <Send className="w-4 h-4" /> ম্যানুয়াল কুরিয়ার
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Courier Dialog */}
      {manualCourierOrder && (() => {
        const mcOrder = orders.find(o => o.id === manualCourierOrder);
        // Check if any product in order has vendor stock type
        const hasVendorStockProduct = mcOrder?.items.some((item: any) => {
          const mp = storeProducts.find(p => p.id === item.productId || p.title === item.name);
          return mp?.stockType === 'vendor';
        });
        // Auto-calculate buy price for vendor
        const autoBuyPrice = mcOrder ? mcOrder.items.reduce((sum: number, item: any) => {
          if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
            return sum + item.buyPrice * item.qty;
          }
          const mp = storeProducts.find(p => p.id === item.productId || p.title === item.name);
          return sum + (mp?.buyPrice || 0) * item.qty;
        }, 0) : 0;

        return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setManualCourierOrder(null); setManualCourierName(''); setManualTrackingLink(''); setManualCourierStockType('self'); setManualVendorBuyPrice(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> ম্যানুয়াল কুরিয়ার — {manualCourierOrder}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium">স্টক টাইপ</Label>
                <Select value={manualCourierStockType} onValueChange={(v) => {
                  setManualCourierStockType(v as OrderStockType);
                  if (v === 'vendor') setManualVendorBuyPrice(String(autoBuyPrice));
                  else setManualVendorBuyPrice('');
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">সেলফ স্টক</SelectItem>
                    <SelectItem value="vendor">ভেন্ডর স্টক</SelectItem>
                  </SelectContent>
                </Select>
                {manualCourierStockType === 'self' && hasVendorStockProduct && (
                  <p className="text-xs text-orange-600 mt-1">⚠️ আপনার স্টকে এই প্রডাক্টটি নেই। দয়া করে প্রডাক্ট স্টক করুন বা প্রডাক্ট পোস্ট এডিট করে সেল্ফ স্টক করুন।</p>
                )}
              </div>
              {manualCourierStockType === 'vendor' && (
                <div>
                  <Label className="text-xs font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</Label>
                  <Input
                    type="number"
                    value={manualVendorBuyPrice}
                    onChange={(e) => setManualVendorBuyPrice(e.target.value)}
                    placeholder="কেনা দাম লিখুন"
                    className="mt-1"
                    min="0"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs font-medium">কুরিয়ারের নাম *</Label>
                <Input value={manualCourierName} onChange={(e) => setManualCourierName(e.target.value)} placeholder="যেমন: Pathao, RedX..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">ট্র্যাকিং লিংক (ঐচ্ছিক)</Label>
                <Input value={manualTrackingLink} onChange={(e) => setManualTrackingLink(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setManualCourierOrder(null); setManualCourierName(''); setManualTrackingLink(''); setManualCourierStockType('self'); setManualVendorBuyPrice(''); }}>বাতিল</Button>
                <Button className="gap-1.5" onClick={() => handleManualCourier(manualCourierOrder)}>
                  <Send className="w-4 h-4" /> পাঠান
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        );
      })()}

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
                <div>
                  <Label className="text-xs font-medium">স্টক টাইপ</Label>
                  <Select value={apiCourierStockType} onValueChange={(v) => {
                    setApiCourierStockType(v as OrderStockType);
                    if (v === 'vendor') {
                      const auto = apiOrder.items.reduce((sum: number, item: any) => {
                        if (typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
                          return sum + item.buyPrice * item.qty;
                        }
                        const mp = storeProducts.find(p => p.id === item.productId || p.title === item.name);
                        return sum + (mp?.buyPrice || 0) * item.qty;
                      }, 0);
                      if (!apiCourierVendorPrice) setApiCourierVendorPrice(String(auto));
                    }
                  }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">সেলফ স্টক</SelectItem>
                      <SelectItem value="vendor">ভেন্ডর স্টক</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {apiCourierStockType === 'vendor' && (
                  <div>
                    <Label className="text-xs font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর) *</Label>
                    <Input
                      type="number"
                      value={apiCourierVendorPrice}
                      onChange={(e) => setApiCourierVendorPrice(e.target.value)}
                      placeholder="কেনা দাম লিখুন"
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">এই দাম থেকেই প্রফিট হিসাব হবে।</p>
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

      {/* Edit Tracking / Stock Type Dialog */}
      {editTrackingOrderId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setEditTrackingOrderId(null); setEditTrackingCourierName(''); setEditTrackingUrl(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-500" /> ট্র্যাকিং এডিট — {editTrackingOrderId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium">কুরিয়ার নাম</Label>
                <Input
                  value={editTrackingCourierName}
                  onChange={(e) => setEditTrackingCourierName(e.target.value)}
                  placeholder="কুরিয়ার নাম"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">ট্র্যাকিং লিংক</Label>
                <Input
                  value={editTrackingUrl}
                  onChange={(e) => setEditTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">স্টক টাইপ</Label>
                <Select value={editTrackingStockType} onValueChange={(v) => setEditTrackingStockType(v as OrderStockType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">সেলফ স্টক</SelectItem>
                    <SelectItem value="vendor">ভেন্ডর স্টক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editTrackingStockType === 'vendor' && (
                <div>
                  <Label className="text-xs font-medium">প্রোডাক্টের কেনা দাম (ভেন্ডর)</Label>
                  <Input
                    type="number"
                    value={editTrackingVendorPrice}
                    onChange={(e) => setEditTrackingVendorPrice(e.target.value)}
                    placeholder="কেনা দাম লিখুন"
                    className="mt-1"
                    min="0"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-300 hover:bg-red-50 text-red-600 w-full"
                  onClick={() => {
                    const id = editTrackingOrderId;
                    if (!id) return;
                    // Wipe all courier traces so the order returns to the "send to courier" flow
                    useSteadfastStore.getState().removeOrderData(id);
                    useCarrybeeStore.getState().removeOrderData(id);
                    const fu = useFollowUpStore.getState();
                    fu.removeCourierName(id);
                    fu.removeTrackingUrl(id);
                    fu.removeStockType(id);
                    setCourierLocked(id, false);
                    setEditTrackingOrderId(null);
                    setEditTrackingCourierName('');
                    setEditTrackingUrl('');
                    // Re-open the courier picker so user can pick another courier
                    const ord = orders.find(o => o.id === id);
                    if (ord) setCourierPickerOrder(ord);
                    toast.success('কুরিয়ার তথ্য মুছে দেওয়া হয়েছে — অন্য কুরিয়ার বেছে নিন');
                  }}
                >
                  <Truck className="w-4 h-4" /> অন্য কুরিয়ারে পাঠান (রিসেট)
                </Button>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-amber-300 hover:bg-amber-50 text-amber-700"
                    onClick={() => {
                      setCourierLocked(editTrackingOrderId, true);
                      setEditTrackingOrderId(null);
                      toast.success('ট্র্যাকিং লক করা হয়েছে — আর এডিট করা যাবে না');
                    }}
                  >
                    <Lock className="w-4 h-4" /> লক করুন
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditTrackingOrderId(null)}>বাতিল</Button>
                    <Button onClick={async () => {
                      const ordId = editTrackingOrderId;
                      const newStock = editTrackingStockType;
                      setStockType(ordId, newStock);
                      if (newStock === 'vendor') {
                        const price = parseFloat(editTrackingVendorPrice);
                        if (!isNaN(price) && price > 0) setVendorBuyPrice(ordId, price);
                      }
                      const followUp = useFollowUpStore.getState();
                      const cName = editTrackingCourierName.trim();
                      if (cName) followUp.setCourierName(ordId, cName);
                      else followUp.removeCourierName(ordId);
                      const tUrl = editTrackingUrl.trim();
                      if (tUrl) followUp.setTrackingUrl(ordId, tUrl);
                      else followUp.removeTrackingUrl(ordId);
                      // If the order is already in a return status, re-sync the
                      // expense/deposit ledger entry immediately so AccountReport
                      // reflects the new stock type within the same session.
                      const ordForSync = orders.find(o => o.id === ordId);
                      if (ordForSync && (ordForSync.status === 'রিটার্ন' || ordForSync.status === 'পেইড রিটার্ন')) {
                        try {
                          const { syncReturnLedger } = await import('@/lib/return-ledger');
                          await syncReturnLedger(ordForSync, newStock);
                        } catch (e) { console.warn('[return-ledger stock-type change] skipped:', e); }
                      }
                      toast.success('আপডেট হয়েছে');
                      setEditTrackingOrderId(null);
                      setEditTrackingCourierName('');
                      setEditTrackingUrl('');
                    }}>সেভ করুন</Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Tracking Link Dialog */}
      {addLinkOrderId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setAddLinkOrderId(null); setAddLinkUrl(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-blue-500" /> ট্র্যাকিং লিংক অ্যাড করুন — {addLinkOrderId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium">ট্র্যাকিং লিংক *</Label>
                <Input value={addLinkUrl} onChange={(e) => setAddLinkUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setAddLinkOrderId(null); setAddLinkUrl(''); }}>বাতিল</Button>
                <Button className="gap-1.5" onClick={async () => {
                  if (!addLinkUrl.trim()) { toast.error('ট্র্যাকিং লিংক দিন'); return; }
                  try {
                    await api.post('/admin/data/follow-ups', { order_id: addLinkOrderId, tracking_url: addLinkUrl.trim() });
                    setTrackingUrl(addLinkOrderId, addLinkUrl.trim());
                    toast.success(`অর্ডার ${addLinkOrderId}-এ ট্র্যাকিং লিংক সেভ হয়েছে`);
                    setAddLinkOrderId(null);
                    setAddLinkUrl('');
                  } catch {
                    toast.error('ট্র্যাকিং লিংক সেভ হয়নি — আবার চেষ্টা করুন');
                  }
                }}>
                  <ExternalLink className="w-4 h-4" /> অ্যাড করুন
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Paid Return Amount Dialog */}
      {paidReturnOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setPaidReturnOrder(null); setPaidReturnAmount(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                💰 পেইড রিটার্ন — {paidReturnOrder.id}
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const stockType = useFollowUpStore.getState().stockTypes[paidReturnOrder.id] || 'self';
              const isVendor = stockType === 'vendor';
              const VENDOR_PACKAGING_CHARGE = 10;
              const dCharge = paidReturnOrder.deliveryCharge || 0;
              const pCharge = isVendor ? VENDOR_PACKAGING_CHARGE : 0;
              const totalCharges = dCharge + pCharge;
              const paidNum = parseFloat(paidReturnAmount);
              const hasInput = paidReturnAmount !== '' && !isNaN(paidNum);
              const diff = hasInput ? paidNum - totalCharges : 0;
              return (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">কাস্টমার:</span>
                  <span className="font-medium">{paidReturnOrder.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">মোট:</span>
                  <span className="font-medium">৳{paidReturnOrder.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ডেলিভারি চার্জ:</span>
                  <span className="font-medium">৳{dCharge}</span>
                </div>
                {isVendor && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">প্যাকেজিং চার্জ:</span>
                      <span className="font-medium">৳{pCharge}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="text-muted-foreground font-semibold">মোট চার্জ:</span>
                      <span className="font-bold">৳{totalCharges}</span>
                    </div>
                    <p className="text-[11px] text-amber-600 pt-1">
                      ভেন্ডর স্টক — ঘাটতি/অতিরিক্ত ভেন্ডর পেমেন্টে সমন্বয় হবে
                    </p>
                  </>
                )}
                {!isVendor && (
                  <p className="text-[11px] text-blue-600 pt-1">
                    সেলফ স্টক — ঘাটতি/অতিরিক্ত কুরিয়ার পেমেন্টে সমন্বয় হবে
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium">কত টাকা পেইড করে রিটার্ন করা হয়েছে? *</Label>
                <Input
                  type="number"
                  value={paidReturnAmount}
                  onChange={(e) => setPaidReturnAmount(e.target.value)}
                  placeholder="যেমন: 100"
                  className="mt-1"
                  min="0"
                />
                {hasInput && (
                  <div className="mt-2 text-xs space-y-1">
                    {diff >= 0 ? (
                      <p className="text-green-600 font-medium">
                        ✅ মোট চার্জ (৳{totalCharges}) কভার হবে, {isVendor ? 'ভেন্ডর পেমেন্টে যোগ' : 'কুরিয়ার পেমেন্টে যোগ'}: ৳{diff.toFixed(0)}
                      </p>
                    ) : (
                      <p className="text-red-600 font-medium">
                        ⚠️ মোট চার্জ (৳{totalCharges}) থেকে কম, {isVendor ? 'ভেন্ডর পেমেন্ট থেকে কাটা হবে' : 'কুরিয়ার পেমেন্ট থেকে কাটা হবে'}: ৳{(-diff).toFixed(0)}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPaidReturnOrder(null); setPaidReturnAmount(''); }}>বাতিল</Button>
                <Button className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white" onClick={handlePaidReturnConfirm}>
                  পেইড রিটার্ন করুন
                </Button>
              </div>
            </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog (Double Confirm) */}
      {deleteConfirmOrder && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setDeleteConfirmOrder(null); setDeleteConfirmStep(0); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" /> অর্ডার ডিলিট — {deleteConfirmOrder.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {deleteConfirmStep === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    আপনি কি <span className="font-bold text-foreground">{deleteConfirmOrder.id}</span> ({deleteConfirmOrder.customer}) অর্ডারটি ডিলিট করতে চান?
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
    </div>
  );
};

export default Orders;
