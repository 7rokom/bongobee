import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { useDigitalOrderStore, type DigitalOrder } from '@/stores/useDigitalOrderStore';
import { useDigitalProductStore } from '@/stores/useDigitalProductStore';
// download files are served from Laravel public storage (paths are direct URLs)
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, Copy, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'পেন্ডিং': 'bg-yellow-400 text-yellow-950',
  'কনফার্মড': 'bg-green-500 text-white',
  'বাতিল': 'bg-red-500 text-white',
};

const DigitalAccount = () => {
  const navigate = useNavigate();
  const userId = useDigitalAuthStore((s) => s.userId);
  const profile = useDigitalAuthStore((s) => s.profile);
  const ready = useDigitalAuthStore((s) => s.ready);
  const init = useDigitalAuthStore((s) => s.init);
  const signOut = useDigitalAuthStore((s) => s.signOut);
  const fetchByUser = useDigitalOrderStore((s) => s.fetchByUser);
  const { products, fetch: fetchProducts } = useDigitalProductStore();

  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { const u = init(); return u; }, [init]);
  useEffect(() => { if (ready && !userId) navigate('/digital/login'); }, [ready, userId, navigate]);
  useEffect(() => {
    if (userId) {
      fetchByUser(userId).then(setOrders);
      fetchProducts({ force: true, includeAll: true });
    }
  }, [userId]);

  const getProduct = (id: string | null) => products.find((p) => p.id === id);

  const handleDownload = async (order: DigitalOrder) => {
    const p = getProduct(order.productId);
    if (!p?.downloadFilePath) { toast.error('ফাইল পাওয়া যায়নি'); return; }
    window.open(p.downloadFilePath, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <Card className="mb-6 overflow-hidden border-primary/20">
        <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-background p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold shadow">
              {profile?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold leading-tight">{profile?.name || 'আমার অ্যাকাউন্ট'}</h1>
              {profile && <p className="text-sm text-muted-foreground">{profile.email}</p>}
            </div>
          </div>
          <Button variant="outline" onClick={async () => { await signOut(); navigate('/digital/login'); }}>
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
        </div>
      </Card>

      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary rounded-full" /> আমার অর্ডার ({orders.length})
      </h2>

      {orders.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          কোনো অর্ডার নেই
          <div className="mt-3"><Link to="/digital-products" className="text-primary underline">প্রডাক্ট ব্রাউজ করুন</Link></div>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const p = getProduct(o.productId);
          const confirmed = o.status === 'কনফার্মড';
          return (
            <Card key={o.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{o.orderNumber}</span>
                  <Badge className={statusColors[o.status]}>{o.status}</Badge>
                </div>
                <div className="flex items-start gap-3">
                  {p?.featuredImage && <img src={p.featuredImage} alt="" className="w-16 h-16 object-cover rounded-lg border" />}
                  <div className="flex-1">
                    <p className="font-semibold">{o.productTitle}</p>
                    <p className="text-sm text-muted-foreground">৳{o.price} • {new Date(o.createdAt).toLocaleDateString('bn-BD')}</p>
                  </div>
                </div>

                {!confirmed && (
                  <p className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 p-3 rounded-lg">
                    ⏳ অ্যাডমিন অ্যাপ্রুভ করার পর এখানে ডাউনলোড/অ্যাক্সেস লিংক দেখা যাবে।
                  </p>
                )}

                {confirmed && p && (
                  <div className="space-y-2 pt-2 border-t">
                    {(p.productType === 'file' || p.productType === 'both') && p.downloadFilePath && (
                      <Button onClick={() => handleDownload(o)} disabled={busyId === o.id} className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary">
                        {busyId === o.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        ডাউনলোড করুন
                      </Button>
                    )}
                    {(p.productType === 'link' || p.productType === 'both') && p.accessLink && (
                      <a href={p.accessLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary underline font-medium">
                        <ExternalLink className="h-4 w-4" /> অ্যাক্সেস লিংক খুলুন
                      </a>
                    )}
                    {(p.productType === 'link' || p.productType === 'both') && p.accessCode && (
                      <div className="bg-muted p-3 rounded-lg text-sm flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">অ্যাক্সেস কোড</p>
                          <span className="font-mono font-bold">{p.accessCode}</span>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(p.accessCode!); toast.success('কপি হয়েছে'); }} className="p-2 hover:bg-background rounded">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link to="/digital-products" className="text-primary underline">আরো প্রডাক্ট দেখুন</Link>
      </p>
    </div>
  );
};

export default DigitalAccount;
