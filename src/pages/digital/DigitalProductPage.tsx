import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDigitalProductStore, type DigitalProduct } from '@/stores/useDigitalProductStore';
import { useDigitalAuthStore } from '@/stores/useDigitalAuthStore';
import { useDigitalCartStore } from '@/stores/useDigitalCartStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, ShieldCheck, Download, Link2, Sparkles, Clock, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';

const DigitalProductPage = () => {
  const userId = useDigitalAuthStore((s) => s.userId);
  const initAuth = useDigitalAuthStore((s) => s.init);
  useEffect(() => { const unsub = initAuth(); return unsub; }, [initAuth]);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { products, fetch, fetchBySlug, getBySlug } = useDigitalProductStore();
  const addToCart = useDigitalCartStore((s) => s.add);
  const cartCount = useDigitalCartStore((s) => s.totalItems());
  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const cached = getBySlug(slug);
    if (cached) setProduct(cached);
    fetchBySlug(slug).then((p) => { setProduct(p); setLoading(false); });
    fetch();
  }, [slug]);

  if (loading && !product) {
    return <div className="container mx-auto p-10 text-center">লোড হচ্ছে...</div>;
  }
  if (!product) {
    return <div className="container mx-auto p-10 text-center">প্রডাক্ট পাওয়া যায়নি</div>;
  }

  const handleBuy = () => {
    sessionStorage.setItem('digital_checkout_product', JSON.stringify({
      id: product.id, title: product.title, slug: product.slug, price: product.price,
    }));
    sessionStorage.removeItem('digital_checkout_cart');
    navigate(userId ? '/digital/payment' : '/digital/checkout');
  };

  const handleAddToCart = () => {
    addToCart({
      productId: product.id, slug: product.slug, title: product.title,
      price: product.price, image: product.featuredImage,
    });
    toast.success('কার্টে যোগ হয়েছে');
  };

  const related = products
    .filter((p) => p.status === 'published' && p.id !== product.id)
    .slice(0, 10);

  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <>
      <SEOHead
        title={`${product.title} | ডিজিটাল প্রডাক্ট`}
        description={product.metaDescription || product.shortDescription}
        ogType="product"
        ogImage={product.featuredImage}
      />
      <div className="bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container-box py-6 md:py-10 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6 md:gap-10">
            <div className="relative">
              <div className="sticky top-24">
                <div className="relative rounded-2xl overflow-hidden border-2 border-primary/10 shadow-xl bg-card">
                  <img
                    src={product.featuredImage || '/placeholder.svg'}
                    alt={product.title}
                    className="w-full aspect-square object-cover"
                  />
                  {discount > 0 && (
                    <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground rounded-full px-3 py-1 text-sm font-bold shadow-lg">
                      -{discount}%
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <Badge className="bg-primary/15 text-primary border-0 hover:bg-primary/20">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> ডিজিটাল প্রডাক্ট
              </Badge>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">{product.title}</h1>

              {product.shortDescription && (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:h-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block [&_table]:overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: product.shortDescription }}
                />
              )}

              <div className="flex items-baseline gap-3 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                <span className="text-4xl font-extrabold text-primary">৳{product.price}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-lg line-through text-muted-foreground">৳{product.originalPrice}</span>
                )}
                {discount > 0 && (
                  <span className="ml-auto bg-destructive/10 text-destructive text-xs font-bold px-2 py-1 rounded">
                    সেভ ৳{(product.originalPrice! - product.price)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(product.productType === 'file' || product.productType === 'both') && (
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50 border">
                    <Download className="h-5 w-5 text-primary mb-1" />
                    <span className="font-medium">ইনস্ট্যান্ট ডাউনলোড</span>
                  </div>
                )}
                {(product.productType === 'link' || product.productType === 'both') && (
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50 border">
                    <Link2 className="h-5 w-5 text-primary mb-1" />
                    <span className="font-medium">অ্যাক্সেস লিংক</span>
                  </div>
                )}
                <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50 border">
                  <ShieldCheck className="h-5 w-5 text-primary mb-1" />
                  <span className="font-medium">সুরক্ষিত পেমেন্ট</span>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50 border">
                  <Clock className="h-5 w-5 text-primary mb-1" />
                  <span className="font-medium">দ্রুত ডেলিভারি</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 text-base font-bold border-2 border-primary text-primary hover:bg-primary/10"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" /> কার্টে যোগ করুন
                </Button>
                <Button
                  size="lg"
                  className="h-14 text-base font-bold shadow-lg hover:shadow-xl bg-gradient-to-r from-primary to-secondary hover:opacity-95 transition-all"
                  onClick={handleBuy}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" /> এখনই কিনুন
                </Button>
              </div>
              {cartCount > 0 && (
                <Link to="/digital/cart" className="block text-center text-sm text-primary font-semibold hover:underline">
                  কার্ট দেখুন ({cartCount} আইটেম) →
                </Link>
              )}
            </div>
          </div>

          {product.longDescription && (
            <div className="mt-10 p-5 md:p-8 rounded-2xl bg-card border shadow-sm">
              <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full" /> বিস্তারিত
              </h2>
              <div className="prose prose-sm md:prose-base max-w-none break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:h-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block [&_table]:overflow-x-auto" dangerouslySetInnerHTML={{ __html: product.longDescription }} />
            </div>
          )}

          {related.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                  <span className="w-1 h-6 bg-primary rounded-full" /> রিলেটেড প্রডাক্ট
                </h2>
                <Link to="/digital-products" className="text-sm text-primary font-medium hover:underline">সব দেখুন →</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                {related.map((p) => (
                  <Link key={p.id} to={`/digital-product/${p.slug}`}>
                    <Card className="overflow-hidden h-full hover:shadow-lg transition-all hover:-translate-y-0.5 group">
                      <div className="aspect-square overflow-hidden bg-muted">
                        <img
                          src={p.featuredImage || '/placeholder.svg'}
                          alt={p.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5 md:p-3">
                        <h3 className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-base md:text-lg font-bold text-primary">৳{p.price}</span>
                          {p.originalPrice && p.originalPrice > p.price && (
                            <span className="text-xs line-through text-muted-foreground">৳{p.originalPrice}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default DigitalProductPage;
