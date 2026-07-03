import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminStore } from '@/stores/useAdminStore';
import { api, setToken, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Store, Shield } from 'lucide-react';

const ResellerLogin = () => {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const { login: adminLogin } = useAdminStore();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      toast({ title: 'সব ফিল্ড পূরণ করুন', variant: 'destructive' });
      return;
    }
    try {
      const res = await api.post<{ token: string; reseller: { id: string; name: string; email: string } }>(
        '/auth/reseller/login',
        { email: loginForm.email, password: loginForm.password }
      );
      setToken('reseller', res.token);
      localStorage.setItem('reseller-auth', JSON.stringify({ id: res.reseller.id, name: res.reseller.name, email: res.reseller.email }));
      toast({ title: `স্বাগতম, ${res.reseller.name}!` });
      navigate('/reseller');
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 403
        ? 'আপনার অ্যাকাউন্ট এখনো অনুমোদিত হয়নি'
        : 'ভুল ইমেইল বা পাসওয়ার্ড';
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleSignup = async () => {
    if (!signupForm.name || !signupForm.email || !signupForm.phone || !signupForm.password) {
      toast({ title: 'সব ফিল্ড পূরণ করুন', variant: 'destructive' });
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      toast({ title: 'পাসওয়ার্ড মিলছে না', variant: 'destructive' });
      return;
    }
    try {
      await api.post('/auth/reseller/register', {
        name: signupForm.name,
        email: signupForm.email,
        phone: signupForm.phone,
        password: signupForm.password,
      });
      toast({ title: 'রেজিস্ট্রেশন সফল হয়েছে! অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন।', description: 'আপনার অ্যাকাউন্ট পেন্ডিং আছে।' });
      setSignupForm({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
    } catch (e) {
      const msg = e instanceof ApiError && e.errors?.email
        ? 'এই ইমেইল দিয়ে আগেই রেজিস্ট্রেশন করা হয়েছে'
        : (e instanceof Error ? e.message : 'রেজিস্ট্রেশন ব্যর্থ হয়েছে');
      toast({ title: msg, variant: 'destructive' });
    }
  };

  const handleAdminLogin = async () => {
    if (!adminForm.email || !adminForm.password) {
      toast({ title: 'সব ফিল্ড পূরণ করুন', variant: 'destructive' });
      return;
    }
    if (await adminLogin(adminForm.email, adminForm.password)) {
      toast({ title: 'লগইন সফল!' });
      navigate('/admin');
    } else {
      toast({ title: 'ভুল ইমেইল বা পাসওয়ার্ড', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">রিসেলার প্যানেল</CardTitle>
          <p className="text-sm text-muted-foreground">লগইন করুন অথবা নতুন অ্যাকাউন্ট তৈরি করুন</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">লগইন</TabsTrigger>
              <TabsTrigger value="signup">সাইন আপ</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label>ইমেইল</Label>
                <Input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="আপনার ইমেইল"
                />
              </div>
              <div className="space-y-2">
                <Label>পাসওয়ার্ড</Label>
                <div className="relative">
                  <Input
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="পাসওয়ার্ড"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowLoginPass(!showLoginPass)}>
                    {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full" onClick={handleLogin}>লগইন করুন</Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label>নাম</Label>
                <Input
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                  placeholder="আপনার পূর্ণ নাম"
                />
              </div>
              <div className="space-y-2">
                <Label>ইমেইল</Label>
                <Input
                  type="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  placeholder="আপনার ইমেইল"
                />
              </div>
              <div className="space-y-2">
                <Label>ফোন নম্বর</Label>
                <Input
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>পাসওয়ার্ড</Label>
                <div className="relative">
                  <Input
                    type={showSignupPass ? 'text' : 'password'}
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    placeholder="পাসওয়ার্ড"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSignupPass(!showSignupPass)}>
                    {showSignupPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>পাসওয়ার্ড নিশ্চিত করুন</Label>
                <Input
                  type="password"
                  value={signupForm.confirmPassword}
                  onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                  placeholder="পুনরায় পাসওয়ার্ড দিন"
                  onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                />
              </div>
              <Button className="w-full" onClick={handleSignup}>রেজিস্ট্রেশন করুন</Button>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerLogin;
