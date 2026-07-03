import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '@/stores/useProductStore';
import { useMohasagorStore } from '@/stores/useMohasagorStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit2, Trash2, Eye, FileText, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { Product } from '@/data/store-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const Products = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const { products: productList, deleteProduct, updateProduct } = useProductStore();
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      const settings = useSiteSettingsStore.getState();
      const nextProductsVersion = (settings.productsCacheVersion || 1) + 1;
      const nextMohasagorVersion = (settings.mohasagorCacheVersion || 1) + 1;
      await settings.updateSettings({
        productsCacheVersion: nextProductsVersion,
        mohasagorCacheVersion: nextMohasagorVersion,
      });
      // Bust local cache immediately for the admin too
      await Promise.all([
        useProductStore.getState().fetchProducts({ force: true, includeAll: true, expectedVersion: nextProductsVersion }),
        useMohasagorStore.getState().fetchProducts({ force: true }),
      ]);
      toast.success('ক্যাশ রিফ্রেশ হয়েছে — সব ভিজিটর পরের লোডে নতুন প্রডাক্ট দেখবে।');
      setRefreshOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('ক্যাশ রিফ্রেশ করতে সমস্যা হয়েছে');
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => productList.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (p.status || 'published') === statusFilter;
    return matchSearch && matchStatus;
  }), [productList, search, statusFilter]);

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [filtered.length, totalPages, currentPage]);
  const pageItems = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage]);

  const publishedCount = productList.filter(p => (p.status || 'published') === 'published').length;
  const draftCount = productList.filter(p => p.status === 'draft').length;

  const requestDelete = (product: Product) => {
    setDeleteConfirmProduct(product);
    setDeleteConfirmStep(1);
  };

  const confirmDeleteStep = () => {
    if (!deleteConfirmProduct) return;
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
      return;
    }
    deleteProduct(deleteConfirmProduct.id);
    toast.success(`"${deleteConfirmProduct.title}" ডিলিট হয়েছে`);
    setDeleteConfirmProduct(null);
    setDeleteConfirmStep(0);
  };

  const toggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    updateProduct(id, { status: newStatus as 'published' | 'draft' });
    toast.success(newStatus === 'published' ? 'পণ্য পাবলিশ করা হয়েছে' : 'পণ্য ড্রাফটে নেওয়া হয়েছে');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">পণ্য সমূহ</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">মোট {productList.length}টি পণ্য</span>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{publishedCount} পাবলিশড</Badge>
            <Badge variant="secondary" className="text-xs">{draftCount} ড্রাফট</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={productList}
            filename="products"
            label="পণ্য"
            onImport={(items: Product[]) => {
              items.forEach(p => {
                if (!productList.find(ep => ep.id === p.id)) {
                  useProductStore.getState().addProduct(p);
                }
              });
            }}
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setRefreshOpen(true)}
            title="রিসেলার শপ পেজে নিজস্ব ও মহাসাগরের প্রডাক্ট ক্যাশ রিফ্রেশ করুন"
          >
            <RefreshCw className="w-4 h-4" /> ক্যাশ রিফ্রেশ
          </Button>
          <Button className="gap-2" onClick={() => navigate('/admin/products/new')}>
            <Plus className="w-4 h-4" /> নতুন পণ্য যোগ করুন
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="পণ্য খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব পণ্য</SelectItem>
            <SelectItem value="published">পাবলিশড</SelectItem>
            <SelectItem value="draft">ড্রাফট</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">পণ্য</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ক্যাটাগরি</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">মূল্য</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">স্ট্যাটাস</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">স্টক</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(product => {
                  const productStatus = product.status || 'published';
                  return (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img src={product.featuredImage || product.images[0]} alt={product.title} className="w-10 h-10 rounded-lg object-cover" />
                          <span className="font-medium line-clamp-1 max-w-[200px]">{product.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{product.category}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold">৳ {product.price}</span>
                        {product.originalPrice && <span className="text-xs text-muted-foreground line-through ml-1">৳ {product.originalPrice}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => toggleStatus(product.id, productStatus)} className="cursor-pointer">
                          {productStatus === 'published' ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 gap-1 text-xs"><Eye className="w-3 h-3" /> পাবলিশড</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs hover:bg-secondary/80"><FileText className="w-3 h-3" /> ড্রাফট</Badge>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {product.inStock ? 'স্টকে আছে' : 'স্টকে নেই'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(product.status || 'published') === 'published' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="ভিউ করুন" onClick={() => navigate(`/product/${product.slug}`)}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="লিংক কপি" onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/product/${product.slug}`);
                                toast.success('লিংক কপি হয়েছে');
                              }}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/products/edit/${product.id}`)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => requestDelete(product)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 border-t bg-muted/20 rounded-md">
          <p className="text-xs text-muted-foreground">
            পেজ <span className="font-semibold text-foreground">{currentPage}</span> / {totalPages} — দেখাচ্ছে {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} মোট {filtered.length}টি
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</Button>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹</Button>
            <span className="text-sm px-2">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>›</Button>
            <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
          </div>
        </div>
      )}

      {deleteConfirmProduct && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setDeleteConfirmProduct(null); setDeleteConfirmStep(0); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" /> পণ্য ডিলিট
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {deleteConfirmStep === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    আপনি কি <span className="font-bold text-foreground">"{deleteConfirmProduct.title}"</span> পণ্যটি ডিলিট করতে চান?
                  </p>
                  <p className="text-xs text-destructive font-medium">⚠️ এই অ্যাকশন পূর্বাবস্থায় ফেরানো যাবে না।</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setDeleteConfirmProduct(null); setDeleteConfirmStep(0); }}>বাতিল</Button>
                    <Button variant="destructive" onClick={confirmDeleteStep}>হ্যাঁ, ডিলিট করুন</Button>
                  </div>
                </>
              )}
              {deleteConfirmStep === 2 && (
                <>
                  <p className="text-sm font-bold text-destructive">
                    ⚠️ শেষ সতর্কতা! সত্যিই কি "{deleteConfirmProduct.title}" চিরতরে ডিলিট করতে চান?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setDeleteConfirmProduct(null); setDeleteConfirmStep(0); }}>বাতিল</Button>
                    <Button variant="destructive" onClick={confirmDeleteStep}>নিশ্চিত ডিলিট</Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ক্যাশ রিফ্রেশ করবেন?</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              এটা চাপলে সব রিসেলার ও ভিজিটরের ব্রাউজারে সংরক্ষিত নিজস্ব প্রডাক্ট (৭ দিন)
              এবং মহাসাগরের প্রডাক্ট (৩০ দিন) ক্যাশ ইনভ্যালিড হবে। তারা পরের বার শপ পেজ
              খুললে নতুন ডেটা লোড হবে। বারবার চাপলে অতিরিক্ত Egress খরচ হবে।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefreshOpen(false)} disabled={refreshing}>
              বাতিল
            </Button>
            <Button onClick={handleRefreshCache} disabled={refreshing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'রিফ্রেশ হচ্ছে...' : 'হ্যাঁ, রিফ্রেশ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
