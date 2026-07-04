import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useLandingPageStore } from '@/stores/useLandingPageStore';
import { useProductStore } from '@/stores/useProductStore';
import { useCartStore } from '@/stores/useStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCouponStore } from '@/stores/useCouponStore';
import { useBlockStore } from '@/stores/useBlockStore';
import { useFraudBlockedStore } from '@/stores/useFraudBlockedStore';
import { useIncompleteOrderStore, sendBeaconIncompleteOrder, sendIncompleteOrderFetch } from '@/stores/useIncompleteOrderStore';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ShoppingCart, Truck, User, Phone, MapPin, Tag, ShieldCheck, CheckCircle, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { validatePhone, validateName } from '@/lib/order-validation';
import ValidationPopup from '@/components/ValidationPopup';
import { generateFingerprint } from '@/lib/fingerprint';
import { trackPurchase, trackPageView, trackInitiateCheckout } from '@/lib/dataLayer';
import { checkFraud, checkHasPreviousOrder } from '@/lib/fraud-check';
import { getAdjustedPurchaseValue } from '@/lib/value-multiplier';
import PostOrderPopup from '@/components/PostOrderPopup';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { isInternalUser } from '@/lib/is-internal-user';
import { useResellerRef } from '@/contexts/ResellerRefContext';
import { useResellerStore } from '@/stores/useResellerStore';

// ─── DOMPurify configuration ─────────────────────────────────────────────────

const PURIFY_CONFIG: DOMPurify.Config = {
  ADD_TAGS: ['iframe', 'video', 'source', 'style', 'picture', 'figure', 'figcaption'],
  ADD_ATTR: [
    'allow', 'allowfullscreen', 'frameborder', 'scrolling',
    'target', 'loading', 'decoding', 'crossorigin',
    'autoplay', 'controls', 'loop', 'muted', 'playsinline',
    'srcset', 'sizes', 'type',
  ],
  ALLOW_DATA_ATTR: true,
  FORCE_BODY: false,
};

// Allow only YouTube / Vimeo iframes; add lazy-loading to images
if (typeof window !== 'undefined') {
  DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
    if ((node as Element).tagName === 'IFRAME') {
      const src = (node as Element).getAttribute('src') || '';
      const ok =
        src.startsWith('https://www.youtube.com/') ||
        src.startsWith('https://youtube.com/') ||
        src.startsWith('https://player.vimeo.com/');
      if (!ok) (node as Element).removeAttribute('src');
    }
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ((node as Element).tagName === 'IMG') {
      (node as Element).setAttribute('loading', 'lazy');
      const style = (node as Element).getAttribute('style') || '';
      if (!style.includes('max-width')) {
        (node as Element).setAttribute('style', style + (style ? ';' : '') + 'max-width:100%;height:auto;');
      }
    }
  });
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

// ─── Placeholder replacement ──────────────────────────────────────────────────

const CHECKOUT_SENTINEL = '___LP_CHECKOUT_POINT___';

