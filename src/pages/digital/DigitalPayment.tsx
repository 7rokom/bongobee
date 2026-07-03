import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { useDigitalOrderStore } from '@/stores/useDigitalOrderStore';
import { useDigitalPaymentMethodStore } from '@/stores/useDigitalPaymentMethodStore';
import { useDigitalCartStore } from '@/stores/useDigitalCartStore';
import { useDigitalBlockStore, getClientIp, getClientFingerprint } from '@/stores/useDigitalBlockStore';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Upload, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { trackInitiateCheckout } from '@/lib/dataLayer';

interface CheckoutProduct { id: string; title: string; slug: string; price: number; qty?: number; }
interface CheckoutCart { items: CheckoutProduct[]; total: number; }

const isValidBdPhone = (s: string) => /^[0-9]{11}$/.test(s.trim());

const DigitalPayment = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [cart, setCart] = useState<CheckoutCart | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [trxId, setTrxId] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutFired, setCheckoutFired] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const { methods, fetchActive } = useDigitalPaymentMethodStore();
  const initAuth = useDigitalAuthStore((s) => s.init);
  const userId = useDigitalAuthStore((s) => s.userId);
  const profile = useDigitalAuthStore((s) => s.profile);
  const ready = useDigitalAuthStore((s) => s.ready);
  const createOrder = useDigitalOrderStore((s) => s.create);
  const clearCart = useDigitalCartStore((s) => s.clear);
  const fetchBlocks = useDigitalBlockStore((s) => s.fetchAll);
  const isBlocked = useDigitalBlockStore((s) => s.isBlocked);

  useEffect(() => {
    const cartStored = sessionStorage.getItem('digital_checkout_cart');
    const productStored = sessionStorage.getItem('digital_checkout_product');
    if (cartStored) setCart(JSON.parse(cartStored));
    else if (productStored) setProduct(JSON.parse(productStored));
    else { navigate('/'); return; }
    fetchActive();
    fetchBlocks();
    const unsub = initAuth();
    return unsub;
  }, []);

  useEffect(() => {
    if (ready && !userId) navigate('/digital/checkout');
  }, [ready, userId, navigate]);

  // Pre-check: if logged-in user is blocked, show message immediately
  useEffect(() => {
    if (!userId || !profile) return;
    (async () => {
      const ip = await getClientIp();
      const fp = getClientFingerprint();
      if (isBlocked({ userId, phone: profile.phone || null, ip, fingerprint: fp })) {
        setBlockedMsg('আপনাকে ব্লক করা হয়েছে। অর্ডার করা সম্ভব নয়।');
      }
    })();
  }, [userId, profile, isBlocked]);

  useEffect(() => {
    if (methods.length && !selectedId) setSelectedId(methods[0].id);
  }, [methods, selectedId]);

  const total = cart ? cart.total : (product?.price || 0);
  const titleSummary = cart ? `${cart.items.length} টি প্রডাক্ট` : (product?.title || '');

  useEffect(() => {
    if (!checkoutFired && (product || cart) && methods.length) {
      const items = cart
        ? cart.items.map((i) => ({ item_id: i.id, item_name: i.title, price: i.price, quantity: i.qty || 1, item_category: 'Digital' }))
        : [{ item_id: product!.id, item_name: product!.title, price: product!.price, quantity: 1, item_category: 'Digital' }];
      trackInitiateCheckout(items, total);
      setCheckoutFired(true);
    }
  }, [product, cart, methods, checkoutFired, total]);

  const selected = methods.find((m) => m.id === selectedId);
  const isBank = selected?.type === 'bank';

  const handleFile = (f: File | null) => {
    if (!f) { setScreenshot(null); return; }
    if (!f.type.startsWith('image/')) { toast.error('শুধু ইমেজ ফাইল আপলোড করুন'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('ফাইল সাইজ ৫MB এর কম হতে হবে'); return; }
    setScreenshot(f);
  };

  const handleSubmit = async () => {
    if ((!product && !cart) || !userId || !profile) return;
    if (!selected) { toast.error('পেমেন্ট পদ্ধতি সিলেক্ট করুন'); return; }
    if (!trxId.trim()) { toast.error('TrxID দিন'); return; }

    if (isBank) {
      if (!paymentNumber.trim()) { toast.error('অ্যাকাউন্ট নম্বর দিন'); return; }
      if (!bankName.trim()) { toast.error('ব্যাংকের নাম দিন'); return; }
    } else {
      if (!paymentNumber.trim()) { toast.error('পেমেন্ট নম্বর দিন'); return; }
      if (!isValidBdPhone(paymentNumber)) { toast.error('পেমেন্ট নম্বর ঠিক ১১ ডিজিট হতে হবে'); return; }
    }

    // Block check before any side effects
    const ip = await getClientIp();
    const fp = getClientFingerprint();
    await fetchBlocks();
    if (isBlocked({ userId, phone: profile.phone || null, ip, fingerprint: fp })) {
      setBlockedMsg('আপনাকে ব্লক করা হয়েছে। অর্ডার করা সম্ভব নয়।');
      return;
    }

    setLoading(true);

    let screenshotPath: string | null = null;
    if (screenshot) {
      try {
        const fd = new FormData();
        fd.append('file', screenshot);
        fd.append('folder', `digital-screenshots/${userId}`);
        const res = await api.post('/public/digital-fe/upload', fd);
        screenshotPath = res?.path || null;
      } catch (e: any) {
        setLoading(false);
        toast.error('স্ক্রিনশট আপলোড ব্যর্থ: ' + (e?.message || ''));
        return;
      }
    }

    const items = cart
      ? cart.items.map((i) => ({ productId: i.id, title: i.title, slug: i.slug, price: i.price, qty: i.qty || 1 }))
      : [{ productId: product!.id, title: product!.title, slug: product!.slug, price: product!.price, qty: 1 }];

    const primary = items[0];

    const order = await createOrder({
      userId,
      productId: primary.productId,
      productTitle: cart ? `${primary.title}${items.length > 1 ? ` + ${items.length - 1} আরও` : ''}` : primary.title,
      productSlug: primary.slug,
      customerName: profile.name,
      customerPhone: profile.phone || '',
      customerEmail: profile.email,
      customerAddress: profile.address || '',
      price: total,
      paymentMethod: isBank ? 'bank' : (selected.name.toLowerCase().includes('nagad') ? 'nagad' : 'bkash'),
      paymentMethodId: selected.id,
      paymentMethodName: selected.name,
      paymentNumber,
      bankName: isBank ? bankName : undefined,
      trxId,
      screenshotPath,
      items,
      customerIp: ip,
      customerFingerprint: fp,
    });

    setLoading(false);
    if (!order) {
      toast.error('অর্ডার সাবমিট ব্যর্থ');
      return;
    }
    sessionStorage.removeItem('digital_checkout_product');
    sessionStorage.removeItem('digital_checkout_cart');
    if (cart) clearCart();
    sessionStorage.setItem('digital_last_order', JSON.stringify({
      orderId: order.id,
      orderNumber: order.orderNumber,
      productId: primary.productId,
      productTitle: order.productTitle,
      price: total,
    }));
    navigate('/digital/thank-you');
  };

  if ((!product && !cart) || !ready) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold">পেমেন্ট</h1>
        <p className="text-sm text-muted-foreground mt-1">পেমেন্ট সম্পন্ন করে নিচের তথ্য দিন</p>
      </div>

      <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="p-4">
          {cart ? (
            <div className="space-y-1">
              {cart.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span>{it.title} {it.qty && it.qty > 1 ? `× ${it.qty}` : ''}</span>
                  <span className="font-semibold">৳{it.price * (it.qty || 1)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between items-center">
                <span className="font-semibold">মোট</span>
                <span className="text-2xl font-extrabold text-primary">৳{total}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">প্রডাক্ট</p>
                <p className="font-bold">{titleSummary}</p>
              </div>
              <p className="text-2xl font-extrabold text-primary">৳{total}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold">পেমেন্ট পদ্ধতি বাছুন</h2>

          {methods.length === 0 && (
            <p className="text-sm text-muted-foreground">কোন পেমেন্ট পদ্ধতি কনফিগার করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`border rounded-lg p-3 flex flex-col items-center gap-2 transition-all ${
                  selectedId === m.id ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                {m.logoUrl
                  ? <img src={m.logoUrl} alt={m.name} className="h-8 w-auto object-contain" />
                  : <div className="h-8 flex items-center font-semibold">{m.name}</div>}
                <span className="text-xs font-medium">{m.name}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="bg-muted p-3 rounded text-sm space-y-1">
              {selected.accountNumber && (
                <p><span className="text-muted-foreground">{isBank ? 'অ্যাকাউন্ট:' : 'নম্বর:'}</span> <span className="font-mono font-bold">{selected.accountNumber}</span></p>
              )}
              <p><span className="text-muted-foreground">পরিমাণ:</span> <strong>৳{total}</strong></p>
              {selected.instructions && (
                <p className="whitespace-pre-line text-muted-foreground">{selected.instructions}</p>
              )}
            </div>
          )}

          {selected && (
            <div className="space-y-3 pt-2 border-t">
              {isBank ? (
                <>
                  <div>
                    <Label>আপনার অ্যাকাউন্ট নম্বর *</Label>
                    <Input value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} placeholder="যেমন: 1234567890123" />
                  </div>
                  <div>
                    <Label>ব্যাংকের নাম *</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="যেমন: Dutch-Bangla Bank" />
                  </div>
                </>
              ) : (
                <div>
                  <Label>আপনার পেমেন্ট নম্বর * (১১ ডিজিট)</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="01XXXXXXXXX"
                  />
                  {paymentNumber && !isValidBdPhone(paymentNumber) && (
                    <p className="text-xs text-destructive mt-1">নম্বর ঠিক ১১ ডিজিট হতে হবে</p>
                  )}
                </div>
              )}

              <div>
                <Label>TrxID / ট্রানজেকশন আইডি *</Label>
                <Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="যেমন: 8N7A2K3LM9" />
              </div>

              <div>
                <Label>স্ক্রিনশট (ঐচ্ছিক)</Label>
                {screenshot ? (
                  <div className="flex items-center gap-2 mt-1 p-2 border rounded">
                    <img src={URL.createObjectURL(screenshot)} alt="preview" className="h-12 w-12 object-cover rounded" />
                    <span className="text-sm flex-1 truncate">{screenshot.name}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setScreenshot(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="mt-1 flex items-center justify-center gap-2 border-2 border-dashed rounded p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">পেমেন্ট স্ক্রিনশট আপলোড করুন</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button size="lg" className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-secondary shadow-lg" onClick={handleSubmit} disabled={loading || methods.length === 0 || !!blockedMsg}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        অর্ডার সাবমিট করুন
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> সুরক্ষিত পেমেন্ট — অ্যাডমিন অ্যাপ্রুভ করার পর অ্যাক্সেস পাবেন
      </p>

      <Dialog open={!!blockedMsg} onOpenChange={(o) => !o && setBlockedMsg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> অ্যাক্সেস ব্লকড
            </DialogTitle>
          </DialogHeader>
          <p className="text-center py-4 font-semibold">{blockedMsg}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalPayment;
