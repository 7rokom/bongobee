import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDigitalProductStore } from '@/stores/useDigitalProductStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const DigitalProducts = () => {
  const navigate = useNavigate();
  const { products, fetch, remove, update } = useDigitalProductStore();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDelete2, setConfirmDelete2] = useState<string | null>(null);

  useEffect(() => { fetch({ force: true, includeAll: true }); }, [fetch]);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'published' ? 'draft' : 'published';
    await update(id, { status: next as any });
    toast.success(`স্ট্যাটাস ${next === 'published' ? 'পাবলিশড' : 'ড্রাফট'} করা হয়েছে`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ডিজিটাল প্রডাক্ট</h1>
          <p className="text-sm text-muted-foreground">মোট: {products.length}</p>
        </div>
        <Button onClick={() => navigate('/admin/digital/products/new')}>
          <Plus className="mr-2 h-4 w-4" /> নতুন প্রডাক্ট
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="সার্চ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">কোন প্রডাক্ট নেই</CardContent></Card>
        )}
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start">
              <img src={p.featuredImage || '/placeholder.svg'} alt={p.title} className="w-20 h-20 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{p.title}</h3>
                  <Badge variant={p.status === 'published' ? 'default' : 'secondary'}>
                    {p.status === 'published' ? 'পাবলিশড' : 'ড্রাফট'}
                  </Badge>
                  <Badge variant="outline">{p.productType === 'file' ? 'ফাইল' : p.productType === 'link' ? 'লিংক' : 'উভয়'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{p.shortDescription}</p>
                <p className="text-sm font-semibold mt-1">৳{p.price}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => window.open(`/digital-product/${p.slug}`, '_blank')}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleStatus(p.id, p.status)}>
                  {p.status === 'published' ? 'ড্রাফট করুন' : 'পাবলিশ করুন'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/admin/digital/products/edit/${p.id}`)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>প্রডাক্ট ডিলিট করবেন?</DialogTitle></DialogHeader>
          <p>এই কাজটি ফেরানো যাবে না।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={() => {
              setConfirmDelete2(confirmDelete);
              setConfirmDelete(null);
            }}>হ্যাঁ, ডিলিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete2} onOpenChange={(o) => !o && setConfirmDelete2(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>আপনি কি নিশ্চিত?</DialogTitle></DialogHeader>
          <p>চূড়ান্তভাবে এই প্রডাক্ট ডিলিট হয়ে যাবে। আবার নিশ্চিত করুন।</p>
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

export default DigitalProducts;
