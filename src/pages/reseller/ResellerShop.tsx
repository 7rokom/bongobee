import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductStore } from '@/stores/useProductStore';
import { useMohasagorStore } from '@/stores/useMohasagorStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useResellerDomainStore } from '@/stores/useResellerDomainStore';
import { ShoppingCart, Search, Link2, Check, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const getStoredResellerId = () => {
  const raw = localStorage.getItem('reseller-auth');
  if (!raw) return '';
  try {
    return JSON.parse(raw)?.id || '';
  } catch {
    localStorage.removeItem('reseller-auth');
    return '';
  }
};

export interface ResellerCartItem {
  product: any;
  qty: number;
  sellingPrice: number;
  selectedColor?: string;
  selectedSize?: string;
  selectedWeight?: string;
}

const ResellerShop = () => {
  const allProducts = useProductStore((s) => s.products);
  const products = useMemo(
    () => allProducts.filter((p) => !p.isAffiliate && p.status !== 'draft'),
    [allProducts],
  );
  const { products: mohasagorProducts, categories: mohasagorCategories, loading: mohasagorLoading, error: mohasagorError, fetchProducts: fetchMohasagor } = useMohasagorStore();
  const resellers = useResellerStore((s) => s.resellers);
  const fetchResellers = useResellerStore((s) => s.fetchResellers);
  const { domain: customDomain, fetchDomain } = useResellerDomainStore();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const navigate = useNavigate();

  const resellerId = getStoredResellerId();
  const reseller = resellers.find(r => r.id === resellerId);
  const serialNumber = reseller?.serialNumber;

  useEffect(() => {
    fetchMohasagor();
    fetchDomain(); // load reseller's custom domain for link generation
  }, []);

  useEffect(() => {
    if (!resellerId) return;
    if (!reseller) fetchResellers();
    api.get(`/rs/product-prices?reseller_id=${resellerId}`)
      .then((data: any) => {
        if (Array.isArray(data)) {
          const prices: Record<string, number> = {};
          data.forEach((d: any) => { prices[d.product_id] = Number(d.custom_price); });
          setCustomPrices(prices);
        }
      }).catch(() => {});
  }, [resellerId]);

  const filterProducts = (list: any[]) =>
    list.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const handleOrder = (product: any) => {
    const sellingPrice = customPrices[product.id] || product.price;
    navigate('/reseller/place-order', { state: { products: [{ product, qty: 1, sellingPrice }] } });
  };

  const handleCopyLink = (product: any) => {
    const slug = product.slug;
    // Use custom domain if reseller has one that is verified
    const link = (customDomain && customDomain.status === 'verified')
      ? `https://${customDomain.domain}/product/${slug}`
      : `${window.location.origin}/r/${serialNumber || resellerId}/product/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(product.id);
      toast({ title: 'লিংক কপি হয়েছে!' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSavePrice = async () => {
    if (!editingProduct || !editPrice) return;
    const price = Number(editPrice);
    if (isNaN(price) || price <= 0) {
      toast({ title: 'সঠিক দাম দিন', variant: 'destructive' });
      return;
    }
    await api.post('/rs/product-prices', { reseller_id: resellerId, product_id: editingProduct.id, custom_price: price });
    setCustomPrices(prev => ({ ...prev, [editingProduct.id]: price }));
    toast({ title: 'দাম সেভ হয়েছে!' });
    setEditingProduct(null);
  };

  const renderProductCard = (product: any) => {
    const resellerPrice = product.resellerPrice || product.price;
    const sellingPrice = customPrices[product.id] || product.price;
    return (
      <Card key={product.id} className="border-0 shadow-sm overflow-hidden group">
        <div className="aspect-square overflow-hidden bg-muted relative">
          <img
            src={product.featuredImage || (Array.isArray(product.images) ? product.images[0] : '') || '/placeholder.svg'}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium text-foreground line-clamp-2">{product.title}</p>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">রিসেলার প্রাইস: ৳{resellerPrice}</p>
            <div className="flex items-center gap-1">
              <p className="text-lg font-bold text-primary">৳{sellingPrice}</p>
              <button
                className="text-muted-foreground hover:text-primary"
                onClick={() => { setEditingProduct(product); setEditPrice(String(sellingPrice)); }}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => handleOrder(product)}>
              <ShoppingCart className="h-3.5 w-3.5" /> অর্ডার
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 px-2"
              onClick={() => handleCopyLink(product)}
            >
              {copiedId === product.id ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">লিংক</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const filteredOwn = filterProducts(products);
  const filteredMohasagor = filterProducts(
    selectedCategory === 'all'
      ? mohasagorProducts
      : mohasagorProducts.filter((p) => p.category === selectedCategory),
  );
  const allTabProducts = filteredMohasagor;

  // Reset pagination when tab/category/search changes
  useEffect(() => {
    setVisibleCount(12);
  }, [activeTab, selectedCategory, search]);

  const currentList = activeTab === 'all' ? allTabProducts : filteredOwn;
  const visibleList = currentList.slice(0, visibleCount);
  const hasMore = visibleCount < currentList.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">শপ পেজ</h1>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="প্রোডাক্ট খুঁজুন..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">সব প্রোডাক্ট ({allTabProducts.length})</TabsTrigger>
          <TabsTrigger value="trending">ট্রেন্ডিং প্রোডাক্ট ({filteredOwn.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {mohasagorCategories.length > 0 && !mohasagorError && (
            <ScrollArea className="w-full mb-4">
              <div className="flex gap-2 pb-2">
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                  className="whitespace-nowrap"
                >
                  সব ({mohasagorProducts.length})
                </Button>
                {mohasagorCategories.map((cat) => {
                  const count = mohasagorProducts.filter((p) => p.category === cat).length;
                  return (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat)}
                      className="whitespace-nowrap"
                    >
                      {cat} ({count})
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          {mohasagorLoading && mohasagorProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>
          ) : (
            <div className="space-y-4">

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleList.map((p) => renderProductCard(p))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    size="lg"
                    className="rounded-full px-8"
                    onClick={() => setVisibleCount((c) => c + 8)}
                  >
                    আরও দেখুন ({currentList.length - visibleCount}টি বাকি)
                  </Button>
                </div>
              )}
              {currentList.length === 0 && (
                <p className="text-center text-muted-foreground py-8">কোন প্রোডাক্ট পাওয়া যায়নি</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleList.map((p) => renderProductCard(p))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                className="rounded-full px-8"
                onClick={() => setVisibleCount((c) => c + 8)}
              >
                আরও দেখুন ({currentList.length - visibleCount}টি বাকি)
              </Button>
            </div>
          )}
          {filteredOwn.length === 0 && <p className="text-center text-muted-foreground py-8">কোন প্রোডাক্ট পাওয়া যায়নি</p>}
        </TabsContent>
      </Tabs>

      {/* Edit Price Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>সেলিং প্রাইস সেট করুন</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editingProduct.title}</p>
              <p className="text-sm">রিসেলার প্রাইস: <span className="font-bold">৳{editingProduct.resellerPrice || editingProduct.price}</span></p>
              <div className="space-y-2">
                <Label>আপনার সেলিং প্রাইস</Label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="সেলিং প্রাইস"
                />
              </div>
              {Number(editPrice) > (editingProduct.resellerPrice || editingProduct.price) && (
                <p className="text-sm text-green-600 font-medium">
                  আপনার লাভ: ৳{Number(editPrice) - (editingProduct.resellerPrice || editingProduct.price)}
                </p>
              )}
              <Button className="w-full" onClick={handleSavePrice}>সেভ করুন</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResellerShop;
