import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { useDigitalBlockStore, getClientIp, getClientFingerprint } from '@/stores/useDigitalBlockStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutProduct { id: string; title: string; slug: string; price: number; qty?: number; }
interface CheckoutCart { items: CheckoutProduct[]; total: number; }

const DigitalCheckout = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [cart, setCart] = useState<CheckoutCart | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const signUp = useDigitalAuthStore((s) => s.signUpAndCreateProfile);
  const initAuth = useDigitalAuthStore((s) => s.init);
  const existingUserId = useDigitalAuthStore((s) => s.userId);
  const fetchBlocks = useDigitalBlockStore((s) => s.fetchAll);
  const isBlocked = useDigitalBlockStore((s) => s.isBlocked);

  useEffect(() => {
    const cartStored = sessionStorage.getItem('digital_checkout_cart');
    const productStored = sessionStorage.getItem('digital_checkout_product');
    if (cartStored) setCart(JSON.parse(cartStored));
    else if (productStored) setProduct(JSON.parse(productStored));
    else { navigate('/'); return; }
    const unsub = initAuth();
    fetchBlocks();
    return unsub;
  }, []);

  useEffect(() => {
    if (existingUserId) navigate('/digital/payment', { replace: true });
  }, [existingUserId, navigate]);

  const total = cart ? cart.total : (product?.price || 0);
  const title = cart ? `${cart.items.length} টি প্রডাক্ট` : (product?.title || '');

  const handleSubmit = async () => {
    if (!product && !cart) return;
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast.error('সব প্রয়োজনীয় ফিল্ড পূরণ করুন'); return;
    }
    if (password.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return;
    }

    // Block check (IP / phone / fingerprint)
    const ip = await getClientIp();
    const fp = getClientFingerprint();
    if (isBlocked({ phone: phone.trim(), ip, fingerprint: fp })) {
      setBlockedMsg('আপনাকে ব্লক করা হয়েছে। অর্ডার করা সম্ভব নয়।');
      return;
    }

    setLoading(true);
    const r = await signUp({ name, email, password, phone, address: '' });
    setLoading(false);
    if (!r.ok || !r.userId) {
      toast.error(r.error || 'অ্যাকাউন্ট তৈরি ব্যর্থ'); return;
    }
    navigate('/digital/payment');
  };

  if (!product && !cart) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold">চেকআউট</h1>
        <p className="text-sm text-muted-foreground mt-1">অ্যাকাউন্ট তৈরি করুন — পরে এই ইমেইল দিয়ে লগইন করে প্রডাক্ট পাবেন</p>
      </div>

      <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="p-4">
          {cart ? (
            <div className="space-y-2">
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
                <p className="font-bold">{title}</p>
              </div>
              <p className="text-2xl font-extrabold text-primary">৳{total}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" /> আপনার তথ্য
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>নাম *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>ফোন *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>ইমেইল *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>পাসওয়ার্ড * (অ্যাকাউন্ট তৈরি হবে)</Label>
            <div className="relative">
              <Input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">এই ইমেইল ও পাসওয়ার্ড দিয়ে আপনি পরে লগইন করে আপনার ক্রয়কৃত প্রডাক্ট পাবেন</p>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full mt-6 h-12 text-base font-bold bg-gradient-to-r from-primary to-secondary shadow-lg" onClick={handleSubmit} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        পরবর্তী ধাপ — পেমেন্ট
      </Button>

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

export default DigitalCheckout;
