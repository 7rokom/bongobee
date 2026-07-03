import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const DigitalLogin = () => {
  const navigate = useNavigate();
  const signIn = useDigitalAuthStore((s) => s.signIn);
  const userId = useDigitalAuthStore((s) => s.userId);
  const init = useDigitalAuthStore((s) => s.init);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { const u = init(); return u; }, [init]);
  useEffect(() => { if (userId) navigate('/digital/account'); }, [userId, navigate]);

  const handleLogin = async () => {
    if (!email || !password) { toast.error('ইমেইল ও পাসওয়ার্ড দিন'); return; }
    setLoading(true);
    const r = await signIn(email, password);
    setLoading(false);
    if (!r.ok) { toast.error(r.error || 'লগইন ব্যর্থ'); return; }
    toast.success('লগইন সফল');
    navigate('/digital/account');
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-md">
      <Card><CardContent className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">কাস্টমার লগইন</h1>
        <div><Label>ইমেইল</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div>
          <Label>পাসওয়ার্ড</Label>
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShow(!show)}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button className="w-full" onClick={handleLogin} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          লগইন
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          অ্যাকাউন্ট নেই? কোনো ডিজিটাল প্রডাক্ট <a href="https://bongobee.store/digital-products" className="text-primary underline font-bold">কিনলে</a> অ্যাকাউন্ট তৈরি হবে।
        </p>
      </CardContent></Card>
    </div>
  );
};

export default DigitalLogin;