function replacePlaceholders(html: string, product: any, page: any): string {
  const price = page.customPrice ?? product.price ?? '';
  const regularPrice = page.customOriginalPrice ?? product.originalPrice ?? price;
  const discount = regularPrice && price ? Math.max(0, Number(regularPrice) - Number(price)) : 0;
  const mainImage = product.featuredImage || product.images?.[0] || '';
  const gallery = ((): string => {
    const imgs: string[] = [];
    if (product.featuredImage) imgs.push(product.featuredImage);
    (product.images || []).forEach((img: string) => { if (!imgs.includes(img)) imgs.push(img); });
    return imgs.map((src) => `<img src="${src}" loading="lazy" style="max-width:100%;height:auto;" />`).join('\n');
  })();

  return html
    .replace(/\{\{product_name\}\}/g, String(product.title ?? ''))
    .replace(/\{\{price\}\}/g, String(price))
    .replace(/\{\{regular_price\}\}/g, String(regularPrice))
    .replace(/\{\{discount\}\}/g, String(discount))
    .replace(/\{\{short_description\}\}/g, String(product.shortDescription ?? ''))
    .replace(/\{\{image\}\}/g, mainImage)
    .replace(/\{\{gallery\}\}/g, gallery)
    .replace(/\{\{stock\}\}/g, String(product.stock ?? ''))
    .replace(/\{\{category\}\}/g, String(product.category ?? ''))
    .replace(/\{\{sku\}\}/g, String(product.sku ?? ''))
    .replace(/\{\{brand\}\}/g, String(product.brand ?? ''))
    .replace(/\{\{checkout\}\}/g, CHECKOUT_SENTINEL);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const AdSlot = () => {
  const { adsenseCode, adBlockedResellers } = useSiteSettingsStore();
  const ref = useRef<HTMLDivElement>(null);
  const internal = isInternalUser();
  const resellerId = useResellerRef();
  const blocked = !!resellerId && (adBlockedResellers ?? []).includes(resellerId);
  useEffect(() => {
    if (!ref.current || !adsenseCode || internal || blocked) return;
    const scripts = ref.current.querySelectorAll('script');
    scripts.forEach((old) => {
      const s = document.createElement('script');
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }, [adsenseCode, internal, blocked]);
  if (!adsenseCode || internal || blocked) return null;
  return <div ref={ref} className="my-4" dangerouslySetInnerHTML={{ __html: adsenseCode }} />;
};

const deliveryOptions = [
  { value: '70', label: 'ঢাকার মধ্যে', price: 70 },
  { value: '100', label: 'ঢাকার আশেপাশে', price: 100 },
  { value: '130', label: 'ঢাকার বাইরে', price: 130 },
];

// ─── Checkout section (extracted for injection) ───────────────────────────────

interface CheckoutProps {
  product: any;
  page: any;
  resellerRef: string | null;
  addResellerOrder: any;
  fetchResellers: any;
}

const CheckoutSection = ({ product, page, resellerRef, addResellerOrder, fetchResellers }: CheckoutProps) => {
  const navigate = useNavigate();
  const createOrder = useOrderStore((s) => s.createOrderFromCheckout);
  const { coupons, applyCoupon: storeApplyCoupon } = useCouponStore();
  const checkBlockedRemote = useBlockStore((s) => s.checkBlockedRemote);
  const isDeviceBlocked = useFraudBlockedStore((s) => s.isDeviceBlocked);
  const markBlocked = useFraudBlockedStore((s) => s.markBlocked);
  const addIncomplete = useIncompleteOrderStore((s) => s.addOrder);
  const removeByPhone = useIncompleteOrderStore((s) => s.removeByPhone);
  const fraudEnabled = useFraudSettingsStore((s) => s.enabled);

  const thankYouPath = resellerRef ? '/r/thank-you' : '/thank-you';
  const fakeThankYouPath = resellerRef ? '/r/confirm-order' : '/order-confirmed';

  const [fraudBlocked, setFraudBlocked] = useState(false);
  const [fraudBlockReason, setFraudBlockReason] = useState<'no_data' | 'low_ratio' | null>(null);
  const [fraudChecking, setFraudChecking] = useState(false);
  const [showFraudPopup, setShowFraudPopup] = useState(false);
  const [customerIp, setCustomerIp] = useState('');
  const [customerFingerprint, setCustomerFingerprint] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [delivery, setDelivery] = useState('130');
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [showPostOrderPopup, setShowPostOrderPopup] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [pendingPurchasePayload, setPendingPurchasePayload] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedWeight, setSelectedWeight] = useState('');
  const orderSubmitted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('https://api.ipify.org?format=json')
        .then((res) => res.json())
        .then((data) => setCustomerIp(data.ip))
        .catch(() => setCustomerIp(''));
      setCustomerFingerprint(generateFingerprint());
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const hasColors = product.colors && product.colors.length > 0;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasWeights = product.weights && product.weights.length > 0;

  const getCurrentPrice = () => {
    let currentPrice = page.customPrice ?? product.price;
    const vp = product.variationPrices;
    if (vp && vp.length > 0) {
      if (selectedColor) { const cp = vp.find((v: any) => v.variationType === 'color' && v.variationName === selectedColor); if (cp?.price) currentPrice = cp.price; }
      if (selectedSize) { const sp = vp.find((v: any) => v.variationType === 'size' && v.variationName === selectedSize); if (sp?.price) currentPrice = sp.price; }
      if (selectedWeight) { const wp = vp.find((v: any) => v.variationType === 'weight' && v.variationName === selectedWeight); if (wp?.price) currentPrice = wp.price; }
    }
    return currentPrice;
  };

  const currentPrice = getCurrentPrice();
  const displayOriginalPrice = page.customOriginalPrice ?? product.originalPrice;
  const hasFreeDelivery = product.freeDelivery || false;
  const deliveryCharge = hasFreeDelivery ? 0 : Number(delivery);
  const subtotal = currentPrice * quantity;
  const total = subtotal + deliveryCharge - discount;

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    const result = storeApplyCoupon(couponCode.trim(), subtotal);
    if (!result.valid) { toast({ title: result.message, variant: 'destructive' }); return; }
    setDiscount(result.discount);
    setAppliedCoupon(couponCode.trim());
    toast({ title: `কুপন অ্যাপ্লাই হয়েছে! ৳${result.discount} ছাড়` });
  };

  const validateVariations = (): boolean => {
    const missing: string[] = [];
    if (hasColors && !selectedColor) missing.push('কালার');
    if (hasSizes && !selectedSize) missing.push('সাইজ');
    if (hasWeights && !selectedWeight) missing.push('ওজন');
    if (missing.length > 0) { toast({ title: `দয়া করে ${missing.join(', ')} সিলেক্ট করুন`, variant: 'destructive' }); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateVariations()) return;
    if (!name || !phone || !address) { toast({ title: 'সকল তথ্য পূরণ করুন', variant: 'destructive' }); return; }
    const nameErr = validateName(name);
    if (nameErr) { setValidationMsg(nameErr); return; }
    const phoneErr = validatePhone(phone);
    if (phoneErr) { setValidationMsg(phoneErr); return; }

    const isBlocked = await checkBlockedRemote(phone, customerIp || undefined, customerFingerprint || undefined);
    if (isBlocked) {
      await addIncomplete({
        name, phone, address,
        items: [{ title: product.title, quantity, price: currentPrice, image: product.images?.[0] || '' }],
        totalPrice: subtotal, deliveryCharge,
        deliveryZone: delivery === '70' ? 'ঢাকার মধ্যে' : delivery === '100' ? 'ঢাকার আশেপাশে' : 'ঢাকার বাইরে',
        grandTotal: total, type: 'blocked', blockReason: 'আগে থেকেই ব্লক করা কাস্টমার',
        customerIp: customerIp || undefined, customerFingerprint: customerFingerprint || undefined,
      });
      setValidationMsg('আপনি আগেও আমাদের ওয়েবসাইটে অর্ডার করেছিলেন। কিন্তু অর্ডার ক্যান্সেল করে দিয়েছেন। তাই আপনাকে ব্লক করে দেওয়া হয়েছে।');
      return;
    }

    let fraudFailed = false;
    let fraudBlockNote = '';
    let fraudResult: any = null;
    setFraudChecking(true);
    if (fraudEnabled) {
      fraudResult = await checkFraud(phone);
      if (!fraudResult.passed) {
        fraudFailed = true;
        fraudBlockNote = fraudResult.reason === 'no_data'
          ? 'এনার কুরিয়ার হিস্টোরি পাওয়া যায়নি'
          : `এনার কুরিয়ার রেশিও কম (${fraudResult.deliveryPercent}%)`;
      }
    } else {
      try {
        const { fetchAndCacheCourierRatio } = await import('@/lib/fraud-check');
        await fetchAndCacheCourierRatio(phone);
      } catch { /* non-fatal */ }
    }
    setFraudChecking(false);

    // Check if customer has any previous order (any status) → redirect to fake thank-you (no pixels)
    const hasPrevious = await checkHasPreviousOrder(customerFingerprint || undefined, phone, customerIp || undefined);

    const variations: Record<string, string> = {};
    if (selectedColor) variations['কালার'] = selectedColor;
    if (selectedSize) variations['সাইজ'] = selectedSize;
    if (selectedWeight) variations['ওজন'] = selectedWeight;

    const buildPurchasePayload = (orderId: string) => {
      const adjusted = getAdjustedPurchaseValue(total, fraudResult);
      return {
        orderId,
        items: [{ item_id: product.id, item_name: product.title, price: currentPrice, quantity, item_category: product.category }],
        value: total, shipping: deliveryCharge, discount, currency: 'BDT',
        valueOverride: adjusted,
        customer: { name, phone, address },
      };
    };

    if (resellerRef) {
      try {
        let resellers = useResellerStore.getState().resellers;
        let reseller = resellers.find((r: any) => r.id === resellerRef);
        if (!reseller) {
          await fetchResellers();
          reseller = useResellerStore.getState().resellers.find((r: any) => r.id === resellerRef);
        }
        if (!reseller) { toast({ title: 'রিসেলার পাওয়া যায়নি', variant: 'destructive' }); return; }

        const { api } = await import('@/lib/api');
        const cpData = await api.get(`/public/reseller-prices?reseller_id=${reseller.id}&product_id=${product.id}`).catch(() => []);
        const customPriceRow = Array.isArray(cpData) ? cpData[0] : null;
        const baseSellingPrice = customPriceRow?.custom_price ? Number(customPriceRow.custom_price) : currentPrice;
        const resellerPrice = product.resellerPrice || product.price;
        const netDelivery = Math.max(0, deliveryCharge - discount);
        const perUnitDelivery = quantity > 0 ? netDelivery / quantity : 0;
        const sellingPrice = baseSellingPrice + perUnitDelivery;
        const vars = variations;
        const resellerItem = {
          productId: product.id, productTitle: product.title,
          image: product.featuredImage || product.images?.[0] || '',
          qty: quantity, resellerPrice, sellingPrice,
          profit: (sellingPrice - resellerPrice) * quantity,
          buyPrice: typeof product.buyPrice === 'number' ? product.buyPrice : undefined,
          stockProductName: product.stockProductName || undefined,
          selectedColor: vars['কালার'] || undefined,
          selectedSize: vars['সাইজ'] || undefined,
          selectedWeight: vars['ওজন'] || undefined,
          selectedVariations: Object.keys(vars).length > 0 ? vars : undefined,
        };
        const totalSellingPrice = sellingPrice * quantity;
        const totalResellerCost = resellerPrice * quantity;
        const PACKAGING_CHARGE = 10;
        const codCharge = Math.ceil(totalSellingPrice / 100);
        const totalProfit = totalSellingPrice - totalResellerCost - deliveryCharge - PACKAGING_CHARGE - codCharge;
        const roId = await useResellerStore.getState().getNextResellerOrderId();
        await addResellerOrder({
          id: roId, resellerId: reseller.id, resellerName: reseller.name,
          customerName: name, customerPhone: phone, customerAddress: address,
          items: [resellerItem], deliveryCharge, packagingCharge: PACKAGING_CHARGE,
          codCharge, totalSellingPrice, totalResellerCost, totalProfit,
          status: 'পেন্ডিং', date: new Date().toISOString(),
          customerIp: customerIp || undefined, customerFingerprint: customerFingerprint || undefined,
          source: (await import('@/lib/order-source')).getOrderSource(),
          notes: [
            ...(orderNote.trim() ? [`📝 কাস্টমার নোট: ${orderNote.trim()}`] : []),
            ...(fraudFailed ? [`⚠️ ${fraudBlockNote}`] : []),
          ].length > 0 ? [
            ...(orderNote.trim() ? [`📝 কাস্টমার নোট: ${orderNote.trim()}`] : []),
            ...(fraudFailed ? [`⚠️ ${fraudBlockNote}`] : []),
          ] : undefined,
        });
        orderSubmitted.current = true;
        removeByPhone(phone);
        if (fraudFailed || hasPrevious) { navigate(fakeThankYouPath, { state: { orderId: roId } }); return; }
        const purchasePayload = buildPurchasePayload(roId);
        const popupEnabled = useFraudSettingsStore.getState().postOrderPopupEnabled;
        if (popupEnabled) { setPendingOrderId(roId); setPendingPurchasePayload(purchasePayload); setShowPostOrderPopup(true); }
        else { navigate(thankYouPath, { state: { orderId: roId, purchasePayload } }); }
        return;
      } catch (e) {
        console.error('Failed to create reseller order from LP:', e);
        toast({ title: 'রিসেলার অর্ডার সাবমিট ব্যর্থ', variant: 'destructive' });
        return;
      }
    }

    const id = await createOrder({
      name, phone, address,
      items: [{
        title: product.title, quantity, price: currentPrice,
        image: product.images?.[0] || '',
        variations: Object.keys(variations).length > 0 ? variations : undefined,
        freeDelivery: hasFreeDelivery,
      }],
      deliveryCharge, subtotal: subtotal - discount,
      customerIp: customerIp || undefined, customerFingerprint: customerFingerprint || undefined,
      orderNote: fraudFailed ? `${orderNote.trim() ? orderNote.trim() + ' | ' : ''}⚠️ ${fraudBlockNote}` : orderNote.trim() || undefined,
      source: (await import('@/lib/order-source')).getOrderSource(),
    });

    orderSubmitted.current = true;
    removeByPhone(phone);
    if (fraudFailed || hasPrevious) { navigate(fakeThankYouPath, { state: { orderId: id } }); return; }
    const purchasePayload = buildPurchasePayload(id);
    const popupEnabled = useFraudSettingsStore.getState().postOrderPopupEnabled;
    if (popupEnabled) { setPendingOrderId(id); setPendingPurchasePayload(purchasePayload); setShowPostOrderPopup(true); }
    else { navigate('/thank-you', { state: { orderId: id, purchasePayload } }); }
  };

  return (
    <>
      <section className="bg-muted/40 border-t" id="lp-checkout">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
          <p className="text-[18px] md:text-[22px] font-bold text-destructive text-center leading-tight">
            অর্ডার করতে নিচের ফর্মটি পূরন করে নিচের "অর্ডার করুন" বাটুনে চাপদিন।
          </p>

          <AdSlot />

          <div className="flex items-center gap-3 border rounded-lg p-3 bg-background max-w-lg mx-auto md:max-w-none">
            <img src={product.images?.[0] || '/placeholder.svg'} alt={product.title} className="w-14 h-14 object-cover rounded border" loading="lazy" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{product.title}</p>
            </div>
            <div className="flex items-center gap-1.5 border rounded px-1">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 flex items-center justify-center text-lg font-bold text-muted-foreground hover:text-foreground">-</button>
              <span className="w-6 text-center text-sm font-medium">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 flex items-center justify-center text-lg font-bold text-muted-foreground hover:text-foreground">+</button>
            </div>
            <span className="font-bold text-primary whitespace-nowrap">৳{subtotal}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Billing details</h3>
              <div>
                <Label className="text-sm font-medium mb-1.5 block text-foreground">আপনার নাম *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="সম্পূর্ণ নাম" className="h-11 rounded-lg bg-background" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block text-foreground">মোবাইল নাম্বার *</Label>
                <Input value={phone} onChange={(e) => {
                  const val = e.target.value;
                  if (/[০-৯]/.test(val)) toast({ title: 'আপনার ফোন নাম্বারটি ইংরেজিতে লিখুন প্লিজ!', duration: 4000 });
                  setPhone(val);
                }} placeholder="01XXXXXXXXX" className="h-11 rounded-lg bg-background" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block text-foreground">সম্পূর্ণ ঠিকানা *</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="গ্রাম/এলাকার নাম, থানার নাম, জেলার নাম" className="h-11 rounded-lg bg-background" />
              </div>

              {hasColors && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[15px] font-semibold">কালার:</label>
                  {product.colors!.map((color: string) => {
                    const hp = product.variationPrices?.find((v: any) => v.variationType === 'color' && v.variationName === color);
                    return (
                      <Button key={color} variant={selectedColor === color ? 'default' : 'outline'} size="sm"
                        className={`rounded-full text-xs ${selectedColor !== color ? 'border-foreground/40' : ''}`}
                        onClick={() => setSelectedColor(selectedColor === color ? '' : color)}>
                        {color} {hp?.price ? `(৳${hp.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}
              {hasSizes && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[15px] font-semibold">সাইজ:</label>
                  {product.sizes!.map((size: string) => {
                    const hp = product.variationPrices?.find((v: any) => v.variationType === 'size' && v.variationName === size);
                    return (
                      <Button key={size} variant={selectedSize === size ? 'default' : 'outline'} size="sm"
                        className={`rounded-full text-xs ${selectedSize !== size ? 'border-foreground/40' : ''}`}
                        onClick={() => setSelectedSize(selectedSize === size ? '' : size)}>
                        {size} {hp?.price ? `(৳${hp.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}
              {hasWeights && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[15px] font-semibold">ওজন:</label>
                  {product.weights!.map((weight: string) => {
                    const hp = product.variationPrices?.find((v: any) => v.variationType === 'weight' && v.variationName === weight);
                    return (
                      <Button key={weight} variant={selectedWeight === weight ? 'default' : 'outline'} size="sm"
                        className={`rounded-full text-xs ${selectedWeight !== weight ? 'border-foreground/40' : ''}`}
                        onClick={() => setSelectedWeight(selectedWeight === weight ? '' : weight)}>
                        {weight} {hp?.price ? `(৳${hp.price})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2">Shipping</h4>
                {hasFreeDelivery ? (
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/30">
                    <p className="text-sm font-bold text-primary flex items-center gap-2"><Truck className="h-4 w-4" /> 🎉 সম্পূর্ণ ফ্রি ডেলিভারি</p>
                  </div>
                ) : (
                  <RadioGroup value={delivery} onValueChange={setDelivery} className="space-y-1.5">
                    {deliveryOptions.map((opt) => (
                      <div key={opt.value}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all bg-background ${delivery === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
                        onClick={() => setDelivery(opt.value)}>
                        <RadioGroupItem value={opt.value} id={`lp-d-${opt.value}`} />
                        <label htmlFor={`lp-d-${opt.value}`} className="flex-1 cursor-pointer text-sm">{opt.label}</label>
                        <span className="font-bold text-sm text-primary">৳{opt.price}</span>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-1.5 block">অর্ডার নোট (অপশনাল)</Label>
                <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} rows={2}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Your order</h3>
              <div className="border rounded-lg overflow-hidden bg-background">
                <div className="flex justify-between px-4 py-2.5 bg-muted/60 border-b text-sm font-semibold text-muted-foreground">
                  <span>Product</span><span>Subtotal</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <img src={product.images?.[0] || '/placeholder.svg'} alt="" className="w-10 h-10 object-cover rounded border" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{product.title}</p>
                    {selectedColor && <p className="text-xs text-muted-foreground">কালার: {selectedColor}</p>}
                    {selectedSize && <p className="text-xs text-muted-foreground">সাইজ: {selectedSize}</p>}
                    {selectedWeight && <p className="text-xs text-muted-foreground">ওজন: {selectedWeight}</p>}
                  </div>
                  <span className="text-sm whitespace-nowrap">×{quantity}</span>
                  <span className="text-sm font-semibold whitespace-nowrap">৳{subtotal}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">৳{subtotal}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-b text-sm">
                  <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                  <span className={`font-medium ${hasFreeDelivery ? 'text-primary' : ''}`}>{hasFreeDelivery ? 'ফ্রি' : `৳${deliveryCharge}`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between px-4 py-2.5 border-b text-sm text-primary">
                    <span>ডিসকাউন্ট</span><span>-৳{discount}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary text-lg">৳{total}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="কুপন কোড (অপশনাল)" className="flex-1 h-10 rounded-lg bg-background" />
                <Button variant="outline" onClick={applyCoupon} className="rounded-lg h-10 px-5 font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground">অ্যাপ্লাই</Button>
              </div>
              {appliedCoupon && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4" /> কুপন "{appliedCoupon}" অ্যাপ্লাই হয়েছে (৳{discount} ছাড়)
                </div>
              )}

              <div className="border rounded-lg p-4 bg-background space-y-2">
                <p className="font-semibold text-sm">Cash on delivery</p>
                <p className="text-xs text-muted-foreground">Pay with cash upon delivery.</p>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our <span className="text-primary underline cursor-pointer">privacy policy</span>.
              </p>

              <Button size="lg"
                className="w-full rounded-lg text-[18px] md:text-[20px] font-bold h-14 bg-[#1a237e] hover:bg-[#283593] text-white shadow-md"
                onClick={handleSubmit} disabled={fraudChecking || fraudBlocked}>
                {fraudChecking ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> একটু অপেক্ষা করুন....</> : `অর্ডার করুন ৳${total}`}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ValidationPopup open={!!validationMsg} message={validationMsg} onClose={() => setValidationMsg('')} />
      <PostOrderPopup orderId={pendingOrderId} isOpen={showPostOrderPopup} onComplete={(choice) => { setShowPostOrderPopup(false); navigate(thankYouPath, { state: { orderId: pendingOrderId, postOrderChoice: choice, purchasePayload: pendingPurchasePayload } }); }} />
      <Dialog open={showFraudPopup} onOpenChange={(v) => { if (!v) setShowFraudPopup(false); }}>
        <DialogContent className="sm:max-w-md text-center" hideClose>
          <div className="py-4 space-y-4">
            <p className="text-[17px] leading-relaxed text-foreground text-left px-2">
              {fraudBlockReason === 'no_data' ? useFraudSettingsStore.getState().noDataMessage : useFraudSettingsStore.getState().lowRatioMessage}
            </p>
            <Button onClick={() => setShowFraudPopup(false)} className="w-full rounded-lg">ঠিক আছে</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ─── Main LandingPage component ───────────────────────────────────────────────

const LandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { pages, fetchPages, loading: lpLoading } = useLandingPageStore();
  const { products, loading: prodLoading } = useProductStore();
  const productPageTitleSize = useSiteSettingsStore((s) => s.productPageTitleSize);
  const productPageDescSize = useSiteSettingsStore((s) => s.productPageDescSize);

  const page = pages.find((p) => p.slug === slug);
  const product = page ? products.find((p) => p.id === page.productId) : undefined;

  useEffect(() => {
    if (pages.length === 0) fetchPages();
  }, []);

  const resellerRef = useResellerRef();
  const addResellerOrder = useResellerStore((s) => s.addResellerOrder);
  const fetchResellers = useResellerStore((s) => s.fetchResellers);

  // Track page view once
  const trackedRef = useRef(false);
  useEffect(() => {
    if (!product || trackedRef.current || isInternalUser()) return;
    trackedRef.current = true;
    try {
      trackPageView(page?.title || product.title);
      const price = (() => {
        let p = page?.customPrice ?? product.price;
        const vp = product.variationPrices;
        if (vp && vp.length > 0) {
          const first = vp.find((v: any) => v.price);
          if (first?.price) p = first.price;
        }
        return p;
      })();
      trackInitiateCheckout(
        [{ item_id: product.id, item_name: product.title, price, quantity: 1, item_category: product.category }],
        price,
      );
    } catch { /* non-fatal */ }
  }, [product, page]);

  // Auto-slide and description toggle (legacy mode)
  const [selectedImage, setSelectedImage] = useState(0);
  const [showDescription, setShowDescription] = useState(false);
  const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!product || !product.images || page?.customHtml) return;
    const imgs: string[] = [];
    if (product.featuredImage) imgs.push(product.featuredImage);
    product.images.forEach((img: string) => { if (!imgs.includes(img)) imgs.push(img); });
    if (imgs.length <= 1) return;
    autoSlideRef.current = setInterval(() => {
      setSelectedImage((prev) => (prev + 1) % imgs.length);
    }, 2000);
    return () => { if (autoSlideRef.current) clearInterval(autoSlideRef.current); };
  }, [product, page?.customHtml]);

  // Incomplete order beacon
  const beaconDataRef = useRef<any>(null);
  useEffect(() => {
    if (product) {
      beaconDataRef.current = { name: '', phone: '', address: '', product, delivery: '130', customerIp: '', customerFingerprint: '' };
    }
  });
  useEffect(() => {
    let sent = false;
    const handleUnload = () => { if (sent) return; sent = true; };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  if (!page || !product) {
    if (lpLoading || prodLoading || products.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-xl font-bold text-foreground">পেজটি পাওয়া যায়নি</p>
      </div>
    );
  }

  const checkoutProps = { product, page, resellerRef, addResellerOrder, fetchResellers };

  // ── BUILDER MODE: custom_html present ─────────────────────────────────────
  if (page.customHtml && page.customHtml.trim()) {
    // 1. Replace {{checkout}} sentinel before other replacements so it survives
    const rawWithSentinel = page.customHtml.replace(/\{\{checkout\}\}/g, CHECKOUT_SENTINEL);
    // 2. Replace remaining placeholders
    const replaced = replacePlaceholders(rawWithSentinel, product, page);
    // 3. Split on sentinel
    const parts = replaced.split(CHECKOUT_SENTINEL);
    const hasInlineCheckout = parts.length > 1;
    // 4. Sanitize each part
    const cleanParts = parts.map((p) => sanitize(p));

    return (
      <div className="min-h-screen bg-background">
        {/* Part 1 — everything before {{checkout}} (or the whole HTML if absent) */}
        {cleanParts[0] && (
          <div
            className="lp-custom-html [&_img]:max-w-full [&_img]:h-auto [&_*]:max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: cleanParts[0] }}
          />
        )}

        {/* Checkout section — inline if {{checkout}} was present, or appended */}
        <CheckoutSection {...checkoutProps} />

        {/* Part 2 — everything after {{checkout}} (usually empty) */}
        {hasInlineCheckout && cleanParts[1] && (
          <div
            className="lp-custom-html [&_img]:max-w-full [&_img]:h-auto [&_*]:max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: cleanParts[1] }}
          />
        )}
      </div>
    );
  }

  // ── LEGACY MODE: no custom_html — existing auto-generated layout ────────────
  const allImages = (() => {
    const imgs: string[] = [];
    if (product.featuredImage) imgs.push(product.featuredImage);
    product.images.forEach((img: string) => { if (!imgs.includes(img)) imgs.push(img); });
    return imgs.length > 0 ? imgs : ['/placeholder.svg'];
  })();

  const hasColors = product.colors && product.colors.length > 0;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasWeights = product.weights && product.weights.length > 0;

  const getCurrentPriceLegacy = () => {
    let currentPrice = page.customPrice ?? product.price;
    const vp = product.variationPrices;
    if (vp && vp.length > 0) {
      // Legacy mode doesn't track variation selection here; use base price
    }
    return currentPrice;
  };

  const currentPrice = getCurrentPriceLegacy();
  const displayOriginalPrice = page.customOriginalPrice ?? product.originalPrice;

  const nextImage = () => setSelectedImage((prev) => (prev + 1) % allImages.length);
  const prevImage = () => setSelectedImage((prev) => (prev - 1 + allImages.length) % allImages.length);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFD54F 0%, #FFECB3 60%, #FFF8E1 100%)' }}>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" fill="white" />
          </svg>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 relative z-10">
          <h1 className="font-extrabold text-center text-foreground leading-snug" style={{ fontSize: `${productPageTitleSize}px` }}>
            {page.title}
          </h1>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          <div className="space-y-5 order-2 md:order-1">
            <h2 className="font-bold text-foreground leading-tight" style={{ fontSize: `${productPageTitleSize}px` }}>{product.title}</h2>
            <div className="leading-relaxed prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words [&_*]:max-w-full overflow-x-auto" style={{ fontSize: `${productPageDescSize}px`, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              dangerouslySetInnerHTML={{ __html: product.shortDescription }} />
            <AdSlot />
          </div>
          <div className="order-1 md:order-2">
            <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30">
              <img src={allImages[selectedImage]} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
              {allImages.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow-md transition-colors">
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                  </button>
                  <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-1.5 shadow-md transition-colors">
                    <ChevronRight className="h-5 w-5 text-foreground" />
                  </button>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {allImages.map((_, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${selectedImage === i ? 'bg-primary scale-125' : 'bg-border'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-6">
        <button onClick={() => setShowDescription(!showDescription)}
          className="w-full flex items-center justify-center gap-2 py-3 text-[15px] font-bold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors">
          {showDescription ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          প্রডাক্ট এর বিস্তারিত জানুন
        </button>
        {showDescription && (
          <div className="prose prose-sm max-w-none leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words [&_*]:max-w-full overflow-x-auto mt-4"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', fontSize: `${productPageDescSize}px` }}
            dangerouslySetInnerHTML={{ __html: product.longDescription }} />
        )}
      </section>

      <section className="py-8 md:py-10 text-center">
        <div className="max-w-5xl mx-auto px-4 space-y-3">
          {displayOriginalPrice && (
            <p className="text-[22px] md:text-[28px] font-bold text-foreground">
              রেগুলার প্রাইজ={' '}
              <span className="line-through decoration-destructive decoration-[3px]">৳{displayOriginalPrice}</span>
              {' '}টাকা
            </p>
          )}
          <p className="text-[24px] md:text-[32px] font-extrabold text-foreground">
            বর্তমান প্রাইজ{' '}
            <span className="inline-flex items-center justify-center w-[70px] h-[70px] md:w-[90px] md:h-[90px] rounded-full border-[3px] border-destructive text-destructive text-[22px] md:text-[28px] font-extrabold">
              ৳{currentPrice}
            </span>
            {' '}টাকা
          </p>
        </div>
      </section>

      <CheckoutSection {...checkoutProps} />
    </div>
  );
};

export default LandingPage;
