import { useNavigate, Link } from 'react-router-dom';
import { useDigitalCartStore } from '@/stores/useDigitalCartStore';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

const DigitalCart = () => {
  const navigate = useNavigate();
  const { items, remove, updateQty, totalPrice } = useDigitalCartStore();
  const userId = useDigitalAuthStore((s) => s.userId);

  const handleCheckout = () => {
    if (items.length === 0) return;
    sessionStorage.setItem(
      'digital_checkout_cart',
      JSON.stringify({
        items: items.map((i) => ({
          id: i.productId, title: i.title, slug: i.slug, price: i.price, qty: i.qty,
        })),
        total: totalPrice(),
      }),
    );
    sessionStorage.removeItem('digital_checkout_product');
    navigate(userId ? '/digital/payment' : '/digital/checkout');
  };

  return (
    <>
      <SEOHead title="ডিজিটাল কার্ট" description="আপনার নির্বাচিত ডিজিটাল প্রডাক্টসমূহ" />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-primary" /> ডিজিটাল কার্ট
          </h1>
          <Link to="/digital-products" className="text-sm text-primary flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-4 w-4" /> আরও কিনুন
          </Link>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              কার্টে কোনো প্রডাক্ট নেই।
              <div className="mt-4">
                <Button onClick={() => navigate('/digital-products')}>শপে যান</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.productId}>
                  <CardContent className="p-3 flex gap-3 items-center">
                    <img src={item.image || '/placeholder.svg'} alt={item.title} className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/digital-product/${item.slug}`} className="font-semibold hover:text-primary line-clamp-1">{item.title}</Link>
                      <p className="text-primary font-bold mt-1">৳{item.price}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(item.productId, item.qty - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.qty}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(item.productId, item.qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(item.productId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-lg font-semibold">মোট</span>
                <span className="text-2xl font-extrabold text-primary">৳{totalPrice()}</span>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full mt-4 h-14 text-base font-bold bg-gradient-to-r from-primary to-secondary shadow-lg" onClick={handleCheckout}>
              চেকআউট ({items.length} আইটেম)
            </Button>
          </>
        )}
      </div>
    </>
  );
};

export default DigitalCart;
