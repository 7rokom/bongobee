import { useEffect, useState } from 'react';
import { useDigitalOrderStore, type DigitalOrderStatus, type DigitalOrder } from '@/stores/useDigitalOrderStore';
// screenshots are served from Laravel public storage (paths are direct URLs)
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone, Mail, Trash2, Copy, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const ScreenshotLink = ({ order }: { order: DigitalOrder }) => {
  const [loading, setLoading] = useState(false);
  if (!order.screenshotPath) return null;
  const open = async () => {
    window.open(order.screenshotPath!, '_blank');
  };
  return (
    <button onClick={open} disabled={loading} className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
      <ImageIcon className="h-3.5 w-3.5" /> {loading ? 'লোডিং...' : 'স্ক্রিনশট দেখুন'}
    </button>
  );
};

const statusColors: Record<DigitalOrderStatus, string> = {
  'পেন্ডিং': 'bg-yellow-400 text-yellow-950',
  'কনফার্মড': 'bg-green-500 text-white',
  'বাতিল': 'bg-red-500 text-white',
};

const DigitalOrders = () => {
  const { orders, fetchAll, updateStatus, remove } = useDigitalOrderStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'সব' | DigitalOrderStatus>('সব');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDelete2, setConfirmDelete2] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search) ||
      o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      o.trxId.includes(search);
    const matchStatus = statusFilter === 'সব' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    pending: orders.filter((o) => o.status === 'পেন্ডিং').length,
    confirmed: orders.filter((o) => o.status === 'কনফার্মড').length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ডিজিটাল অর্ডার</h1>
        <p className="text-sm text-muted-foreground">পেন্ডিং: {counts.pending} | কনফার্মড: {counts.confirmed} | মোট: {orders.length}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="সার্চ (অর্ডার নং, নাম, ফোন, ইমেইল, TrxID)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="সব">সব</SelectItem>
            <SelectItem value="পেন্ডিং">পেন্ডিং</SelectItem>
            <SelectItem value="কনফার্মড">কনফার্মড</SelectItem>
            <SelectItem value="বাতিল">বাতিল</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">কোন অর্ডার পাওয়া যায়নি</CardContent></Card>
        )}
        {filtered.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{o.orderNumber}</span>
                  <Badge className={statusColors[o.status]}>{o.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString('bn-BD')}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">প্রডাক্ট:</span>{' '}
                  {o.items && o.items.length > 0 ? (
                    <ul className="list-disc ml-5 mt-1">
                      {o.items.map((it, idx) => (
                        <li key={idx}><strong>{it.title}</strong> {it.qty > 1 ? `× ${it.qty}` : ''} — ৳{it.price * it.qty}</li>
                      ))}
                    </ul>
                  ) : (
                    <strong>{o.productTitle}</strong>
                  )}
                </div>
                <div><span className="text-muted-foreground">মোট মূল্য:</span> <strong>৳{o.price}</strong></div>
                <div><span className="text-muted-foreground">কাস্টমার:</span> {o.customerName}</div>
                <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {o.customerPhone}</div>
                <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {o.customerEmail}</div>
                <div>
                  <span className="text-muted-foreground">{o.paymentMethodName || o.paymentMethod} TrxID:</span>
                  <button onClick={() => { navigator.clipboard.writeText(o.trxId); toast.success('কপি হয়েছে'); }} className="ml-1 inline-flex items-center gap-1 font-mono hover:underline">
                    {o.trxId} <Copy className="h-3 w-3" />
                  </button>
                </div>
                {o.paymentNumber && (
                  <div>
                    <span className="text-muted-foreground">পেমেন্ট নম্বর/অ্যাকাউন্ট:</span>{' '}
                    <span className="font-mono">{o.paymentNumber}</span>
                  </div>
                )}
                {o.bankName && (
                  <div>
                    <span className="text-muted-foreground">ব্যাংক:</span> {o.bankName}
                  </div>
                )}
                {o.screenshotPath && (
                  <div className="sm:col-span-2"><ScreenshotLink order={o} /></div>
                )}
                {o.customerAddress && <div className="sm:col-span-2"><span className="text-muted-foreground">ঠিকানা:</span> {o.customerAddress}</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                {o.status !== 'কনফার্মড' && (
                  <Button size="sm" onClick={async () => { await updateStatus(o.id, 'কনফার্মড'); toast.success('কনফার্ম করা হয়েছে'); }}>
                    অ্যাপ্রুভ করুন
                  </Button>
                )}
                {o.status !== 'বাতিল' && (
                  <Button size="sm" variant="outline" onClick={async () => { await updateStatus(o.id, 'বাতিল'); toast.success('বাতিল করা হয়েছে'); }}>
                    বাতিল
                  </Button>
                )}
                {o.status !== 'পেন্ডিং' && (
                  <Button size="sm" variant="outline" onClick={async () => { await updateStatus(o.id, 'পেন্ডিং'); }}>
                    পেন্ডিং
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(o.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>অর্ডার ডিলিট করবেন?</DialogTitle></DialogHeader>
          <p>এই কাজটি ফেরানো যাবে না।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete2(confirmDelete); setConfirmDelete(null); }}>হ্যাঁ, ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete2} onOpenChange={(o) => !o && setConfirmDelete2(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>আপনি কি নিশ্চিত?</DialogTitle></DialogHeader>
          <p>চূড়ান্তভাবে এই অর্ডার ডিলিট হয়ে যাবে। আবার নিশ্চিত করুন।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete2(null)}>না</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDelete2) { await remove(confirmDelete2); toast.success('ডিলিট হয়েছে'); setConfirmDelete2(null); }
            }}>হ্যাঁ, কনফার্ম ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalOrders;
