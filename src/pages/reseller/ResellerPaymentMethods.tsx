import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface SavedPaymentMethod {
  id: string;
  reseller_id: string;
  method_type: string;
  account_number: string;
  label: string;
}

const methodLabels: Record<string, string> = {
  bkash: 'বিকাশ',
  nagad: 'নগদ',
  rocket: 'রকেট',
  upay: 'উপায়',
  bank: 'ব্যাংক',
};

const getReseller = () => {
  const auth = localStorage.getItem('reseller-auth');
  return auth ? JSON.parse(auth) : null;
};

const ResellerPaymentMethods = () => {
  const reseller = getReseller();
  const resellerId = reseller?.id || '';
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [open, setOpen] = useState(false);
  const [methodType, setMethodType] = useState('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMethods = async () => {
    try { const data = await api.get(`/rs/payment-methods?reseller_id=${resellerId}`); if (Array.isArray(data)) setMethods(data); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (resellerId) fetchMethods();
  }, [resellerId]);

  const handleAdd = async () => {
    if (!accountNumber.trim()) {
      toast({ title: 'অ্যাকাউন্ট নম্বর দিন', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/rs/payment-methods', {
        reseller_id: resellerId,
        method_type: methodType,
        account_number: accountNumber.trim(),
        label: label.trim() || `${methodLabels[methodType]} - ${accountNumber.trim().slice(-4)}`,
      });
      toast({ title: 'পেমেন্ট মেথড যোগ হয়েছে' });
      setAccountNumber('');
      setLabel('');
      setOpen(false);
      fetchMethods();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try { await api.del(`/rs/payment-methods/${id}`); } catch { /* ignore */ }
    setMethods((prev) => prev.filter((m) => m.id !== id));
    toast({ title: 'পেমেন্ট মেথড মুছে ফেলা হয়েছে' });
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">পেমেন্ট মেথড</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> নতুন মেথড</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>পেমেন্ট মেথড যোগ করুন</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>মেথড টাইপ</Label>
                <Select value={methodType} onValueChange={setMethodType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bkash">বিকাশ</SelectItem>
                    <SelectItem value="nagad">নগদ</SelectItem>
                    <SelectItem value="rocket">রকেট</SelectItem>
                    <SelectItem value="upay">উপায়</SelectItem>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>অ্যাকাউন্ট নম্বর</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="আপনার অ্যাকাউন্ট নম্বর" />
              </div>
              <div className="space-y-2">
                <Label>লেবেল (ঐচ্ছিক)</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="যেমন: আমার বিকাশ পার্সোনাল" />
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={loading}>
                {loading ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {methods.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>কোনো পেমেন্ট মেথড যোগ করা হয়নি</p>
            <p className="text-xs mt-1">পেমেন্ট রিকুয়েস্ট দিতে আগে পেমেন্ট মেথড যোগ করুন</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <Card key={m.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{m.label || methodLabels[m.method_type]}</p>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">{methodLabels[m.method_type]}</Badge>
                      <p className="text-sm text-muted-foreground mt-1 font-mono">{m.account_number}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResellerPaymentMethods;
