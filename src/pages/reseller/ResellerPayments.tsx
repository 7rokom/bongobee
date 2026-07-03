import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResellerStore, PaymentRequest } from '@/stores/useResellerStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { computeResellerBalance } from '@/lib/reseller-balance';

const MINIMUM_BALANCE = 200;

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

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-100 text-yellow-800',
  'অনুমোদিত': 'bg-green-100 text-green-800',
  'বাতিল': 'bg-red-100 text-red-800',
};

const ResellerPayments = () => {
  const reseller = getReseller();
  const resellerId = reseller?.id || '';
  const store = useResellerStore();
  const requests = store.paymentRequests.filter((p) => p.resellerId === resellerId);
  const addPaymentRequest = store.addPaymentRequest;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);

  const orders = store.orders.filter((o) => o.resellerId === resellerId);
  const { withdrawable: totalBalance } = computeResellerBalance(orders, requests);
  const withdrawable = Math.max(0, totalBalance - MINIMUM_BALANCE);

  useEffect(() => {
    if (resellerId) {
      api.get(`/rs/payment-methods?reseller_id=${resellerId}`).then((data) => {
        if (Array.isArray(data)) setSavedMethods(data);
      }).catch(() => {});
    }
  }, [resellerId]);

  const handleSubmit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'সঠিক পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (amt > withdrawable) {
      toast({ title: `সর্বোচ্চ ৳${withdrawable} উত্তোলন করা যাবে (৳${MINIMUM_BALANCE} রিজার্ভ)`, variant: 'destructive' });
      return;
    }
    const selectedMethod = savedMethods.find((m) => m.id === selectedMethodId);
    if (!selectedMethod) {
      toast({ title: 'পেমেন্ট মেথড সিলেক্ট করুন', variant: 'destructive' });
      return;
    }

    const req: PaymentRequest = {
      id: Date.now().toString(),
      resellerId,
      resellerName: reseller?.name || '',
      amount: amt,
      method: methodLabels[selectedMethod.method_type] || selectedMethod.method_type,
      accountNumber: selectedMethod.account_number,
      status: 'পেন্ডিং',
      date: new Date().toLocaleDateString('bn-BD'),
    };

    addPaymentRequest(req);
    toast({ title: 'পেমেন্ট রিকুয়েস্ট সাবমিট হয়েছে' });
    setAmount('');
    setSelectedMethodId('');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">পেমেন্ট রিকুয়েস্ট</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" disabled={withdrawable <= 0}>
              <Plus className="h-4 w-4" /> নতুন রিকুয়েস্ট
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>পেমেন্ট রিকুয়েস্ট</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">উত্তোলনযোগ্য</p>
                <p className="text-xl font-bold text-primary">৳{withdrawable}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" /> সর্বনিম্ন ৳{MINIMUM_BALANCE} ব্যালেন্স রাখতে হবে
                </p>
              </div>

              {savedMethods.length === 0 ? (
                <div className="p-4 border rounded-lg text-center text-sm text-muted-foreground">
                  <p>কোনো পেমেন্ট মেথড নেই</p>
                  <p className="text-xs mt-1">প্রথমে "পেমেন্ট মেথড" পেজ থেকে মেথড যোগ করুন</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>পেমেন্ট মেথড সিলেক্ট করুন</Label>
                    <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                      <SelectTrigger><SelectValue placeholder="মেথড সিলেক্ট করুন" /></SelectTrigger>
                      <SelectContent>
                        {savedMethods.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label || methodLabels[m.method_type]} — {m.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>পরিমাণ (৳)</Label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="পরিমাণ" />
                  </div>
                  <Button className="w-full" onClick={handleSubmit}>রিকুয়েস্ট সাবমিট</Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">কোনো পেমেন্ট রিকুয়েস্ট নেই</CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>তারিখ</TableHead>
                <TableHead>পরিমাণ</TableHead>
                <TableHead>মেথড</TableHead>
                <TableHead>অ্যাকাউন্ট</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="font-medium">৳{r.amount}</TableCell>
                  <TableCell>{r.method}</TableCell>
                  <TableCell>{r.accountNumber}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[r.status] || ''} variant="secondary">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default ResellerPayments;
